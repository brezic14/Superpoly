import { randomBytes, randomUUID } from 'node:crypto';
import { CODE_ALPHABET, CODE_BODY_LENGTH, CODE_PREFIX, CODE_REGEX } from '../config.js';

/** Génère un corps de code aléatoire, ex : "212A4B". */
export function generateCodeBody(randomFn = Math.random) {
  let out = '';
  for (let i = 0; i < CODE_BODY_LENGTH; i += 1) {
    out += CODE_ALPHABET[Math.floor(randomFn() * CODE_ALPHABET.length)];
  }
  return out;
}

/** Génère un code complet, ex : "#212A4B". */
export function generateCode(randomFn = Math.random) {
  return `${CODE_PREFIX}${generateCodeBody(randomFn)}`;
}

/**
 * Normalise une saisie utilisateur vers le format canonique.
 * Accepte "212a4b", "#212a4b", "  #212A4B  " -> "#212A4B".
 * Retourne null si le format reste invalide.
 */
export function normalizeCode(input) {
  if (typeof input !== 'string') return null;
  let code = input.trim().toUpperCase();
  if (!code) return null;
  if (!code.startsWith(CODE_PREFIX)) code = `${CODE_PREFIX}${code}`;
  return CODE_REGEX.test(code) ? code : null;
}

/** Normalise un pseudo. Retourne null si invalide. */
export function normalizeName(input, { min = 2, max = 20 } = {}) {
  if (typeof input !== 'string') return null;
  const name = input.trim().replace(/\s+/g, ' ');
  if (name.length < min || name.length > max) return null;
  return name;
}

/** Identifiant public d'un joueur de salon (exposé au client pour kick). */
export function generatePlayerId() {
  return randomUUID();
}

/** Secret d'authentification du joueur (jamais exposé aux autres). */
export function generatePlayerToken() {
  return randomBytes(24).toString('hex');
}
