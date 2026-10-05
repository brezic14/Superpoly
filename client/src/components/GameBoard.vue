<template>
  <div class="board-wrap">
    <img class="board-img" :src="plateauUrl" alt="Plateau Superpoly" draggable="false" />
    <!-- Un pion par joueur : cercle couleur, position % depuis board.json.
         Pions superposés : seul le dernier arrivé visible (z-index = ordre d'arrivée). -->
    <div
      v-for="(p, idx) in orderedPawns"
      :key="p.id"
      class="pawn"
      :style="{
        left: p.x + '%',
        top: p.y + '%',
        background: p.color,
        zIndex: 10 + idx,
        opacity: idx === orderedPawns.length - 1 || p.square !== lastSquare ? 1 : 0.85,
      }"
      :title="p.pseudo"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import plateauUrl from '../assets/plateau.png';
import board from '../data/board.json';

const props = defineProps({
  players: { type: Array, default: () => [] },
  positions: { type: Object, default: () => ({}) },
  lastRoll: { type: Object, default: null },
});

// Trie les pions : ceux sur la même case s'empilent, le dernier arrivé (lastRoll.playerId) au-dessus.
const orderedPawns = computed(() => {
  const list = props.players.map((p) => {
    const square = props.positions[p.id] ?? p.square ?? 0;
    const cell = board.find((s) => s.id === square) ?? board[0];
    return { ...p, square, x: cell.x, y: cell.y };
  });
  return list.slice().sort((a, b) => {
    if (a.square !== b.square) return a.square - b.square;
    if (props.lastRoll) {
      if (a.id === props.lastRoll.playerId) return 1;
      if (b.id === props.lastRoll.playerId) return -1;
    }
    return 0;
  });
});

const lastSquare = computed(() => {
  if (!props.lastRoll) return -1;
  return props.positions[props.lastRoll.playerId] ?? props.lastRoll.to;
});
</script>
