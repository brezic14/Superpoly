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

const COST_OFF = 2.8; // % plateau : distance centre -> slot coût (cas général)
const COST_OFF_BOTTOM_OUTER = 1.2; // ligne du bas externe : pions déjà près du bord

// Plages d'ids séquentielles (plateau 56 cases, sens horaire).
const EDGES = [
  { to: 8, orient: 'V', angle: -90, dx: COST_OFF, dy: 0 }, // 0-7   colonne gauche
  { to: 19, orient: 'H', angle: 0, dx: 0, dy: COST_OFF }, // 8-18  ligne du haut
  { to: 26, orient: 'V', angle: 90, dx: -COST_OFF, dy: 0 }, // 19-25  colonne droite
  { to: 36, orient: 'H', angle: 0, dx: 0, dy: COST_OFF_BOTTOM_OUTER }, // 26-35 ligne du bas
  { to: 39, orient: 'V', angle: -90, dx: COST_OFF, dy: 0 }, // 36-38 colonne gauche int.
  { to: 47, orient: 'H', angle: 0, dx: 0, dy: COST_OFF }, // 39-46 ligne haute int.
  { to: 50, orient: 'V', angle: 90, dx: -COST_OFF, dy: 0 }, // 47-49 colonne droite int.
  { to: 56, orient: 'H', angle: 0, dx: 0, dy: COST_OFF }, // 50-55 ligne basse int.
];

export function edgeOf(id) {
  return EDGES.find((e) => id < e.to) ?? EDGES[0];
}

/** Slots d'une case : pion (centre), coût (bord opposé bande), amél (côté bande, futur). */
export function slotFor(cell) {
  const edge = edgeOf(cell.id);
  return {
    orient: edge.orient,
    angle: edge.angle,
    pawn: { x: cell.x, y: cell.y },
    cost: { x: cell.x + edge.dx, y: cell.y + edge.dy },
    amel: { x: cell.x - edge.dx, y: cell.y - edge.dy },
  };
}
