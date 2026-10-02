# Superpoly

Version en ligne du Monopoly (Vue.js + Node.js). Règles : voir `rules.md`.
Logique métier : `docs/uml/instance.puml` (pur, inchangé). Salon réseau : `docs/uml/lobby.puml`.

## Lot actuel : accueil + salon (5 joueurs max, hôte inclus)

- Accueil (`/`) : `Créer une partie` + champ `nom`, `Rejoindre une partie` + champ `code`.
- Salon (`/salon/#XXXXXX`) : affichage `#code`, bouton `CC` (copier), bouton `Démarrer`
  (hôte seul, 2 joueurs min), liste joueurs avec croix d'expulsion (hôte seul).
- Code salon : `#` + 6 caractères `[0-9A-Z]` (ex `#212A4B`). Saisie tolérante
  (minuscules, `#` oublié).
- Hôte qui quitte → le doyen (premier arrivé) devient hôte.
- Transport : **REST + polling 2s** (compatible serverless, pas de WebSocket).
  Chaque joueur reçoit un token secret à la création/rejoin (persisté en
  `localStorage`), le kick se fait par id joueur.

## Lancer en local

```bash
npm run install:all
# terminal 1
npm run dev:server   # http://localhost:3000 (+ /api/health)
# terminal 2 : avec VITE_SERVER_URL=http://localhost:3000 (voir client/.env.example)
npm run dev:client   # http://localhost:5173
```

Variables : `server/.env` (voir `.env.example` : `PORT`, `CLIENT_ORIGIN`, `MAX_PLAYERS=5`,
`ROOM_TTL_SECONDS`, `UPSTASH_*` pour la prod).
Front : `VITE_SERVER_URL` vide = même domaine (prod Vercel), `http://localhost:3000` en dev.

## Déploiement Vercel (superpoly.vercel.app)

- Build front : `vercel.json` (`client/dist`, rewrite SPA `/salon/:code` → `/`).
- API salon : fonctions `api/rooms/*` (même logique que l'Express local).
- **Variables Vercel requises** : `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
  (base Upstash Redis, free tier suffit — sans elles, le stockage retombe en mémoire,
  non partagé entre instances serverless : salons fantômes possibles).
- Sans Upstash, tout fonctionne en mono-instance (dev local) mais pas en prod.

## Tests

```bash
npm run test:server        # unitaires code + service salon (mémoire)
npm run build:client       # build Vite
```
