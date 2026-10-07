import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useRoomStore } from './room.js';
import { useChatStore } from './chat.js';
import board from '../data/board.json';

const API_BASE = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');
export const BOARD_SIZE = 57;
export const STEP_MS = 250;

async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/rooms/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    const err = new Error('Serveur injoignable. Vérifie qu’il est démarré.');
    err.code = 'NETWORK';
    throw err;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    // Message serveur si présent, sinon code explicite (ex. 404 = route absente).
    const err = new Error(json.message ?? `Erreur partie (${json.code ?? `HTTP ${res.status}`}).`);
    err.code = json.code ?? `HTTP_${res.status}`;
    throw err;
  }
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function pathSquares(from, to) {
  // Chemin visuel case-par-case (cf board.md) : avance de 1 en 1 avec wrap 56 -> 0.
  const out = [];
  let cur = from;
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    cur = (cur + 1) % BOARD_SIZE;
    out.push(cur);
    if (cur === to) break;
  }
  return out;
}

export const useGameStore = defineStore('game', () => {
  const game = ref(null);
  const displayPositions = ref({});
  const animating = ref(false);
  const animatingId = ref(null);
  const rolling = ref(false);
  const error = ref('');
  const seenGid = ref(0);
  const seenVersion = ref(0);
  const pendingAnims = ref([]);

  const room = () => useRoomStore();

  const players = computed(() => game.value?.players ?? []);
  const currentPlayerId = computed(() => game.value?.currentPlayerId ?? null);
  const lastRoll = computed(() => game.value?.lastRoll ?? null);
  const myId = computed(() => room().myPlayerId);
  const isMyTurn = computed(() => !!myId.value && myId.value === currentPlayerId.value && !animating.value);
  const currentPlayer = computed(() => players.value.find((p) => p.id === currentPlayerId.value) ?? null);

  function squareInfo(id) {
    return board.find((s) => s.id === id) ?? board[0];
  }

  function snapPositions(g) {
    const pos = {};
    for (const p of g.players) pos[p.id] = p.square;
    displayPositions.value = pos;
  }

  async function runAnimation(playerId, to) {
    animating.value = true;
    animatingId.value = playerId;
    try {
      // Part de la position ACTUELLEMENT affichée (pas de lastRoll.from) : si des
      // versions ont été ratées entre deux polls, on traverse quand même chaque
      // case intermédiaire au lieu de téléporter le pion.
      const start = displayPositions.value[playerId] ?? to;
      if (start === to) return; // déjà sur place : rien à animer (évite un tour complet).
      for (const sq of pathSquares(start, to)) {
        // Nouvelle partie ou reset entre-temps : on abandonne, sinon l'ancienne
        // animation écrirait des cases périmées dans la nouvelle partie.
        if (animatingId.value !== playerId) return;
        displayPositions.value = { ...displayPositions.value, [playerId]: sq };
        await sleep(STEP_MS);
      }
    } finally {
      // Joue les animations mises en file pendant celle-ci (tours rapides).
      const next = pendingAnims.value.shift();
      if (next) {
        await runAnimation(next.playerId, next.to);
      } else {
        animating.value = false;
        animatingId.value = null;
      }
    }
  }

  function applyGame(g, { animate = true } = {}) {
    if (!g) return;
    const gid = g.gid ?? 0;
    if (gid !== seenGid.value) {
      // Nouvelle partie (ou premier chargement) : les versions repartent à 1,
      // resync complète au lieu d'animer depuis l'ancienne partie.
      seenGid.value = gid;
      seenVersion.value = g.version;
      pendingAnims.value = [];
      animating.value = false;
      animatingId.value = null;
      game.value = g;
      snapPositions(g);
      return;
    }
    if (g.version < seenVersion.value) {
      // Réponse périmée (poll émis avant un lancer, arrivé après sa réponse) :
      // l'ignorer ENTIÈREMENT, sinon game.value (dés affichés) et les positions
      // seraient réécrits avec d'anciennes données.
      return;
    }
    if (g.version === seenVersion.value) {
      // Pas de nouveau lancer : resync silencieuse (ex. refresh).
      // MAIS jamais pendant une animation : snapPositions téléporterait le pion
      // sur sa case d'arrivée puis la boucle d'animation le ramènerait en arrière.
      // Les autres pions ne peuvent pas bouger sans bump de version, donc on peut
      // simplement ignorer ce poll tant que l'animation converge.
      if (!animating.value && pendingAnims.value.length === 0) {
        game.value = g;
        snapPositions(g);
      }
      return;
    }
    seenVersion.value = g.version;
    game.value = g;
    const lr = g.lastRoll;
    if (animate && lr) {
      const anim = { to: lr.to, playerId: lr.playerId };
      if (animating.value) {
        // Évite les doublons : ne garde que la destination la plus récente par joueur.
        const i = pendingAnims.value.findIndex((a) => a.playerId === anim.playerId);
        if (i === -1) pendingAnims.value.push(anim);
        else pendingAnims.value[i] = anim;
      } else {
        void runAnimation(anim.playerId, anim.to);
      }
      // Les autres pions (théoriquement inchangés) : synchro directe.
      for (const p of g.players) {
        if (p.id !== lr.playerId) displayPositions.value = { ...displayPositions.value, [p.id]: p.square };
      }
    } else {
      snapPositions(g);
    }
  }

  async function pollOnce() {
    const r = room();
    if (!r.code || !r.myToken) return;
    const pollCode = r.code;
    const pollToken = r.myToken;
    try {
      const state = await api(`state?code=${encodeURIComponent(pollCode)}&token=${encodeURIComponent(pollToken)}`);
      // Salon quitté/rejoint entre l'envoi et la réponse : réponse d'un ancien
      // salon, à jeter pour ne pas corrompre la partie en cours.
      if (r.code !== pollCode || r.myToken !== pollToken) return;
      if (state.game) applyGame({ ...state.game, myPlayerId: state.myPlayerId });
      error.value = '';
    } catch (e) {
      if (e.code === 'GAME_NOT_STARTED') return;
      // NOT_IN_ROOM / ROOM_NOT_FOUND gérés par le store salon ; ici on ignore pour ne pas écraser son erreur.
    }
  }

  async function roll() {
    const r = room();
    error.value = '';
    if (rolling.value || animating.value) return;
    rolling.value = true;
    try {
      const json = await api('roll', { method: 'POST', body: { code: r.code, token: r.myToken } });
      applyGame(json.game);
      if (json.chat) useChatStore().applyChat(json.chat);
    } catch (e) {
      error.value = e.message ?? 'Lancer impossible.';
    } finally {
      rolling.value = false;
    }
  }

  function reset() {
    game.value = null;
    displayPositions.value = {};
    animating.value = false;
    animatingId.value = null;
    rolling.value = false;
    error.value = '';
    seenGid.value = 0;
    seenVersion.value = 0;
    pendingAnims.value = [];
  }

  return {
    game, players, currentPlayerId, currentPlayer, lastRoll, isMyTurn,
    displayPositions, animating, animatingId, rolling, error,
    squareInfo, applyGame, pollOnce, roll, reset,
  };
});
