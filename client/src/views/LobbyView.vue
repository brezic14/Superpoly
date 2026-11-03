<template>
  <div class="frame">
    <div class="lobby-wrap">
      <div class="lobby-top">
        <span class="code-display">{{ displayCode }}</span>
        <button class="copy-btn" @click="copyCode" title="Copier le code">CC</button>
        <button
          class="wire-btn primary"
          :disabled="!canStart"
          :title="startTitle"
          @click="room.startGame()"
        >
          Démarrer
        </button>
      </div>

      <PlayerList
        :players="room.players"
        :is-host="room.isHost"
        :my-id="room.myPlayerId"
        @kick="confirmKick"
      />
    </div>

    <div class="lobby-meta">
      <p class="hint" v-if="copied">Code copié ! Partage-le à tes amis.</p>
      <p class="hint">{{ room.players.length }} / {{ room.maxPlayers }} joueurs</p>
      <p class="error" v-if="room.error">{{ room.error }}</p>
      <p class="hint" v-if="room.starting">Partie en démarrage…</p>
      <button class="quit-link" @click="leave">Quitter le salon</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRoomStore } from '../stores/room.js';
import PlayerList from '../components/PlayerList.vue';

const props = defineProps({ code: { type: String, default: '' } });
const route = useRoute();
const router = useRouter();
const room = useRoomStore();
const copied = ref(false);

const routeCode = computed(() => props.code || route.params.code || '');
const displayCode = computed(() => room.code || routeCode.value);

const canStart = computed(() => room.isHost && room.players.length >= 1);
const startTitle = computed(() => {
  if (!room.isHost) return 'Seul l’hôte peut démarrer';
  if (room.players.length < 1) return '1 joueur minimum';
  return 'Démarrer la partie';
});

async function copyCode() {
  try {
    await navigator.clipboard.writeText(displayCode.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    room.error = 'Copie impossible, sélectionne le code manuellement.';
  }
}

function confirmKick(targetId) {
  if (window.confirm('Expulser ce joueur ?')) room.kick(targetId);
}

async function leave() {
  await room.leaveRoom();
  router.push({ name: 'home' });
}

onMounted(async () => {
  // Refresh direct sur /salon/#XXXXXX : reprise via token mémorisé, sinon rejoin.
  if (!room.code && routeCode.value) {
    const resumed = await room.resumeRoom(routeCode.value);
    if (!resumed && room.myPseudo.trim().length >= 2) {
      await room.joinRoom({ code: routeCode.value, pseudo: room.myPseudo });
    }
  } else if (room.code) {
    room.pollOnce();
    // Relance le polling (naviguer accueil <-> salon coupe l'ancien timer).
    room.startPolling?.();
  }
});

onUnmounted(() => {
  room.stopPolling();
});

// Expulsé -> retour accueil.
watch(
  () => room.code,
  (c) => {
    if (!c && room.error.includes('expulsé')) router.push({ name: 'home' });
  }
);

// Démarrage (par l'hôte) -> tous les joueurs basculent vers l'interface de jeu.
watch(
  () => room.status,
  (s) => {
    if ((s === 'STARTING' || s === 'PLAYING') && room.code) {
      router.push({ name: 'game', params: { code: room.code } });
    }
  }
);
</script>
