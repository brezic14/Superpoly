import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useRoomStore } from './room.js';
import board from '../data/board.json';

const API_BASE = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');
export const BOARD_SIZE = 57;
export const STEP_MS = 250;

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}/api/rooms/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    const err = new Error(json.message ?? 'Erreur partie.');
    err.code = json.code ?? 'UNKNOWN';
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
  const rolling = ref(false);
  const error = ref('');
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

  async function runAnimation(from, to, playerId) {
    animating.value = true;
    try {
      for (const sq of pathSquares(from, to)) {
        displayPositions.value = { ...displayPositions.value, [playerId]: sq };
        await sleep(STEP_MS);
      }
    } finally {
      animating.value = false;
      // Joue les animations mises en file pendant celle-ci (tours rapides).
      const next = pendingAnims.value.shift();
      if (next) await runAnimation(next.from, next.to, next.playerId);
    }
  }

  function applyGame(g, { animate = true } = {}) {
    if (!g) return;
    const firstLoad = !game.value;
    game.value = g;
    if (firstLoad || seenVersion.value === 0) {
      seenVersion.value = g.version;
      snapPositions(g);
      return;
    }
    if (g.version === seenVersion.value) {
      // Pas de nouveau lancer : resync silencieuse (ex. refresh).
      snapPositions(g);
      return;
    }
    seenVersion.value = g.version;
    const lr = g.lastRoll;
    if (animate && lr) {
      const anim = { from: lr.from, to: lr.to, playerId: lr.playerId };
      if (animating.value) {
        pendingAnims.value.push(anim);
      } else {
        void runAnimation(anim.from, anim.to, anim.playerId);
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
    try {
      const state = await api(`state?code=${encodeURIComponent(r.code)}&token=${encodeURIComponent(r.myToken)}`);
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
    rolling.value = false;
    error.value = '';
    seenVersion.value = 0;
    pendingAnims.value = [];
  }

  return {
    game, players, currentPlayerId, currentPlayer, lastRoll, isMyTurn,
    displayPositions, animating, rolling, error,
    squareInfo, applyGame, pollOnce, roll, reset,
  };
});
