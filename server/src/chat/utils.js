/**
 * Helpers chat — module feuille SANS import (évite tout cycle avec lobby/service.js).
 * Stocké dans room.chat : { version, seq, messages, lastSentAt }
 * Message : { id, at, kind: 'player' | 'system', playerId?, pseudo?, text }
 */

export const CHAT_HISTORY_LIMIT = 100;
export const CHAT_EXPOSE_LIMIT = 50;

/** Initialise room.chat si absent (compat anciennes rooms Redis). */
export function ensureChat(room) {
  if (!room.chat || typeof room.chat !== 'object') {
    room.chat = { version: 1, seq: 0, messages: [], lastSentAt: {} };
  }
  if (!Array.isArray(room.chat.messages)) room.chat.messages = [];
  if (typeof room.chat.seq !== 'number') room.chat.seq = room.chat.messages.length;
  if (typeof room.chat.version !== 'number') room.chat.version = 1;
  if (!room.chat.lastSentAt || typeof room.chat.lastSentAt !== 'object') room.chat.lastSentAt = {};
  return room.chat;
}

function trimHistory(chat) {
  if (chat.messages.length > CHAT_HISTORY_LIMIT) {
    chat.messages = chat.messages.slice(-CHAT_HISTORY_LIMIT);
  }
}

/** Pousse un message système (italique côté client). Synchrone. */
export function pushSystemMessage(room, text) {
  const chat = ensureChat(room);
  const clean = String(text ?? '').trim().slice(0, 200);
  if (!clean) return null;
  chat.seq += 1;
  const msg = { id: `s${chat.seq}`, at: Date.now(), kind: 'system', text: clean };
  chat.messages.push(msg);
  trimHistory(chat);
  chat.version += 1;
  room.version += 1;
  return msg;
}

/** Vue publique (50 derniers, sans rate-map). */
export function publicChat(room, limit = CHAT_EXPOSE_LIMIT) {
  const chat = ensureChat(room);
  return { version: chat.version, messages: chat.messages.slice(-limit).map((m) => ({ ...m })) };
}
