# Board Mangement System


Le plateau est représenté par 57 case ayant chacun des propriétés spécifiques.la cases sont traitées dans rules.md

Les détails techniques des déplacement sont spécifiées ici :

Chaque case à un numéro, la case départ a pour numéro 0 et la dernière 55.
Un joueur est positionner sur une case (un nuémro spécifie sa position). 
Au début tous les joueurs sont sur la case 0. Lorsque qu'il lance les deux dés, son pion (représenté par un cercle natif d'une couelur attribuée au lancement de la partie), son pion se déplace de case en case (translation vers la case suivante avec un petit temps d'arret sur chaque case intermédiare), mais le numéro de case du joueur est mis à jour directement au numéro de case d'arrivé (le joueur tombe sur le montant 7, il était à la case 15, il est donc à la case 22, mais visuellement son pion se déplace à la case 16, puis 17, puis..., puis 22).
Il est important de noter que certaines case peuvent avoir des effets si le joueur passe dessus mais ne s'arrête pas à cette case (si un joueur passe par la case départ(sauf début de partie) ou intermédiare, il recoit de l'argent).
En cas de double le joueur suit les instructions de la case d'arrivée puis à l'obligation de relancer les dés.

En cas de passage après la case 56, le joueur est ammené à nouveau sur la case 0 (il est à la case 54, il fait 6 donc il passe de 54 à 55 à 56 à 0 à 1 à 2 puis 3)

Quand deux (ou plusieurs joueurs sont sur la même case) les pions sont placé les uns sur les autres et seul le dernier pion arrivé est visible.

