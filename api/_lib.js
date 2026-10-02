import { ServiceError } from '../server/src/lobby/service.js';
import { getStore } from '../server/src/lobby/restStore.js';

/**
 * Socle des fonctions serverless /api (Vercel) — zéro dépendance externe.
 * Même logique métier que l'Express local (server/src/routes/rooms.js).
 */
export function withCors(handler) {
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    try {
      await handler(req, res, getStore());
    } catch (e) {
      if (e instanceof ServiceError) {
        return res.status(e.status).json({ ok: false, code: e.key, message: e.message });
      }
      console.error('[api]', e);
      return res.status(500).json({ ok: false, code: 'INTERNAL', message: 'Erreur serveur.' });
    }
  };
}

export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
}
