// Random-power physics rounds. Duration assumes a shot about every 1.5s, plus
// one mini-game pause after each secret visit. Not part of npm test.
// Policy: ×1 below 7 slots, ×2 from 7 slots, and at 9 slots ×8 when that shot
// can be paid, otherwise ×4. Default is 100 rounds.
import { createTable, STEP } from '../src/physics.js';
import { slotsForScore } from '../src/slots.js';
import {
  START_BALLS, BURST_COST, SECRET_BALLS, DRUM_RANDOM_BALLS, DRUM_ENLARGE_BALLS, DRUM_CLOCK_BALLS,
  chooseSpendFactor, shotCost, MINI_BALLS_FULL_SCORE,
} from '../src/round.js';

const ROUNDS = Number(process.argv[2] || 100);
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
  const tierShots = { 1: 0, 2: 0, 4: 0, 8: 0 };
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
      stock += SECRET_BALLS;
      score += Math.round(performanceScore * 0.35);
      miniMs += MINI_PAUSE_MS;
      miniAwarded = true;
      secretWait = false;
      game.setEmissionPaused(false);
    }
    const clock = steps * STEP;
    const spendable = stock + game.collector.stored.length;
    const burstWanted = random() < 0.12;
    const used = chooseSpendFactor(slots, spendable, burstWanted);
    const burst = burstWanted && used > 0;
    const cost = used ? shotCost(used, burst) : 0;
    if (!secretWait && used && clock - lastShot >= 900 && game.balls.length < 10) {
      const ball = burst ? game.launchBurst(used) : game.launch(random(), used);
      if (ball) {
        let need = cost;
        const fromStock = Math.min(stock, need);
        stock -= fromStock;
        need -= fromStock;
        if (need) game.takeStored(need);
        const fired = burst ? BURST_COST : 1;
        launches += fired;
        ballsSpent += cost;
        tierShots[used] += fired;
        if (used > 1) doubleShots += fired;
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
  return {
    score, launches, ballsSpent, doubleShots, tierShots, slots, jackpots, bestSlot, physicsMs,
    playMs: launches * SHOT_GAP_MS + miniMs, capped: steps >= STEP_CAP, ballHits, reelSpins, reelPaid,
    randomShots: game.stats.randomShots, enlargements: game.stats.enlargements, clockBursts: game.stats.clockBursts,
    jarReleases: game.stats.storageBursts, jarBalls: game.stats.storageDrops,
  };
}

const results = [];
const started = Date.now();
for (let i = 0; i < ROUNDS; i++) results.push(playRound(1000 + i * 97));
const mean = list => list.reduce((sum, value) => sum + value, 0) / list.length;
const sorted = list => list.slice().sort((a, b) => a - b);
const pick = (list, p) => { const values = sorted(list); return values[Math.min(values.length - 1, Math.floor((values.length - 1) * p))]; };
const round1 = value => Math.round(value * 10) / 10;
const round2 = value => Math.round(value * 100) / 100;
const minutes = list => list.map(value => value / 60000);
const scores = results.map(row => row.score);
const play = minutes(results.map(row => row.playMs));
const physics = minutes(results.map(row => row.physicsMs));
const spent = results.map(row => row.ballsSpent);
const reached7 = results.filter(row => row.slots >= 7).length;
const reached9 = results.filter(row => row.slots >= 9).length;
const reached50k = scores.filter(score => score >= 50000).length;
const pct = count => round1(count / ROUNDS * 100);
const meanTier = factor => round1(mean(results.map(row => row.tierShots[factor])));
const reelEvents = count => results.reduce((sum, row) => sum + row.ballHits[count], 0);
const buckets = [0, 1000, 3000, 5000, 10000, 20000, 50000, Infinity];
const hist = buckets.slice(0, -1).map((lo, i) => {
  const hi = buckets[i + 1];
  return { lo, hi, n: scores.filter(score => score >= lo && score < hi).length };
});
const capped = results.filter(row => row.capped);
console.log(JSON.stringify({
  rounds: ROUNDS,
  policy: '7槽起用×2；9槽优先×8（这一发付得起时），否则×4',
  elapsedSec: Math.round((Date.now() - started) / 1000),
  startBalls: START_BALLS,
  playMin: { mean: round2(mean(play)), median: round2(pick(play, 0.5)), p90: round2(pick(play, 0.9)) },
  physicsMin: { mean: round2(mean(physics)), median: round2(pick(physics, 0.5)), p90: round2(pick(physics, 0.9)) },
  ballsSpent: { mean: Math.round(mean(spent)), median: pick(spent, 0.5) },
  giftsPerRound: {
    leftDrumBalls: round1(mean(results.map(row => row.randomShots))),
    clockBursts: round1(mean(results.map(row => row.clockBursts))),
    clockBalls: round1(mean(results.map(row => row.clockBursts * 12))),
    jarReleases: round1(mean(results.map(row => row.jarReleases))),
    jarBalls: round1(mean(results.map(row => row.jarBalls))),
    secretVisits: round1(mean(results.map(row => row.jackpots))),
    secretBalls: round1(mean(results.map(row => row.jackpots * SECRET_BALLS))),
    reelPlus1: round1(mean(results.map(row => row.ballHits[1]))),
    reelPlus10: round1(mean(results.map(row => row.ballHits[2] * 10))),
    reelPlus100: round1(mean(results.map(row => row.ballHits[3] * 100))),
    reelBalls: round1(mean(results.map(row => row.ballHits[1] + row.ballHits[2] * 10 + row.ballHits[3] * 100))),
  },
  score: { mean: Math.round(mean(scores)), median: pick(scores, 0.5), p90: pick(scores, 0.9), max: Math.max(...scores) },
  reach: {
    slots7: { n: reached7, pct: pct(reached7) },
    slots9: { n: reached9, pct: pct(reached9) },
    score50k: { n: reached50k, pct: pct(reached50k) },
  },
  meanLaunches: Math.round(mean(results.map(row => row.launches))),
  meanTierShots: { x1: meanTier(1), x2: meanTier(2), x4: meanTier(4), x8: meanTier(8) },
  cappedRuns: capped.length,
  capped: capped.map(row => ({ score: row.score, launches: row.launches, slots: row.slots, jackpots: row.jackpots })),
  compareToPrevious40: { meanPlayMin: 7.99, meanScore: 20643, medianScore: 16902, maxScore: 57581, reached50k: 3, reached9: 8, reached7: 28 },
  meanScore: Math.round(mean(scores)),
  meanBallsSpent: Math.round(mean(spent)),
  meanDoubleShots: Math.round(mean(results.map(row => row.doubleShots))),
  meanPlayMin: round2(mean(play)),
  meanPhysicsMin: round2(mean(physics)),
  p50: pick(scores, 0.5),
  p90: pick(scores, 0.9),
  max: Math.max(...scores),
  reached50k,
  reached5slotCap: reached7,
  reached9,
  meanJackpots: round2(mean(results.map(row => row.jackpots))),
  ballOutcomes: [1, 2, 3].map(count => ({ count, n: reelEvents(count) })),
  reelSpins: results.reduce((sum, row) => sum + row.reelSpins, 0),
  reelPaid: results.reduce((sum, row) => sum + row.reelPaid, 0),
  randomShots: results.reduce((sum, row) => sum + row.randomShots, 0),
  enlargements: results.reduce((sum, row) => sum + row.enlargements, 0),
  clockBursts: results.reduce((sum, row) => sum + row.clockBursts, 0),
  hist,
}, null, 2));
