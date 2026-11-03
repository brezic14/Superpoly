<template>
  <div class="app-shell">
    <!-- Header retiré sur accueil/salon (cf. maquettes acceuil2 / sallon2). -->
    <header v-if="showHeader" class="app-header">
      <h1 class="logo">Superpoly</h1>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const showHeader = computed(() => !['home', 'lobby'].includes(route.name));
</script>
