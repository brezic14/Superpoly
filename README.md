# Superpoly

Superpoly est une adaptation web gratuite et multijoueur, inspirée du Monopoly.
Les joueurs s'affrontent sur un plateau de 56 cases : ils lancent les dés,
achètent des villes, encaissent des loyers et tentent de prendre le monopole de
la partie.

## Jouer en ligne

Le jeu est disponible ici : **https://superpoly.vercel.app**

Dans la page d'accueil, il est possible de créer une partie ou d'en rejoindre
une à l'aide d'un code. Une fois dans le salon, le code peut être partagé avec
d'autres joueurs. La partie peut ensuite commencer : les joueurs lancent les dés,
achètent des villes et développent leur capital.

## Fonctionnalités

- Salons jusqu'à 5 joueurs avec code de partie.
- Chat et messages système pendant la partie.
- Plateau de 56 cases avec pions colorés et déplacement animé.
- Lancer de deux dés, gestion des doubles et des 3 doubles.
- Achat de villes libres.
- Paiement des loyers au propriétaire.
- Loyer doublé lorsque le propriétaire possède toutes les villes d'un pays.
- Fiche détaillée des villes et affichage des prix et loyers sur le plateau.

## À venir

- Gares, aéroports et services.
- Cases taxes, chance, cagnotte, policier et prison complète.
- Améliorations et revente de villes.
- Négociations, échanges, alliances, marché noir et privilèges.
- Faillite, élimination et victoire.

## Stack technique

- **Front-end** : Vue.js
- **Back-end** : Node.js
- **Communication** : API REST avec actualisation régulière
- **Stockage** : Upstash Redis
- **Hébergement** : Vercel

### Arborescence du projet

```text
Superpoly/
├─ api/                     # Fonctions serverless (Vercel)
│  ├─ health.js
│  └─ rooms/                # create, join, state, leave, kick, start, roll, buy, pass, chat
├─ client/                  # Application Vue.js
│  ├─ src/
│  │  ├─ assets/            # Plateau, logos et images
│  │  ├─ components/        # Plateau, dés, cartes, chat, joueurs
│  │  ├─ data/board.json    # Données des 56 cases
│  │  ├─ router/            # Routes de l'application
│  │  ├─ stores/            # État du salon, du jeu et du chat
│  │  ├─ views/             # Accueil, salon, partie
│  │  ├─ App.vue
│  │  ├─ main.js
│  │  └─ style.css
│  ├─ index.html
│  ├─ package.json
│  └─ vite.config.js
├─ server/                  # Serveur Node.js
│  ├─ src/
│  │  ├─ chat/              # Chat et messages système
│  │  ├─ game/              # Plateau, villes et loyers
│  │  ├─ lobby/             # Salons et joueurs
│  │  ├─ routes/            # Routes REST
│  │  ├─ apiLib.js
│  │  ├─ config.js
│  │  └─ index.js
│  ├─ test/                 # Tests du serveur
│  ├─ .env.example
│  └─ package.json
├─ index.html
├─ package.json
├─ vercel.json
└─ README.md
```

---

Projet personnel réalisé avec Vue.js et Node.js.
