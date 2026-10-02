// NOTE : pas d'import 'dotenv' ici — ce module est aussi chargé par les
// fonctions serverless /api (Vercel) qui n'ont aucune dépendance externe.
// Le chargement .env local est fait dans server/src/index.js uniquement.

// Nombre de joueurs max par salon, hôte inclus. Modifiable via .env (future option UI).
export const MAX_PLAYERS = Number.parseInt(process.env.MAX_PLAYERS ?? '5', 10) || 5;

// Code salon : '#' + 6 caractères [0-9A-Z]. Ex : #212A4B, #5EG714
export const CODE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const CODE_BODY_LENGTH = 6;
export const CODE_PREFIX = '#';
export const CODE_REGEX = /^#[0-9A-Z]{6}$/;

// Pseudo : 2 à 20 caractères après trim.
export const NAME_MIN = 2;
export const NAME_MAX = 20;

// Durée de vie d'un salon stocké (secondes). 6h par défaut.
export const ROOM_TTL_SECONDS = Number.parseInt(process.env.ROOM_TTL_SECONDS ?? '21600', 10) || 21600;

// Stockage partagé des salons (option B Vercel) : Upstash Redis via REST.
// Sans ces variables, repli mémoire (dev local uniquement — non partagé en serverless).
export const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL ?? '';
export const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';

export const PORT = Number.parseInt(process.env.PORT ?? '3000', 10) || 3000;
export const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
