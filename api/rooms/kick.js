import { kickPlayer } from '../../server/src/lobby/service.js';
import { readBody, withCors } from '../../server/src/apiLib.js';

export default withCors(async (req, res, store) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD', message: 'POST attendu.' });
  const { code, token, targetId } = readBody(req);
  res.json({ ok: true, ...(await kickPlayer(store, { code, token, targetId })) });
});
