// Saturated fruit faces shared by the 2D board, the 3D ball texture, and the
// collection-book preview. Gloss adds frost on top of the same pattern.
function clipDisc(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
}

function seeds(id) {
  let n = 0;
  for (const ch of id) n = (n * 33 + ch.charCodeAt(0)) >>> 0;
  return () => {
    n = (n * 1664525 + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

function watermelon(ctx, x, y, r) {
  ctx.fillStyle = '#1f8a3e';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = '#f4fff6';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.82, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e1062c';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a120f';
  for (let i = 0; i < 5; i++) {
    const a = -0.4 + i * 1.15;
    ctx.save();
    ctx.translate(x + Math.cos(a) * r * 0.32, y + Math.sin(a) * r * 0.28);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.07, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function pineapple(ctx, x, y, r) {
  ctx.fillStyle = '#f0b400';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.strokeStyle = '#8a5a12';
  ctx.lineWidth = Math.max(1, r * 0.06);
  const step = r * 0.38;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * step - r, y - r);
    ctx.lineTo(x + i * step + r, y + r);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + i * step - r, y + r);
    ctx.lineTo(x + i * step + r, y - r);
    ctx.stroke();
  }
  ctx.fillStyle = '#2f8a32';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * r * 0.22, y - r * 0.15);
    ctx.lineTo(x + i * r * 0.08, y - r * 0.95);
    ctx.lineTo(x + i * r * 0.36, y - r * 0.2);
    ctx.fill();
  }
}

function grape(ctx, x, y, r) {
  ctx.fillStyle = '#4a1578';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  const spots = [[0, 0.15, 0.34, '#7a2ea8'], [-0.32, -0.05, 0.28, '#8e44c4'], [0.3, -0.08, 0.27, '#6a2498'], [-0.16, 0.38, 0.24, '#922ed0'], [0.18, 0.4, 0.22, '#55167f'], [0, -0.42, 0.22, '#3a0d5c']];
  for (const [dx, dy, scale, color] of spots) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, r * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2f8a32';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.55);
  ctx.quadraticCurveTo(x + r * 0.2, y - r * 0.9, x + r * 0.05, y - r * 0.98);
  ctx.stroke();
}

function orange(ctx, x, y, r) {
  ctx.fillStyle = '#f06a00';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.strokeStyle = '#c2410c';
  ctx.lineWidth = Math.max(1, r * 0.05);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffd7a8';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + 0.4;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
}

function cherry(ctx, x, y, r) {
  ctx.fillStyle = '#d0122d';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = '#ff4d6a';
  ctx.beginPath();
  ctx.arc(x - r * 0.22, y - r * 0.18, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.38, r * 0.16, r * 0.1, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#2f8a32';
  ctx.fillStyle = '#3aaa40';
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(x + r * 0.05, y - r * 0.45);
  ctx.quadraticCurveTo(x + r * 0.35, y - r * 0.75, x + r * 0.15, y - r * 0.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.32, y - r * 0.72, r * 0.16, r * 0.08, 0.6, 0, Math.PI * 2);
  ctx.fill();
}

function frost(ctx, x, y, r, id) {
  const rand = seeds(id);
  const glow = ctx.createRadialGradient(x - r * 0.2, y - r * 0.35, r * 0.05, x, y, r);
  glow.addColorStop(0, 'rgba(255,255,255,0.72)');
  glow.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  for (let i = 0; i < 10; i++) {
    const px = x + (rand() - 0.5) * r * 1.5;
    const py = y + (rand() - 0.5) * r * 1.5;
    ctx.globalAlpha = 0.55 + rand() * 0.4;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px, py, r * (0.04 + rand() * 0.05), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(1, r * 0.06);
  for (let i = 0; i < 4; i++) {
    const px = x + (rand() - 0.5) * r;
    const py = y + (rand() - 0.5) * r;
    ctx.beginPath();
    ctx.moveTo(px - r * 0.08, py);
    ctx.lineTo(px + r * 0.08, py);
    ctx.moveTo(px, py - r * 0.08);
    ctx.lineTo(px, py + r * 0.08);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const PAINTERS = { 20: watermelon, 10: pineapple, 5: grape, 3: orange, 2: cherry };

export function paintBallFace(ctx, x, y, r, skin) {
  if (!skin) return false;
  ctx.save();
  clipDisc(ctx, x, y, r);
  (PAINTERS[skin.fruit] || cherry)(ctx, x, y, r);
  if (skin.tier === 2) frost(ctx, x, y, r, skin.id);
  else {
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.28, y - r * 0.32, r * 0.22, r * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return true;
}

export function ballTexture(skin, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  paintBallFace(ctx, size / 2, size / 2, size * 0.48, skin);
  return canvas;
}
