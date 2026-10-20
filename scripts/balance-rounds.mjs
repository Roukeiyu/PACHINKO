// Random-power physics rounds. Duration assumes a shot about every 1.5s, plus
// one mini-game pause after each secret visit. Not part of npm test.
import { createTable, STEP } from '../src/physics.js';
import { slotsForScore } from '../src/slots.js';
import {
  START_BALLS, BURST_COST, SECRET_BALLS, LUCKY_BALLS, DRUM_RANDOM_BALLS, DRUM_ENLARGE_BALLS, DRUM_CLOCK_BALLS,
  miniGameBalls, MINI_BALLS_FULL_SCORE,
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
  const game = createTable({
    slots,
    random,
    starRandom: seeded(seed ^ 0x9e3779b9),
    slotRandom: seeded(seed ^ 0x85ebca6b),
    onScore(result) {
      score += result.points;
      if (result.kind === 'slot') {
        stock += result.multiplier + (result.lucky ? LUCKY_BALLS : 0);
        bestSlot = Math.max(bestSlot, result.multiplier);
      }
      if (result.kind === 'jackpot') {
        stock += SECRET_BALLS + game.setEmissionPaused(true);
        jackpots += 1;
        secretWait = true;
        miniAwarded = false;
      }
    },
    onSurprise(event) {
      if (event.kind === 'random') stock += DRUM_RANDOM_BALLS;
      if (event.kind === 'enlarge') stock += DRUM_ENLARGE_BALLS;
      if (event.kind === 'clock') stock += DRUM_CLOCK_BALLS;
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
      stock += miniGameBalls(performanceScore);
      score += Math.round(performanceScore * 0.35);
      miniMs += MINI_PAUSE_MS;
      miniAwarded = true;
      secretWait = false;
      game.setEmissionPaused(false);
    }
    const clock = steps * STEP;
    const spendable = stock + game.collector.stored.length;
    const burst = random() < 0.12 && spendable >= BURST_COST;
    const cost = burst ? BURST_COST : 1;
    if (!secretWait && spendable >= cost && clock - lastShot >= 900 && game.balls.length < 10) {
      const ball = burst ? game.launchBurst() : game.launch(random());
      if (ball) {
        let need = cost;
        const fromStock = Math.min(stock, need);
        stock -= fromStock;
        need -= fromStock;
        if (need) game.takeStored(need);
        launches += cost;
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
  return { score, launches, slots, jackpots, bestSlot, physicsMs, playMs: launches * SHOT_GAP_MS + miniMs, capped: steps >= STEP_CAP };
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
  meanPlayMin: +(mean(results.map(r => r.playMs)) / 60000).toFixed(2),
  meanPhysicsMin: +(mean(results.map(r => r.physicsMs)) / 60000).toFixed(2),
  p50: pct(0.5), p90: pct(0.9), p95: pct(0.95), max: scores.at(-1),
  reached50k: scores.filter(score => score >= 50000).length,
  reached5slotCap: results.filter(r => r.slots >= 7).length,
  reached9: results.filter(r => r.slots >= 9).length,
  capped: results.filter(r => r.capped).map(r => ({ score: r.score, launches: r.launches, slots: r.slots, jackpots: r.jackpots })),
  meanJackpots: +mean(results.map(r => r.jackpots)).toFixed(2),
  hist,
}, null, 2));
