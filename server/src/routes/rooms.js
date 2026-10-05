import { Router } from 'express';
import { getStore } from '../lobby/restStore.js';
import { ServiceError, createRoom, getState, joinRoom, kickPlayer, leaveRoom, startRoom } from '../lobby/service.js';
import { getGameState, rollDice } from '../game/service.js';
import { normalizeCode } from '../lobby/code.js';

/** Routes REST du salon — même logique que les fonctions /api (Vercel). */
export function roomsRouter() {
  const router = Router();
  const store = () => getStore();

  router.post('/create', async (req, res) => {
    try {
      res.status(201).json({ ok: true, ...(await createRoom(store(), { name: req.body?.name })) });
    } catch (e) {
      sendServiceError(res, e);
    }
  });

  router.post('/join', async (req, res) => {
    try {
      res.json({ ok: true, ...(await joinRoom(store(), { code: req.body?.code, name: req.body?.name })) });
    } catch (e) {
      sendServiceError(res, e);
    }
  });

  router.get('/state', async (req, res) => {
    try {
      res.json({
        ok: true,
        ...(await getState(store(), { code: req.query?.code, token: req.query?.token })),
      });
    } catch (e) {
      sendServiceError(res, e);
    }
  });

  router.post('/leave', async (req, res) => {
    try {
      res.json({ ok: true, ...(await leaveRoom(store(), { code: req.body?.code, token: req.body?.token })) });
    } catch (e) {
      sendServiceError(res, e);
    }
  });

  router.post('/kick', async (req, res) => {
    try {
      res.json({
        ok: true,
        ...(await kickPlayer(store(), {
          code: req.body?.code,
          token: req.body?.token,
          targetId: req.body?.targetId,
        })),
      });
    } catch (e) {
      sendServiceError(res, e);
    }
  });

  router.post('/start', async (req, res) => {
    try {
      res.json({ ok: true, ...(await startRoom(store(), { code: req.body?.code, token: req.body?.token })) });
    } catch (e) {
      sendServiceError(res, e);
    }
  });

  router.post('/roll', async (req, res) => {
    try {
      const code = normalizeCode(req.body?.code);
      if (!code) throw new ServiceError('INVALID_CODE');
      const room = await store().get(code);
      if (!room) throw new ServiceError('ROOM_NOT_FOUND', 404);
      const { d1, d2, total, game } = rollDice(room, { token: req.body?.token });
      await store().save(room);
      res.json({ ok: true, d1, d2, total, game });
    } catch (e) {
      sendServiceError(res, e);
    }
  });

  router.get('/game', async (req, res) => {
    try {
      const code = normalizeCode(req.query?.code);
      if (!code) throw new ServiceError('INVALID_CODE');
      const room = await store().get(code);
      if (!room) throw new ServiceError('ROOM_NOT_FOUND', 404);
      res.json({ ok: true, game: getGameState(room, { token: req.query?.token }) });
    } catch (e) {
      sendServiceError(res, e);
    }
  });

  return router;
}

export function sendServiceError(res, e) {
  if (e instanceof ServiceError) {
    return res.status(e.status).json({ ok: false, code: e.key, message: e.message });
  }
  console.error('[rooms]', e);
  return res.status(500).json({ ok: false, code: 'INTERNAL', message: 'Erreur serveur.' });
}
