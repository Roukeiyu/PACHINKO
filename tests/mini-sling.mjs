import assert from 'node:assert/strict';
import { createMiniGame, randomMiniGame, miniGameIdle, miniIntro, MINI_GAMES, SLING_DURATION, SLING_TARGET, SLING_TOTAL, SLING_POINT, SLING_WIN_BONUS } from '../src/mini-games.js';
import { SLING_FALL_Y } from '../src/mini-sling.js';

const pull = (game, dx=42, dy=-18) => { game.setAim({ x:58-dx, y:298-dy }); return game.release(); };
const idle = createMiniGame('sling', { now: 100 });
assert.equal(idle.state.blocks.length, SLING_TOTAL);
assert.equal(miniIntro('sling').goal, `击落 ${SLING_TARGET} 块过关，最多 30 秒`);
assert.equal(miniIntro('sling').time, '30 秒');
assert.equal(randomMiniGame(()=>.999), 'sling');
assert.notEqual(randomMiniGame(()=>.999, 'sling'), 'sling');
assert.equal(Object.keys(MINI_GAMES).length, 6);
idle.tick(100 + SLING_DURATION - 1);
assert.equal(idle.state.status,'playing');
assert.equal(idle.state.removed,0,'settled towers never score from gravity or idle contact drift');
idle.tick(100 + SLING_DURATION);
assert.equal(idle.state.status,'timeout');
assert.equal(idle.remaining(100+SLING_DURATION),0);
assert.equal(miniGameIdle(idle.state),true);
assert.equal(pull(idle),false,'no shot may start after the deadline');

function play(sequence, cadence=100, interval=800) {
  const game=createMiniGame('sling'), counted=new Set();let clock=0;
  function advance(until) {
    while(clock<until && game.state.status==='playing') {
      clock=Math.min(until,clock+cadence);game.tick(clock);
      for(const b of game.state.blocks) if(b.down && !counted.has(b.id)) {
        const top=b.y-Math.abs(Math.sin(b.angle))*11.5-Math.abs(Math.cos(b.angle))*12;
        assert.ok(top>SLING_FALL_Y,'a newly scored piece is entirely below the platform, not merely shifted inside the tower');
        counted.add(b.id);
      }
      assert.equal(game.state.removed,counted.size,'each physical piece scores once');
    }
  }
  for(let shot=0;shot*interval<SLING_DURATION && game.state.status==='playing';shot++) {
    advance(shot*interval);
    if(game.state.status==='playing') pull(game,...sequence[shot%sequence.length]);
  }
  advance(SLING_DURATION);
  return game;
}

// Aiming at different levels can still dismantle the towers within 30 seconds.
for (const sequence of [[[32,-28],[40,-24]],[[40,-24],[32,-28],[36,-24]]]) {
  const game=play(sequence);
  assert.equal(game.state.status,'complete','changing angle is a reachable strategy');
  assert.ok(game.state.removed>=SLING_TARGET);
  assert.equal(game.state.won,true);
  assert.equal(miniGameIdle(game.state),false);
  assert.equal(game.state.score,game.state.removed*SLING_POINT+SLING_WIN_BONUS);
  assert.ok(game.state.lastSim<SLING_DURATION,'reaching the goal settles early');
  const frozen=game.snapshot();game.tick(100000);pull(game);game.stop();
  assert.deepEqual(game.snapshot(),frozen,'result and bonus are frozen and cannot be paid twice');
}
// The former one-shot angle now needs sustained play, and shallow/weak spam
// no longer turns contact or a tower collapsing onto itself into an easy win.
const casual=play([[42,-18]]);
assert.ok(casual.state.lastSim>=10000 && casual.state.fired>=10,'the former instant-win angle requires sustained play');
for(const shot of [[45,-6],[32,-16],[46,0]]) {
  const game=play([shot]);
  assert.equal(game.state.status,'timeout','repeating a poorly aimed shot does not guarantee a win');
  assert.ok(game.state.removed<SLING_TARGET);
}
const cadenceSequence=[[32,-28],[40,-24]];
assert.deepEqual(play(cadenceSequence,17).snapshot(),play(cadenceSequence,100).snapshot(),'identical shot times give identical physics at different rendering cadences');

const missed=createMiniGame('sling');
assert.equal(pull(missed,12,-8),true);
assert.equal(pull(missed),false,'duplicate release/reload cannot create another projectile');
missed.tick(SLING_DURATION);
assert.equal(missed.state.status,'timeout');
assert.equal(missed.state.removed,0,'a weak shot that never reaches the stacks does not score');
assert.equal(miniGameIdle(missed.state),true);
assert.equal(missed.state.shots.length,0,'expired and out-of-bounds shots are retired');
const partial=createMiniGame('sling');pull(partial,32,-28);partial.tick(SLING_DURATION);
assert.ok(partial.state.removed>0 && partial.state.removed<SLING_TARGET);
assert.equal(partial.state.won,false);assert.equal(partial.state.status,'timeout');
assert.equal(partial.state.score,partial.state.removed*SLING_POINT,'timeout preserves earned points without a win bonus');
const canceled=createMiniGame('sling');canceled.setAim({x:16,y:316});canceled.clearAim();
assert.equal(canceled.release(),false);assert.equal(canceled.state.fired,0);
pull(canceled);canceled.tick(200);canceled.stop();
const stopped=canceled.snapshot();canceled.tick(20000);assert.deepEqual(canceled.snapshot(),stopped);
assert.equal(canceled.state.status,'aborted');assert.equal(canceled.state.shots.length,0);
const disposed=createMiniGame('sling');disposed.dispose();assert.equal(pull(disposed),false);
const retry=createMiniGame('sling');assert.equal(retry.state.score,0);assert.equal(retry.state.fired,0);assert.equal(retry.state.removed,0);
assert.equal(retry.state.blocks.filter(b=>b.down).length,0);retry.dispose();
console.log('PASS: stricter whole-piece knockdowns, aimed wins versus shallow spam, fixed-step cadence, idle/miss/partial scores, exact 30s deadline, single payout, reload, cancel, disposal and clean replay.');
