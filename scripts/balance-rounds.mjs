// Random-power physics rounds. Duration assumes a shot about every 1.5s, plus
// one mini-game pause after each secret visit. Not part of npm test.
import { createTable, STEP } from '../src/physics.js';
import { slotsForScore } from '../src/slots.js';
import {
  START_BALLS, BURST_COST, SECRET_BALLS, DRUM_RANDOM_BALLS, DRUM_ENLARGE_BALLS, DRUM_CLOCK_BALLS,
  BALL_COST_MULTIPLIER, miniGameBalls, shotCost, MINI_BALLS_FULL_SCORE,
} from '../src/round.js';

const ROUNDS = Number(process.argv[2] || 40);
const SHOT_GAP_MS = 1500;
const MINI_PAUSE_MS = 40000;
const STEP_CAP = Math.ceil(20 * 60 * 1000 / STEP);

function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}

function playRound(seed) {
  const random = seeded(seed);
  let stock = START_BALLS;
  let score = 0;
  let slots = 5;
  let launches = 0;
  let jackpots = 0;
  let bestSlot = 0;
  let secretWait = false;
  let miniAwarded = false;
  const ballHits = { 1: 0, 2: 0, 3: 0 };
  let reelSpins = 0;
  let reelPaid = 0;
  let doubleShots = 0;
  let ballsSpent = 0;
  const game = createTable({
    slots,
    random,
    starRandom: seeded(seed ^ 0x9e3779b9),
    slotRandom: seeded(seed ^ 0x85ebca6b),
    onScore(result) {
      score += result.points;
      if (result.kind === 'slot') bestSlot = Math.max(bestSlot, result.multiplier);
      if (result.kind === 'jackpot') {
        stock += game.setEmissionPaused(true);
        jackpots += 1;
        secretWait = true;
        miniAwarded = false;
      }
    },
    onSurprise(event) {
      if (event.kind === 'random') stock += DRUM_RANDOM_BALLS;
      if (event.kind === 'enlarge') stock += DRUM_ENLARGE_BALLS;
      if (event.kind === 'clock') stock += DRUM_CLOCK_BALLS;
      if (event.kind === 'slot-result') {
        if (event.mode === 'reel') {
          reelSpins += 1;
          if (event.paid) reelPaid += 1;
        }
        if (event.ballPayout) {
          stock += event.ballPayout;
          if (event.balls >= 1 && event.balls <= 3) ballHits[event.balls] += 1;
        }
      }
    },
  });
  let steps = 0;
  let lastShot = -SHOT_GAP_MS;
  let miniMs = 0;
  while (steps < STEP_CAP) {
    const next = slotsForScore(score);
    const idle = game.balls.length === 0 && game.collector.remaining === 0 && game.pendingLaunches === 0;
    if (next > slots && idle && !secretWait) {
      slots = next;
      game.setSlots(next);
    }
    if (secretWait && idle && !miniAwarded) {
      const performanceScore = random() * MINI_BALLS_FULL_SCORE;
      stock += miniGameBalls(performanceScore) + SECRET_BALLS;
      score += Math.round(performanceScore * 0.35);
      miniMs += MINI_PAUSE_MS;
      miniAwarded = true;
      secretWait = false;
      game.setEmissionPaused(false);
    }
    const clock = steps * STEP;
    const spendable = stock + game.collector.stored.length;
    const factor = slots >= 7 ? BALL_COST_MULTIPLIER : 1;
    const burstWanted = random() < 0.12;
    let burst = false;
    let used = 0;
    if (burstWanted) {
      if (spendable >= shotCost(factor, true)) { burst = true; used = factor; }
    } else if (spendable >= shotCost(factor, false)) used = factor;
    else if (spendable >= 1) used = 1;
    const cost = used ? shotCost(used, burst) : 0;
    if (!secretWait && used && clock - lastShot >= 900 && game.balls.length < 10) {
      const ball = burst ? game.launchBurst(used) : game.launch(random(), used);
      if (ball) {
        let need = cost;
        const fromStock = Math.min(stock, need);
        stock -= fromStock;
        need -= fromStock;
        if (need) game.takeStored(need);
        launches += burst ? BURST_COST : 1;
        ballsSpent += cost;
        if (used > 1) doubleShots += burst ? BURST_COST : 1;
        lastShot = clock;
      }
    }
    game.step();
    steps += 1;
    const pending = game.collector.remaining;
    const stored = game.collector.stored.length;
    if (stock <= 0 && stored === 0 && pending === 0 && game.pendingLaunches === 0 && game.balls.length === 0 && !secretWait) break;
  }
  const physicsMs = steps * STEP;
  return { score, launches, ballsSpent, doubleShots, slots, jackpots, bestSlot, physicsMs, playMs: launches * SHOT_GAP_MS + miniMs, capped: steps >= STEP_CAP, ballHits, reelSpins, reelPaid, randomShots: game.stats.randomShots, enlargements: game.stats.enlargements, clockBursts: game.stats.clockBursts };
}

const results = [];
const started = Date.now();
for (let i = 0; i < ROUNDS; i++) results.push(playRound(1000 + i * 97));
const scores = results.map(r => r.score).sort((a, b) => a - b);
const mean = list => list.reduce((sum, value) => sum + value, 0) / list.length;
const pct = p => scores[Math.min(scores.length - 1, Math.floor((scores.length - 1) * p))];
const buckets = [0, 1000, 3000, 5000, 10000, 20000, 50000, Infinity];
const hist = buckets.slice(0, -1).map((lo, i) => {
  const hi = buckets[i + 1];
  return { lo, hi, n: scores.filter(score => score >= lo && score < hi).length };
});
console.log(JSON.stringify({
  rounds: ROUNDS,
  elapsedSec: Math.round((Date.now() - started) / 1000),
  startBalls: START_BALLS,
  meanScore: Math.round(mean(scores)),
  meanLaunches: Math.round(mean(results.map(r => r.launches))),
  meanBallsSpent: Math.round(mean(results.map(r => r.ballsSpent))),
  meanDoubleShots: Math.round(mean(results.map(r => r.doubleShots))),
  meanPlayMin: +(mean(results.map(r => r.playMs)) / 60000).toFixed(2),
  meanPhysicsMin: +(mean(results.map(r => r.physicsMs)) / 60000).toFixed(2),
  p50: pct(0.5), p90: pct(0.9), p95: pct(0.95), max: scores.at(-1),
  reached50k: scores.filter(score => score >= 50000).length,
  reached5slotCap: results.filter(r => r.slots >= 7).length,
  reached9: results.filter(r => r.slots >= 9).length,
  capped: results.filter(r => r.capped).map(r => ({ score: r.score, launches: r.launches, slots: r.slots, jackpots: r.jackpots })),
  meanJackpots: +mean(results.map(r => r.jackpots)).toFixed(2),
  ballOutcomes: [1, 2, 3].map(count => ({ count, n: results.reduce((sum, row) => sum + row.ballHits[count], 0) })),
  reelSpins: results.reduce((sum, row) => sum + row.reelSpins, 0),
  reelPaid: results.reduce((sum, row) => sum + row.reelPaid, 0),
  randomShots: results.reduce((sum, row) => sum + row.randomShots, 0),
  enlargements: results.reduce((sum, row) => sum + row.enlargements, 0),
  clockBursts: results.reduce((sum, row) => sum + row.clockBursts, 0),
  meanReelSpins: +mean(results.map(row => row.reelSpins)).toFixed(2),
  hist,
}, null, 2));
