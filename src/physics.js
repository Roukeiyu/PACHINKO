import Matter from 'matter-js';
import { createSlotMachine, SLOT_DISPLAY } from './slot-machine.js';

const { Engine, Bodies, Body, Composite, Events } = Matter;
export const TABLE = Object.freeze({ width: 760, height: 900, left: 39, right: 655, slotTop: 797, scoreLine: 865, launchX: 713, launchY: 787 });
export const STEP = 1000 / 120;
const FILTER = { world: 1, ascending: 2, playing: 4, returnRamp: 8, launchDoor: 16 };
export const slotMultipliers = count => count === 5 ? [2, 3, 10, 3, 2] : count === 9 ? [2, 2, 3, 5, 10, 5, 3, 2, 2] : [2, 3, 5, 10, 5, 3, 2];

// Physics is independent of rendering, so trajectory and scoring can be tested at
// the same fixed time step used on desktop and mobile (including fast launches).
export function createTable({ slots = 7, random = Math.random, starRandom = Math.random, slotRandom = Math.random, onHit = () => {}, onScore = () => {}, onReturn = () => {}, onSurprise = () => {} } = {}) {
  const engine = Engine.create({ gravity: { x: 0, y: 1.05 }, positionIterations: 8, velocityIterations: 8 });
  const balls = [], walls = [], pins = [], kickers = [], bumpers = [], rails = [], diamonds = [], spinners = [], guards = [], dividers = [], gates = [];
  const holes = [{ x: 615, y: 482, facing: Math.PI, glow: 0 }];
  const deflectors = [], pendingDeflections = [];
  let activeStar = null, nextStarAt = 0, nextStarId = 1, lastStarLocation = -1, nextStarMultiplier = 2;
  let clock = 0, nextId = 1;
  const pendingShots = [], pendingDrops = [], pendingLaunches = [];
  let emissionPaused = false;
  const collector = { x: 100, y: 650, radius: 18, capacity: 20, stored: [], remaining: 0, glow: 0, outlets: [] };
  const rewards = { hits: [0, 0, 0], goals: [10, 10, 30], enlargedUntil: 0, burstUntil: 0, burstStep: -1, gateGlow: 0, ordinaryStars: 0 };
  const slotMachine = createSlotMachine({ random: slotRandom, onEvent: event => onSurprise({ ...event, x: SLOT_DISPLAY.x, y: SLOT_DISPLAY.y }) });
  const stats = { launches: 0, entered: 0, scored: 0, jackpots: 0, returns: 0, timeouts: 0, redirected: 0, bonusBalls: 0, randomShots: 0, clockBursts: 0, enlargements: 0, absorbed: 0, storageBursts: 0, storageDrops: 0, impacts: 0, hits: { pin: 0, kicker: 0, bumper: 0, rail: 0, spinner: 0, diamond: 0, wall: 0, deflector: 0 } };
  const add = (body, group, extra = {}) => { body.plugin = { glow: 0, ...extra }; group.push(body); Composite.add(engine.world, body); return body; };
  const segment = (x1, y1, x2, y2, thickness, group, label = 'wall', restitution = .65) => {
    const length = Math.hypot(x2 - x1, y2 - y1);
    return add(Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, length + thickness / 2, thickness, { isStatic: true, angle: Math.atan2(y2 - y1, x2 - x1), chamfer: { radius: thickness / 2 }, label, restitution, friction: .002 }), group);
  };
  segment(23, 78, 23, 885, 22, walls);
  segment(23, 78, 75, 27, 22, walls);
  segment(75, 27, 668, 27, 22, walls);
  segment(668, 27, 744, 103, 22, walls);
  segment(744, 103, 744, 885, 22, walls);
  // Split the inner wall at the marked line. Ascending shots meet the vertical
  // door; returning balls meet the diagonal ramp and roll down-left into play.
  segment(676, 164, 676, 529, 17, walls);
  segment(676, 625, 676, 882, 17, walls);
  const door = segment(676, 529, 676, 625, 17, gates, 'launch-door');
  door.collisionFilter = { category: FILTER.launchDoor, mask: FILTER.ascending, group: 0 };
  const ramp = segment(659, 615, 743, 543, 12, gates, 'return-ramp', .12);
  ramp.collisionFilter = { category: FILTER.returnRamp, mask: FILTER.playing, group: 0 };
  segment(677, 882, 744, 882, 20, walls);
  segment(35, 760, 40, 795, 14, walls);
  segment(664, 760, 653, 795, 14, walls);
  // Close the open left approach with a short inward-facing guard, leaving
  // clearance around the triangle for its full-circle launches.
  segment(28, 370, 87, 396, 13, walls);

  [[238, 236, 32], [462, 236, 32], [350, 367, 39]].forEach(([x, y, r], i) => {
    add(Bodies.circle(x, y, r, { isStatic: true, label: 'bumper', restitution: 1.05, friction: 0 }), bumpers, { index: i, radius: r, baseRadius: r, lastKick: -1000 });
  });
  // Permanent spring studs at the two marked positions on the center axis.
  [[350, 50], [350, 690]].forEach(([x, y], index) => {
    add(Bodies.circle(x, y, 13, { isStatic: true, label: 'kicker', restitution: 1.05, friction: 0 }), kickers, { index, radius: 13 });
  });
  [[156, 304, 228, 363], [536, 335, 601, 290], [125, 578, 217, 541], [496, 568, 581, 611]].forEach(args => segment(...args, 16, rails, 'rail', .93));
  for (const [index, amplitude, period, direction] of [[0, 36, 4600, 1], [3, 34, 5200, -1]]) {
    const rail = rails[index];
    rail.plugin.motion = { x: rail.position.x, y: rail.position.y, axisX: Math.cos(rail.angle), axisY: Math.sin(rail.angle), amplitude, period, direction };
  }
  [[254, 668], [442, 695]].forEach(([x, y]) => add(Bodies.polygon(x, y, 4, 23, { isStatic: true, label: 'diamond', restitution: .95, friction: 0, angle: Math.PI / 4 }), diamonds));
  const spinner = add(Bodies.rectangle(351, 540, 122, 13, { isStatic: true, label: 'spinner', chamfer: { radius: 6 }, restitution: .85, friction: .01 }), spinners);
  spinner.plugin.radius = 61;
  // Tip and arrow share the outgoing direction. The launch tip has clearance
  // from nearby obstacles even when pointing left, allowing full-circle shots.
  const triangle = add(Bodies.fromVertices(99, 466, [[{ x: 34, y: 0 }, { x: -17, y: -23 }, { x: -17, y: 23 }]], { isStatic: true, label: 'deflector', restitution: .8, friction: 0 }), deflectors, { radius: 34, angle: -Math.PI / 3, hits: 0 });
  Body.setAngle(triangle, triangle.plugin.angle);
  // Recessed cups with narrow, inward-facing mouths. A jackpot is earned by
  // actually reaching the hole, never by an invisible random rejection.
  for (const hole of holes) {
    for (let i = 0; i < 12; i++) {
      const a = hole.facing + .55 + i * (Math.PI * 2 - 1.1) / 12;
      const b = hole.facing + .55 + (i + 1) * (Math.PI * 2 - 1.1) / 12;
      segment(hole.x + Math.cos(a) * 32, hole.y + Math.sin(a) * 32, hole.x + Math.cos(b) * 32, hole.y + Math.sin(b) * 32, 8, guards, 'guard');
    }
  }
  // A real upward-facing cup receives balls through a wide mouth in the lower-left gap.
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + .9 + i * (Math.PI * 2 - 1.8) / 14;
    const b = -Math.PI / 2 + .9 + (i + 1) * (Math.PI * 2 - 1.8) / 14;
    const rim = segment(collector.x + Math.cos(a) * 33, collector.y + Math.sin(a) * 33,
      collector.x + Math.cos(b) * 33, collector.y + Math.sin(b) * 33, 8, guards, 'guard', .25);
    rim.plugin.storage = true;
  }
  // Cover the outer seam between the recessed cup and the side wall, so a
  // falling ball cannot wedge into the narrow space behind the cup.
  segment(665, 413, 615, 438, 13, walls);
  // Fixed left/right pairs mirrored across the center bumper's vertical x=350 axis.
  // Coordinates leave space for moving rails, enlarged bumpers and the hole.
  const pinAnchors = [[150, 155], [280, 155], [110, 235], [320, 270],
    [250, 325], [95, 350], [190, 420], [250, 500], [250, 600],
    [185, 640], [310, 640], [120, 730], [200, 730], [310, 730]];
  const pinPositions = pinAnchors.flatMap(([x, y]) => [[x, y], [700 - x, y]]);
  pinPositions.forEach(([x, y], index) => {
    add(Bodies.circle(x, y, 7.5, { isStatic: true, label: 'pin', restitution: .85, friction: 0 }), pins, { index });
  });
  // Collectibles only appear in reachable gaps. Reserve every moving rail's
  // full swept area, the spinner's sweep and the center bumper's enlarged size.
  const starLocations = [], probe = Bodies.circle(0, 0, 26);
  const starObstacles = [...walls, ...pins, ...kickers, ...rails, ...diamonds, ...guards];
  for (let y = 180; y <= 740; y += 20) for (let x = 80; x <= 620; x += 20) {
    Body.setPosition(probe, { x, y });
    if (Matter.Query.collides(probe, starObstacles).length) continue;
    if (rails.some(r => {
      const m = r.plugin.motion;
      return m && x > r.bounds.min.x - Math.abs(m.axisX * m.amplitude) - 26 && x < r.bounds.max.x + Math.abs(m.axisX * m.amplitude) + 26
        && y > r.bounds.min.y - Math.abs(m.axisY * m.amplitude) - 26 && y < r.bounds.max.y + Math.abs(m.axisY * m.amplitude) + 26;
    })) continue;
    if (bumpers.some(b => Math.hypot(x - b.position.x, y - b.position.y) < b.plugin.baseRadius * (b.plugin.index === 2 ? 1.5 : 1) + 26)) continue;
    if (Math.hypot(x - 351, y - 540) < 94 || Math.hypot(x - 99, y - 466) < 64 || holes.some(h => Math.hypot(x - h.x, y - h.y) < 62) || Math.hypot(x - collector.x, y - collector.y) < 62) continue;
    // Keep collectible stars readable around the painted reel display.
    if (Math.abs(x - SLOT_DISPLAY.x) < SLOT_DISPLAY.width / 2 + 26 && Math.abs(y - SLOT_DISPLAY.y) < SLOT_DISPLAY.height / 2 + 26) continue;
    starLocations.push({ x, y });
  }
  function placeStar() {
    const candidates = starLocations.map((p, index) => ({ ...p, index })).filter(p => p.index !== lastStarLocation && balls.every(b => Math.hypot(p.x - b.body.position.x, p.y - b.body.position.y) > 65));
    if (!candidates.length) return;
    const p = candidates[Math.min(candidates.length - 1, Math.floor(starRandom() * candidates.length))];
    lastStarLocation = p.index;
    const multiplier = nextStarMultiplier, lifetime = multiplier === 5 ? 10000 : 30000;
    activeStar = Object.freeze({ id: nextStarId++, x: p.x, y: p.y, radius: 11, born: clock, multiplier, expiresAt: clock + lifetime });
    nextStarMultiplier = 2;
  }
  placeStar();
  function clearBalls() { for (const ball of balls) Composite.remove(engine.world, ball.body); balls.length = 0; pendingShots.length = 0; pendingLaunches.length = 0; rewards.burstUntil = 0; rewards.burstStep = -1; }
  function setSlots(count) {
    if (![5, 7, 9].includes(count)) throw new RangeError('Slots must be 5, 7, or 9');
    slots = count; clearBalls();
    for (const body of dividers) Composite.remove(engine.world, body);
    dividers.length = 0;
    const sw = (TABLE.right - TABLE.left) / slots;
    for (let i = 1; i < slots; i++) segment(TABLE.left + i * sw, TABLE.slotTop, TABLE.left + i * sw, 894, 7, dividers, 'divider', .4);
    collector.outlets = Array.from({ length: slots }, (_, column) => ({ column, x: TABLE.left + (column + .5) * sw, y: 74, glow: 0 }));
    // Stored balls and drops that have not yet emerged survive a layout change.
    const columns = shuffledColumns(pendingDrops.length);
    pendingDrops.forEach((drop, i) => { drop.column = columns[i]; });
  }
  setSlots(slots);
  function spawn(x, y, vx, vy, { power = 0, bonus = false, kind = 'launch' } = {}) {
    const body = Bodies.circle(x, y, 11, { label: 'ball', density: .009, restitution: .65, friction: .001, frictionAir: .001, collisionFilter: { category: bonus ? FILTER.playing : FILTER.ascending, mask: 0xffffffff, group: 0 } });
    Body.setVelocity(body, { x: vx, y: vy });
    const ball = { id: nextId++, body, power, entered: bonus, bonus, kind, scoreFactor: 1, redirected: false, trail: [], born: clock, stuck: 0, lastKick: -1000, lastBumperHits: [-1000, -1000, -1000], collisions: 0 };
    Composite.add(engine.world, body); balls.push(ball);
    if (bonus) stats.bonusBalls++;
    return ball;
  }
  const laneOccupied = () => balls.some(ball => !ball.entered && ball.body.position.x > 688 && ball.body.position.y > 675);
  function launch(power = .65) {
    if (emissionPaused) return null;
    if (balls.length >= 24 || pendingLaunches.length || laneOccupied()) return null;
    return launchBall(power);
  }
  function launchBall(power, kind = 'launch') {
    power = Math.max(0, Math.min(1, power));
    // One spring impulse proportional to the held charge. No minimum velocity,
    // continuing booster, or speed maintenance: weak shots fall back naturally.
    const ball = spawn(TABLE.launchX + (random() - .5) * 1.5, TABLE.launchY, -.05 * power, -32 * power, { power, kind });
    stats.launches++;
    return ball;
  }
  function emitCharged(ordinal) {
    const ball = launchBall(1, 'charged');
    onSurprise({ kind: 'emit', source: 'charged', ordinal, angle: -Math.PI / 2, x: TABLE.launchX, y: TABLE.launchY, ballId: ball.id, at: clock });
    return ball;
  }
  function launchBurst() {
    if (emissionPaused) return null;
    // Reserve the entire burst before firing. At 90ms spacing each preceding
    // full-power ball clears the spring before the next real impulse is applied.
    if (balls.length + 5 > 24 || pendingLaunches.length || laneOccupied()) return null;
    for (let i = 1; i < 5; i++) pendingLaunches.push({ due: clock + i * 90, ordinal: i });
    return emitCharged(0);
  }
  function setEmissionPaused(paused) {
    if (emissionPaused === paused) return;
    emissionPaused = paused;
    if (paused) {
      // Stop the un-fired part of a charged burst as soon as a secret opens.
      pendingLaunches.length = 0;
    }
  }
  function emitFrom(bumper, angle, kind, ordinal = 0) {
    const radius = bumper.plugin.radius + 26;
    const ball = spawn(bumper.position.x + Math.cos(angle) * radius, bumper.position.y + Math.sin(angle) * radius, Math.cos(angle) * 12.5, Math.sin(angle) * 12.5, { bonus: true, kind });
    if (kind === 'clock') rewards.burstStep = ordinal;
    onSurprise({ kind: 'emit', source: kind, ordinal, angle, x: bumper.position.x, y: bumper.position.y, ballId: ball.id, at: clock });
  }
  function shuffledColumns(count) {
    const columns = [];
    while (columns.length < count) {
      const round = Array.from({ length: slots }, (_, i) => i);
      for (let i = round.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [round[i], round[j]] = [round[j], round[i]];
      }
      columns.push(...round.slice(0, count - columns.length));
    }
    return columns;
  }
  function storeBall(ball) {
    collector.stored.push(ball.scoreFactor); stats.absorbed++; collector.glow = 1;
    onSurprise({ kind: 'store', x: collector.x, y: collector.y, count: collector.stored.length, capacity: collector.capacity, ballId: ball.id, scoreFactor: ball.scoreFactor });
    if (collector.stored.length < collector.capacity) return;
    const factors = collector.stored.splice(0).flatMap(factor => [factor, factor]);
    const columns = shuffledColumns(factors.length);
    let due = Math.max(clock + 250, (pendingDrops.at(-1)?.due ?? clock) + 100);
    factors.forEach((scoreFactor, i) => {
      pendingDrops.push({ due, column: columns[i], scoreFactor });
      due += 80 + random() * 60;
    });
    collector.remaining = pendingDrops.length; stats.storageBursts++;
    onSurprise({ kind: 'storage-burst', x: collector.x, y: collector.y, amount: factors.length });
  }
  function emitDrop(drop) {
    const outlet = collector.outlets[drop.column], sw = (TABLE.right - TABLE.left) / slots;
    const x = outlet.x + (random() * 2 - 1) * Math.min(8, sw / 2 - 18);
    // Drop beneath the top mouth, clear of the upper spring stud and pin row.
    // A gentle downward velocity lets gravity and the full board decide the outcome.
    const ball = spawn(x, outlet.y + 21, (random() - .5) * .7, .6 + random() * .8, { bonus: true, kind: 'storage' });
    ball.scoreFactor = drop.scoreFactor;
    outlet.glow = 1; stats.storageDrops++;
    onSurprise({ kind: 'emit', source: 'storage', angle: Math.PI / 2, x, y: outlet.y, column: drop.column, ballId: ball.id, scoreFactor: ball.scoreFactor, at: clock });
  }
  function resizeCenter(enlarged) {
    const bumper = bumpers[2], radius = bumper.plugin.baseRadius * (enlarged ? 1.5 : 1);
    if (Math.abs(bumper.plugin.radius - radius) < .01) return;
    Body.scale(bumper, radius / bumper.plugin.radius, radius / bumper.plugin.radius);
    bumper.plugin.radius = radius;
  }
  function recordBumperHit(bumper) {
    const index = bumper.plugin.index;
    rewards.hits[index]++;
    if (rewards.hits[index] % rewards.goals[index]) return;
    if (index === 0) {
      stats.randomShots++;
      pendingShots.push({ due: clock, index: 0, angle: random() * Math.PI * 2, kind: 'random', ordinal: 0 });
      onSurprise({ kind: 'random', x: bumper.position.x, y: bumper.position.y });
    } else if (index === 1) {
      stats.enlargements++; rewards.enlargedUntil = clock + 10000;
      resizeCenter(true);
      onSurprise({ kind: 'enlarge', x: bumpers[2].position.x, y: bumpers[2].position.y });
    } else {
      stats.clockBursts++; rewards.burstUntil = clock + 1200;
      for (let i = 0; i < 12; i++) pendingShots.push({ due: clock + i * 1000 / 12, index: 2, angle: -Math.PI / 2 + i * Math.PI / 6, kind: 'clock', ordinal: i });
      onSurprise({ kind: 'clock', x: bumper.position.x, y: bumper.position.y });
    }
  }
  Events.on(engine, 'collisionStart', event => {
    for (const pair of event.pairs) {
      const body = pair.bodyA.label === 'ball' ? pair.bodyA : pair.bodyB.label === 'ball' ? pair.bodyB : null;
      if (!body) continue;
      const obstacle = body === pair.bodyA ? pair.bodyB : pair.bodyA;
      if (obstacle.label === 'ball') continue;
      const ball = balls.find(b => b.body === body);
      if (!ball) continue;
      if (obstacle.label === 'deflector') pendingDeflections.push({ ball, obstacle });
      ball.collisions++;
      stats.impacts++;
      if (obstacle.label in stats.hits) stats.hits[obstacle.label]++;
      obstacle.plugin.glow = 1;
      if (obstacle.label === 'return-ramp' && body.position.x > 676 && body.velocity.y > 0 && !ball.redirected) {
        ball.redirected = true; stats.redirected++; rewards.gateGlow = 1;
        onSurprise({ kind: 'redirect', x: 671, y: 594 });
      }
      if (obstacle.label === 'bumper' && clock - ball.lastBumperHits[obstacle.plugin.index] > 100) {
        ball.lastBumperHits[obstacle.plugin.index] = clock;
        recordBumperHit(obstacle);
      }
      if (['bumper', 'kicker'].includes(obstacle.label) && clock - ball.lastKick > 170) {
        const dx = body.position.x - obstacle.position.x, dy = body.position.y - obstacle.position.y;
        const d = Math.hypot(dx, dy) || 1;
        // An active pinball bumper adds a bounded outward impulse.
        Body.setVelocity(body, { x: dx / d * 10.8, y: dy / d * 10.8 });
        ball.lastKick = clock;
      }
      onHit({ kind: obstacle.label, x: body.position.x, y: body.position.y, index: obstacle.plugin.index || 0 });
    }
  });
  function remove(ball, index) { Composite.remove(engine.world, ball.body); balls.splice(index, 1); }
  function settleScore(result, ball) {
    const globalMultiplier = slotMachine.state.multiplier;
    stats.scored++;
    // The bonus is read at entry, never copied to a ball or to storage stock.
    // The entry that earns a spin is scored before its future result activates.
    onScore({ ...result, scoreFactor: ball.scoreFactor, globalMultiplier,
      points: result.basePoints * ball.scoreFactor * globalMultiplier, ballId: ball.id });
    slotMachine.recordEntry(clock);
  }
  function step(dt = STEP) {
    clock += dt;
    // Freeze earned bonus/drop schedules while existing balls drain, including
    // any rewards those balls earn during the wait. Inventory is never lost.
    if (emissionPaused) for (const queue of [pendingShots,pendingDrops]) for (const shot of queue) shot.due += dt;
    slotMachine.advance(clock);
    if (activeStar && clock + 1e-6 >= activeStar.expiresAt) {
      activeStar = null;
      nextStarAt = clock;
    }
    if (!activeStar && clock + 1e-6 >= nextStarAt) placeStar();
    if (rewards.enlargedUntil && clock + 1e-6 >= rewards.enlargedUntil) { rewards.enlargedUntil = 0; resizeCenter(false); }
    rewards.gateGlow = Math.max(0, rewards.gateGlow - dt / 900);
    collector.glow = Math.max(0, collector.glow - dt / 600);
    for (const outlet of collector.outlets) outlet.glow = Math.max(0, outlet.glow - dt / 320);
    while (!emissionPaused && pendingDrops.length && pendingDrops[0].due <= clock + 1e-6) emitDrop(pendingDrops.shift());
    collector.remaining = pendingDrops.length;
    while (!emissionPaused && pendingLaunches.length && pendingLaunches[0].due <= clock + 1e-6) emitCharged(pendingLaunches.shift().ordinal);
    // Use the same simulation clock for countdowns and clock-burst scheduling;
    // opening settings or backgrounding the tab pauses all gameplay together.
    for (let i = 0; !emissionPaused && i < pendingShots.length;) {
      const shot = pendingShots[i];
      if (shot.due > clock + 1e-6) { i++; continue; }
      pendingShots.splice(i, 1); emitFrom(bumpers[shot.index], shot.angle, shot.kind, shot.ordinal);
    }
    for (const ball of balls) {
      const { body } = ball;
      ball.pickupFrom = { ...body.position };
      if (ball.entered || body.velocity.y > 0) body.collisionFilter.category = FILTER.playing;
    }
    Body.setAngle(spinner, Math.sin(clock / 1350) * .85, true);
    for (const rail of rails) {
      const motion = rail.plugin.motion;
      if (motion) {
        const travel = Math.sin(clock / motion.period * Math.PI * 2) * motion.amplitude * motion.direction;
        Body.setPosition(rail, { x: motion.x + motion.axisX * travel, y: motion.y + motion.axisY * travel }, true);
      }
    }
    Engine.update(engine, dt);
    // Apply the active platform's kick after the solver so the contact response
    // cannot overwrite it. Place the ball just beyond the new tip to avoid
    // overlapping a rotated face and counting one contact multiple times.
    for (const { ball, obstacle } of pendingDeflections.splice(0)) {
      const p = obstacle.plugin;
      // Continuous random headings around the full circle; exclude the nearest
      // 25 degrees on either side so every hit visibly changes direction.
      const minTurn = 25 * Math.PI / 180;
      p.angle = (p.angle + minTurn + random() * (Math.PI * 2 - minTurn * 2)) % (Math.PI * 2);
      p.hits++;
      Body.setAngle(obstacle, p.angle);
      const dx = Math.cos(p.angle), dy = Math.sin(p.angle);
      Body.setPosition(ball.body, { x: obstacle.position.x + dx * (p.radius + 14), y: obstacle.position.y + dy * (p.radius + 14) });
      Body.setVelocity(ball.body, { x: dx * 12.5, y: dy * 12.5 });
      ball.pickupFrom = { ...ball.body.position };
      onSurprise({ kind: 'deflect', x: obstacle.position.x, y: obstacle.position.y, angle: p.angle });
    }
    for (const body of [...pins, ...kickers, ...bumpers, ...rails, ...diamonds, ...spinners, ...deflectors]) body.plugin.glow = Math.max(0, body.plugin.glow - dt / 320);
    for (const hole of holes) hole.glow = Math.max(0, hole.glow - dt / 1500);
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i], { body } = ball, { x, y } = body.position;
      ball.trail.push({ x, y }); if (ball.trail.length > 18) ball.trail.shift();
      if (!ball.entered && x < 650) { ball.entered = true; body.collisionFilter.category = FILTER.playing; stats.entered++; }
      if (activeStar && ball.entered) {
        // Sweep the actual frame path so fast balls cannot skip a small star.
        const from = ball.pickupFrom, dx = x - from.x, dy = y - from.y;
        const along = Math.max(0, Math.min(1, ((activeStar.x - from.x) * dx + (activeStar.y - from.y) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(activeStar.x - from.x - along * dx, activeStar.y - from.y - along * dy) <= activeStar.radius + 11) {
          const collected = activeStar;
          activeStar = null; nextStarAt = clock + 500; ball.scoreFactor *= collected.multiplier;
          if (collected.multiplier === 2 && ++rewards.ordinaryStars % 10 === 0) nextStarMultiplier = 5;
          onSurprise({ kind: 'star', x: collected.x, y: collected.y, ballId: ball.id, multiplier: collected.multiplier, scoreFactor: ball.scoreFactor });
        }
      }
      if (body.speed > 32) Body.setVelocity(body, { x: body.velocity.x * 32 / body.speed, y: body.velocity.y * 32 / body.speed });
      if (ball.entered) {
        const from = ball.pickupFrom, dx = x - from.x, dy = y - from.y;
        const along = Math.max(0, Math.min(1, ((collector.x - from.x) * dx + (collector.y - from.y) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(collector.x - from.x - along * dx, collector.y - from.y - along * dy) < collector.radius) {
          remove(ball, i); storeBall(ball); continue;
        }
      }
      const hole = ball.entered && holes.find(h => Math.hypot(x - h.x, y - h.y) < 18);
      if (hole) { hole.glow = 1; stats.jackpots++; remove(ball, i); settleScore({ kind: 'jackpot', basePoints: 500, x: hole.x, y: hole.y }, ball); continue; }
      if (ball.entered && x < 666 && y >= TABLE.scoreLine) {
        const column = Math.max(0, Math.min(slots - 1, Math.floor((x - TABLE.left) / ((TABLE.right - TABLE.left) / slots))));
        const multiplier = slotMultipliers(slots)[column];
        remove(ball, i); settleScore({ kind: 'slot', column, multiplier, basePoints: multiplier * 10, x: TABLE.left + (column + .5) * (TABLE.right - TABLE.left) / slots, y: TABLE.scoreLine }, ball); continue;
      }
      // Balls falling back down the shooter lane are returned, never mis-scored
      // as the rightmost slot. A timeout is visible rather than a hidden teleport.
      if ((x > 688 && y > 815 && body.velocity.y > 0) || y > 960 || clock - ball.born > 45000) {
        if (clock - ball.born > 45000) stats.timeouts++;
        stats.returns++; remove(ball, i); onReturn({ ballId: ball.id }); continue;
      }
      if (body.speed < .18) ball.stuck += dt; else ball.stuck = 0;
      if (ball.stuck > 1000) { Body.setVelocity(body, { x: random() > .5 ? .9 : -.9, y: -.5 }); ball.stuck = 0; }
    }
  }
  return { engine, balls, walls, pins, kickers, bumpers, rails, diamonds, spinners, deflectors, guards, dividers, gates, holes, collector, slotMachine: slotMachine.state, stats, rewards, launch, launchBurst, setEmissionPaused, get emissionPaused() { return emissionPaused; }, get pendingLaunches() { return pendingLaunches.length; }, step, setSlots, get star() { return activeStar; }, get clock() { return clock; }, get slots() { return slots; } };
}
