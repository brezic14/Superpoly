import { withCors } from './_lib.js';

export default withCors(async (_req, res) => {
  res.json({ ok: true, service: 'superpoly-server' });
});
