// A fixed pool of confetti. Burst gifts already fill the board, so this overlay
// never allocates during a lock and never adds physics bodies.
const COLORS = ['#e2ae48', '#e994a4', '#8fb56a', '#f4e2a8', '#fffaf0', '#d4a44c'];
const POOL = 64;

export function createCrowdFireworks(canvas) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const pool = Array.from({ length: POOL }, () => ({ on: false }));
  let cursor = 0;
  let acc = 0;
  let dpr = 1;

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const nextW = Math.round(w * dpr);
    const nextH = Math.round(h * dpr);
    if (canvas.width === nextW && canvas.height === nextH) return;
    canvas.width = nextW;
    canvas.height = nextH;
  }

  function burst(width, height) {
    const x = width * (0.2 + Math.random() * 0.6);
    const y = height * (0.14 + Math.random() * 0.42);
    for (let i = 0; i < 8; i++) {
      const p = pool[cursor];
      cursor = (cursor + 1) % POOL;
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 50 + Math.random() * 80;
      p.on = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 30;
      p.life = 1;
      p.decay = 0.5 + Math.random() * 0.4;
      p.size = 2 + Math.random() * 2;
      p.color = COLORS[i % COLORS.length];
    }
  }

  function frame(dt, active, reduced) {
    if (!canvas.width) resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (reduced) return 0;
    const step = Math.min(Math.max(dt, 0), 50) / 1000;
    if (active) {
      acc += dt;
      if (acc >= 260) {
        acc = 0;
        burst(canvas.width / dpr, canvas.height / dpr);
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let alive = 0;
    for (const p of pool) {
      if (!p.on) continue;
      p.vy += 110 * step;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.life -= p.decay * step;
      if (p.life <= 0) {
        p.on = false;
        continue;
      }
      alive += 1;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size * 1.7);
    }
    ctx.globalAlpha = 1;
    return alive;
  }

  return { resize, frame };
}
