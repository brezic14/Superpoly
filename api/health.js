import { withCors } from '../server/src/apiLib.js';
import { storageKind } from '../server/src/lobby/restStore.js';

export default withCors(async (_req, res) => {
  res.json({ ok: true, service: 'superpoly-server', storage: storageKind() });
});
