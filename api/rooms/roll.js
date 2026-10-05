import { rollDice } from '../../../server/src/game/service.js';
import { normalizeCode } from '../../../server/src/lobby/code.js';
import { ServiceError } from '../../../server/src/lobby/service.js';
import { readBody, withCors } from '../../_lib.js';

export default withCors(async (req, res, store) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD', message: 'POST attendu.' });
  const { code: rawCode, token } = readBody(req);
  const code = normalizeCode(rawCode);
  if (!code) throw new ServiceError('INVALID_CODE');
  const room = await store.get(code);
  if (!room) throw new ServiceError('ROOM_NOT_FOUND', 404);
  const { d1, d2, total, game } = rollDice(room, { token });
  await store.save(room);
  res.json({ ok: true, d1, d2, total, game });
});
