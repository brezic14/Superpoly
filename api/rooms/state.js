import { getState } from '../../server/src/lobby/service.js';
import { withCors } from '../../server/src/apiLib.js';

export default withCors(async (req, res, store) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, code: 'METHOD', message: 'GET attendu.' });
  res.json({ ok: true, ...(await getState(store, { code: req.query?.code, token: req.query?.token })) });
});
