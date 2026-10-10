import assert from 'node:assert/strict';
import { restoreCollections, collectSlot } from '../src/collections.js';
const counts = restoreCollections();
assert.deepEqual(counts, { 2: 0, 3: 0, 5: 0, 10: 0 });
collectSlot(counts, { kind: 'slot', column: 0, multiplier: 2, globalMultiplier: 5, scoreFactor: 25 });
collectSlot(counts, { kind: 'slot', column: 6, multiplier: 2 });
assert.equal(counts[2], 2, 'same fruit shares progress; bonus points do not multiply collection quantity');
assert.equal(collectSlot(counts, { kind: 'jackpot', multiplier: 2 }), null);
assert.equal(collectSlot(counts, { kind: 'return', multiplier: 2 }), null);
assert.equal(collectSlot(counts, { kind: 'slot', multiplier: 99 }), null);
assert.equal(counts[2], 2, 'only valid fruit slots collect');
assert.deepEqual(restoreCollections(JSON.parse(JSON.stringify(counts))), counts, 'progress survives serialization');
assert.deepEqual(restoreCollections({ 2: -1, 3: 1.5, 5: '20', 10: 40 }), { 2: 0, 3: 0, 5: 0, 10: 40 });
for (const saved of [null, false, 0, 'bad']) assert.deepEqual(restoreCollections(saved), { 2: 0, 3: 0, 5: 0, 10: 0 });
const maximum = restoreCollections({ 2: Number.MAX_SAFE_INTEGER });
collectSlot(maximum, { kind: 'slot', multiplier: 2 });
assert.equal(maximum[2], Number.MAX_SAFE_INTEGER);
console.log('PASS: shared fruit counts, one collection per slot entry, exclusions and safe saved progress.');

const { collectionStatus, COLLECTION_GOALS } = await import('../src/collections.js');
const { createTable, TABLE, slotMultipliers } = await import('../src/physics.js');
const { default: Matter } = await import('matter-js');
function drop(game, column, factor = 1) {
  const ball = game.launch(); assert.ok(ball); ball.entered = true; ball.scoreFactor = factor;
  Matter.Body.setPosition(ball.body, { x: TABLE.left + (column + .5) * (TABLE.right - TABLE.left) / game.slots, y: TABLE.scoreLine - 1 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: 6 }); game.step();
}
for (const slots of [5,7,9]) for (const multiplier of new Set(slotMultipliers(slots))) for (const [index,goal] of COLLECTION_GOALS.entries()) {
  const stock = restoreCollections({ [multiplier]: goal - 1 }), events = [];
  const game = createTable({ slots, collections: stock, onScore: e => events.push(e) });
  game.slotMachine.tripleUntil = 60000;
  const column = slotMultipliers(slots).indexOf(multiplier);
  drop(game,column,2);
  assert.equal(events.length,1); assert.equal(stock[multiplier],goal);
  assert.equal(events[0].points, multiplier * 10 * 2 * 5 * [1,1.5,2][index], 'threshold entry uses the previous level with both temporary bonuses');
  assert.equal(events[0].collection.upgraded,true); assert.equal(events[0].collection.level,index+1);
  drop(game,slotMultipliers(slots).lastIndexOf(multiplier),2);
  assert.equal(stock[multiplier],goal+1);
  assert.equal(events[1].points, multiplier * 10 * 2 * 5 * [1.5,2,3][index], 'next entry uses the new level, including a matching slot on the other side');
  assert.equal(events[1].collection.upgraded,false);
  for(let i=0;i<20;i++)game.step();assert.equal(events.length,2,'settled balls cannot collect again');
  game.setSlots(slots===5?9:5);assert.equal(stock[multiplier],goal+1,'layout changes preserve counts');
}
assert.deepEqual(collectionStatus(100),{count:100,level:3,bonus:3,next:null});
assert.equal(collectionStatus(10000).bonus,3,'max level keeps collecting without further reward growth');
{
  const stock=restoreCollections({2:100}), events=[];
  const game=createTable({collections:stock,onScore:e=>events.push(e)});
  game.slotMachine.tripleUntil=60000;
  const ball=game.launch();ball.entered=true;ball.scoreFactor=2;
  Matter.Body.setPosition(ball.body,{x:game.holes[0].x-47,y:game.holes[0].y-2});
  Matter.Body.setVelocity(ball.body,{x:5,y:-1});
  for(let i=0;i<45 && game.balls.includes(ball);i++)game.step();
  assert.equal(events[0].kind,'jackpot');assert.equal(events[0].points,500*2*5);
  assert.equal(events[0].collection,null);assert.deepEqual(stock,{2:100,3:0,5:0,10:0},'secret hole awards no fruit or permanent fruit bonus');
}
console.log('PASS: real slot entries at every upgrade threshold in 5/7/9 layouts, next-entry upgrades, star/global stacking, one settlement, max level and secret-hole exclusions.');
