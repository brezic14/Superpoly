import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRoomStore } from '../src/lobby/restStore.js';
import { ServiceError, createRoom, joinRoom, publicRoom } from '../src/lobby/service.js';
import {
  advanceTurn,
  initGame,
  publicGame,
  publicProperties,
  removeFromGame,
  resolveBuy,
  rollDice,
} from '../src/game/service.js';
import { cityDetail } from '../src/game/cities.js';

const die = (d) => (d - 1 + 0.5) / 6;

async function twoPlayerStarted() {
  const store = new MemoryRoomStore();
  const { room, me } = await createRoom(store, { name: 'Riri' });
  const j2 = await joinRoom(store, { code: room.code, name: 'Fifi' });
  const saved = await store.get(room.code);
  initGame(saved, () => 0.999); // ordre déterministe : premier puis second
  saved.status = 'STARTING';
  await store.save(saved);
  return { store, room: saved, host: me, guest: j2.me };
}

function curOf(room) {
  const id = room.game.order[room.game.currentIndex];
  const tok = room.players.find((p) => p.id === id).token;
  return { id, tok };
}

/** Lance des dés forcés pour le joueur courant. */
function forceRoll(room, d1, d2) {
  const { tok } = curOf(room);
  const seq = [die(d1), die(d2)];
  let i = 0;
  return { res: rollDice(room, { token: tok, randomFn: () => seq[i++ % 2] }), tok };
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

describe('achat villes libres', () => {
  it('catalogue Milan (500/2000/4000/8000/16000, coût 5000, amélioration 15000)', () => {
    const d = cityDetail(1, {});
    assert.equal(d.nom, 'Milan');
    assert.equal(d.pays, 'Italie');
    assert.equal(d.price, 5000);
    assert.equal(d.baseRent, 500);
    assert.deepEqual(d.rents, [2000, 4000, 8000, 16000]);
    assert.equal(d.salePrice, 2500);
    assert.equal(d.upgradeCost, 15000);
    assert.equal(d.ownerId, null);
  });

  it('atterrissage ville libre -> pending, tour non avancé', async () => {
    const { room } = await twoPlayerStarted();
    // 0 + (1+2)=3 -> 3 (Venise, libre).
    const { res } = forceRoll(room, 1, 2);
    assert.equal(res.game.lastRoll.to, 3);
    assert.ok(res.game.pending);
    assert.equal(res.game.pending.square, 3);
    assert.equal(res.game.pending.detail.nom, 'Venise');
    assert.equal(res.game.lastRoll.rentPayment, null);
    assert.equal(room.game.currentIndex, 0); // tour bloqué
  });

  it('buy débite, transfère, avance le tour + message chat', async () => {
    const { room, host } = await twoPlayerStarted();
    forceRoll(room, 1, 2); // -> Venise
    const before = room.game.players[host.id].money;
    const { game, chat } = resolveBuy(room, { token: host.token, choice: 'buy' });
    assert.equal(room.game.players[host.id].money, before - 5000);
    assert.equal(room.game.ownership[3].ownerId, host.id);
    assert.equal(room.game.pending, null);
    assert.equal(room.game.currentIndex, 1); // tour avancé
    assert.ok(chat.messages.some((m) => m.text.includes('acheté Venise')));
    assert.equal(game.players.find((p) => p.id === host.id).money, before - 5000);
  });

  it('pass ne coûte rien, avance le tour', async () => {
    const { room, host } = await twoPlayerStarted();
    forceRoll(room, 1, 2);
    const before = room.game.players[host.id].money;
    resolveBuy(room, { token: host.token, choice: 'pass' });
    assert.equal(room.game.players[host.id].money, before);
    assert.ok(!room.game.ownership[3]);
    assert.equal(room.game.pending, null);
    assert.equal(room.game.currentIndex, 1);
  });

  it('buy sans fonds -> NOT_ENOUGH_MONEY, pending conservé', async () => {
    const { room, host } = await twoPlayerStarted();
    forceRoll(room, 1, 2);
    room.game.players[host.id].money = 1000;
    await assertFails((async () => resolveBuy(room, { token: host.token, choice: 'buy' }))(), 'NOT_ENOUGH_MONEY');
    assert.ok(room.game.pending); // peut encore passer
    assert.equal(room.game.currentIndex, 0);
  });

  it('résolution par un autre joueur -> NOT_YOUR_TURN ; sans pending -> NO_PENDING', async () => {
    const { room, host, guest } = await twoPlayerStarted();
    forceRoll(room, 1, 2);
    await assertFails((async () => resolveBuy(room, { token: guest.token, choice: 'pass' }))(), 'NOT_YOUR_TURN');
    await assertFails((async () => resolveBuy(room, { token: guest.token, choice: 'x' }))(), 'NOT_YOUR_TURN');
    resolveBuy(room, { token: host.token, choice: 'pass' });
    await assertFails((async () => resolveBuy(room, { token: host.token, choice: 'pass' }))(), 'NO_PENDING');
  });

  it('relancer avec pending -> PENDING_BUY', async () => {
    const { room } = await twoPlayerStarted();
    const { tok } = forceRoll(room, 1, 2);
    await assertFails((async () => rollDice(room, { token: tok, randomFn: () => 0.5 }))(), 'PENDING_BUY');
  });

  it('double + ville libre -> pending puis rejoue après achat', async () => {
    const { room, host } = await twoPlayerStarted();
    // 55 + (1+1)=2 -> 57%56 = 1 (Milan), double.
    room.game.players[host.id].square = 55;
    const cur = room.game.order[room.game.currentIndex];
    assert.equal(cur, host.id);
    const seq = [die(1), die(1)];
    let i = 0;
    const r = rollDice(room, { token: host.token, randomFn: () => seq[i++ % 2] });
    assert.equal(r.game.lastRoll.to, 1);
    assert.equal(r.game.lastRoll.mustRollAgain, true);
    assert.ok(r.game.pending);
    resolveBuy(room, { token: host.token, choice: 'buy' });
    assert.equal(room.game.currentIndex, 0); // rejoue (double)
    assert.equal(room.game.ownership[1].ownerId, host.id);
  });

  it('loyer doublé si pays complet (Italie)', async () => {
    const { room, host } = await twoPlayerStarted();
    room.game.players[host.id].money = 1000000;
    for (const sq of [1, 3, 5, 6]) room.game.ownership[sq] = { ownerId: host.id };
    const props = publicProperties(room);
    assert.equal(props[1].rent, 1000); // base 500 x2
    assert.equal(props[1].price, 5000);
    // Sans pays complet : base seule.
    delete room.game.ownership[3];
    assert.equal(publicProperties(room)[1].rent, 500);
  });

  it('atterrissage sur la ville d’un autre -> loyer payé, tour avancé', async () => {
    const { room, host, guest } = await twoPlayerStarted();
    room.game.ownership[3] = { ownerId: guest.id }; // Venise
    const hostBefore = room.game.players[host.id].money;
    const guestBefore = room.game.players[guest.id].money;
    const { res } = forceRoll(room, 1, 2); // -> 3 (Venise)
    assert.equal(res.game.lastRoll.to, 3);
    assert.equal(res.game.lastRoll.rentPayment.amount, 500);
    assert.equal(res.game.lastRoll.rentPayment.ownerId, guest.id);
    assert.equal(room.game.players[host.id].money, hostBefore - 500);
    assert.equal(room.game.players[guest.id].money, guestBefore + 500);
    assert.equal(room.game.currentIndex, 1);
    assert.ok(res.chat.messages.some((m) => m.text.includes('loyer') && m.text.includes('500')));
  });

  it('loyer doublé quand le propriétaire possède tout le pays', async () => {
    const { room, host, guest } = await twoPlayerStarted();
    for (const sq of [1, 3, 5, 6]) room.game.ownership[sq] = { ownerId: guest.id };
    const hostBefore = room.game.players[host.id].money;
    const guestBefore = room.game.players[guest.id].money;
    const { res } = forceRoll(room, 1, 2); // -> Venise
    assert.equal(res.game.lastRoll.rentPayment.due, 1000); // 500 x2
    assert.equal(res.game.lastRoll.rentPayment.amount, 1000);
    assert.equal(room.game.players[host.id].money, hostBefore - 1000);
    assert.equal(room.game.players[guest.id].money, guestBefore + 1000);
  });

  it('sa propre ville -> aucun loyer, tour avancé', async () => {
    const { room, host } = await twoPlayerStarted();
    room.game.ownership[3] = { ownerId: host.id };
    const before = room.game.players[host.id].money;
    const { res } = forceRoll(room, 1, 2); // -> Venise
    assert.equal(res.game.lastRoll.rentPayment, null);
    assert.equal(room.game.players[host.id].money, before);
    assert.equal(room.game.currentIndex, 1);
  });

  it('double + ville adverse -> loyer payé puis relance', async () => {
    const { room, host, guest } = await twoPlayerStarted();
    room.game.players[host.id].square = 55;
    room.game.ownership[1] = { ownerId: guest.id }; // Milan
    const guestBefore = room.game.players[guest.id].money;
    const seq = [die(1), die(1)]; // 55 + 2 = 57 % 56 = 1
    let i = 0;
    const r = rollDice(room, { token: host.token, randomFn: () => seq[i++ % 2] });
    assert.equal(r.game.lastRoll.to, 1);
    assert.equal(r.game.lastRoll.mustRollAgain, true);
    assert.equal(r.game.lastRoll.rentPayment.amount, 500);
    assert.equal(room.game.players[guest.id].money, guestBefore + 500);
    assert.equal(room.game.currentIndex, 0);
  });

  it('fonds insuffisants -> tout le solde payé, joueur maintenu', async () => {
    const { room, host, guest } = await twoPlayerStarted();
    room.game.ownership[3] = { ownerId: guest.id };
    room.game.players[host.id].money = 300;
    const guestBefore = room.game.players[guest.id].money;
    const { res } = forceRoll(room, 1, 2); // -> Venise, loyer 500
    assert.equal(room.game.players[host.id].money, 0);
    assert.equal(room.game.players[guest.id].money, guestBefore + 300);
    assert.equal(res.game.lastRoll.rentPayment.amount, 300);
    assert.equal(res.game.lastRoll.rentPayment.due, 500);
    assert.ok(room.game.order.includes(host.id));
    assert.ok(res.chat.messages.some((m) => m.text.includes('solde insuffisant')));
  });

  it('case non-ville -> aucun loyer', async () => {
    const { room, host } = await twoPlayerStarted();
    room.game.players[host.id].square = 55;
    const before = room.game.players[host.id].money;
    const { res } = forceRoll(room, 1, 2); // 55 + 3 = 58 % 56 = 2 (Taxe)
    assert.equal(res.game.lastRoll.to, 2);
    assert.equal(res.game.lastRoll.rentPayment, null);
    assert.equal(room.game.players[host.id].money, before);
  });

  it('properties exposées via publicGame et résumé salon', async () => {
    const { room, host } = await twoPlayerStarted();
    forceRoll(room, 1, 2); // -> Venise (3)
    resolveBuy(room, { token: host.token, choice: 'buy' });
    const g = publicGame(room, host.id);
    assert.equal(g.properties[3].ownerId, host.id);
    assert.deepEqual(g.properties[1], { ownerId: null, price: 5000, rent: 500 }); // Milan libre
    const pub = publicRoom(room);
    assert.equal(pub.game.properties[3].ownerId, host.id);
    assert.equal(pub.game.pending, null);
    assert.ok(pub.game.players.find((p) => p.id === host.id).money < 200000);
  });

  it('villes déjà achetées : pas de pending, tour avancé', async () => {
    const { room, host } = await twoPlayerStarted();
    room.game.ownership[3] = { ownerId: host.id };
    forceRoll(room, 1, 2); // -> Venise (à soi)
    assert.equal(room.game.pending, null);
    assert.equal(room.game.currentIndex, 1);
  });

  it('removeFromGame nettoie ordre + pending', async () => {
    const { room, host, guest } = await twoPlayerStarted();
    forceRoll(room, 1, 2); // pending pour host
    assert.ok(room.game.pending);
    removeFromGame(room, host.id);
    assert.equal(room.game.pending, null);
    assert.deepEqual(room.game.order, [guest.id]);
    assert.equal(room.game.currentIndex, 0);
    advanceTurn(room);
    assert.equal(room.game.currentIndex, 0); // un seul joueur restant
  });
});
