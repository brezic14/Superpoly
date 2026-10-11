<template>
  <div class="board-wrap">
    <img class="board-img" :src="plateauUrl" alt="Plateau Superpoly" draggable="false" />
    <!-- Debug ?debug=1 : id de chaque case (vérif attribution des étiquettes). -->
    <template v-if="debug">
      <div
        v-for="cell in board"
        :key="'dbg-' + cell.id"
        class="debug-id"
        :style="{ left: cell.x + '%', top: cell.y + '%' }"
      >
        {{ cell.id }}
      </div>
    </template>
    <!-- Étiquettes prix/loyer au slot <pos_coût> : prix d'achat en noir si ville
         libre, sinon loyer actuel de la couleur du propriétaire. -->
    <div
      v-for="tag in priceTags"
      :key="'tag-' + tag.id"
      class="price-tag"
      :data-square="tag.id"
      :style="{
        left: tag.x + '%',
        top: tag.y + '%',
        color: tag.color,
        transform: `translate(-50%, -50%) rotate(${tag.angle}deg)`,
      }"
    >
      {{ tag.label }}
    </div>
    <!-- Étiquettes prix/loyer : prix d'achat en noir si ville libre, sinon loyer
         actuel de la couleur du propriétaire. Rotation selon le sens de marche. -->
    <div
      v-for="tag in priceTags"
      :key="'tag-' + tag.id"
      class="price-tag"
      :style="{
        left: tag.x + '%',
        top: tag.y + '%',
        color: tag.color,
        transform: `translate(-50%, -50%) rotate(${tag.angle}deg)`,
      }"
    >
      {{ tag.label }}
    </div>
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
import { slotFor } from './cellSlots.js';

const debug = new URLSearchParams(window.location.search).has('debug');

const props = defineProps({
  players: { type: Array, default: () => [] },
  positions: { type: Object, default: () => ({}) },
  lastRoll: { type: Object, default: null },
  properties: { type: Object, default: () => ({}) },
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

const colorByPlayer = computed(() => {
  const map = {};
  for (const p of props.players) map[p.id] = p.color;
  return map;
});

// Une étiquette par case ville, ancrée au slot <pos_coût> : prix (noir, libre)
// ou loyer (couleur du proprio).
const priceTags = computed(() =>
  board
    .filter((s) => s.type === 'ville')
    .map((cell) => {
      const info = props.properties[cell.id] ?? props.properties[String(cell.id)];
      const ownerId = info?.ownerId ?? null;
      const amount = ownerId ? info?.rent : info?.price;
      const slot = slotFor(cell);
      return {
        id: cell.id,
        x: slot.cost.x,
        y: slot.cost.y,
        angle: slot.angle,
        color: ownerId ? colorByPlayer.value[ownerId] ?? '#111' : '#111',
        label:
          amount == null
            ? ''
            : `${Number(amount).toLocaleString('fr-FR')}€`,
      };
    })
    .filter((t) => t.label !== '')
);
</script>
