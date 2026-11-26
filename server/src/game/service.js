import { ServiceError } from '../lobby/service.js';
import { publicChat, pushSystemMessage } from '../chat/utils.js';
import { CITIES, cityDetail, isCity, rentDue } from './cities.js';

/**
 * Moteur de jeu MVP — déplacement + achat de villes libres (aucun autre effet).
 * Autoritaire serveur, transport-agnostique (Express local + Vercel serverless).
 *
 * État stocké dans room.game :
 * {
 *   status: 'PLAYING',
 *   gid, order: [playerId...],      // ordre aléatoire fixe
 *   currentIndex: 0,
 *   players: { [id]: { id, pseudo, color, square, money } },
 *   ownership: { [square]: { ownerId } },
 *   pending: { type: 'buy', playerId, square } | null,  // choix passer/acheter en attente
 *   lastRoll: { playerId, d1, d2, total, from, to, isDouble, doublesCount, mustRollAgain, sentToPrison } | null,
 *   version: 1                 // incrémenté à chaque lancer (détection de changement via polling)
 * }
 */

export const BOARD_SIZE = 56;
export const START_MONEY = 200000;
/** Gain en passant par (ou en s'arrêtant sur) la case Départ. */
export const START_BONUS = 25000;
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

/** Le déplacement traverse-t-il (ou termine-t-il sur) la case Départ ? */
function passesStart(from, total) {
  return total > 0 && from + total >= BOARD_SIZE;
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
      money: START_MONEY,
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
    ownership: {},
    pending: null,
    lastRoll: null,
    version: 1,
  };
  return room.game;
}

function findPlayerByToken(room, token) {
  return room.players.find((p) => p.token === token) ?? null;
}

/** Filet compat : parties créées avant l'économie (money/ownership/pending). */
function ensureEconomy(g) {
  if (!g.ownership || typeof g.ownership !== 'object') g.ownership = {};
  if (!('pending' in g) || (g.pending !== null && typeof g.pending !== 'object')) g.pending = null;
  for (const p of Object.values(g.players)) {
    if (typeof p.money !== 'number') p.money = START_MONEY;
  }
}

/** Passe au joueur suivant (ordre fixe). */
export function advanceTurn(room) {
  const g = room.game;
  if (!g || g.order.length === 0) return;
  g.currentIndex = (g.currentIndex + 1) % g.order.length;
}

/**
 * Retire un joueur de la partie en cours (départ/expulsion) : ordre, index et
 * pending nettoyés pour ne jamais bloquer la partie. Appelé par le salon.
 */
export function removeFromGame(room, playerId) {
  const g = room.game;
  if (!g) return;
  delete g.players[playerId];
  const idx = g.order.indexOf(playerId);
  if (idx !== -1) {
    g.order.splice(idx, 1);
    if (g.order.length === 0) {
      g.currentIndex = 0;
    } else {
      if (idx < g.currentIndex) g.currentIndex -= 1;
      g.currentIndex %= g.order.length;
    }
  }
  if (g.pending?.playerId === playerId) g.pending = null;
  g.version += 1;
  room.version += 1;
}

/** Résumé des propriétés pour le plateau : { [square]: { ownerId, price, rent } }. */
export function publicProperties(room) {
  const g = room.game;
  if (!g) return {};
  const out = {};
  for (const sq of Object.keys(g.ownership)) {
    const detail = cityDetail(Number(sq), g.ownership);
    if (detail) out[sq] = { ownerId: detail.ownerId, price: detail.price, rent: detail.currentRent };
  }
  // Cases libres : prix affiché = prix d'achat (loyer de base en info).
  for (const sq of Object.keys(CITIES)) {
    if (!out[sq]) {
      const detail = cityDetail(Number(sq), g.ownership);
      out[sq] = { ownerId: null, price: detail.price, rent: detail.baseRent };
    }
  }
  return out;
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
    ownership: Object.fromEntries(Object.entries(g.ownership ?? {}).map(([sq, o]) => [sq, { ...o }])),
    properties: publicProperties(room),
    pending: g.pending ? { ...g.pending, detail: cityDetail(g.pending.square, g.ownership ?? {}) } : null,
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
 *   prison (PRISON_SQUARE), tour suivant.
 * - arrivée sur une ville libre -> pending 'buy' (passer/acheter) : le tour
 *   n'avance qu'à la résolution. Relancer avant = PENDING_BUY.
 */
export function rollDice(room, { token, randomFn = Math.random } = {}) {
  if (!room.game) throw new ServiceError('GAME_NOT_STARTED', 409);
  const me = findPlayerByToken(room, token);
  if (!me) throw new ServiceError('NOT_IN_ROOM', 403);
  const g = room.game;
  ensureEconomy(g);
  if (g.pending) throw new ServiceError('PENDING_BUY', 409);
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
    advanceTurn(room);
  } else if (isDouble) {
    mustRollAgain = true;
  } else {
    mustRollAgain = false;
  }

  // Bonus case Départ : traversée ou arrêt pile sur la case 0. Exclu en cas
  // d'envoi forcé en prison (3 doubles).
  const passedStart = !sentToPrison && passesStart(from, total);

  g.players[me.id].square = to;
  if (passedStart) g.players[me.id].money += START_BONUS;

  // Loyer : atterrissage sur la ville d'un autre joueur. Le montant est doublé
  // si le propriétaire possède toutes les villes du pays (rentDue/currentRent).
  let rentPayment = null;
  if (!sentToPrison) {
    const due = rentDue(to, g.ownership, me.id);
    const owner = due ? g.players[due.ownerId] ?? null : null;
    if (due && owner) {
      const payer = g.players[me.id];
      const amount = Math.min(due.amount, Math.max(0, payer.money ?? 0));
      if (amount > 0) {
        payer.money -= amount;
        owner.money += amount;
      }
      rentPayment = {
        payerId: me.id,
        ownerId: due.ownerId,
        ownerPseudo: owner.pseudo,
        amount,
        due: due.amount,
      };
    }
  }

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
    passedStart,
    startBonus: passedStart ? START_BONUS : 0,
    rentPayment,
  };

  // Ville libre -> choix passer/acheter, le tour attend la résolution.
  // Note : la prison a déjà avancé le tour dans sa branche (un seul avancement).
  if (!sentToPrison && isCity(to) && !g.ownership[to]?.ownerId) {
    g.pending = { type: 'buy', playerId: me.id, square: to };
  } else if (!mustRollAgain && !sentToPrison) {
    advanceTurn(room);
  }
  g.version += 1;
  room.version += 1;

  // Message système (italique côté client) : « Riri a fait 7 (3 + 4). »
  const roller = g.players[me.id];
  let rollText = `${roller.pseudo} a fait ${total} (${d1} + ${d2}).`;
  if (sentToPrison) rollText += ' Direction prison !';
  else if (mustRollAgain) rollText += ' Double, rejoue !';
  pushSystemMessage(room, rollText);

  if (passedStart) {
    const where = to === 0 ? 'arrive sur la case Départ' : 'passe par la case Départ';
    pushSystemMessage(room, `${roller.pseudo} ${where} et reçoit ${START_BONUS.toLocaleString('fr-FR')}€.`);
  }

  if (rentPayment) {
    if (rentPayment.amount > 0) {
      let rentText = `${roller.pseudo} a payé ${rentPayment.amount.toLocaleString('fr-FR')}€ de loyer à ${rentPayment.ownerPseudo}`;
      if (rentPayment.amount < rentPayment.due) rentText += ' (solde insuffisant)';
      pushSystemMessage(room, `${rentText}.`);
    } else {
      pushSystemMessage(
        room,
        `${roller.pseudo} n'a pas assez pour payer le loyer de ${rentPayment.due.toLocaleString('fr-FR')}€ à ${rentPayment.ownerPseudo}.`
      );
    }
  }

  return { d1, d2, total, game: publicGame(room, me.id), chat: publicChat(room) };
}

/**
 * Résout le choix passer/acheter après arrivée sur une ville libre.
 * choice: 'buy' | 'pass'. Seul le joueur concerné peut répondre.
 * Retourne { game, chat }. Améliorations / vente / loyers : hors périmètre.
 */
export function resolveBuy(room, { token, choice } = {}) {
  if (!room.game) throw new ServiceError('GAME_NOT_STARTED', 409);
  const me = findPlayerByToken(room, token);
  if (!me) throw new ServiceError('NOT_IN_ROOM', 403);
  const g = room.game;
  ensureEconomy(g);
  const pending = g.pending;
  if (!pending || pending.type !== 'buy') throw new ServiceError('NO_PENDING', 409);
  if (me.id !== pending.playerId) throw new ServiceError('NOT_YOUR_TURN', 403);
  if (choice !== 'buy' && choice !== 'pass') throw new ServiceError('INVALID_CHOICE', 400);
  const detail = cityDetail(pending.square, g.ownership);
  if (!detail) throw new ServiceError('NOT_A_CITY', 409);
  if (g.ownership[pending.square]?.ownerId) throw new ServiceError('ALREADY_OWNED', 409);

  const player = g.players[me.id];
  if (choice === 'buy') {
    if (player.money < detail.price) throw new ServiceError('NOT_ENOUGH_MONEY', 409);
    player.money -= detail.price;
    g.ownership[pending.square] = { ownerId: me.id };
    pushSystemMessage(room, `${player.pseudo} a acheté ${detail.nom} pour ${detail.price.toLocaleString('fr-FR')}€.`);
  } else {
    pushSystemMessage(room, `${player.pseudo} n'achète pas ${detail.nom}.`);
  }

  g.pending = null;
  // Fin du tour sauf double (rejouer).
  if (!g.lastRoll?.mustRollAgain) advanceTurn(room);
  g.version += 1;
  room.version += 1;

  return { game: publicGame(room, me.id), chat: publicChat(room) };
}

/** État jeu pour un membre (polling). */
export function getGameState(room, { token } = {}) {
  if (!room.game) throw new ServiceError('GAME_NOT_STARTED', 409);
  const me = findPlayerByToken(room, token);
  if (!me) throw new ServiceError('NOT_IN_ROOM', 403);
  return publicGame(room, me.id);
}
