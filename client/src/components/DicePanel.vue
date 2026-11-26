<template>
  <div class="state-panel">
    <span class="state-label">état</span>
    <p class="state-title">{{ title }}</p>
    <p class="state-desc">{{ description }}</p>
    <p class="dice-result" v-if="lastRoll">{{ lastRoll.d1 }} + {{ lastRoll.d2 }} = {{ lastRoll.total }}</p>
    <p class="state-desc" v-if="lastRoll">De {{ caseName(lastRoll.from) }} vers {{ caseName(lastRoll.to) }}</p>
    <p class="state-desc" v-if="lastRoll?.startBonus">
      Case Départ : <span class="m-gain">+{{ fmt(lastRoll.startBonus) }}</span>
    </p>
    <p class="state-desc info" v-if="lastRoll?.isDouble && !lastRoll?.sentToPrison">Double ! Rejouez.</p>
    <p class="state-desc info" v-if="lastRoll?.sentToPrison">3 doubles… direction la prison !</p>
    <p class="state-desc rent" v-if="rent">
      <template v-if="rent.amount > 0">
        Loyer payé : <span class="m-cost">{{ fmt(rent.amount) }}</span> à {{ rent.ownerPseudo }}
      </template>
      <template v-else>
        Loyer impayé : <span class="m-cost">{{ fmt(rent.due) }}</span> à {{ rent.ownerPseudo }}
      </template>
      <span v-if="rent.amount < rent.due"> (solde insuffisant)</span>
    </p>
    <p class="state-desc info" v-if="pending">En attente du choix passer / acheter…</p>
    <button class="wire-btn dice-btn" :disabled="!canRoll || rolling || animating" @click="$emit('roll')">
      {{ rolling ? 'Lancer…' : 'lancer les dés' }}
    </button>
    <p class="error" v-if="error">{{ error }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import board from '../data/board.json';

const props = defineProps({
  isMyTurn: { type: Boolean, default: false },
  animating: { type: Boolean, default: false },
  rolling: { type: Boolean, default: false },
  currentName: { type: String, default: '' },
  lastRoll: { type: Object, default: null },
  error: { type: String, default: '' },
  pending: { type: Object, default: null },
});
defineEmits(['roll']);

const canRoll = computed(() => props.isMyTurn && !props.animating && !props.rolling && !props.pending);
const rent = computed(() => props.lastRoll?.rentPayment ?? null);

function fmt(n) {
  return `${Number(n ?? 0).toLocaleString('fr-FR')}€`;
}

// Nom de case pour vérifier visuellement chaque déplacement (ex. "De Lille vers Florence").
function caseName(id) {
  const cell = board.find((s) => s.id === id);
  return cell ? `${cell.nom} (${cell.id})` : `#${id}`;
}

const title = computed(() => {
  if (props.animating) return 'Déplacement…';
  if (props.isMyTurn) return 'A vous de jouer';
  if (props.currentName) return `Tour de ${props.currentName}`;
  return 'Partie en cours';
});

const description = computed(() => {
  if (props.isMyTurn) return 'Lancez les dés et déplacez-vous d\u2019autant de cases que la somme du montant des deux dés.';
  return 'Patientez : le joueur courant lance les dés, son pion avance case par case.';
});
</script>
