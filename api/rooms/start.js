import { startRoom } from '../../server/src/lobby/service.js';
import { readBody, withCors } from '../_lib.js';

export default withCors(async (req, res, store) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD', message: 'POST attendu.' });
  const { code, token } = readBody(req);
  res.json({ ok: true, ...(await startRoom(store, { code, token })) });
});
