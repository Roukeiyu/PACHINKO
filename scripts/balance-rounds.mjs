// Random-power physics rounds. Duration assumes a shot about every 1.5s, plus
// one mini-game pause after each secret visit. Not part of npm test.
// Default policy: ×1 below 7 slots, ×2 from 7 slots, and at 9 slots ×8 when
// that shot can be paid, otherwise ×4. Default is 100 rounds of the shipped
// rules. --policy does not change the game:
//   paid (a)  ×2 from 7 slots, ×8 then ×4 at 9 slots (default)
//   p1 (b)    ×2 from 7 slots, then ×1 only once 9 slots are open
//   p2 (c)    ×1 for the whole round
// --gifts multiplies ball gifts by the ball that triggered them.
// full (the shipped default) uses that ball's own ×N.
// off leaves gifts alone. x2 gives every multiplier ball a flat ×2 gift.
// full and x2 also advance the center drum (index 2, the 30-hit clock meter)
// by the ball's own ×N. The player cannot shoot while the board is crowd-locked.
// Left drum, right drum, and the reel progress stay at +1 per hit.
// Clock-burst and jar balls stay ×1; only how many of them appear changes.
// Secret +20 and reel ball payouts are stock, scaled by the triggering ball.
//
// Named variants and --flags override the sim only. They do not change the
// game. Extra drum/clock/enlarge balls are stock gifts on top of any real
// balls the table already launches. valueScoreScale multiplies points of a
// paid shot (valueFactor > 1) and leaves ×1 shots alone.
//
//   node scripts/balance-rounds.mjs [rounds] [main|a|b|c] [--policy=paid|p1|p2|a|b|c] [--gifts=off|full|x2]
//   node scripts/balance-rounds.mjs 40 --unlock7=3000 --unlock9=11000
import { createTable, STEP } from '../src/physics.js';
import { SLOT_UNLOCK_7, SLOT_UNLOCK_9 } from '../src/slots.js';
import {
  START_BALLS, BURST_COST, SECRET_BALLS, DRUM_RANDOM_BALLS, DRUM_ENLARGE_BALLS, DRUM_CLOCK_BALLS,
  chooseSpendFactor, shotCost, ballValue, MINI_BALLS_FULL_SCORE,
  BOARD_CROWD_LOCK, boardCrowdUnlock, crowdLaunchLocked,
} from '../src/round.js';

// Probed proposals. `main` is empty: the shipped rules. Flags can still override a preset.
const PRESETS = {
  main: {},
  // Thresholds only. The ball supply is unchanged.
  a: { unlock7: 1500, unlock9: 3200 },
  // Historical proposal: the old 5000 / 20000 gates, a capped mini-game grant,
  // a larger secret, and +2 on enlarge. Unlock pins stay so this preset does
  // not inherit later shipped gates.
  b: { unlock7: 5000, unlock9: 20000, secretBalls: 28, miniBalls: 16, enlargeBalls: 2 },
  // Earlier gates, a larger opening stock, a small mini grant, paid shots score 1.45×.
  c: { unlock7: 3800, unlock9: 10000, startBalls: 160, secretBalls: 12, miniBalls: 8, valueScoreScale: 1.45 },
};

const POLICIES = {
  paid: '7槽起用×2；9槽优先×8（这一发付得起时），否则×4',
  p1: '7槽起用×2；9槽改回只打×1',
  p2: '全程只打×1',
};
const POLICY_ALIASES = { paid: 'paid', a: 'paid', p1: 'p1', b: 'p1', p2: 'p2', c: 'p2' };
const GIFT_MODES = {
  off: '赠球不乘倍',
  full: '赠球乘触发球自己的 ×N；中鼓进度也按 ×N 走',
  x2: '任何倍球的赠球固定 ×2；中鼓进度仍按该球自己的 ×N 走',
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
  const policy = POLICY_ALIASES[flags.policy || 'paid'];
  if (!policy) throw new Error(`Unknown policy "${flags.policy}". Use paid, p1, p2, a, b, or c.`);
  const gifts = flags.gifts || 'full';
  if (!Object.hasOwn(GIFT_MODES, gifts)) throw new Error(`Unknown gifts "${gifts}". Use off, full, or x2.`);
  return { rounds, preset, tune, policy, gifts };
}

const { rounds: ROUNDS, preset: PRESET, tune: TUNE, policy: POLICY, gifts: GIFTS } = parseInvocation(process.argv.slice(2));

// Gift scale follows the triggering ball. Center-drum progress uses the ball's
// own multiplier in both full and x2; x2 only flattens the gift count.
function giftMultiplier(valueFactor) {
  const factor = ballValue(valueFactor);
  if (GIFTS === 'off' || factor <= 1) return 1;
  return GIFTS === 'full' ? factor : 2;
}

// p1 and p2 only change which tier chooseSpendFactor prefers. Fallback for a
// short stock (unaffordable burst, last ball at ×1) stays the shipped rule.
function spendFactor(slots, spendable, burst) {
  const tier = POLICY === 'p2' ? 5 : POLICY === 'p1' && slots >= 9 ? 5 : slots;
  return chooseSpendFactor(tier, spendable, burst);
}

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
  let clockEmitted = 0;
  let jarScheduled = 0;
  let secretScale = 1;
  let peakBalls = 0;
  let crowdLocked = false;
  let crowdBlocks = 0;
  const reelGranted = { 1: 0, 2: 0, 3: 0 };
  const pendingAll = [];
  const pendingReel = [];
  const tierShots = { 1: 0, 2: 0, 4: 0, 8: 0 };
  const game = createTable({
    slots,
    random,
    starRandom: seeded(seed ^ 0x9e3779b9),
    slotRandom: seeded(seed ^ 0x85ebca6b),
    ...(GIFTS === 'off' ? {} : {
      centerHitWeight: ball => ballValue(ball.valueFactor),
      giftScale: ball => giftMultiplier(ball.valueFactor),
    }),
    onScore(result) {
      const paidBoost = result.valueFactor > 1 ? TUNE.valueScoreScale : 1;
      score += result.points * paidBoost;
      if (GIFTS !== 'off') {
        if ((game.slotMachine.entries + 1) % game.slotMachine.goal === 0) pendingAll.push(giftMultiplier(result.valueFactor));
        if (result.lucky) pendingReel.push(giftMultiplier(result.valueFactor));
      }
      if (result.kind === 'slot') bestSlot = Math.max(bestSlot, result.multiplier);
      if (result.kind === 'jackpot') {
        if (!secretWait) secretScale = giftMultiplier(result.valueFactor);
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
      if (event.kind === 'storage-burst') jarScheduled += event.amount;
      if (event.kind === 'clock') {
        clockEmitted += event.balls || 12;
        stock += DRUM_CLOCK_BALLS + TUNE.clockExtra;
        clockExtraGranted += TUNE.clockExtra;
      }
      if (event.kind === 'slot-result') {
        let scale = 1;
        if (GIFTS !== 'off') {
          const queue = event.mode === 'reel' ? pendingReel : pendingAll;
          if (queue.length) scale = queue.shift();
        }
        if (event.mode === 'reel') {
          reelSpins += 1;
          if (event.paid) reelPaid += 1;
        }
        if (event.ballPayout) {
          const granted = event.ballPayout * scale;
          stock += granted;
          if (event.balls >= 1 && event.balls <= 3) {
            ballHits[event.balls] += 1;
            reelGranted[event.balls] += granted;
          }
        }
      }
    },
  });
  let steps = 0;
  let lastShot = -SHOT_GAP_MS;
  let miniMs = 0;
  let at9 = null;
  while (steps < STEP_CAP) {
    const next = slotsForTune(score);
    const idle = game.balls.length === 0 && game.collector.remaining === 0 && game.pendingLaunches === 0;
    if (next > slots && idle && !secretWait) {
      slots = next;
      game.setSlots(next);
      if (slots >= 9 && !at9) {
        at9 = { score, ballsSpent, launches, miniMs, steps };
      }
    }
    if (secretWait && idle && !miniAwarded) {
      const performanceScore = random() * MINI_BALLS_FULL_SCORE;
      const secretPay = TUNE.secretBalls * secretScale;
      stock += secretPay + TUNE.miniBalls;
      secretGranted += secretPay;
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
    const used = spendFactor(slots, spendable, burstWanted);
    const burst = burstWanted && used > 0;
    const cost = used ? shotCost(used, burst) : 0;
    crowdLocked = crowdLaunchLocked(crowdLocked, game.balls.length);
    if (!secretWait && used && clock - lastShot >= 900 && game.balls.length < 10) {
      if (crowdLocked) crowdBlocks += 1;
      else {
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
    }
    game.step();
    steps += 1;
    if (game.balls.length > peakBalls) peakBalls = game.balls.length;
    const pending = game.collector.remaining;
    const stored = game.collector.stored.length;
    if (stock <= 0 && stored === 0 && pending === 0 && game.pendingLaunches === 0 && game.balls.length === 0 && !secretWait) break;
  }
  const physicsMs = steps * STEP;
  const after9 = at9 ? {
    playMs: (launches - at9.launches) * SHOT_GAP_MS + (miniMs - at9.miniMs),
    physicsMs: (steps - at9.steps) * STEP,
    score: score - at9.score,
    ballsSpent: ballsSpent - at9.ballsSpent,
    launches: launches - at9.launches,
    scoreAt: at9.score,
    ballsAt: at9.ballsSpent,
  } : null;
  return {
    score, launches, ballsSpent, doubleShots, tierShots, slots, jackpots, bestSlot, physicsMs,
    playMs: launches * SHOT_GAP_MS + miniMs, capped: steps >= STEP_CAP, ballHits, reelSpins, reelPaid, after9,
    randomShots: game.stats.randomShots, enlargements: game.stats.enlargements, clockBursts: game.stats.clockBursts,
    jarReleases: game.stats.storageBursts, jarBalls: game.stats.storageDrops,
    secretGranted, miniGranted, enlargeGranted, drumExtraGranted, clockExtraGranted, clockEmitted, jarScheduled, reelGranted,
    peakBalls, stockLeft: stock, tableBalls: game.balls.length, crowdBlocks,
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
const reached9Rows = results.filter(row => row.after9);
const summarizeMinutes = rows => ({
  mean: round2(mean(minutes(rows))),
  median: round2(pick(minutes(rows), 0.5)),
  p90: round2(pick(minutes(rows), 0.9)),
});
const summarizeCount = rows => ({
  mean: Math.round(mean(rows)),
  median: pick(rows, 0.5),
});
const after9 = reached9Rows.length ? {
  n: reached9Rows.length,
  playMin: summarizeMinutes(reached9Rows.map(row => row.after9.playMs)),
  physicsMin: summarizeMinutes(reached9Rows.map(row => row.after9.physicsMs)),
  ballsSpent: summarizeCount(reached9Rows.map(row => row.after9.ballsSpent)),
  scoreGained: {
    ...summarizeCount(reached9Rows.map(row => row.after9.score)),
    max: Math.max(...reached9Rows.map(row => row.after9.score)),
  },
  scoreAtUnlock: summarizeCount(reached9Rows.map(row => row.after9.scoreAt)),
  meanLaunches: Math.round(mean(reached9Rows.map(row => row.after9.launches))),
  capped: reached9Rows.filter(row => row.capped).length,
} : { n: 0 };
console.log(JSON.stringify({
  rounds: ROUNDS,
  variant: PRESET,
  tune: TUNE,
  policy: POLICY,
  policyText: POLICIES[POLICY],
  gifts: GIFTS,
  giftsText: GIFT_MODES[GIFTS],
  launchLock: BOARD_CROWD_LOCK,
  launchUnlock: boardCrowdUnlock(),
  launchLockBlocked: results.reduce((sum, row) => sum + row.crowdBlocks, 0),
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
    clockBalls: round1(mean(results.map(row => row.clockEmitted + row.clockExtraGranted))),
    clockExtra: round1(mean(results.map(row => row.clockExtraGranted))),
    jarReleases: round1(mean(results.map(row => row.jarReleases))),
    jarBalls: round1(mean(results.map(row => row.jarBalls))),
    jarScheduled: round1(mean(results.map(row => row.jarScheduled))),
    secretVisits: round1(mean(results.map(row => row.jackpots))),
    secretBalls: round1(mean(results.map(row => row.secretGranted))),
    miniBalls: round1(mean(results.map(row => row.miniGranted))),
    enlargeBalls: round1(mean(results.map(row => row.enlargeGranted))),
    reelPlus1: round1(mean(results.map(row => row.reelGranted[1]))),
    reelPlus10: round1(mean(results.map(row => row.reelGranted[2]))),
    reelPlus100: round1(mean(results.map(row => row.reelGranted[3]))),
    reelBalls: round1(mean(results.map(row => row.reelGranted[1] + row.reelGranted[2] + row.reelGranted[3]))),
  },
  score: { mean: Math.round(mean(scores)), median: pick(scores, 0.5), p90: pick(scores, 0.9), max: Math.max(...scores) },
  reach: {
    slots7: { n: reached7, pct: pct(reached7) },
    slots9: { n: reached9, pct: pct(reached9) },
    score50k: { n: reached50k, pct: pct(reached50k) },
  },
  meanLaunches: Math.round(mean(results.map(row => row.launches))),
  meanTierShots: { x1: meanTier(1), x2: meanTier(2), x4: meanTier(4), x8: meanTier(8) },
  after9,
  nine: results.flatMap((row, i) => row.after9 ? [{
    i,
    scoreAt: row.after9.scoreAt,
    scoreAfter: row.after9.score,
    playAfterMs: row.after9.playMs,
    physicsAfterMs: row.after9.physicsMs,
    ballsAfter: row.after9.ballsSpent,
    launchesAfter: row.after9.launches,
    finalScore: row.score,
    capped: row.capped,
  }] : []),
  cappedRuns: capped.length,
  meanPeakBalls: round1(mean(results.map(row => row.peakBalls))),
  maxPeakBalls: Math.max(...results.map(row => row.peakBalls)),
  cappedStock: capped.length ? Math.round(mean(capped.map(row => row.stockLeft))) : 0,
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
