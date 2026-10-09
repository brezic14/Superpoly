import { normalizeCode } from '../../server/src/lobby/code.js';
import { ServiceError } from '../../server/src/lobby/service.js';
import { postChat } from '../../server/src/chat/service.js';
import { readBody, withCors } from '../../server/src/apiLib.js';

export default withCors(async (req, res, store) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, code: 'METHOD', message: 'POST attendu.' });
  const { code: rawCode, token, text } = readBody(req);
  const code = normalizeCode(rawCode);
  if (!code) throw new ServiceError('INVALID_CODE');
  const room = await store.get(code);
  if (!room) throw new ServiceError('ROOM_NOT_FOUND', 404);
  const { message, chat } = postChat(room, { token, text });
  await store.save(room);
  res.status(201).json({ ok: true, message, chat });
});
