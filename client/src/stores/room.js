import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// Base API : vide = même domaine (/api du même Vercel, recommandé en prod).
// En dev local avec serveur séparé : VITE_SERVER_URL=http://localhost:3000
const API_BASE = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');
const POLL_MS = 2000;

const tokenKey = (code) => `superpoly:token:${code}`;

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}/api/rooms/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    const err = new Error(json.message ?? 'Erreur salon.');
    err.code = json.code ?? 'UNKNOWN';
    throw err;
  }
  return json;
}

export const useRoomStore = defineStore('room', () => {
  const code = ref('');
  const myPlayerId = ref('');
  const myToken = ref('');
  const myPseudo = ref(localStorage.getItem('superpoly-name') ?? '');
  const players = ref([]);
  const maxPlayers = ref(5);
  const status = ref('WAITING');
  const error = ref('');
  const starting = ref(null);
  const seenCode = ref('');
  const seenVersion = ref(0);
  let pollTimer = null;

  const isHost = computed(() => {
    const me = players.value.find((p) => p.id === myPlayerId.value);
    return !!me?.isHost;
  });

  function resetError() {
    error.value = '';
  }

  function applyRoom(payload) {
    if (!payload) return;
    // Réponse destinée à un autre salon (poll en vol pendant un changement de
    // salon) : l'ignorer pour ne pas corrompre le salon courant.
    if (payload.code && code.value && payload.code !== code.value) return;
    // Nouveau salon : les versions repartent, on réarme le garde anti-périmé.
    if (payload.code && payload.code !== seenCode.value) {
      seenCode.value = payload.code;
      seenVersion.value = 0;
    }
    // Réponse périmée (émise avant une action déjà appliquée) : l'ignorer.
    if (payload.version != null && payload.version < seenVersion.value) return;
    code.value = payload.code ?? code.value;
    players.value = payload.players ?? players.value;
    maxPlayers.value = payload.maxPlayers ?? maxPlayers.value;
    status.value = payload.status ?? status.value;
    if (payload.myPlayerId) myPlayerId.value = payload.myPlayerId;
    if (payload.isHost !== undefined && !payload.players) {
      // state() renvoie isHost séparément — recalculé via players de toute façon.
    }
    if (status.value === 'STARTING' && !starting.value) {
      starting.value = { code: code.value, players: players.value };
    }
    if (payload.version != null) seenVersion.value = payload.version;
  }

  function rememberToken() {
    if (code.value && myToken.value) {
      localStorage.setItem(tokenKey(code.value), myToken.value);
    }
  }

  function forgetToken(c) {
    if (c) localStorage.removeItem(tokenKey(c));
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function pollOnce() {
    if (!code.value || !myToken.value) return;
    const pollCode = code.value;
    const pollToken = myToken.value;
    try {
      const state = await api(`state?code=${encodeURIComponent(pollCode)}&token=${encodeURIComponent(pollToken)}`);
      // Salon quitté/rejoint entre l'envoi et la réponse : jeter la réponse.
      if (code.value !== pollCode || myToken.value !== pollToken) return;
      applyRoom(state);
      resetErrorIfSync(state);
    } catch (e) {
      if (e.code === 'NOT_IN_ROOM' || e.code === 'ROOM_NOT_FOUND') {
        // Expulsé ou salon supprimé.
        const wasKicked = e.code === 'NOT_IN_ROOM' && players.value.length > 0;
        stopPolling();
        forgetToken(code.value);
        code.value = '';
        players.value = [];
        myToken.value = '';
        myPlayerId.value = '';
        seenCode.value = '';
        seenVersion.value = 0;
        error.value = wasKicked ? 'Tu as été expulsé du salon.' : e.message;
      }
      // Sinon (réseau...) : on garde l'état, le prochain poll réessaiera.
    }
  }

  function resetErrorIfSync() {
    if (error.value && !error.value.includes('expulsé')) error.value = '';
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollOnce, POLL_MS);
  }

  async function createRoom(pseudo) {
    resetError();
    myPseudo.value = pseudo.trim();
    localStorage.setItem('superpoly-name', myPseudo.value);
    const json = await api('create', { method: 'POST', body: { name: myPseudo.value } }).catch(fail);
    if (!json) return;
    myToken.value = json.me.token;
    myPlayerId.value = json.me.id;
    applyRoom({ ...json.room, myPlayerId: json.me.id });
    starting.value = null;
    rememberToken();
    startPolling();
  }

  async function joinRoom({ code: rawCode, pseudo }) {
    resetError();
    myPseudo.value = pseudo.trim();
    localStorage.setItem('superpoly-name', myPseudo.value);
    const json = await api('join', {
      method: 'POST',
      body: { code: rawCode.trim(), name: myPseudo.value },
    }).catch(fail);
    if (!json) return;
    myToken.value = json.me.token;
    myPlayerId.value = json.me.id;
    applyRoom({ ...json.room, myPlayerId: json.me.id });
    starting.value = null;
    rememberToken();
    startPolling();
  }

  /** Reprise après refresh : token mémorisé -> état direct, sans rejoin. */
  async function resumeRoom(rawCode) {
    resetError();
    const c = rawCode.trim().toUpperCase();
    const token = localStorage.getItem(tokenKey(c.startsWith('#') ? c : `#${c}`));
    if (!token) return false;
    const prevCode = code.value;
    code.value = c.startsWith('#') ? c : `#${c}`;
    myToken.value = token;
    try {
      const state = await api(`state?code=${encodeURIComponent(code.value)}&token=${encodeURIComponent(token)}`);
      myPlayerId.value = state.myPlayerId;
      applyRoom(state);
      startPolling();
      return true;
    } catch {
      code.value = prevCode;
      myToken.value = '';
      return false;
    }
  }

  async function leaveRoom() {
    const c = code.value;
    const t = myToken.value;
    stopPolling();
    forgetToken(c);
    code.value = '';
    players.value = [];
    myToken.value = '';
    myPlayerId.value = '';
    starting.value = null;
    seenCode.value = '';
    seenVersion.value = 0;
    if (c && t) {
      await api('leave', { method: 'POST', body: { code: c, token: t } }).catch(() => {});
    }
  }

  async function kick(targetId) {
    resetError();
    const json = await api('kick', {
      method: 'POST',
      body: { code: code.value, token: myToken.value, targetId },
    }).catch(fail);
    if (json) applyRoom(json.room);
  }

  async function startGame() {
    resetError();
    const json = await api('start', {
      method: 'POST',
      body: { code: code.value, token: myToken.value },
    }).catch(fail);
    if (json) {
      applyRoom(json);
      starting.value = { code: json.code, players: json.players, gamePlayers: json.gamePlayers };
    }
  }

  function fail(e) {
    error.value = e.message ?? 'Erreur salon.';
    return null;
  }

  return {
    code, myPlayerId, myToken, myPseudo, players, maxPlayers, status, error, starting,
    isHost, createRoom, joinRoom, resumeRoom, leaveRoom, kick, startGame, pollOnce, startPolling, stopPolling, resetError,
  };
});
