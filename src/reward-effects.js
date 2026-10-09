// Reward choreography shares the simulation clock, so settings pause every wave.
const profiles = {
  2: { tier: 1, name: '轻盈泡泡', color: '#83ae98', shape: 'bubble', count: 10, waves: 1, radius: 38, duration: 650, speed: 3, notes: [659, 880] },
  3: { tier: 2, name: '花瓣绽放', color: '#dd8fa6', shape: 'petal', count: 18, waves: 1, radius: 60, duration: 950, speed: 4.5, notes: [587, 740, 880] },
  5: { tier: 3, name: '星光喷泉', color: '#a58ad5', shape: 'star', count: 18, waves: 2, radius: 90, duration: 2400, speed: 6, notes: [587, 740, 880, 1175, 1480] },
  10: { tier: 4, name: '金色礼花', color: '#dab05b', shape: 'ribbon', count: 20, waves: 3, radius: 125, duration: 3800, speed: 8, notes: [587, 740, 880, 1175, 1480, 1760, 2349] },
  jackpot: { tier: 5, name: '秘密宝藏', color: '#d4a44c', shape: 'star', count: 20, waves: 4, radius: 150, duration: 5500, waveInterval: 700, speed: 8.5, notes: [587, 740, 880, 1175, 1480, 1760, 2349, 2960] },
  clock: { tier: 6, name: '30 次碰撞 · 十二时钟盛典', color: '#e2ae48', shape: 'star', count: 28, waves: 5, radius: 270, duration: 3000, speed: 10, notes: [294, 440, 587, 740, 880, 1175, 1480, 1760, 2349, 2960, 3520, 4699] },
};
for (const p of Object.values(profiles)) { Object.freeze(p.notes); Object.freeze(p); }
export function rewardProfile(result) {
  return profiles[result.kind === 'clock' || result.kind === 'jackpot' ? result.kind : result.multiplier] || profiles[2];
}
function wave(fx, burst, random) {
  const { profile: p, x, y, calm, nextWave } = burst;
  const count = calm ? 2 + p.tier : p.count;
  const colors = [p.color, '#f1c774', '#eaa1b1', '#a7c8aa', '#b4a0d8'];
  for (let i = 0; i < count; i++) {
    const radial = burst.kind === 'clock' || burst.kind === 'jackpot';
    const angle = radial ? i / count * Math.PI * 2 + nextWave * .2 : -Math.PI / 2 + (random() - .5) * 1.6;
    const speed = (calm ? 1 : p.speed) * (.5 + random() * .5);
    fx.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1, decay: calm ? .025 : .016 / (1 + p.tier * .12), gravity: radial ? .06 : .12,
      size: 2 + random() * (p.tier > 3 ? 3 : 2), rotation: angle,
      color: p.tier < 3 ? p.color : colors[i % colors.length],
      shape: p.shape === 'ribbon' && i % 3 === 0 ? 'star' : p.shape });
  }
  fx.ripples.push({ x, y, life: 1, color: p.color, radius: calm ? 25 : p.radius,
    width: p.tier > 3 ? 3 : 2, decay: calm ? .04 : .025 / (1 + p.tier * .15) });
  // Many simultaneous scores remain bounded on mobile.
  if (fx.particles.length > 360) fx.particles.splice(0, fx.particles.length - 360);
  if (fx.ripples.length > 100) fx.ripples.splice(0, fx.ripples.length - 100);
  burst.nextWave++;
}
export function celebrateReward(fx, result, calm, random = Math.random) {
  const profile = rewardProfile(result);
  const burst = { kind: result.kind, x: result.x, y: result.kind === 'slot' ? result.y - 52 : result.y,
    profile, age: 0, nextWave: 0, calm,
    scene: result.kind === 'jackpot' ? 'treasure' : result.kind === 'slot' && result.multiplier === 10 ? 'lucky' : profile === profiles[5] ? 'stars' : null };
  fx.celebrations.push(burst);
  if (fx.celebrations.length > 16) {
    const lowestTier = Math.min(...fx.celebrations.map(b => b.profile.tier));
    fx.celebrations.splice(fx.celebrations.findIndex(b => b.profile.tier === lowestTier), 1);
  }
  wave(fx, burst, random);
  if (!calm) fx.shake = Math.max(fx.shake, profile.tier === 6 ? 5 : profile.tier >= 4 ? 1.5 : 0);
  return profile;
}
export function advanceCelebrations(fx, dt, calm, random = Math.random) {
  for (let i = fx.celebrations.length - 1; i >= 0; i--) {
    const b = fx.celebrations[i]; b.age += dt; b.calm ||= calm;
    const waves = b.calm ? 1 : b.profile.waves;
    while (b.nextWave < waves && b.age >= b.nextWave * (b.profile.waveInterval ?? 160)) wave(fx, b, random);
    if (b.age >= b.profile.duration) fx.celebrations.splice(i, 1);
  }
}

// Outer wall centers plus the bottom lip form a single clockwise circuit.
const border = [[23,885],[23,78],[75,27],[668,27],[744,103],[744,885],[23,885]];
const lengths = border.slice(1).map(([x,y], i) => Math.hypot(x-border[i][0], y-border[i][1]));
const perimeter = lengths.reduce((sum, length) => sum + length, 0);
export const LUCKY_LAP_DURATION = 2600;
export function marqueePoint(progress) {
  let distance = Math.max(0, Math.min(1, progress)) * perimeter;
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const ratio = distance / lengths[i];
      return { x: border[i][0] + (border[i+1][0]-border[i][0]) * ratio,
        y: border[i][1] + (border[i+1][1]-border[i][1]) * ratio };
    }
    distance -= lengths[i];
  }
}
export function rewardSceneAt(burst, calm = false) {
  const reduced = calm || burst.calm, duration = burst.profile.duration;
  return { scene: burst.scene, reduced,
    alpha: Math.max(0, Math.min(1, burst.age / 180 + .25, (duration - burst.age) / 650)),
    progress: Math.max(0, Math.min(1, burst.age / LUCKY_LAP_DURATION)),
    marquee: burst.scene === 'lucky' && !reduced && burst.age < LUCKY_LAP_DURATION };
}
// Coalesce simultaneous scores so scenery costs stay bounded during multiball.
export function activeRewardScenes(celebrations) {
  const scenes = new Map();
  for (const burst of celebrations) if (burst.scene) scenes.set(burst.scene, burst);
  return [...scenes.values()];
}
