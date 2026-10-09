<template>
  <div v-if="pending?.detail" class="city-card">
    <p class="city-kind">ville</p>
    <p class="city-title">{{ pending.detail.nom }} ({{ pending.detail.pays }})</p>
    <div class="city-rows">
      <p>Loyer de base : <strong>{{ fmt(pending.detail.baseRent) }}</strong></p>
      <p
        v-for="n in 4"
        :key="n"
        class="city-rent-up"
      >
        Loyer {{ n }} amélioration{{ n > 1 ? 's' : '' }} : {{ fmt(pending.detail.rents[n - 1]) }}
      </p>
      <p>Coût : <strong>{{ fmt(pending.detail.price) }}</strong></p>
      <p class="city-soft">
        vente : {{ fmt(pending.detail.salePrice) }}
        <span class="city-sep">amélioration : {{ fmt(pending.detail.upgradeCost) }}</span>
      </p>
    </div>
    <div class="city-actions">
      <button
        class="wire-btn city-pass"
        :disabled="!canAct || resolving"
        @click="$emit('pass')"
      >
        passer
      </button>
      <button
        class="wire-btn city-buy"
        :disabled="!canAct || resolving || !affordable"
        :title="!affordable ? 'Fonds insuffisants' : 'Acheter cette ville'"
        @click="$emit('buy')"
      >
        acheter
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  pending: { type: Object, default: null },
  myId: { type: String, default: '' },
  myMoney: { type: Number, default: 0 },
  resolving: { type: Boolean, default: false },
});
defineEmits(['buy', 'pass']);

// Boutons actifs uniquement pour le joueur concerné (choix utilisateur) ;
// les autres voient la fiche avec boutons grisés.
const canAct = computed(() => !!props.pending && props.pending.playerId === props.myId);
const affordable = computed(() => (props.myMoney ?? 0) >= (props.pending?.detail?.price ?? Infinity));

function fmt(n) {
  return `${Number(n ?? 0).toLocaleString('fr-FR')}€`;
}
</script>
