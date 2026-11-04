import { SLING_BOARD_W as W, SLING_BOARD_H as H, SLING_X, SLING_Y, SLING_AREA, SLING_RELOAD, SLING_BLOCK_W, SLING_BLOCK_H } from './mini-sling.js';

export function renderSling(field, state) {
  let canvas = field.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas'); canvas.className = 'mini-sling-canvas';
    canvas.setAttribute('aria-label', '弹弓拆拆乐：固定中心炮台，拖动调整向上的射击角度，松手发射，把25块全部推出平台');
    field.append(canvas);
  }
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== W * ratio || canvas.height !== H * ratio) { canvas.width = W * ratio; canvas.height = H * ratio; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, W, H);
  const paint = slingPalette(field);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const tile = (x, y, w, h, r, fill, stroke = paint.line) => {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke();
  };
  const area = SLING_AREA;
  ctx.fillStyle = paint.shadow;
  ctx.fillRect(area.left, area.top + 4, area.right - area.left, area.bottom - area.top);
  ctx.fillStyle = paint.paper;
  ctx.fillRect(area.left, area.top, area.right - area.left, area.bottom - area.top);
  ctx.strokeStyle = paint.line; ctx.lineWidth = 1.5;
  ctx.strokeRect(area.left, area.top, area.right - area.left, area.bottom - area.top);
  for (const b of state.blocks) {
    if (b.scale <= 0) continue;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle); ctx.scale(b.scale, b.scale); ctx.globalAlpha = b.down ? b.scale : 1;
    tile(-SLING_BLOCK_W / 2, -SLING_BLOCK_H / 2, SLING_BLOCK_W, SLING_BLOCK_H, 6, paint.tiles[b.color % paint.tiles.length]);
    ctx.globalAlpha *= .85; ctx.fillStyle = paint.paper; ctx.beginPath(); ctx.arc(-6, -7, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  for (const hit of state.impacts) {
    const t = (state.lastSim - hit.at) / 320;
    ctx.fillStyle = paint.gold; ctx.globalAlpha = 1 - t;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, r = 8 + t * 16;
      ctx.beginPath(); ctx.arc(hit.x + Math.cos(a) * r, hit.y + Math.sin(a) * r, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.textAlign = 'center'; ctx.font = '700 16px "Trebuchet MS", "PingFang SC", sans-serif'; ctx.fillStyle = '#b4532a';
  for (const e of state.escapes) {
    const t = (state.lastSim - e.at) / 600;
    ctx.globalAlpha = 1 - t;
    ctx.fillText('+180', Math.max(22, Math.min(W - 22, e.x)), Math.max(57, Math.min(300, e.y)) - t * 16);
  }
  ctx.globalAlpha = 1;
  const ready = state.lastSim + 1e-6 >= state.nextShotAt;
  if (state.pull) {
    const { dx, dy } = state.pull;
    ctx.strokeStyle = paint.gold; ctx.globalAlpha = .55; ctx.setLineDash([3, 7]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(SLING_X + dx * 25, SLING_Y + dy * 25); ctx.lineTo(SLING_X + dx * 190, SLING_Y + dy * 190); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  for (const s of state.shots) {
    const trail = Math.min(1.3, 23 / (Math.hypot(s.vx, s.vy) || 1));
    ctx.strokeStyle = paint.gold; ctx.lineWidth = 5; ctx.globalAlpha = .35;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * trail, s.y - s.vy * trail); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, Math.PI * 2); ctx.fillStyle = paint.gold; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = paint.line; ctx.stroke();
    ctx.beginPath(); ctx.arc(s.x - 3, s.y - 3, 3, 0, Math.PI * 2); ctx.fillStyle = paint.paper; ctx.fill();
  }
  tile(12, SLING_Y + 8, W - 24, 12, 6, paint.tiles[2]);
  const recoil = Math.max(0, 1 - (state.lastSim - state.launchAt) / 140) * 5;
  tile(SLING_X - 17, SLING_Y - 3, 34, 24, 8, paint.paper);
  ctx.save(); ctx.translate(SLING_X, SLING_Y); ctx.rotate(state.aimAngle);
  tile(-9, -25 + recoil, 18, 29, 6, paint.gold);
  if (ready) {
    ctx.beginPath(); ctx.arc(0, -14 + recoil, 5, 0, Math.PI * 2);
    ctx.fillStyle = paint.paper; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = paint.line; ctx.stroke();
  }
  ctx.restore();
  ctx.textAlign = 'center'; ctx.fillStyle = paint.ink; ctx.font = '700 12px "Trebuchet MS", "PingFang SC", sans-serif';
  ctx.fillText(state.pull ? '松手发射 ↑' : ready ? '拖动调整方向 · 点按也能发射' : '快速装填中…', W / 2, 410);
  if (!ready) {
    const progress = 1 - Math.min(1, (state.nextShotAt - state.lastSim) / SLING_RELOAD);
    ctx.fillStyle = paint.accent; ctx.fillRect(20, 391, (W - 40) * progress, 3);
  }
}

function slingPalette(field) {
  let probe = field.querySelector('.mini-sling-swatches');
  if (!probe) {
    probe = document.createElement('div');
    probe.className = 'mini-sling-swatches';
    probe.setAttribute('aria-hidden', 'true');
    probe.innerHTML = '<i class="mini-cell mini-color-0"></i><i class="mini-cell mini-color-1"></i><i class="mini-cell mini-color-2"></i><i class="mini-cell mini-color-3"></i><i class="mini-sling-paper"></i><i class="mini-sling-line"></i><i class="mini-sling-shadow"></i><i class="mini-sling-gold"></i>';
    field.append(probe);
  }
  const bg = name => getComputedStyle(probe.querySelector(name)).backgroundColor;
  return {
    tiles: [0, 1, 3, 2].map(index => bg(`.mini-color-${index}`)),
    paper: bg('.mini-sling-paper'),
    line: bg('.mini-sling-line'),
    shadow: bg('.mini-sling-shadow'),
    gold: bg('.mini-sling-gold'),
    ink: getComputedStyle(field).color,
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f1a1ad',
  };
}
