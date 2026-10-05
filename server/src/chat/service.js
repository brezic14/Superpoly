import { ServiceError } from '../lobby/service.js';
import { ensureChat, publicChat } from './utils.js';

export const CHAT_MAX_LENGTH = 200;
export const CHAT_MIN_INTERVAL_MS = 1000;

export { publicChat };

/**
 * Poste un message joueur. Synchrone sur l'objet room (l'appelant sauvegarde).
 * Retourne { message, chat }.
 */
export function postChat(room, { token, text } = {}) {
  const me = room.players.find((p) => p.token === token) ?? null;
  if (!me) throw new ServiceError('NOT_IN_ROOM', 403);
  const clean = String(text ?? '').trim();
  if (!clean) throw new ServiceError('CHAT_EMPTY', 400);
  if (clean.length > CHAT_MAX_LENGTH) throw new ServiceError('CHAT_TOO_LONG', 400);
  const chat = ensureChat(room);
  const now = Date.now();
  const last = chat.lastSentAt[me.id] ?? 0;
  if (now - last < CHAT_MIN_INTERVAL_MS) throw new ServiceError('CHAT_RATE_LIMIT', 429);
  chat.seq += 1;
  const message = {
    id: `m${chat.seq}`,
    at: now,
    kind: 'player',
    playerId: me.id,
    pseudo: me.pseudo,
    text: clean.slice(0, CHAT_MAX_LENGTH),
  };
  chat.messages.push(message);
  if (chat.messages.length > 100) chat.messages = chat.messages.slice(-100);
  chat.lastSentAt[me.id] = now;
  chat.version += 1;
  room.version += 1;
  return { message, chat: publicChat(room) };
}
