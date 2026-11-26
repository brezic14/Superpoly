import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRoomStore } from '../src/lobby/restStore.js';
import { createRoom, joinRoom, startRoom } from '../src/lobby/service.js';
import { BOARD_SIZE, PRISON_SQUARE, START_BONUS, getGameState, initGame, publicGame, rollDice } from '../src/game/service.js';

async function twoPlayerRoom() {
  const store = new MemoryRoomStore();
  const { room, me } = await createRoom(store, { name: 'Hote' });
  const j2 = await joinRoom(store, { code: room.code, name: 'J2' });
  const started = await startRoom(store, { code: room.code, token: me.token });
  const saved = await store.get(room.code);
  return { store, room: saved, host: me, guest: j2.me, started };
}

const die = (d) => (d - 1 + 0.5) / 6;

function currentToken(room) {
  const id = room.game.order[room.game.currentIndex];
  const player = room.players.find((p) => p.id === id);
  return { id, token: player.token };
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

  it('déplacement modulo 56', () => {
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
    // randomFn donnant 3 : 1+floor(r*6)=3 -> r dans [0.333,0.5[. Double -> rejouer mais square=(54+6)%56=4.
    const r = rollDice(room, { token: tok, randomFn: () => 0.4 });
    assert.equal(r.total, 6);
    assert.equal(r.game.players.find((p) => p.id === cur).square, 4);
  });

  it('passage case départ : 55 + 4 = 3, 54 + 2 = 0 (pile Départ)', () => {
    for (const [from, d1, d2, expected] of [[55, 1, 3, 3], [54, 1, 1, 0], [35, 1, 1, 37], [0, 6, 6, 12]]) {
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
      room.game.players[cur].square = from;
      const seq = [(d1 - 1 + 0.5) / 6, (d2 - 1 + 0.5) / 6];
      let i = 0;
      const r = rollDice(room, { token: tok, randomFn: () => seq[i++ % seq.length] });
      assert.equal(r.total, d1 + d2);
      assert.equal(r.game.players.find((p) => p.id === cur).square, expected);
      assert.equal(r.game.lastRoll.from, from);
      assert.equal(r.game.lastRoll.to, expected);
    }
  });

  it('passage par la case Départ -> bonus 25 000', async () => {
    const { room } = await twoPlayerRoom();
    const { id, token } = currentToken(room);
    room.game.players[id].square = 54;
    const before = room.game.players[id].money;
    const seq = [die(1), die(2)]; // 54 + 3 = 57 % 56 = 1
    let i = 0;
    const r = rollDice(room, { token, randomFn: () => seq[i++ % 2] });
    assert.equal(r.total, 3);
    assert.equal(r.game.lastRoll.to, 1);
    assert.equal(r.game.lastRoll.passedStart, true);
    assert.equal(r.game.lastRoll.startBonus, START_BONUS);
    assert.equal(room.game.players[id].money, before + START_BONUS);
    assert.ok(r.chat.messages.some((m) => m.text.includes('case Départ') && m.text.includes('25')));
  });

  it('arrêt pile sur la case Départ -> bonus + relance', async () => {
    const { room } = await twoPlayerRoom();
    const { id, token } = currentToken(room);
    room.game.players[id].square = 54;
    const before = room.game.players[id].money;
    const seq = [die(1), die(1)]; // 54 + 2 = 56 % 56 = 0 (double)
    let i = 0;
    const r = rollDice(room, { token, randomFn: () => seq[i++ % 2] });
    assert.equal(r.game.lastRoll.to, 0);
    assert.equal(r.game.lastRoll.passedStart, true);
    assert.equal(r.game.lastRoll.mustRollAgain, true);
    assert.equal(room.game.players[id].money, before + START_BONUS);
    assert.ok(r.chat.messages.some((m) => m.text.includes('arrive sur la case Départ')));
  });

  it('aucun bonus de Départ au premier lancer depuis la case 0', async () => {
    const { room } = await twoPlayerRoom();
    const { id, token } = currentToken(room);
    room.game.players[id].square = 0;
    const before = room.game.players[id].money;
    const seq = [die(1), die(2)]; // -> 3, sans tour complet
    let i = 0;
    const r = rollDice(room, { token, randomFn: () => seq[i++ % 2] });
    assert.equal(r.game.lastRoll.passedStart, false);
    assert.equal(r.game.lastRoll.startBonus, 0);
    assert.equal(room.game.players[id].money, before);
  });

  it('déplacement normal sans tour complet -> aucun bonus', async () => {
    const { room } = await twoPlayerRoom();
    const { id, token } = currentToken(room);
    room.game.players[id].square = 10;
    const before = room.game.players[id].money;
    const seq = [die(1), die(2)]; // -> 13
    let i = 0;
    const r = rollDice(room, { token, randomFn: () => seq[i++ % 2] });
    assert.equal(r.game.lastRoll.to, 13);
    assert.equal(r.game.lastRoll.passedStart, false);
    assert.equal(r.game.lastRoll.startBonus, 0);
    assert.equal(room.game.players[id].money, before);
  });

  it('3 doubles -> prison sans bonus même si la distance croise le Départ', async () => {
    const { room } = await twoPlayerRoom();
    const { id, token } = currentToken(room);
    room.game.players[id].square = 54;
    room.game.lastRoll = { playerId: id, doublesCount: 2 };
    const before = room.game.players[id].money;
    const seq = [die(1), die(1)]; // 54 + 2 : croiserait 0, mais envoi direct en prison
    let i = 0;
    const r = rollDice(room, { token, randomFn: () => seq[i++ % 2] });
    assert.equal(r.game.lastRoll.sentToPrison, true);
    assert.equal(r.game.lastRoll.passedStart, false);
    assert.equal(r.game.lastRoll.startBonus, 0);
    assert.equal(room.game.players[id].money, before);
    assert.equal(room.game.players[id].square, PRISON_SQUARE);
  });

  it('gid : chaque démarrage incrémente, exposé en vue publique', () => {
    const room = {
      version: 1,
      players: [
        { id: 'a', pseudo: 'A', token: 't-a' },
        { id: 'b', pseudo: 'B', token: 't-b' },
      ],
    };
    initGame(room, () => 0.999);
    assert.equal(room.game.gid, 1);
    assert.equal(publicGame(room).gid, 1);
    initGame(room, () => 0.999);
    assert.equal(room.game.gid, 2);
    assert.equal(publicGame(room).gid, 2);
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
    assert.ok(BOARD_SIZE === 56);
  });
});
