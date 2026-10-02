<template>
  <div class="frame">
    <div class="home-grid">
      <div class="home-top">
        <button class="wire-btn" :disabled="!canCreate || busy" @click="onCreate">Créer une partie</button>
        <input
          v-model="pseudo"
          class="wire-input"
          placeholder="nom"
          maxlength="20"
          autocomplete="nickname"
        />
      </div>
      <div class="home-bottom">
        <button class="wire-btn" :disabled="!canJoin || busy" @click="onJoin">Rejoindre une partie</button>
        <input
          v-model="joinCode"
          class="wire-input"
          placeholder="code"
          maxlength="7"
          autocapitalize="characters"
          @input="joinCode = joinCode.toUpperCase()"
        />
      </div>
    </div>
    <p class="error">{{ room.error }}</p>
    <p class="hint">Ex de code : #212A4B — le # est ajouté automatiquement si tu l'oublies.</p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useRoomStore } from '../stores/room.js';

const room = useRoomStore();
const router = useRouter();

const pseudo = ref(room.myPseudo);
const joinCode = ref('');
const busy = ref(false);

const canCreate = computed(() => pseudo.value.trim().length >= 2);
const canJoin = computed(() => pseudo.value.trim().length >= 2 && joinCode.value.trim().length >= 6);

// Quand le serveur confirme création / arrivée, on bascule vers /salon/#CODE.
watch(
  () => room.code,
  (newCode) => {
    if (newCode) router.push({ name: 'lobby', params: { code: newCode } });
  }
);

async function onCreate() {
  busy.value = true;
  try {
    await room.createRoom(pseudo.value);
  } finally {
    busy.value = false;
  }
}

async function onJoin() {
  busy.value = true;
  try {
    await room.joinRoom({ code: joinCode.value, pseudo: pseudo.value });
  } finally {
    busy.value = false;
  }
}
</script>
