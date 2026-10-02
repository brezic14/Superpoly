import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateCode, normalizeCode, normalizeName } from '../src/lobby/code.js';
import { MemoryRoomStore } from '../src/lobby/restStore.js';
import {
  ServiceError,
  createRoom,
  getState,
  joinRoom,
  kickPlayer,
  leaveRoom,
  startRoom,
} from '../src/lobby/service.js';

const freshStore = () => new MemoryRoomStore();

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

describe('code salon', () => {
  it('génère # + 6 chars 0-9A-Z', () => {
    for (let i = 0; i < 50; i += 1) {
      assert.match(generateCode(), /^#[0-9A-Z]{6}$/);
    }
  });
  it('normalise la saisie (sans #, minuscules, espaces)', () => {
    assert.equal(normalizeCode('212a4b'), '#212A4B');
    assert.equal(normalizeCode('  #212A4B  '), '#212A4B');
    assert.equal(normalizeCode('#5eg714'), '#5EG714');
    assert.equal(normalizeCode('trop long 123'), null);
    assert.equal(normalizeCode(''), null);
  });
  it('valide les pseudos 2..20', () => {
    assert.equal(normalizeName('  André  '), 'André');
    assert.equal(normalizeName('a'), null);
    assert.equal(normalizeName('x'.repeat(21)), null);
  });
});

describe('service salon (REST, sans socket)', () => {
  it('crée un salon : créateur hôte avec token secret', async () => {
    const store = freshStore();
    const { room, me } = await createRoom(store, { name: 'Hote' });
    assert.match(room.code, /^#[0-9A-Z]{6}$/);
    assert.equal(room.players.length, 1);
    assert.equal(room.players[0].isHost, true);
    assert.ok(!('token' in room.players[0]), 'le token ne doit pas fuiter');
    assert.ok(me.token);
  });

  it('max 5 joueurs, pseudo unique insensible à la casse', async () => {
    const store = freshStore();
    const { room } = await createRoom(store, { name: 'Hote' });
    for (let i = 1; i <= 4; i += 1) {
      await joinRoom(store, { code: room.code, name: `J${i}` });
    }
    await assertFails(joinRoom(store, { code: room.code, name: 'Trop' }), 'ROOM_FULL');
    await assertFails(joinRoom(store, { code: room.code, name: 'j1' }), 'ROOM_FULL');
  });

  it('pseudo pris + code invalide + salon introuvable', async () => {
    const store = freshStore();
    const { room } = await createRoom(store, { name: 'Hote' });
    await assertFails(joinRoom(store, { code: room.code, name: 'hote' }), 'PSEUDO_TAKEN');
    await assertFails(joinRoom(store, { code: '#XXXX', name: 'Zz' }), 'INVALID_CODE');
    await assertFails(joinRoom(store, { code: '#ZZZZZZ', name: 'Zz' }), 'ROOM_NOT_FOUND');
  });

  it("l'hôte qui quitte -> le doyen est promu", async () => {
    const store = freshStore();
    const { room, me } = await createRoom(store, { name: 'Hote' });
    const j1 = await joinRoom(store, { code: room.code, name: 'J1' });
    await joinRoom(store, { code: room.code, name: 'J2' });
    await leaveRoom(store, { code: room.code, token: me.token });
    const state = await getState(store, { code: room.code, token: j1.me.token });
    assert.equal(state.players.length, 2);
    assert.equal(state.players.find((p) => p.isHost).pseudo, 'J1');
  });

  it('kick réservé hôte, démarrage >= 2 joueurs', async () => {
    const store = freshStore();
    const { room, me } = await createRoom(store, { name: 'Hote' });
    await assertFails(startRoom(store, { code: room.code, token: me.token }), 'NEED_2_PLAYERS');
    const j1 = await joinRoom(store, { code: room.code, name: 'J1' });
    await assertFails(kickPlayer(store, { code: room.code, token: j1.me.token, targetId: me.id }), 'NOT_HOST');
    const kicked = await kickPlayer(store, { code: room.code, token: me.token, targetId: j1.me.id });
    assert.equal(kicked.room.players.length, 1);
    await assertFails(getState(store, { code: room.code, token: j1.me.token }), 'NOT_IN_ROOM');
    const j2 = await joinRoom(store, { code: room.code, name: 'J2' });
    const started = await startRoom(store, { code: room.code, token: me.token });
    assert.equal(started.status, 'STARTING');
    assert.equal(started.gamePlayers.length, 2);
    await assertFails(joinRoom(store, { code: room.code, name: 'Tard' }), 'ALREADY_STARTED');
    assert.ok(j2.me.token);
  });
});
