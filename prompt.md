Je recréer un jeu de monopoly en ligne vue.lj, node.js. Lit les fichiers rules.md, tree.txt, client.src/assest/frame/*.png pour avoir du context.

Mon but est de créer la page d'acceuil et le système de sallon où des joueurs peuvent créer une partie et partager un code permmettant d'accèder à cette partie.


la page d'acceuil est designée avec acceuil.png et la page d'attente du salon est designée avec sallon.png

Le joueur qui a créer la partie est considéré comme l'"hote" et les autres "invite". 

Réalise un plan permettant de répondre à ce but.

Seul le système de sallon est la page d'acceuil doivent être modélisé.




Reste à faire côté Vercel (impossible depuis ici)
1. Dashboard Vercel → projet → Settings → Environment Variables → ajouter :
- UPSTASH_REDIS_REST_URL = https://full-mosquito-225689.upstash.io
- UPSTASH_REDIS_REST_TOKEN = le token que tu viens de me donner
- Environnements : Production + Preview (cochés).
2. Deployments → Redeploy le dernier déploiement pour que les fonctions api/* prennent les variables.
3. Tester sur https://superpoly.vercel.app : créer une partie dans un navigateur, rejoindre avec le code dans un second (ou onglet privé) — la liste doit se synchroniser via le polling.
Note : garde le token hors du chat/git à l'avenir — il est maintenant uniquement dans ton server/.env local et (après l'étape 1) dans Vercel.