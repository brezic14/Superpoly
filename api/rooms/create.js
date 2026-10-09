import { createRoom } from '../../server/src/lobby/service.js';
import { readBody, withCors } from '../../server/src/apiLib.js';

export default withCors(async (req, res, store) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD', message: 'POST attendu.' });
  const { name } = readBody(req);
  res.status(201).json({ ok: true, ...(await createRoom(store, { name })) });
});
