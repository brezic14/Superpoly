import { MAX_PLAYERS, NAME_MAX, NAME_MIN } from '../config.js';
import { ensureChat, publicChat, pushSystemMessage } from '../chat/utils.js';
import {
  generateCode,
  generatePlayerId,
  generatePlayerToken,
  normalizeCode,
  normalizeName,
} from './code.js';

/**
 * Logique métier du salon (transport-agnostique : utilisée par Express en local
 * et par les fonctions serverless /api sur Vercel — option B, pas de socket).
 *
 * Room stockée : { code, maxPlayers, status, players, createdAt, version }
 * Player stocké : { id, pseudo, token(secret), isHost, joinedAt }
 */

export const ERRORS = {
  INVALID_NAME: `Pseudo invalide (entre ${NAME_MIN} et ${NAME_MAX} caractères).`,
  INVALID_CODE: 'Code invalide (format attendu : # + 6 lettres/chiffres, ex #212A4B).',
  ROOM_NOT_FOUND: 'Salon introuvable. Vérifie le code.',
  ROOM_FULL: 'Salon complet (5 joueurs max).',
  PSEUDO_TAKEN: 'Ce pseudo est déjà pris dans ce salon.',
  NOT_IN_ROOM: "Tu n'es pas dans ce salon.",
  NOT_HOST: 'Seul l’hôte peut faire ça.',
  CANNOT_KICK_HOST: "On ne peut pas expulser l'hôte.",
  TARGET_NOT_FOUND: 'Joueur introuvable.',
  NEED_1_PLAYER: 'Il faut au moins 1 joueur pour démarrer.',
  ALREADY_STARTED: 'La partie a déjà démarré.',
  GAME_NOT_STARTED: 'La partie n’a pas encore démarré.',
  NOT_YOUR_TURN: 'Ce n’est pas à toi de jouer.',
  CHAT_EMPTY: 'Message vide.',
  CHAT_TOO_LONG: 'Message trop long (200 caractères max).',
  CHAT_RATE_LIMIT: 'Doucement, un message à la fois.',
};

export class ServiceError extends Error {
  constructor(key, status = 400) {
    super(ERRORS[key] ?? 'Erreur inconnue.');
    this.key = key;
    this.status = status;
  }
}

/** Vue publique d'un salon (token jamais exposé). */
export function publicRoom(room) {
  const players = room.players
    .slice()
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({ id: p.id, pseudo: p.pseudo, isHost: p.isHost, joinedAt: p.joinedAt }));
  const out = {
    code: room.code,
    maxPlayers: room.maxPlayers,
    status: room.status,
    version: room.version,
    players,
    hostId: players.find((p) => p.isHost)?.id ?? null,
    chat: publicChat(room),
  };
  // Expose un résumé du jeu (positions, tour courant) sans token, pour le polling
  // unique salon+jeu côté client. Le détail complet passe par publicGame().
  if (room.game) {
    const g = room.game;
    out.game = {
      status: g.status,
      order: g.order.slice(),
      currentIndex: g.currentIndex,
      currentPlayerId: g.order[g.currentIndex] ?? null,
      players: Object.values(g.players).map((p) => ({ ...p })),
      lastRoll: g.lastRoll ? { ...g.lastRoll } : null,
      version: g.version,
    };
  }
  return out;
}

/** Payload minimal pour initialiser le futur Player métier (200 000€, case départ...). */
export function toGamePlayers(room) {
  return room.players.map((p) => ({ pseudo: p.pseudo, money: 200000, square: 0, lapDone: 0 }));
}

function findPlayer(room, token) {
  return room.players.find((p) => p.token === token) ?? null;
}

function promoteOldestIfNeeded(room) {
  if (!room.players.some((p) => p.isHost) && room.players.length > 0) {
    room.players.sort((a, b) => a.joinedAt - b.joinedAt);
    room.players[0].isHost = true;
  }
}

async function uniqueCode(store) {
  let code = generateCode();
  let guard = 0;
  while ((await store.exists(code)) && guard < 100) {
    code = generateCode();
    guard += 1;
  }
  return code;
}

/** Crée un salon, le créateur devient hôte. Retourne { room, me }. */
export async function createRoom(store, { name, maxPlayers = MAX_PLAYERS }) {
  const pseudo = normalizeName(name);
  if (!pseudo) throw new ServiceError('INVALID_NAME');
  const code = await uniqueCode(store);
  const now = Date.now();
  const me = { id: generatePlayerId(), pseudo, token: generatePlayerToken(), isHost: true, joinedAt: now };
  const room = { code, maxPlayers, status: 'WAITING', players: [me], createdAt: now, version: 1 };
  ensureChat(room);
  await store.save(room);
  return { room: publicRoom(room), me: { id: me.id, token: me.token, pseudo: me.pseudo } };
}

/** Rejoint un salon via code. Retourne { room, me }. */
export async function joinRoom(store, { code: rawCode, name }) {
  const code = normalizeCode(rawCode);
  if (!code) throw new ServiceError('INVALID_CODE');
  const pseudo = normalizeName(name);
  if (!pseudo) throw new ServiceError('INVALID_NAME');
  const room = await store.get(code);
  if (!room) throw new ServiceError('ROOM_NOT_FOUND', 404);
  if (room.status !== 'WAITING') throw new ServiceError('ALREADY_STARTED', 409);
  if (room.players.length >= room.maxPlayers) throw new ServiceError('ROOM_FULL', 409);
  if (room.players.some((p) => p.pseudo.toLowerCase() === pseudo.toLowerCase())) {
    throw new ServiceError('PSEUDO_TAKEN', 409);
  }
  const me = { id: generatePlayerId(), pseudo, token: generatePlayerToken(), isHost: false, joinedAt: Date.now() };
  room.players.push(me);
  room.version += 1;
  pushSystemMessage(room, `${me.pseudo} a rejoint le salon.`);
  await store.save(room);
  return { room: publicRoom(room), me: { id: me.id, token: me.token, pseudo: me.pseudo } };
}

/** État du salon pour un membre (inclut mon identité + flag hôte). */
export async function getState(store, { code: rawCode, token }) {
  const code = normalizeCode(rawCode);
  if (!code) throw new ServiceError('INVALID_CODE');
  const room = await store.get(code);
  if (!room) throw new ServiceError('ROOM_NOT_FOUND', 404);
  const me = findPlayer(room, token);
  if (!me) throw new ServiceError('NOT_IN_ROOM', 403);
  return { ...publicRoom(room), myPlayerId: me.id, isHost: me.isHost };
}

/** Quitte un salon. Si l'hôte quitte, le doyen est promu. */
export async function leaveRoom(store, { code: rawCode, token }) {
  const code = normalizeCode(rawCode);
  if (!code) throw new ServiceError('INVALID_CODE');
  const room = await store.get(code);
  if (!room) throw new ServiceError('ROOM_NOT_FOUND', 404);
  const idx = room.players.findIndex((p) => p.token === token);
  if (idx === -1) throw new ServiceError('NOT_IN_ROOM', 403);
  const leaving = room.players[idx];
  room.players.splice(idx, 1);
  promoteOldestIfNeeded(room);
  room.version += 1;
  if (room.players.length === 0) {
    await store.remove(code);
    return { left: true, roomGone: true, code };
  }
  pushSystemMessage(room, `${leaving.pseudo} a quitté le salon.`);
  await store.save(room);
  return { left: true, roomGone: false, room: publicRoom(room) };
}

/** Expulse un joueur (hôte seul). */
export async function kickPlayer(store, { code: rawCode, token, targetId }) {
  const code = normalizeCode(rawCode);
  if (!code) throw new ServiceError('INVALID_CODE');
  const room = await store.get(code);
  if (!room) throw new ServiceError('ROOM_NOT_FOUND', 404);
  const me = findPlayer(room, token);
  if (!me) throw new ServiceError('NOT_IN_ROOM', 403);
  if (!me.isHost) throw new ServiceError('NOT_HOST', 403);
  const target = room.players.find((p) => p.id === targetId);
  if (!target) throw new ServiceError('TARGET_NOT_FOUND', 404);
  if (target.isHost) throw new ServiceError('CANNOT_KICK_HOST', 403);
  room.players = room.players.filter((p) => p.id !== targetId);
  room.version += 1;
  pushSystemMessage(room, `${target.pseudo} a été expulsé par ${me.pseudo}.`);
  await store.save(room);
  return { room: publicRoom(room), kickedId: targetId };
}

/** Démarre la partie (hôte seul, >= 1 joueur). */
export async function startRoom(store, { code: rawCode, token }) {
  const code = normalizeCode(rawCode);
  if (!code) throw new ServiceError('INVALID_CODE');
  const room = await store.get(code);
  if (!room) throw new ServiceError('ROOM_NOT_FOUND', 404);
  const me = findPlayer(room, token);
  if (!me) throw new ServiceError('NOT_IN_ROOM', 403);
  if (!me.isHost) throw new ServiceError('NOT_HOST', 403);
  if (room.status !== 'WAITING') throw new ServiceError('ALREADY_STARTED', 409);
  if (room.players.length < 1) throw new ServiceError('NEED_1_PLAYER', 409);
  room.status = 'STARTING';
  // Initialise le moteur de jeu : ordre aléatoire fixe, tous case 0, couleurs.
  const { initGame } = await import('../game/service.js');
  initGame(room);
  room.version += 1;
  pushSystemMessage(room, 'La partie démarre ! Bonne chance à tous.');
  await store.save(room);
  // Futur pont vers Game métier : ordre / 200 000€ gérés à l'étape plateau.
  return { ...publicRoom(room), gamePlayers: toGamePlayers(room) };
}
