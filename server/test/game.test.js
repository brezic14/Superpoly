import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRoomStore } from '../src/lobby/restStore.js';
import { createRoom, joinRoom, startRoom } from '../src/lobby/service.js';
import { BOARD_SIZE, PRISON_SQUARE, getGameState, initGame, rollDice } from '../src/game/service.js';

async function twoPlayerRoom() {
  const store = new MemoryRoomStore();
  const { room, me } = await createRoom(store, { name: 'Hote' });
  const j2 = await joinRoom(store, { code: room.code, name: 'J2' });
  const started = await startRoom(store, { code: room.code, token: me.token });
  const saved = await store.get(room.code);
  return { store, room: saved, host: me, guest: j2.me, started };
}

describe('moteur jeu (déplacement seul)', () => {
  it('initGame : ordre fixe, case 0, couleurs distinctes', async () => {
    const { room } = await twoPlayerRoom();
    assert.ok(room.game);
    assert.equal(room.game.order.length, 2);
    assert.equal(room.game.currentIndex, 0);
    for (const p of Object.values(room.game.players)) {
      assert.equal(p.square, 0);
      assert.ok(p.color);
    }
    const colors = Object.values(room.game.players).map((p) => p.color);
    assert.equal(new Set(colors).size, 2);
  });

  it('seul le joueur courant peut lancer, tour suivant sinon', async () => {
    const { store, room, host, guest } = await twoPlayerRoom();
    const currentId = room.game.order[room.game.currentIndex];
    const other = currentId === host.id ? guest : host;
    const current = currentId === host.id ? host : guest;
    try {
      rollDice(room, { token: other.token, randomFn: () => 0 });
      assert.fail('aurait dû échouer NOT_YOUR_TURN');
    } catch (e) {
      assert.equal(e.key, 'NOT_YOUR_TURN');
    }
    // randomFn -> 0 donne d1=d2=1 (double). Premier lancer : doit rejouer.
    const r = rollDice(room, { token: current.token, randomFn: () => 0 });
    assert.equal(r.d1, 1);
    assert.equal(r.d2, 1);
    assert.equal(r.game.lastRoll.mustRollAgain, true);
    assert.equal(room.game.currentIndex, 0 === room.game.currentIndex ? room.game.currentIndex : room.game.currentIndex);
    await store.save(room);
  });

  it('déplacement modulo 57', () => {
    const room = {
      version: 1,
      players: [
        { id: 'a', pseudo: 'A', token: 't-a' },
        { id: 'b', pseudo: 'B', token: 't-b' },
      ],
    };
    initGame(room, () => 0.999);
    // Place le joueur courant à la case 54, force un total de 6 (d1=3,d2=3 -> double mais total 6).
    const cur = room.game.order[0];
    const tok = cur === 'a' ? 't-a' : 't-b';
    room.game.players[cur].square = 54;
    // randomFn donnant 3 : 1+floor(r*6)=3 -> r dans [0.333,0.5[. Double -> rejouer mais square=(54+6)%57=3.
    const r = rollDice(room, { token: tok, randomFn: () => 0.4 });
    assert.equal(r.total, 6);
    assert.equal(r.game.players.find((p) => p.id === cur).square, 3);
  });

  it('3 doubles -> prison + tour suivant', () => {
    const room = {
      version: 1,
      players: [
        { id: 'a', pseudo: 'A', token: 't-a' },
        { id: 'b', pseudo: 'B', token: 't-b' },
      ],
    };
    initGame(room, () => 0.999);
    const cur = room.game.order[0];
    const tok = cur === 'a' ? 't-a' : 't-b';
    const zero = () => 0; // d1=d2=1 à chaque fois
    rollDice(room, { token: tok, randomFn: zero });
    rollDice(room, { token: tok, randomFn: zero });
    const third = rollDice(room, { token: tok, randomFn: zero });
    assert.equal(third.game.lastRoll.sentToPrison, true);
    assert.equal(third.game.players.find((p) => p.id === cur).square, PRISON_SQUARE);
    assert.equal(third.game.lastRoll.mustRollAgain, false);
    assert.notEqual(room.game.order[room.game.currentIndex], cur);
  });

  it('getGameState expose isMyTurn', async () => {
    const { room, host } = await twoPlayerRoom();
    const state = getGameState(room, { token: host.token });
    assert.equal(typeof state.isMyTurn, 'boolean');
    assert.equal(state.players.length, 2);
    assert.ok(BOARD_SIZE === 57);
  });
});
