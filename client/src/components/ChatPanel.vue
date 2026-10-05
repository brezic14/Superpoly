<template>
  <div class="chat-history" ref="historyEl">
    <p v-if="chat.messages.length === 0" class="chat-empty">Historique du chat</p>
    <p
      v-for="m in chat.messages"
      :key="m.id"
      :class="m.kind === 'system' ? 'chat-system' : 'chat-msg'"
    >
      <template v-if="m.kind === 'system'">
        <i>{{ m.text }}</i>
      </template>
      <template v-else>
        <strong>{{ m.pseudo }}</strong> : {{ m.text }}
      </template>
    </p>
  </div>
  <p v-if="chat.error" class="chat-error">{{ chat.error }}</p>
  <form class="chat-input" @submit.prevent="submit">
    <input
      v-model="draft"
      class="wire-input chat-box"
      placeholder="Taper ici"
      :maxlength="CHAT_MAX_LENGTH"
      :disabled="chat.sending"
    />
    <button type="submit" class="chat-send-btn" :disabled="!canSend" title="Envoyer">▷</button>
  </form>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useChatStore, CHAT_MAX_LENGTH } from '../stores/chat.js';

const chat = useChatStore();
const draft = ref('');
const historyEl = ref(null);

const canSend = computed(() => draft.value.trim().length > 0 && !chat.sending);

async function submit() {
  const text = draft.value;
  if (!text.trim()) return;
  draft.value = '';
  await chat.send(text);
  scrollBottom();
}

function scrollBottom() {
  nextTick(() => {
    const el = historyEl.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

watch(
  () => chat.messages.length,
  () => scrollBottom()
);
</script>
