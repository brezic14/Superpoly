<template>
  <div class="player-list">
    <div v-if="players.length === 0">En attente de joueurs…</div>
    <div v-for="p in players" :key="p.id" class="player-row">
      <span>{{ p.pseudo }}<span v-if="p.isHost" class="host-badge">👑 hôte</span></span>
      <button
        v-if="isHost && p.id !== myId"
        class="kick"
        title="Expulser"
        @click="$emit('kick', p.id)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  players: { type: Array, default: () => [] },
  isHost: { type: Boolean, default: false },
  myId: { type: String, default: '' },
});
defineEmits(['kick']);
</script>
