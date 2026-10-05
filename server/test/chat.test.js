import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRoomStore } from '../src/lobby/restStore.js';
import { ServiceError, createRoom, joinRoom, publicRoom } from '../src/lobby/service.js';
import { postChat } from '../src/chat/service.js';
import { publicChat } from '../src/chat/utils.js';
import { rollDice } from '../src/game/service.js';

async function roomWithTwo() {
  const store = new MemoryRoomStore();
  const { room, me } = await createRoom(store, { name: 'Riri' });
  const j2 = await joinRoom(store, { code: room.code, name: 'Fifi' });
  const saved = await store.get(room.code);
  return { store, room: saved, host: me, guest: j2.me };
}

async function assertFails(promise, expectedKey) {
  try {
    await promise;
  } catch (e) {
    assert.ok(e instanceof ServiceError, 'devrait lever ServiceError');
    assert.equal(e.key, expectedKey);
    return;
  }
  assert.fail(`aurait dû échouer avec ${expectedKey}`);
}

describe('chat', () => {
  it('post joueur + exposition via publicRoom', async () => {
    const { room, host } = await roomWithTwo();
    const { message, chat } = postChat(room, { token: host.token, text: 'salut ! ça va ?' });
    assert.equal(message.kind, 'player');
    assert.equal(message.pseudo, 'Riri');
    assert.equal(message.text, 'salut ! ça va ?');
    assert.ok(chat.messages.length >= 1);
    const pub = publicRoom(room);
    assert.ok(pub.chat.messages.some((m) => m.id === message.id));
  });

  it('rejette vide, trop long, hors-salon, rate-limit', async () => {
    const { room, host } = await roomWithTwo();
    await assertFails((async () => postChat(room, { token: host.token, text: '   ' }))(), 'CHAT_EMPTY');
    await assertFails((async () => postChat(room, { token: host.token, text: 'x'.repeat(201) }))(), 'CHAT_TOO_LONG');
    await assertFails((async () => postChat(room, { token: 'nope', text: 'coucou' }))(), 'NOT_IN_ROOM');
    postChat(room, { token: host.token, text: 'premier' });
    await assertFails((async () => postChat(room, { token: host.token, text: 'second' }))(), 'CHAT_RATE_LIMIT');
  });

  it('messages système : join + roll « a fait »', async () => {
    const { room, host, guest } = await roomWithTwo();
    const sysJoin = room.chat.messages.filter((m) => m.kind === 'system');
    assert.ok(sysJoin.some((m) => m.text.includes('Fifi') && m.text.includes('rejoint')));
    // Simule un début de partie minimal pour lancer les dés.
    room.game = {
      status: 'PLAYING',
      order: [host.id, guest.id],
      currentIndex: 0,
      players: {
        [host.id]: { id: host.id, pseudo: 'Riri', color: '#FF0000', square: 0 },
        [guest.id]: { id: guest.id, pseudo: 'Fifi', color: '#1E6FFF', square: 0 },
      },
      lastRoll: null,
      version: 1,
    };
    const r = rollDice(room, { token: host.token, randomFn: () => 0.5 });
    assert.ok(r.chat.messages.some((m) => m.kind === 'system' && m.text.includes('a fait')));
    assert.ok(publicChat(room).messages.length <= 50);
  });

  it('plafonne l’historique à 100', async () => {
    const { room, host } = await roomWithTwo();
    for (let i = 0; i < 120; i += 1) {
      room.chat.lastSentAt[host.id] = 0;
      postChat(room, { token: host.token, text: `msg ${i}` });
    }
    assert.equal(room.chat.messages.length, 100);
  });
});
