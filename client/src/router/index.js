import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import LobbyView from '../views/LobbyView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/salon/:code', name: 'lobby', component: LobbyView, props: true },
    { path: '/:pathMatch(.*)*', redirectTo: '/' },
  ],
});

export default router;
