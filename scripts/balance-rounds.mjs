// Random-power physics rounds. Duration assumes a shot about every 1.5s, plus
// one mini-game pause after each secret visit. Not part of npm test.
// Policy: ×1 below 7 slots, ×2 from 7 slots, and at 9 slots ×8 when that shot
// can be paid, otherwise ×4. Default is 100 rounds of the shipped rules.
//
// Named variants and --flags override the sim only. They do not change the
// game. Extra drum/clock/enlarge balls are stock gifts on top of any real
// balls the table already launches. valueScoreScale multiplies points of a
// paid shot (valueFactor > 1) and leaves ×1 shots alone.
//
//   node scripts/balance-rounds.mjs [rounds] [main|a|b|c]
//   node scripts/balance-rounds.mjs 40 --unlock7=3000 --unlock9=11000
import { createTable, STEP } from '../src/physics.js';
import { SLOT_UNLOCK_7, SLOT_UNLOCK_9 } from '../src/slots.js';
import {
  START_BALLS, BURST_COST, SECRET_BALLS, DRUM_RANDOM_BALLS, DRUM_ENLARGE_BALLS, DRUM_CLOCK_BALLS,
  chooseSpendFactor, shotCost, MINI_BALLS_FULL_SCORE,
} from '../src/round.js';

// Probed proposals. `main` is empty: the shipped rules. Flags can still override a preset.
const PRESETS = {
  main: {},
  // Thresholds only. The ball supply is unchanged.
  a: { unlock7: 1500, unlock9: 3200 },
  // Same 5000 / 20000 gates. A capped mini-game grant, a larger secret, and +2 on enlarge.
  b: { secretBalls: 28, miniBalls: 16, enlargeBalls: 2 },
  // Earlier gates, a larger opening stock, a small mini grant, paid shots score 1.45×.
  c: { unlock7: 3800, unlock9: 10000, startBalls: 160, secretBalls: 12, miniBalls: 8, valueScoreScale: 1.45 },
};

const BASE_TUNE = {
  startBalls: START_BALLS,
  unlock7: SLOT_UNLOCK_7,
  unlock9: SLOT_UNLOCK_9,
  secretBalls: SECRET_BALLS,
  miniBalls: 0,
  enlargeBalls: DRUM_ENLARGE_BALLS,
  leftDrumExtra: 0,
  clockExtra: 0,
  valueScoreScale: 1,
};

function parseInvocation(argv) {
  let rounds = 100;
  let preset = 'main';
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      const key = arg.slice(2, eq === -1 ? undefined : eq);
      flags[key] = eq === -1 ? true : arg.slice(eq + 1);
    } else if (/^\d+$/.test(arg)) rounds = Number(arg);
    else preset = arg;
  }
  if (!Object.hasOwn(PRESETS, preset)) throw new Error(`Unknown variant "${preset}". Use main, a, b, or c.`);
  const number = (value, fallback) => {
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`Bad number: ${value}`);
    return parsed;
  };
  const tune = { ...BASE_TUNE, ...PRESETS[preset] };
  tune.startBalls = number(flags.start, tune.startBalls);
  tune.unlock7 = number(flags.unlock7, tune.unlock7);
  tune.unlock9 = number(flags.unlock9, tune.unlock9);
  tune.secretBalls = number(flags.secret, tune.secretBalls);
  tune.miniBalls = number(flags.mini, tune.miniBalls);
  tune.enlargeBalls = number(flags.enlarge, tune.enlargeBalls);
  tune.leftDrumExtra = number(flags.drum, tune.leftDrumExtra);
  tune.clockExtra = number(flags.clock, tune.clockExtra);
  tune.valueScoreScale = number(flags.scale, tune.valueScoreScale);
  return { rounds, preset, tune };
}

const { rounds: ROUNDS, preset: PRESET, tune: TUNE } = parseInvocation(process.argv.slice(2));

function slotsForTune(score) {
  if (score >= TUNE.unlock9) return 9;
  if (score >= TUNE.unlock7) return 7;
  return 5;
}
const SHOT_GAP_MS = 1500;
const MINI_PAUSE_MS = 40000;
const STEP_CAP = Math.ceil(20 * 60 * 1000 / STEP);

function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}

function playRound(seed) {
  const random = seeded(seed);
  let stock = TUNE.startBalls;
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
  let secretGranted = 0;
  let miniGranted = 0;
  let enlargeGranted = 0;
  let drumExtraGranted = 0;
  let clockExtraGranted = 0;
  const tierShots = { 1: 0, 2: 0, 4: 0, 8: 0 };
  const game = createTable({
    slots,
    random,
    starRandom: seeded(seed ^ 0x9e3779b9),
    slotRandom: seeded(seed ^ 0x85ebca6b),
    onScore(result) {
      const paidBoost = result.valueFactor > 1 ? TUNE.valueScoreScale : 1;
      score += result.points * paidBoost;
      if (result.kind === 'slot') bestSlot = Math.max(bestSlot, result.multiplier);
      if (result.kind === 'jackpot') {
        stock += game.setEmissionPaused(true);
        jackpots += 1;
        secretWait = true;
        miniAwarded = false;
      }
    },
    onSurprise(event) {
      if (event.kind === 'random') {
        stock += DRUM_RANDOM_BALLS + TUNE.leftDrumExtra;
        drumExtraGranted += TUNE.leftDrumExtra;
      }
      if (event.kind === 'enlarge') {
        stock += TUNE.enlargeBalls;
        enlargeGranted += TUNE.enlargeBalls;
      }
      if (event.kind === 'clock') {
        stock += DRUM_CLOCK_BALLS + TUNE.clockExtra;
        clockExtraGranted += TUNE.clockExtra;
      }
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
    const next = slotsForTune(score);
    const idle = game.balls.length === 0 && game.collector.remaining === 0 && game.pendingLaunches === 0;
    if (next > slots && idle && !secretWait) {
      slots = next;
      game.setSlots(next);
    }
    if (secretWait && idle && !miniAwarded) {
      const performanceScore = random() * MINI_BALLS_FULL_SCORE;
      stock += TUNE.secretBalls + TUNE.miniBalls;
      secretGranted += TUNE.secretBalls;
      miniGranted += TUNE.miniBalls;
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
    secretGranted, miniGranted, enlargeGranted, drumExtraGranted, clockExtraGranted,
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
  variant: PRESET,
  tune: TUNE,
  policy: '7槽起用×2；9槽优先×8（这一发付得起时），否则×4',
  elapsedSec: Math.round((Date.now() - started) / 1000),
  startBalls: TUNE.startBalls,
  playMin: { mean: round2(mean(play)), median: round2(pick(play, 0.5)), p90: round2(pick(play, 0.9)) },
  physicsMin: { mean: round2(mean(physics)), median: round2(pick(physics, 0.5)), p90: round2(pick(physics, 0.9)) },
  ballsSpent: { mean: Math.round(mean(spent)), median: pick(spent, 0.5) },
  giftsPerRound: {
    leftDrumBalls: round1(mean(results.map(row => row.randomShots + row.drumExtraGranted))),
    leftDrumPhysical: round1(mean(results.map(row => row.randomShots))),
    leftDrumExtra: round1(mean(results.map(row => row.drumExtraGranted))),
    clockBursts: round1(mean(results.map(row => row.clockBursts))),
    clockBalls: round1(mean(results.map(row => row.clockBursts * 12 + row.clockExtraGranted))),
    clockExtra: round1(mean(results.map(row => row.clockExtraGranted))),
    jarReleases: round1(mean(results.map(row => row.jarReleases))),
    jarBalls: round1(mean(results.map(row => row.jarBalls))),
    secretVisits: round1(mean(results.map(row => row.jackpots))),
    secretBalls: round1(mean(results.map(row => row.secretGranted))),
    miniBalls: round1(mean(results.map(row => row.miniGranted))),
    enlargeBalls: round1(mean(results.map(row => row.enlargeGranted))),
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
