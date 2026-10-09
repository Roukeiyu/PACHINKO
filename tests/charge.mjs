import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { chargeAt, overchargeAt, chargeEffectsAt } from '../src/charge.js';
import { createTable, STEP } from '../src/physics.js';

assert.equal(chargeAt(2000), 1);
assert.equal(overchargeAt(2000), 0);
assert.ok(overchargeAt(4999) < 1, 'no five-ball reward before the entire extra three seconds');
assert.equal(overchargeAt(5000), 1);
assert.equal(overchargeAt(20000), 1);
for (let ms = 0; ms < 5000; ms += 10) {
  const before = chargeEffectsAt(ms), after = chargeEffectsAt(ms + 10);
  assert.ok(after.goldRadius <= before.goldRadius, 'gold ring continuously converges');
  if (ms >= 2000) {
    assert.ok(after.coronaRadius >= before.coronaRadius && after.coronaAlpha >= before.coronaAlpha, 'corona grows gradually in both size and intensity');
    assert.ok(after.coronaRadius - before.coronaRadius < .21, 'no late snap to the maximum');
  }
}
const seeded = initial => { let seed = initial; return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
for (const slots of [5,7,9]) for (let seed = 1; seed <= 20; seed++) {
  const shots = [], settlements = new Set();
  const game = createTable({ slots, random: seeded(seed), starRandom: seeded(seed+80), onSurprise: e => { if(e.source === 'charged') {
    const ball = game.balls.find(b => b.id === e.ballId);
    assert.equal(ball.power, 1); assert.equal(ball.bonus, false);
    assert.ok(game.balls.every(other => other === ball || Math.hypot(other.body.position.x - ball.body.position.x, other.body.position.y - ball.body.position.y) > 22), 'new shots never stack inside the spring');
    shots.push(e);
  } }, onScore: e => { assert.ok(!settlements.has(e.ballId), 'each physical ball settles once'); settlements.add(e.ballId); } });
  assert.ok(game.launchBurst());
  assert.equal(game.stats.launches, 1);
  assert.equal(game.pendingLaunches, 4);
  assert.equal(game.launchBurst(), null, 'a pending burst cannot be duplicated');
  assert.equal(game.launch(1), null, 'normal firing cannot interrupt reserved shots');
  for (let i=0; i<Math.ceil(46000/STEP); i++) {
    game.step();
    for (const ball of game.balls) assert.ok(ball.body.position.x >= 30 && ball.body.position.x <= 734 && ball.body.position.y >= 36, 'burst stays inside the same physical table');
  }
  assert.equal(shots.length, 5); assert.equal(game.stats.launches, 5);
  assert.ok(shots.at(-1).at <= 370, 'five physical shots emerge within 0.37 seconds');
  assert.deepEqual(shots.map(e => e.ordinal), [0,1,2,3,4]);
  assert.equal(game.stats.entered, 5, 'all five shots pass through the real lane into play');
  assert.equal(game.stats.timeouts, 0); assert.equal(game.balls.length, 0);
  assert.equal(game.stats.launches + game.stats.bonusBalls, game.stats.scored + game.stats.absorbed + game.stats.returns, 'all original and rewarded balls accounted for');
}
{
  const game = createTable();
  for(let i=0;i<20;i++) { const ball = game.launch(1); ball.entered = true; Matter.Body.setPosition(ball.body, {x:200+i*23,y:750}); }
  assert.equal(game.launchBurst(), null, 'capacity rejects the entire burst instead of dropping part of the five-ball reward');
  assert.equal(game.stats.launches, 20); assert.equal(game.pendingLaunches, 0);
}
{
  const game = createTable(); game.launchBurst();
  game.setSlots(9); for(let i=0;i<100;i++) game.step();
  assert.equal(game.pendingLaunches, 0); assert.equal(game.balls.length, 0, 'clearing in-flight balls also clears their pending shooter burst');
}
console.log('PASS: charge timing and gradual effects; 60 five-ball bursts clear the real lane without overlap, escape, timeouts or duplicate settlement; capacity and layout cancellation.');
