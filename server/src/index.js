import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { CLIENT_ORIGIN, PORT } from './config.js';
import { storageKind } from './lobby/restStore.js';
import { roomsRouter } from './routes/rooms.js';

export const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

const health = (_req, res) =>
  res.json({ ok: true, service: 'superpoly-server', storage: storageKind() });
app.get('/health', health);
app.get('/api/health', health);
app.use('/api/rooms', roomsRouter());

// Démarrage local uniquement : sur Vercel ce sont les fonctions /api qui répondent.
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`[superpoly-server] REST listening on :${PORT} (client origin: ${CLIENT_ORIGIN})`);
  });
}
