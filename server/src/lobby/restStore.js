import { ROOM_TTL_SECONDS, UPSTASH_REDIS_REST_TOKEN, UPSTASH_REDIS_REST_URL } from '../config.js';

/**
 * Stockage des salons — abstraction pour être compatible serverless (option B).
 * - Local : MemoryRoomStore (Map en mémoire, pas de dépendance).
 * - Vercel : UpstashRoomStore (Redis via REST, partagé entre les instances serverless).
 *
 * Forme stockée : objet Room sérialisable (voir service.js), clé `superpoly:room:<CODE>`.
 */

const roomKey = (code) => `superpoly:room:${code}`;

export class MemoryRoomStore {
  constructor() {
    this.rooms = new Map();
  }

  async get(code) {
    return this.rooms.get(code) ?? null;
  }

  async exists(code) {
    return this.rooms.has(code);
  }

  async save(room) {
    // Stocke une copie pour éviter les mutations externes.
    this.rooms.set(room.code, JSON.parse(JSON.stringify(room)));
  }

  async remove(code) {
    this.rooms.delete(code);
  }
}

export class UpstashRoomStore {
  constructor({ url, token, ttlSeconds = ROOM_TTL_SECONDS } = {}) {
    this.url = (url ?? UPSTASH_REDIS_REST_URL).replace(/\/$/, '');
    this.token = token ?? UPSTASH_REDIS_REST_TOKEN;
    this.ttlSeconds = ttlSeconds;
    if (!this.url || !this.token) {
      throw new Error('UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN sont requis.');
    }
  }

  async #call(path, body) {
    const res = await fetch(`${this.url}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Upstash error ${res.status}`);
    const json = await res.json();
    return json.result ?? null;
  }

  async get(code) {
    const raw = await this.#call(`/get/${encodeURIComponent(roomKey(code))}`);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }

  async exists(code) {
    const n = await this.#call(`/exists/${encodeURIComponent(roomKey(code))}`);
    return Number(n) > 0;
  }

  async save(room) {
    await this.#call('/pipeline', [
      ['SET', roomKey(room.code), JSON.stringify(room), 'EX', String(this.ttlSeconds)],
    ]);
  }

  async remove(code) {
    await this.#call(`/del/${encodeURIComponent(roomKey(code))}`);
  }
}

let singleton = null;

/** Indique le backend de stockage actif (diagnostic, sans secret). */
export function storageKind() {
  return UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN ? 'upstash' : 'memory';
}

/** Retourne le store partagé : Upstash si configuré, sinon mémoire (dev local). */
export function getStore() {
  if (singleton) return singleton;
  if (storageKind() === 'upstash') {
    singleton = new UpstashRoomStore();
  } else {
    singleton = new MemoryRoomStore();
  }
  return singleton;
}

/** Réinitialise le singleton (tests). */
export function resetStore() {
  singleton = null;
}
