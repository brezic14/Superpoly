import { ServiceError } from '../lobby/service.js';
import { publicChat, pushSystemMessage } from '../chat/utils.js';

/**
 * Moteur de jeu MVP — déplacement seul (aucun effet de case).
 * Autoritaire serveur, transport-agnostique (Express local + Vercel serverless).
 *
 * État stocké dans room.game :
 * {
 *   status: 'PLAYING',
 *   order: [playerId...],      // ordre aléatoire fixe
 *   currentIndex: 0,
 *   players: { [id]: { id, pseudo, color, square } },
 *   lastRoll: { playerId, d1, d2, total, from, to, isDouble, doublesCount, mustRollAgain, sentToPrison } | null,
 *   version: 1                 // incrémenté à chaque lancer (détection de changement via polling)
 * }
 */

export const BOARD_SIZE = 56;
export const START_MONEY = 200000;
/** Case "simple visite / prison" (coin haut-gauche du plateau visuel). */
export const PRISON_SQUARE = 7;

export const PION_COLORS = ['#FF0000', '#1E6FFF', '#00C800', '#FFD800', '#FF00FF'];

function shuffle(arr, randomFn = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rollDie(randomFn = Math.random) {
  return 1 + Math.floor(randomFn() * 6);
}

/** Initialise room.game au démarrage (ordre mélangé, tous case 0). */
export function initGame(room, randomFn = Math.random) {
  const order = shuffle(room.players.map((p) => p.id), randomFn);
  const players = {};
  order.forEach((id, idx) => {
    const lobbyPlayer = room.players.find((p) => p.id === id);
    players[id] = {
      id,
      pseudo: lobbyPlayer ? lobbyPlayer.pseudo : `Joueur ${idx + 1}`,
      color: PION_COLORS[idx % PION_COLORS.length],
      square: 0,
    };
  });
  // gid : identifiant de partie, incrémenté à chaque démarrage dans ce salon.
  // Permet au client de distinguer une nouvelle partie (versions repartent à 1)
  // d'une réponse réseau périmée (à ignorer).
  const gid = (room.gidCounter = (room.gidCounter ?? 0) + 1);
  room.game = {
    status: 'PLAYING',
    gid,
    order,
    currentIndex: 0,
    players,
    lastRoll: null,
    version: 1,
  };
  return room.game;
}

function findPlayerByToken(room, token) {
  return room.players.find((p) => p.token === token) ?? null;
}

/** Vue publique du jeu (aucun token). */
export function publicGame(room, myPlayerId = null) {
  const g = room.game;
  if (!g) return null;
  const currentPlayerId = g.order[g.currentIndex] ?? null;
  return {
    status: g.status,
    gid: g.gid ?? 0,
    order: g.order.slice(),
    currentIndex: g.currentIndex,
    currentPlayerId,
    players: Object.values(g.players).map((p) => ({ ...p })),
    lastRoll: g.lastRoll ? { ...g.lastRoll } : null,
    version: g.version,
    myPlayerId,
    isMyTurn: myPlayerId ? myPlayerId === currentPlayerId : false,
  };
}

/**
 * Lancer de dés autoritaire. Seul le joueur dont c'est le tour peut lancer.
 * - square mis à jour directement vers la case d'arrivée (l'animation
 *   case-par-case est purement visuelle côté client, cf board.md).
 * - double -> mustRollAgain, même joueur rejoue. 3 doubles d'affilée ->
 *   prison (PRISON_SQUARE), tour suivant. Aucun autre effet de case en MVP.
 */
export function rollDice(room, { token, randomFn = Math.random } = {}) {
  if (!room.game) throw new ServiceError('GAME_NOT_STARTED', 409);
  const me = findPlayerByToken(room, token);
  if (!me) throw new ServiceError('NOT_IN_ROOM', 403);
  const g = room.game;
  const currentPlayerId = g.order[g.currentIndex];
  if (me.id !== currentPlayerId) throw new ServiceError('NOT_YOUR_TURN', 403);

  const d1 = rollDie(randomFn);
  const d2 = rollDie(randomFn);
  const total = d1 + d2;
  const isDouble = d1 === d2;
  const prevDoubles = g.lastRoll && g.lastRoll.playerId === me.id ? g.lastRoll.doublesCount : 0;
  const doublesCount = isDouble ? prevDoubles + 1 : 0;
  const from = g.players[me.id].square;

  let to = (from + total) % BOARD_SIZE;
  let mustRollAgain = false;
  let sentToPrison = false;

  if (isDouble && doublesCount >= 3) {
    // 3 doubles dans le même tour -> prison immédiate, tour suivant.
    to = PRISON_SQUARE;
    sentToPrison = true;
    mustRollAgain = false;
    g.currentIndex = (g.currentIndex + 1) % g.order.length;
  } else if (isDouble) {
    mustRollAgain = true;
  } else {
    mustRollAgain = false;
    g.currentIndex = (g.currentIndex + 1) % g.order.length;
  }

  g.players[me.id].square = to;
  g.lastRoll = {
    playerId: me.id,
    d1,
    d2,
    total,
    from,
    to,
    isDouble,
    doublesCount,
    mustRollAgain,
    sentToPrison,
  };
  g.version += 1;
  room.version += 1;

  // Message système (italique côté client) : « Riri a fait 7 (3 + 4). »
  const roller = g.players[me.id];
  let rollText = `${roller.pseudo} a fait ${total} (${d1} + ${d2}).`;
  if (sentToPrison) rollText += ' Direction prison !';
  else if (mustRollAgain) rollText += ' Double, rejoue !';
  pushSystemMessage(room, rollText);

  return { d1, d2, total, game: publicGame(room, me.id), chat: publicChat(room) };
}

/** État jeu pour un membre (polling). */
export function getGameState(room, { token } = {}) {
  if (!room.game) throw new ServiceError('GAME_NOT_STARTED', 409);
  const me = findPlayerByToken(room, token);
  if (!me) throw new ServiceError('NOT_IN_ROOM', 403);
  return publicGame(room, me.id);
}
