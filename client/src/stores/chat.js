import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useRoomStore } from './room.js';

const API_BASE = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');
export const CHAT_MAX_LENGTH = 200;

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
    const err = new Error(json.message ?? 'Erreur chat.');
    err.code = json.code ?? 'UNKNOWN';
    throw err;
  }
  return json;
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref([]);
  const version = ref(0);
  const sending = ref(false);
  const error = ref('');
  const seenCode = ref('');
  const seenVersion = ref(0);

  function applyChat(chat) {
    if (!chat) return;
    if (typeof chat.version === 'number') {
      // Ignore les réponses périmées (poll émis avant un message, arrivé après).
      if (chat.version < seenVersion.value) return;
      seenVersion.value = chat.version;
      version.value = chat.version;
    }
    if (Array.isArray(chat.messages)) messages.value = chat.messages;
  }

  function ensureRoom(code) {
    // Nouveau salon : repartir de zéro (les versions recommencent à 1).
    if (code !== seenCode.value) {
      seenCode.value = code;
      seenVersion.value = 0;
      version.value = 0;
      messages.value = [];
    }
  }

  async function pollOnce() {
    const r = useRoomStore();
    if (!r.code || !r.myToken) return;
    const pollCode = r.code;
    const pollToken = r.myToken;
    try {
      const state = await api(`state?code=${encodeURIComponent(pollCode)}&token=${encodeURIComponent(pollToken)}`);
      if (r.code !== pollCode || r.myToken !== pollToken) return;
      ensureRoom(pollCode);
      if (state.chat) applyChat(state.chat);
      if (!error.value.startsWith('Doucement')) error.value = '';
    } catch (e) {
      // NOT_IN_ROOM / ROOM_NOT_FOUND gérés par le store salon.
    }
  }

  async function send(text) {
    const r = useRoomStore();
    const clean = String(text ?? '').trim();
    if (!clean || sending.value) return;
    ensureRoom(r.code);
    sending.value = true;
    error.value = '';
    try {
      const json = await api('chat', {
        method: 'POST',
        body: { code: r.code, token: r.myToken, text: clean.slice(0, CHAT_MAX_LENGTH) },
      });
      if (json.chat) applyChat(json.chat);
    } catch (e) {
      error.value = e.message ?? 'Envoi impossible.';
    } finally {
      sending.value = false;
    }
  }

  function reset() {
    messages.value = [];
    version.value = 0;
    sending.value = false;
    error.value = '';
    seenCode.value = '';
    seenVersion.value = 0;
  }

  return { messages, version, sending, error, applyChat, pollOnce, send, reset };
});
