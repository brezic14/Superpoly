<template>
  <div class="side-players">
    <div
      v-for="p in players"
      :key="p.id"
      class="side-player"
      :class="{ active: p.id === currentId, me: p.id === myId }"
    >
      <span class="pawn-dot" :style="{ background: p.color }" />
      <span class="side-name">{{ p.pseudo }}<span v-if="p.id === myId"> (vous)</span></span>
      <span class="side-money">{{ (p.money ?? START_MONEY).toLocaleString('fr-FR') }}€</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  players: { type: Array, default: () => [] },
  currentId: { type: String, default: null },
  myId: { type: String, default: '' },
});

// Capital de départ fixe en MVP (aucun effet de case appliqué pour l'instant).
const START_MONEY = 200000;
</script>
