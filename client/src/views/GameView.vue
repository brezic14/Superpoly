<template>
  <div class="game-layout">
    <!-- Colonne gauche : quitter + chat (placeholder MVP) -->
    <aside class="game-left">
      <button class="quit-btn" @click="leave">Quitter</button>
      <div class="chat-history">Historique du chat</div>
      <div class="chat-input">
        <input class="wire-input chat-box" placeholder="Taper ici" disabled />
        <span class="chat-send">▷</span>
      </div>
    </aside>

    <!-- Centre : plateau -->
    <section class="game-center">
      <p v-if="!game.game" class="hint">Chargement de la partie…</p>
      <GameBoard
        v-else
        :players="game.players"
        :positions="game.displayPositions"
        :last-roll="game.lastRoll"
      />
    </section>

    <!-- Colonne droite : joueurs + état/dés + moi -->
    <aside class="game-right">
      <PlayerSidebar
        :players="game.players"
        :current-id="game.currentPlayerId"
        :my-id="room.myPlayerId"
      />
      <DicePanel
        :is-my-turn="game.isMyTurn"
        :animating="game.animating"
        :rolling="game.rolling"
        :current-name="game.currentPlayer?.pseudo ?? ''"
        :last-roll="game.lastRoll"
        :error="game.error || room.error"
        @roll="game.roll()"
      />
      <div class="me-card" v-if="me">
        <p>{{ me.pseudo }} (vous)</p>
        <span class="pawn-big" :style="{ background: me.color }" />
        <p>{{ START_MONEY.toLocaleString('fr-FR') }}€</p>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRoomStore } from '../stores/room.js';
import { useGameStore } from '../stores/game.js';
import GameBoard from '../components/GameBoard.vue';
import DicePanel from '../components/DicePanel.vue';
import PlayerSidebar from '../components/PlayerSidebar.vue';

const props = defineProps({ code: { type: String, default: '' } });
const route = useRoute();
const router = useRouter();
const room = useRoomStore();
const game = useGameStore();

const START_MONEY = 200000;
const routeCode = computed(() => props.code || route.params.code || '');
const me = computed(() => game.players.find((p) => p.id === room.myPlayerId) ?? null);

let gameTimer = null;

async function leave() {
  if (gameTimer) clearInterval(gameTimer);
  game.reset();
  await room.leaveRoom();
  router.push({ name: 'home' });
}

onMounted(async () => {
  // Refresh direct sur /partie/#XXXXXX : reprise via token mémorisé.
  if (!room.code && routeCode.value) {
    const resumed = await room.resumeRoom(routeCode.value);
    if (!resumed) {
      router.push({ name: 'home' });
      return;
    }
  }
  room.startPolling?.();
  await game.pollOnce();
  gameTimer = setInterval(() => game.pollOnce(), 2000);
});

onUnmounted(() => {
  if (gameTimer) clearInterval(gameTimer);
  room.stopPolling();
});

// Expulsé / salon disparu -> accueil. Réinitialisé (WAITING) -> salon.
watch(
  () => room.code,
  (c) => {
    if (!c) router.push({ name: 'home' });
  }
);
watch(
  () => room.status,
  (s) => {
    if (s === 'WAITING' && room.code) router.push({ name: 'lobby', params: { code: room.code } });
  }
);
</script>
