// Astronomy reel faces. They are not the fruit used by the scoring slots.
// Colors stay literal in day and night: the painter draws them outside the
// time-of-day palette, with a cream edge for dark squares and a dark edge
// for the cream squares.
const HALO = '#fffaf0';

function sunRays() {
  let path = '';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const spread = 0.18;
    const point = (radius, delta) => {
      const a = angle + delta;
      return `${(16 + Math.cos(a) * radius).toFixed(2)} ${(16 + Math.sin(a) * radius).toFixed(2)}`;
    };
    path += `M${point(8.1, -spread)}L${point(13.2, 0)}L${point(8.1, spread)}Z`;
  }
  return path;
}

export const REEL_ICONS = Object.freeze([
  {
    id: 'star',
    name: '星星',
    parts: [
      { type: 'path', d: 'M16 2.4l3.5 8.3 8.9.6-6.8 5.6 2.1 8.8L16 21 8.3 25.7l2.1-8.8L3.6 11.3l8.9-.6z', fill: '#f2c14d', stroke: '#a56b12', halo: HALO },
      { type: 'path', d: 'M16 8l1.6 3.6 3.8.3-2.9 2.4.9 3.7L16 16.1l-3.4 1.9.9-3.7-2.9-2.4 3.8-.3z', fill: '#fff6cf' },
    ],
  },
  {
    id: 'moon',
    name: '弯月',
    parts: [
      // Outer disk minus a disk shifted toward the opening, so the horns stay open.
      { type: 'path', d: 'M22.83 9.4A9.5 9.5 0 1 0 22.83 22.6A6.8 6.8 0 1 1 22.83 9.4Z', fill: '#ffe29a', stroke: '#c8922a', halo: HALO },
      { type: 'circle', cx: 26.6, cy: 8.4, r: 0.9, fill: '#fff6cf', halo: HALO, haloWidth: 1.2 },
      { type: 'circle', cx: 28.2, cy: 13.4, r: 0.55, fill: '#fff6cf', halo: HALO, haloWidth: 0.9 },
    ],
  },
  {
    id: 'sun',
    name: '太阳',
    parts: [
      { type: 'path', d: sunRays(), fill: '#f0a020', halo: HALO },
      { type: 'circle', cx: 16, cy: 16, r: 7.1, fill: '#ffd15c', stroke: '#e08a16', halo: HALO },
      { type: 'circle', cx: 13.7, cy: 14.2, r: 2.1, fill: '#fff6d0' },
    ],
  },
  {
    id: 'planet',
    name: '行星',
    parts: [
      { type: 'circle', cx: 16, cy: 17, r: 7.1, fill: '#6eb0e8', stroke: '#2f6ea8', halo: HALO },
      { type: 'circle', cx: 13.6, cy: 14.8, r: 2.2, fill: '#e7f4ff' },
      { type: 'ellipse', cx: 16, cy: 17, rx: 11, ry: 3.6, rotate: -28, stroke: '#f0b429', halo: HALO, width: 2.2 },
    ],
  },
  {
    id: 'comet',
    name: '彗星',
    parts: [
      { type: 'path', d: 'M25.5 14.6C17 11.2 9.5 12.2 3 16.4 10 18.8 17.4 19.2 25.5 17.2c-.1-.9-.1-1.7 0-2.6z', fill: '#f6d15e', halo: HALO },
      { type: 'path', d: 'M25.2 16.2C18 15.2 11.5 15.6 5.5 17.4 12.2 18.2 18.6 18.2 25.2 16.8z', fill: '#fff4c4' },
      { type: 'circle', cx: 24.4, cy: 16, r: 4.5, fill: '#fff6d4', stroke: '#e2a322', halo: HALO },
      { type: 'circle', cx: 23, cy: 14.8, r: 1.45, fill: '#ffffff' },
    ],
  },
]);

const haloWidth = part => part.haloWidth ?? ((part.width || 1.6) + 3);
const svgAttrs = (part) => {
  const common = [];
  if (part.fill) common.push(`fill="${part.fill}"`);
  else common.push('fill="none"');
  if (part.fillRule) common.push(`fill-rule="${part.fillRule}"`);
  if (part.halo) common.push(`stroke="${part.halo}" stroke-width="${haloWidth(part)}" stroke-linejoin="round" stroke-linecap="round"`);
  return common.join(' ');
};

function svgShape(part) {
  if (part.type === 'circle') return `<circle cx="${part.cx}" cy="${part.cy}" r="${part.r}" ${svgAttrs(part)}/>`;
  if (part.type === 'ellipse') {
    const turn = part.rotate ? ` transform="rotate(${part.rotate} ${part.cx} ${part.cy})"` : '';
    return `<ellipse cx="${part.cx}" cy="${part.cy}" rx="${part.rx}" ry="${part.ry}"${turn} ${svgAttrs(part)}/>`;
  }
  return `<path d="${part.d}" ${svgAttrs(part)}/>`;
}

function svgInk(part) {
  if (!part.stroke) return '';
  const width = part.width || 1.5;
  if (part.type === 'circle') return `<circle cx="${part.cx}" cy="${part.cy}" r="${part.r}" fill="none" stroke="${part.stroke}" stroke-width="${width}"/>`;
  if (part.type === 'ellipse') {
    const turn = part.rotate ? ` transform="rotate(${part.rotate} ${part.cx} ${part.cy})"` : '';
    return `<ellipse cx="${part.cx}" cy="${part.cy}" rx="${part.rx}" ry="${part.ry}"${turn} fill="none" stroke="${part.stroke}" stroke-width="${width}" stroke-linecap="round"/>`;
  }
  return `<path d="${part.d}" fill="${part.fill || 'none'}" stroke="${part.stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

export function reelIconSvg(index) {
  const icon = REEL_ICONS[index];
  if (!icon) return '';
  const body = icon.parts.map(part => svgShape(part) + svgInk(part)).join('');
  return `<svg viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;
}

function trace(ctx, part) {
  if (part.type === 'circle') {
    ctx.beginPath();
    ctx.arc(part.cx, part.cy, part.r, 0, Math.PI * 2);
    return;
  }
  if (part.type === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(part.cx, part.cy, part.rx, part.ry, (part.rotate || 0) * Math.PI / 180, 0, Math.PI * 2);
    return;
  }
  const path = new Path2D(part.d);
  ctx.beginPath();
  // Path2D cannot be assigned through beginPath; stroke/fill accept it directly.
  return path;
}

export function drawReelSymbol(ctx, symbol, x, y, size) {
  const icon = REEL_ICONS[symbol];
  if (!icon) return false;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  ctx.translate(-16, -16);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const part of icon.parts) {
    const path = trace(ctx, part);
    const paint = (style, width) => {
      ctx.lineWidth = width;
      ctx.strokeStyle = style;
      if (path) ctx.stroke(path);
      else ctx.stroke();
    };
    if (part.halo) paint(part.halo, haloWidth(part));
    if (part.fill) {
      ctx.fillStyle = part.fill;
      const rule = part.fillRule || 'nonzero';
      if (path) ctx.fill(path, rule);
      else ctx.fill(rule);
    }
    if (part.stroke) paint(part.stroke, part.width || 1.5);
  }
  ctx.restore();
  return true;
}
