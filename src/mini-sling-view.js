import { SLING_BOARD_W as W, SLING_BOARD_H as H, SLING_X, SLING_Y, SLING_MAX_PULL, SLING_GRAVITY, SLING_POWER } from './mini-sling.js';

export function renderSling(field, state) {
  let canvas = field.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'mini-sling-canvas';
    canvas.setAttribute('aria-label', '弹弓拆拆乐：向左下拖动弹珠，松手击落右边的方块');
    field.append(canvas);
  }
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== W * ratio || canvas.height !== H * ratio) { canvas.width = W * ratio; canvas.height = H * ratio; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, W, H);
  const style = getComputedStyle(field);
  const ink = style.color, surface = style.getPropertyValue('--flow-surface-fffdf5').trim() || '#fffdf5';
  ctx.lineWidth = 2; ctx.lineCap = 'round';
  const rect = (x, y, w, h, radius, fill) => {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = ink; ctx.stroke();
  };
  // Quiet park scenery and a low meadow leave the projectile easy to follow.
  ctx.fillStyle = ink; ctx.globalAlpha = 0.08;
  for (const [x,y,r] of [[48,90,24],[260,75,32],[135,160,18]]) { ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink; ctx.font = '600 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('整块落台才算 · 换角度拆支撑', W / 2, 34);
  rect(0, 400, W, 25, 0, '#97b87b');
  for (const x of [188, 240, 292]) rect(x - 25, 328, 50, 14, 4, '#bcb195');
  for (const block of state.blocks) {
    ctx.save(); ctx.translate(block.x, block.y); ctx.rotate(block.angle);
    ctx.globalAlpha = block.down ? 0.38 : 1;
    rect(-11.5, -12, 23, 24, 3, ['#eda0a8','#e9be6a','#9abd8b','#b4a2cf'][block.color]);
    ctx.strokeStyle = ink; ctx.globalAlpha = block.down ? 0.25 : 0.65;
    ctx.beginPath(); ctx.moveTo(-5,-4); ctx.lineTo(5,4); ctx.moveTo(5,-4); ctx.lineTo(-5,4); ctx.stroke();
    ctx.restore();
  }
  // Fork and elastic are drawn behind the marble, including while aiming.
  ctx.strokeStyle = '#947256'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(58,343); ctx.lineTo(58,311); ctx.moveTo(58,311); ctx.lineTo(43,290); ctx.moveTo(58,311); ctx.lineTo(74,290); ctx.stroke();
  ctx.strokeStyle = ink; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(43,290); ctx.lineTo(state.originX,state.originY); ctx.lineTo(74,290); ctx.stroke();
  if (state.pull) {
    // The preview uses the same velocity and gravity as the Matter shot.
    const { dx, dy } = state.pull;
    ctx.fillStyle = ink;
    for (let i = 1; i <= 12; i++) {
      const frames = i * 2;
      const x = state.originX + dx * SLING_POWER * frames;
      const y = state.originY + dy * SLING_POWER * frames + SLING_GRAVITY * (1000 / 60) ** 2 * .001 * frames * frames / 2;
      if (x > W || y > H || y < 45) break;
      ctx.globalAlpha = 0.6 - i * .035;
      ctx.beginPath(); ctx.arc(x,y,2.4,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const marble = (x,y) => {
    ctx.beginPath(); ctx.arc(x,y,11,0,Math.PI*2); ctx.fillStyle = '#e9b354'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(x-3,y-4,3,0,Math.PI*2); ctx.fillStyle = '#fff9df'; ctx.fill();
  };
  for (const shot of state.shots) marble(shot.x,shot.y);
  const ready = state.lastSim >= state.nextShotAt;
  if (ready || state.pull) marble(state.originX,state.originY);
  ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.font = '600 11px sans-serif';
  const power = state.pull ? Math.round(Math.hypot(state.pull.dx,state.pull.dy) / SLING_MAX_PULL * 100) : 0;
  ctx.fillText(state.pull ? `力度 ${power}% · 松手发射` : ready ? '↙ 向左下拉，松手发射' : '下一颗马上就好…', 14, 375);
  ctx.fillStyle = surface; ctx.beginPath(); ctx.roundRect(14,383,125,5,3); ctx.fill();
  if (power) { ctx.fillStyle = '#bb7841'; ctx.beginPath(); ctx.roundRect(14,383,125*power/100,5,3); ctx.fill(); }
}
