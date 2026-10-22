import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createTable, TABLE, STEP, HIT_SCORE_COOLDOWN, ENLARGE_MS } from '../src/physics.js';
import { ballOwnFactor } from '../src/ball-rim.js';

assert.equal(HIT_SCORE_COOLDOWN, 150);

function table() {
  const scores = [];
  const game = createTable({ onScore: event => scores.push(event) });
  return { game, scores };
}
function ballOf(game, valueFactor = 1, scoreFactor = 1, bonus = false) {
  const ball = game.launch();
  assert.ok(ball);
  ball.entered = true;
  ball.bonus = bonus;
  ball.valueFactor = valueFactor;
  ball.scoreFactor = scoreFactor;
  return ball;
}
function park(game, ball) {
  Matter.Body.setPosition(ball.body, { x: TABLE.launchX, y: 460 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: 0 });
}
function approach(game, ball, obstacle, scores, { valueFactor = 1, scoreFactor = 1, bonus = false, steps = 24 } = {}) {
  const before = scores.length;
  const hits = game.rewards.hits.slice();
  ball.entered = true;
  ball.bonus = bonus;
  ball.valueFactor = valueFactor;
  ball.scoreFactor = scoreFactor;
  Matter.Body.setStatic(ball.body, false);
  Matter.Body.setPosition(ball.body, { x: obstacle.position.x, y: obstacle.position.y + obstacle.plugin.radius + 15 });
  Matter.Body.setVelocity(ball.body, { x: 0, y: -8 });
  for (let i = 0; i < steps && scores.length === before; i++) {
    ball.valueFactor = valueFactor;
    ball.scoreFactor = scoreFactor;
    game.step();
  }
  return {
    event: scores.length > before ? scores.at(-1) : null,
    progress: game.rewards.hits.map((count, index) => count - hits[index]),
  };
}

const targets = [
  ['bunny', game => game.bumpers[0], 1],
  ['bear', game => game.bumpers[1], 1],
  ['diamond', game => game.diamonds[0], 1],
  ['diamond', game => game.diamonds[1], 1],
  ['cat', game => game.bumpers[2], 2],
];
for (const [name, pick, base] of targets) {
  for (const factor of [1, 2, 8]) {
    const { game, scores } = table();
    const obstacle = pick(game);
    const ball = ballOf(game, factor);
    const { event, progress } = approach(game, ball, obstacle, scores, { valueFactor: factor });
    assert.ok(event, `${name} ×${factor} scores on contact`);
    assert.equal(event.kind, 'hit');
    assert.equal(event.target, name);
    assert.equal(event.basePoints, base);
    assert.equal(event.ownFactor, factor);
    assert.equal(event.ownFactor, ballOwnFactor(ball));
    assert.equal(event.points, base * factor);
    assert.equal(event.globalMultiplier, 1);
    assert.equal(event.ballId, ball.id);
    assert.equal(game.stats.scored, 0, 'a bumper hit is not a slot entry');
    assert.equal(game.slotMachine.entries, 0);
    if (name === 'diamond') {
      assert.equal(progress.reduce((sum, n) => sum + n, 0), 0, 'diamonds do not advance a drum');
      assert.equal(event.index, game.diamonds.indexOf(obstacle));
    } else {
      assert.equal(progress[obstacle.plugin.index], 1, 'drum progress still advances by 1');
    }
  }
}
console.log('PASS: ×1, ×2 and ×8 balls score bunny, bear, both diamonds, and the cat drum.');

for (const factor of [1, 2, 8]) {
  const { game, scores } = table();
  assert.equal(scores.length, 0);
  game.forceEnlarge();
  assert.equal(scores.length, 0, 'enlarging without a ball does not score');
  assert.ok(game.rewards.enlargedUntil > game.clock);
  assert.equal(game.bumpers[2].plugin.radius, game.bumpers[2].plugin.baseRadius * 1.5);
  const ball = ballOf(game, factor);
  const grown = approach(game, ball, game.bumpers[2], scores, { valueFactor: factor });
  assert.equal(grown.event.basePoints, 5);
  assert.equal(grown.event.points, 5 * factor);
  assert.equal(grown.event.target, 'cat');
  assert.equal(grown.progress[2], 1, 'the big drum still counts one hit toward 30');
  const started = game.clock;
  while (game.rewards.enlargedUntil) {
    park(game, ball);
    game.step();
    assert.ok(game.clock - started < ENLARGE_MS + 1000);
  }
  const shrunk = approach(game, ball, game.bumpers[2], scores, { valueFactor: factor });
  assert.equal(shrunk.event.basePoints, 2, 'after the enlarge timer the cat pays 2 again');
  assert.equal(shrunk.event.points, 2 * factor);
}
console.log('PASS: the enlarged cat pays +5 × the ball, then +2 once it shrinks.');

{
  const { game, scores } = table();
  const ball = ballOf(game, 4, 2);
  const event = approach(game, ball, game.bumpers[0], scores, { valueFactor: 4, scoreFactor: 2 }).event;
  assert.equal(event.ownFactor, 8);
  assert.equal(event.points, 8, 'launch ×4 times a ×2 star uses the rim factor');
  assert.equal(ballOwnFactor({ scoreFactor: 2, valueFactor: 4 }), 8);
}
{
  const { game, scores } = table();
  const gift = ballOf(game, 1, 1, true);
  const fresh = approach(game, gift, game.bumpers[1], scores, { bonus: true }).event;
  assert.equal(fresh.points, 1, 'a fresh gift ball is ×1');
  assert.equal(gift.bonus, true);
  const stored = approach(game, gift, game.diamonds[0], scores, { bonus: true, scoreFactor: 5, valueFactor: 1 }).event;
  assert.equal(stored.points, 5, 'a jar gift keeps the star factor it was stored with');
  assert.equal(stored.valueFactor, 1);
}
{
  const { game, scores } = table();
  game.slotMachine.tripleUntil = 60000;
  const ball = ballOf(game, 8);
  const event = approach(game, ball, game.bumpers[0], scores, { valueFactor: 8 }).event;
  assert.equal(game.slotMachine.multiplier, 5);
  assert.equal(event.globalMultiplier, 5);
  assert.equal(event.points, 8, 'the reel multiplier does not multiply bumper hits');
  assert.equal(game.stats.scored, 0);
  assert.equal(game.slotMachine.entries, 0);
}
console.log('PASS: stars stack into the rim factor, gifts stay ×1 unless they carry stars, and the reel is ignored.');

{
  const { game, scores } = table();
  const ball = ballOf(game, 2);
  const bumper = game.bumpers[0];
  const first = approach(game, ball, bumper, scores, { valueFactor: 2 });
  assert.equal(first.event.points, 2);
  const scoredAt = game.clock;
  park(game, ball);
  game.step();
  const rattled = approach(game, ball, bumper, scores, { valueFactor: 2, steps: 8 });
  assert.equal(rattled.event, null, 'the same ball on the same bumper waits out the cooldown');
  assert.equal(rattled.progress[0], 0);
  assert.ok(game.clock - scoredAt < HIT_SCORE_COOLDOWN);
  const other = approach(game, ball, game.bumpers[1], scores, { valueFactor: 2 });
  assert.equal(other.event.target, 'bear');
  assert.equal(other.event.points, 2, 'a different bumper pays immediately');
  assert.ok(game.clock - scoredAt < HIT_SCORE_COOLDOWN);
  const left = approach(game, ball, game.diamonds[0], scores, { valueFactor: 8 });
  const right = approach(game, ball, game.diamonds[1], scores, { valueFactor: 8 });
  assert.equal(left.event.index, 0);
  assert.equal(right.event.index, 1);
  assert.equal(left.event.points, 8);
  assert.equal(right.event.points, 8);
  while (game.clock - scoredAt < HIT_SCORE_COOLDOWN + STEP * 4) {
    park(game, ball);
    game.step();
  }
  const again = approach(game, ball, bumper, scores, { valueFactor: 2 });
  assert.equal(again.event.points, 2, 'the same bumper pays again after the cooldown');
  assert.equal(again.progress[0], 1);
  const second = ballOf(game, 8);
  const shared = approach(game, second, bumper, scores, { valueFactor: 8 });
  assert.equal(shared.event.points, 8, 'another ball does not share the cooldown');
  assert.equal(shared.event.ballId, second.id);
}
{
  const { game, scores } = table();
  const ball = ballOf(game);
  const kicked = approach(game, ball, game.kickers[0], scores);
  assert.equal(kicked.event, null, 'spring studs do not award hit points');
  assert.equal(game.stats.hits.kicker > 0, true);
  assert.equal(game.stats.scored, 0);
}
console.log(`PASS: hit score cooldown is ${HIT_SCORE_COOLDOWN}ms per ball and bumper, and studs do not pay.`);
