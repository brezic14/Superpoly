/**
 * Catalogue des villes achetable — source unique (le client reçoit tout via l'API).
 * Clé = id de case (cf client/src/data/board.json). Valeurs issues de info/vile.md.
 * Formules : loyer de base = prix/10 ; pays complet -> x2 ; chaque amélioration -> x2.
 * Amélioration : prix unique de 15 000€ pour toutes les villes.
 */

export const CITIES = {
  1: { nom: 'Milan', pays: 'Italie', prix: 5000, amelioration: 15000 },
  3: { nom: 'Venise', pays: 'Italie', prix: 5000, amelioration: 15000 },
  5: { nom: 'Florence', pays: 'Italie', prix: 5000, amelioration: 15000 },
  6: { nom: 'Rome', pays: 'Italie', prix: 7000, amelioration: 15000 },
  8: { nom: 'Puebla', pays: 'Mexique', prix: 10000, amelioration: 15000 },
  9: { nom: 'Mérida', pays: 'Mexique', prix: 10000, amelioration: 15000 },
  11: { nom: 'Mexico', pays: 'Mexique', prix: 12000, amelioration: 15000 },
  14: { nom: 'Toronto', pays: 'Canada', prix: 15000, amelioration: 15000 },
  15: { nom: 'Montréal', pays: 'Canada', prix: 15000, amelioration: 15000 },
  17: { nom: 'Ottawa', pays: 'Canada', prix: 17000, amelioration: 15000 },
  19: { nom: 'Kyoto', pays: 'Japon', prix: 20000, amelioration: 15000 },
  21: { nom: 'Osaka', pays: 'Japon', prix: 20000, amelioration: 15000 },
  23: { nom: 'Hiroshima', pays: 'Japon', prix: 20000, amelioration: 15000 },
  24: { nom: 'Tokyo', pays: 'Japon', prix: 22000, amelioration: 15000 },
  26: { nom: 'Mumbai', pays: 'Inde', prix: 25000, amelioration: 15000 },
  27: { nom: 'Jaipur', pays: 'Inde', prix: 25000, amelioration: 15000 },
  29: { nom: 'New Delhi', pays: 'Inde', prix: 27000, amelioration: 15000 },
  32: { nom: 'Marrakech', pays: 'Maroc', prix: 30000, amelioration: 15000 },
  33: { nom: 'Fès', pays: 'Maroc', prix: 30000, amelioration: 15000 },
  35: { nom: 'Rabat', pays: 'Maroc', prix: 32000, amelioration: 15000 },
  37: { nom: 'Hambourg', pays: 'Allemagne', prix: 35000, amelioration: 15000 },
  38: { nom: 'Berlin', pays: 'Allemagne', prix: 37000, amelioration: 15000 },
  40: { nom: 'Los Angeles', pays: 'USA', prix: 40000, amelioration: 15000 },
  42: { nom: 'Chicago', pays: 'USA', prix: 40000, amelioration: 15000 },
  43: { nom: 'New York', pays: 'USA', prix: 40000, amelioration: 15000 },
  45: { nom: 'Washington', pays: 'USA', prix: 42000, amelioration: 15000 },
  47: { nom: 'Sydney', pays: 'Australie', prix: 45000, amelioration: 15000 },
  48: { nom: 'Canberra', pays: 'Australie', prix: 47000, amelioration: 15000 },
  50: { nom: 'Bordeaux', pays: 'France', prix: 50000, amelioration: 15000 },
  52: { nom: 'Lille', pays: 'France', prix: 50000, amelioration: 15000 },
  53: { nom: 'Lyon', pays: 'France', prix: 50000, amelioration: 15000 },
  55: { nom: 'Paris', pays: 'France', prix: 52000, amelioration: 15000 },
};

export function isCity(square) {
  return Object.prototype.hasOwnProperty.call(CITIES, square);
}

export function getCity(square) {
  return CITIES[square] ?? null;
}

/** Toutes les cases d'un pays (pour le bonus "pays complet"). */
export function citiesOfCountry(pays) {
  return Object.entries(CITIES)
    .filter(([, c]) => c.pays === pays)
    .map(([square]) => Number(square));
}

/** Loyer de base = prix / 10. */
export function baseRent(price) {
  return Math.floor(price / 10);
}

/** Loyer courant : base x2 si pays complet, x2 par amélioration (0 pour l'instant). */
export function currentRent(price, { fullCountry = false, upgrades = 0 } = {}) {
  return baseRent(price) * (fullCountry ? 2 : 1) * 2 ** upgrades;
}

/** Prix de revente : prix/2 (+ moitié d'une amélioration par niveau, 0 pour l'instant). */
export function salePrice(price, upgradeCost, upgrades = 0) {
  return Math.floor(price / 2 + (upgradeCost / 2) * upgrades);
}

/** Le joueur possède-t-il toutes les villes du pays de cette case ? */
export function ownsWholeCountry(ownership, playerId, square) {
  const city = getCity(square);
  if (!city || !playerId) return false;
  return citiesOfCountry(city.pays).every((sq) => ownership[sq]?.ownerId === playerId);
}

/** Loyer actuel affiché sur le plateau pour une case (0 si libre — on affiche le prix). */
export function rentOf(square, ownership) {
  const city = getCity(square);
  if (!city) return 0;
  const ownerId = ownership[square]?.ownerId ?? null;
  if (!ownerId) return baseRent(city.prix);
  return currentRent(city.prix, { fullCountry: ownsWholeCountry(ownership, ownerId, square) });
}

/** Fiche complète pour la carte d'achat (cf maquette ville_libre). */
export function cityDetail(square, ownership = {}) {
  const city = getCity(square);
  if (!city) return null;
  const base = baseRent(city.prix);
  return {
    square,
    nom: city.nom,
    pays: city.pays,
    price: city.prix,
    upgradeCost: city.amelioration,
    baseRent: base,
    // Tableau affiché : progression "pays complet" (x2) puis x2 par amélioration.
    rents: [1, 2, 3, 4].map((n) => base * 2 * 2 ** n),
    salePrice: salePrice(city.prix, city.amelioration, 0),
    currentRent: rentOf(square, ownership),
    ownerId: ownership[square]?.ownerId ?? null,
  };
}
