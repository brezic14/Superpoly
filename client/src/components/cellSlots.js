/**
 * Slots visuels par case (cf Image 3 : <pos_amél> côté bande, <pos_pion> au
 * centre sous le nom, <pos_coût> au bord opposé à la bande).
 *
 * Bandes vérifiées sur plateau.png : les 4 lignes horizontales ont leur bande
 * au NORD (y compris les lignes du bas, orientées "vers le haut"), les
 * colonnes gauches à l'OUEST, les droites à l'EST.
 * Texte : orientation cellule (H -> 0°, gauche -> -90°, droite -> +90°).
 * Réutilisable pour les futurs éléments (améliorations, gares...).
 */

const EDGES = [
  { to: 8, angle: -90, dx: 2.8, dy: 0 }, // 0-7   colonne gauche
  { to: 19, angle: 0, dx: 0, dy: 2.8 }, // 8-18  ligne du haut
  { to: 26, angle: 90, dx: -2.8, dy: 0 }, // 19-25  colonne droite
  { to: 36, angle: 0, dx: 0, dy: 3.0 }, // 26-35 ligne du bas (Maroc-Inde)
  { to: 39, angle: -90, dx: 2.8, dy: 0 }, // 36-38 colonne gauche int.
  { to: 47, angle: 0, dx: 0, dy: 8.0 }, // 39-46 ligne haute int. (USA)
  { to: 50, angle: 90, dx: -2.8, dy: -1.2 }, // 47-49 colonne droite int.
  { to: 56, angle: 0, dx: 0, dy: 2.0 }, // 50-55 ligne basse int. (France)
];

export function edgeOf(id) {
  return EDGES.find((e) => id < e.to) ?? EDGES[0];
}

/** Slots d'une case : pion (centre), coût (bord opposé bande), amél (côté bande, futur). */
export function slotFor(cell) {
  const edge = edgeOf(cell.id);
  return {
    angle: edge.angle,
    pawn: { x: cell.x, y: cell.y },
    cost: { x: cell.x + edge.dx, y: cell.y + edge.dy },
    amel: { x: cell.x - edge.dx, y: cell.y - edge.dy },
  };
}
