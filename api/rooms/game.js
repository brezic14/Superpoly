import { getGameState } from '../../../server/src/game/service.js';
import { normalizeCode } from '../../../server/src/lobby/code.js';
import { ServiceError } from '../../../server/src/lobby/service.js';
import { withCors } from '../../_lib.js';

export default withCors(async (req, res, store) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, code: 'METHOD', message: 'GET attendu.' });
  const code = normalizeCode(req.query?.code);
  if (!code) throw new ServiceError('INVALID_CODE');
  const room = await store.get(code);
  if (!room) throw new ServiceError('ROOM_NOT_FOUND', 404);
  res.json({ ok: true, game: getGameState(room, { token: req.query?.token }) });
});
