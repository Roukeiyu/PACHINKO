import Matter from 'matter-js';

const { Engine, Bodies, Body, Composite, Events } = Matter;
export const TABLE = Object.freeze({ width: 760, height: 900, left: 39, right: 655, slotTop: 797, scoreLine: 865, launchX: 713, launchY: 787 });
export const STEP = 1000 / 120;
export const slotMultipliers = count => count === 5 ? [2, 3, 10, 3, 2] : count === 9 ? [2, 2, 3, 5, 10, 5, 3, 2, 2] : [2, 3, 5, 10, 5, 3, 2];

// Physics is independent of rendering, so trajectory and scoring can be tested at
// the same fixed time step used on desktop and mobile (including fast launches).
export function createTable({ slots = 7, random = Math.random, onHit = () => {}, onScore = () => {}, onReturn = () => {} } = {}) {
  const engine = Engine.create({ gravity: { x: 0, y: 1.05 }, positionIterations: 8, velocityIterations: 8 });
  const balls = [], walls = [], pins = [], bumpers = [], rails = [], diamonds = [], spinners = [], guards = [], dividers = [];
  const holes = [{ x: 78, y: 466, facing: 0, glow: 0 }, { x: 615, y: 482, facing: Math.PI, glow: 0 }];
  let clock = 0, nextId = 1;
  const stats = { launches: 0, entered: 0, scored: 0, jackpots: 0, returns: 0, timeouts: 0, hits: { pin: 0, bumper: 0, rail: 0, spinner: 0, diamond: 0, wall: 0 } };
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
  // The physical shooter lane is closed at the bottom and opens above y=156.
  segment(676, 164, 676, 882, 17, walls);
  segment(677, 882, 744, 882, 20, walls);
  segment(35, 760, 40, 795, 14, walls);
  segment(664, 760, 653, 795, 14, walls);

  [[238, 226, 32], [450, 247, 32], [350, 367, 39]].forEach(([x, y, r], i) => {
    add(Bodies.circle(x, y, r, { isStatic: true, label: 'bumper', restitution: 1.05, friction: 0 }), bumpers, { index: i, radius: r, lastKick: -1000 });
  });
  [[101, 304, 173, 363], [536, 335, 601, 290], [125, 578, 217, 541], [496, 568, 581, 611]].forEach(args => segment(...args, 16, rails, 'rail', .93));
  [[254, 668], [442, 695]].forEach(([x, y]) => add(Bodies.polygon(x, y, 4, 23, { isStatic: true, label: 'diamond', restitution: .95, friction: 0, angle: Math.PI / 4 }), diamonds));
  const spinner = add(Bodies.rectangle(351, 540, 122, 13, { isStatic: true, label: 'spinner', chamfer: { radius: 6 }, restitution: .85, friction: .01 }), spinners);
  spinner.plugin.radius = 61;
  [[158, 162], [331, 161], [537, 164], [154, 239], [335, 273], [562, 235], [238, 426], [452, 423], [175, 463], [519, 469], [270, 495], [438, 497], [304, 612], [378, 631], [152, 687], [557, 701], [96, 741], [207, 756], [333, 743], [475, 759], [603, 746]].forEach(([x, y], i) => {
    add(Bodies.circle(x, y, 7.5, { isStatic: true, label: 'pin', restitution: .85, friction: 0 }), pins, { index: i });
  });
  // Recessed cups with narrow, inward-facing mouths. A jackpot is earned by
  // actually reaching the hole, never by an invisible random rejection.
  for (const hole of holes) {
    for (let i = 0; i < 12; i++) {
      const a = hole.facing + .55 + i * (Math.PI * 2 - 1.1) / 12;
      const b = hole.facing + .55 + (i + 1) * (Math.PI * 2 - 1.1) / 12;
      segment(hole.x + Math.cos(a) * 32, hole.y + Math.sin(a) * 32, hole.x + Math.cos(b) * 32, hole.y + Math.sin(b) * 32, 8, guards, 'guard');
    }
  }
  // Cover the outer seam between each recessed cup and the side wall, so a
  // falling ball cannot wedge into the narrow space behind the cup.
  segment(28, 397, 78, 422, 13, walls);
  segment(665, 413, 615, 438, 13, walls);
  function clearBalls() { for (const ball of balls) Composite.remove(engine.world, ball.body); balls.length = 0; }
  function setSlots(count) {
    if (![5, 7, 9].includes(count)) throw new RangeError('Slots must be 5, 7, or 9');
    slots = count; clearBalls();
    for (const body of dividers) Composite.remove(engine.world, body);
    dividers.length = 0;
    const sw = (TABLE.right - TABLE.left) / slots;
    for (let i = 1; i < slots; i++) segment(TABLE.left + i * sw, TABLE.slotTop, TABLE.left + i * sw, 894, 7, dividers, 'divider', .4);
  }
  setSlots(slots);
  function launch(power = .65) {
    if (balls.length >= 16 || balls.some(ball => !ball.entered && ball.body.position.y > 675)) return null;
    power = Math.max(0, Math.min(1, power));
    const body = Bodies.circle(TABLE.launchX + (random() - .5) * 1.5, TABLE.launchY, 11, { label: 'ball', density: .009, restitution: .65, friction: .001, frictionAir: .001 });
    Body.setVelocity(body, { x: -.05, y: -(24.5 + power * 5) });
    const ball = { id: nextId++, body, power, entered: false, trail: [], born: clock, stuck: 0, lastKick: -1000, collisions: 0 };
    Composite.add(engine.world, body); balls.push(ball); stats.launches++;
    return ball;
  }
  Events.on(engine, 'collisionStart', event => {
    for (const pair of event.pairs) {
      const body = pair.bodyA.label === 'ball' ? pair.bodyA : pair.bodyB.label === 'ball' ? pair.bodyB : null;
      if (!body) continue;
      const obstacle = body === pair.bodyA ? pair.bodyB : pair.bodyA;
      if (obstacle.label === 'ball') continue;
      const ball = balls.find(b => b.body === body);
      if (!ball) continue;
      ball.collisions++;
      if (obstacle.label in stats.hits) stats.hits[obstacle.label]++;
      obstacle.plugin.glow = 1;
      if (obstacle.label === 'bumper' && clock - ball.lastKick > 170) {
        const dx = body.position.x - obstacle.position.x, dy = body.position.y - obstacle.position.y;
        const d = Math.hypot(dx, dy) || 1;
        // An active pinball bumper adds a bounded outward impulse.
        Body.setVelocity(body, { x: dx / d * 10.8, y: dy / d * 10.8 });
        ball.lastKick = clock;
      }
      if (obstacle.label !== 'wall' && obstacle.label !== 'divider' && obstacle.label !== 'guard') onHit({ kind: obstacle.label, x: body.position.x, y: body.position.y, index: obstacle.plugin.index || 0 });
    }
  });
  function remove(ball, index) { Composite.remove(engine.world, ball.body); balls.splice(index, 1); }
  function step(dt = STEP) {
    clock += dt;
    Body.setAngle(spinner, Math.sin(clock / 1350) * .85, true);
    Engine.update(engine, dt);
    for (const body of [...pins, ...bumpers, ...rails, ...diamonds, ...spinners]) body.plugin.glow = Math.max(0, body.plugin.glow - dt / 320);
    for (const hole of holes) hole.glow = Math.max(0, hole.glow - dt / 1500);
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i], { body } = ball, { x, y } = body.position;
      ball.trail.push({ x, y }); if (ball.trail.length > 18) ball.trail.shift();
      if (!ball.entered && x < 650 && y < 175) { ball.entered = true; stats.entered++; }
      if (body.speed > 32) Body.setVelocity(body, { x: body.velocity.x * 32 / body.speed, y: body.velocity.y * 32 / body.speed });
      const hole = ball.entered && holes.find(h => Math.hypot(x - h.x, y - h.y) < 18);
      if (hole) { hole.glow = 1; stats.jackpots++; stats.scored++; remove(ball, i); onScore({ kind: 'jackpot', points: 500, x: hole.x, y: hole.y, ballId: ball.id }); continue; }
      if (ball.entered && x < 666 && y >= TABLE.scoreLine) {
        const column = Math.max(0, Math.min(slots - 1, Math.floor((x - TABLE.left) / ((TABLE.right - TABLE.left) / slots))));
        const multiplier = slotMultipliers(slots)[column];
        stats.scored++; remove(ball, i); onScore({ kind: 'slot', column, multiplier, points: multiplier * 10, x: TABLE.left + (column + .5) * (TABLE.right - TABLE.left) / slots, y: TABLE.scoreLine, ballId: ball.id }); continue;
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
  return { engine, balls, walls, pins, bumpers, rails, diamonds, spinners, guards, dividers, holes, stats, launch, step, setSlots, get clock() { return clock; }, get slots() { return slots; } };
}
