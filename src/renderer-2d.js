import { chargeEffectsAt } from './charge.js';
import { sceneMotionAt, project2DMotion } from './scene-motion.js';
import { TABLE, LAUNCH_SQUASH } from './physics.js';
import { BOARD_CROWD_LOCK, DRAIN_WALL } from './round.js';
import { ballOwnFactor, ballRimStyle } from './ball-rim.js';
import { skinById } from './skins.js';
import { blendSlotLayout } from './slot-transition.js';
import { SLOT_DISPLAY, BALL_SYMBOL, REEL_WEIGHTS, reelBox, PROGRESS_TOP, PROGRESS_HEIGHT, slotBonusLabel } from './slot-machine.js';
import { drawReelSymbol } from './reel-icons.js';
import { rewardProfile, activeRewardScenes, rewardSceneAt, marqueePoint } from './reward-effects.js';
import { slotIcon, slotColorIndex } from './slot-icons.js';

export function createRenderer(canvas, { textureMode = false } = {}) {
  const ctx = canvas.getContext('2d');
  let activePalette = null, paintingBall = false, motion = sceneMotionAt(0, {}, {}), starMemory = null, starFlash = null;
  const paintColor = (value, role) => paintingBall ? value : activePalette?.color(value, role) ?? value;
  const { width: W, height: H } = TABLE;
  function resize() {
    const dpr = textureMode ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const width = textureMode ? W : canvas.getBoundingClientRect().width;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(width * dpr * H / W);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  const observer = textureMode ? null : new ResizeObserver(resize); observer?.observe(canvas); resize();
  const circle = (x, y, r, color, stroke, line = 1) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (color) { ctx.fillStyle = paintColor(color, 'object'); ctx.fill(); } if (stroke) { ctx.strokeStyle = paintColor(stroke, 'line'); ctx.lineWidth = line; ctx.stroke(); } };
  const box = (x, y, w, h, radius, color, stroke) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = paintColor(color, 'object'); ctx.fill(); if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = paintColor(stroke, 'line'); ctx.stroke(); } };
  const text = (value, x, y, size, color, weight = '') => { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${weight} ${size}px "Trebuchet MS", "PingFang SC", sans-serif`; ctx.fillStyle = /\p{Extended_Pictographic}/u.test(value) ? color : paintColor(color, 'ink'); ctx.fillText(value, x, y); };
  function star(x, y, r, color, angle = 0) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = angle + i * Math.PI / 4, rr = i % 2 ? r * .35 : r; if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = paintColor(color, 'object'); ctx.fill(); }
  function bodyShape(body, color, stroke = '#ffffffb0', shadow = true) {
    ctx.save(); if (shadow) { ctx.shadowColor = paintColor('#45523d35', 'glow'); ctx.shadowBlur = 0; ctx.shadowOffsetY = 5; }
    ctx.beginPath(); body.vertices.forEach((v, i) => { if (!i) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y); }); ctx.closePath(); ctx.fillStyle = paintColor(color, 'object'); ctx.fill(); ctx.shadowOffsetY = 0; ctx.lineWidth = 2; ctx.strokeStyle = paintColor(stroke, 'line'); ctx.stroke(); ctx.restore();
  }
  function ball(x, y, opacity = 1, cheap = false, gift = false, skinId = '') {
    if (textureMode) return;
    paintingBall = true;
    ctx.save(); ctx.globalAlpha = opacity;
    // Gift balls stay pearly lavender so the purple multiplier rim still reads.
    // A fruit skin only recolors a launched ball; the rim is drawn afterwards.
    const skin = gift ? null : skinById(skinId);
    const flat = gift ? '#e4dcff' : skin?.flat || '#ffdb76';
    const glow = gift ? '#d7ccf6' : skin?.glow || '#ffd862';
    const rim = gift ? '#c9b6ea' : skin?.edge || '#a4425d';
    const mid = gift ? '#f7f4ff' : skin?.mid || '#fffde8';
    const edge = gift ? '#c5b4f0' : skin?.edge || '#ffdb76';
    if (cheap) {
      circle(x, y, 11.5, paintColor(flat));
      ctx.restore();
      paintingBall = false;
      return;
    }
    ctx.shadowColor = paintColor(glow, 'glow'); ctx.shadowBlur = 25;
    circle(x, y, 14, rim); ctx.shadowBlur = 0;
    const g = ctx.createRadialGradient(x - 3, y - 4, 0, x, y, 12); g.addColorStop(0, paintColor('#ffffff')); g.addColorStop(.6, paintColor(mid)); g.addColorStop(1, paintColor(edge));
    circle(x, y, 11.5, g);
    circle(x - 3, y - 4, 3.5, '#fff');
    if (skin?.tier === 2) text(skin.mark, x + 3, y + 3, 8, '#fff');
    ctx.restore(); paintingBall = false;
  }
  function ownRim(x, y, factor, quiet, gift = false) {
    const style = ballRimStyle(factor, gift);
    paintingBall = true;
    ctx.save();
    if (style.glow && !quiet) {
      ctx.globalAlpha = style.tier === 8 ? 0.42 : 0.3;
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = style.tier === 8 ? 11 : 7;
      circle(x, y, style.radius + 1.5 + style.extra, null, style.glow, style.tier === 8 ? 3.4 : 2.4);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    circle(x, y, style.radius, null, style.color, style.width);
    ctx.restore();
    paintingBall = false;
  }
  function mixHex(from, to, t) {
    const channels = hex => {
      const raw = String(hex).replace('#', '');
      const full = raw.length >= 6 ? raw : raw.slice(0, 3).split('').map(ch => ch + ch).join('');
      return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16));
    };
    if (typeof from !== 'string' || typeof to !== 'string' || from[0] !== '#' || to[0] !== '#') return t >= 1 ? to : from;
    const a = channels(from), b = channels(to);
    const value = index => Math.round(a[index] + (b[index] - a[index]) * t);
    return `rgb(${value(0)} ${value(1)} ${value(2)})`;
  }
  function formatMultiplier(from, to, eased, bonus) {
    const value = (from + (to - from) * eased) * bonus;
    const rounded = Math.round(value * 10) / 10;
    return `×${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`;
  }
  function slotLayout(state) {
    const shift = state.slotTransition;
    if (!shift) return blendSlotLayout(state.slots, state.slots, 1);
    return blendSlotLayout(shift.from, shift.to, (performance.now() - shift.startedAt) / shift.duration);
  }
  function draw(game, theme, state, fx, palette = null) {
    activePalette = palette;
    const t = state.calm ? 0 : game.clock / 1000;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = paintColor(theme.bg, 'surface'); ctx.fillRect(0, 0, W, H);
    ctx.save();
    motion = textureMode ? sceneMotionAt(0, {}, {}) : sceneMotionAt(game.clock, state, fx);
    // This transform moves the 2D camera view, leaving physical coordinates fixed.
    if (!textureMode && motion.intensity) {
      ctx.translate(motion.x, motion.y);
    }
    ctx.fillStyle = paintColor('#b8b08b1d', 'object');
    for (let x = 12; x < W; x += 24) for (let y = 12; y < H; y += 24) circle(x, y, .8, '#b8b08b26');
    // The shooter remains separate, without a flight-mode label or booster.
    box(38, 43, 620, 741, 30, '#ffffff29', '#c3c4a93b');
    box(689, 128, 47, 739, 21, '#d9e6d299');
    ctx.save(); ctx.strokeStyle = paintColor('#afc09a75', 'line'); ctx.lineWidth = 2; ctx.setLineDash([3, 10]); ctx.beginPath(); ctx.moveTo(713, 750); ctx.lineTo(713, 154); ctx.stroke(); ctx.restore();
    for (let i = 0; i < 3; i++) { const y = 650 + i * 60 - (t * 45 % 60); ctx.beginPath(); ctx.moveTo(704, y + 8); ctx.lineTo(713, y); ctx.lineTo(722, y + 8); ctx.strokeStyle = paintColor('#86a869a0', 'line'); ctx.lineWidth = 3; ctx.stroke(); }
    text('P O N  P O N', 351, 112, 24, '#69815d', 'bold');
    const bonus = game.slotMachine, bonusLabel = slotBonusLabel(bonus, game.clock);
    text(bonusLabel || 'LITTLE PINBALL CLUB', 351, 133, 11, bonus.multiplier === 5 ? '#8b59b5' : bonus.multiplier === 2 ? '#99712d' : '#9ca184', bonusLabel ? 'bold' : '');
    if (bonusLabel) { ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = paintColor(bonus.multiplier === 5 ? '#b494d0' : '#d5b069', 'line'); ctx.strokeRect(43, 46, 609, 737); ctx.restore(); }
    text('↖', 651, 103, 27, '#a0b28d');
    star(209, 112, 7, '#d7b57a', t * .3); star(495, 112, 7, '#d7b57a', -t * .3);
    [[104, 209], [597, 647], [402, 196], [86, 639]].forEach(([x, y], i) => star(x, y + Math.sin(t + i) * 3, 4, '#d4b78475', t * .1));
    // Painted guide rings provide motion cues without competing with the ball.
    for (const bumper of game.bumpers) { const { x, y } = bumper.position; ctx.save(); ctx.setLineDash([3, 9]); circle(x, y, bumper.plugin.radius + 17, null, '#cfbf9a55'); ctx.restore(); }
    for (const wall of game.walls) bodyShape(wall, '#aebf99', '#dce6ce');
    // A diagonal one-way flap intercepts descending balls; the dashed vertical
    // line shows the separate upward path, which is never blocked by the flap.
    ctx.save();ctx.globalAlpha=.8;bodyShape(game.gates[1], game.rewards.gateGlow ? '#f8cc77' : '#d7bf97', '#fff3d6', false);ctx.restore();
    ctx.save();ctx.setLineDash([5,6]);ctx.strokeStyle = paintColor('#a7ba8e', 'line');ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(676,539);ctx.lineTo(676,615);ctx.stroke();ctx.restore();
    text('↙ 回流口', 624, 640, 12, '#9b8965');
    const layout = slotLayout(state);
    const iconSize = 20;
    const scoreSize = 15;
    for (const region of layout.regions) {
      const width = region.x1 - region.x0;
      if (width < 1.5) continue;
      const mid = (region.x0 + region.x1) / 2;
      if (region.kind === 'drain') {
        box(region.x0, TABLE.slotTop, width, 98, 3, '#5c2428');
        ctx.save();
        ctx.beginPath(); ctx.rect(region.x0, TABLE.slotTop, width, 98); ctx.clip();
        ctx.strokeStyle = paintColor('#e7b8a2', 'line'); ctx.lineWidth = 1.5; ctx.globalAlpha = .55;
        for (let y = TABLE.slotTop - 6; y < TABLE.slotTop + 98; y += 8) { ctx.beginPath(); ctx.moveTo(region.x0, y); ctx.lineTo(region.x1, y + 7); ctx.stroke(); }
        ctx.restore();
        if (width >= 12) text('漏', mid, TABLE.slotTop + 78, width >= 36 ? 13 : 10, '#f6d7c8', 'bold');
        continue;
      }
      const eased = layout.eased;
      const fromColor = paintColor(theme.colors[slotColorIndex(region.fromMultiplier)], 'object');
      const toColor = paintColor(theme.colors[slotColorIndex(region.toMultiplier)], 'object');
      const inset = Math.min(3, width / 6);
      box(region.x0 + inset, TABLE.slotTop, width - inset * 2, 86, 8, mixHex(fromColor, toColor, eased));
      const glow = fx.slotGlows[region.column] || 0;
      if (glow) { const p = rewardProfile({ multiplier: region.toMultiplier }); ctx.save(); ctx.globalAlpha = glow * .65; ctx.shadowBlur = 8 + p.tier * 5; ctx.shadowColor = paintColor(p.color, 'glow'); box(region.x0 + inset, TABLE.slotTop, width - inset * 2, 86, 8, p.color); ctx.restore(); }
      if (width < 16) continue;
      if (region.fromMultiplier === region.toMultiplier) text(slotIcon(region.toMultiplier), mid, TABLE.slotTop + 23, iconSize, '#627454');
      else {
        ctx.save(); ctx.globalAlpha = 1 - eased; text(slotIcon(region.fromMultiplier), mid, TABLE.slotTop + 23, iconSize, '#627454'); ctx.restore();
        ctx.save(); ctx.globalAlpha = eased; text(slotIcon(region.toMultiplier), mid, TABLE.slotTop + 23, iconSize, '#627454'); ctx.restore();
      }
      text(formatMultiplier(region.fromMultiplier, region.toMultiplier, eased, bonus.multiplier), mid, TABLE.slotTop + 54, scoreSize, '#4c6648', 'bold');
      if (bonus.multiplier > 1) text(`进洞 ×${bonus.multiplier}`, mid, TABLE.slotTop + 73, 9, bonus.multiplier === 5 ? '#8b59b5' : '#99712d');
      else {
        const lucky = (region.luckyFrom ? 1 - eased : 0) + (region.luckyTo ? eased : 0);
        if (lucky > 0.04) { ctx.save(); ctx.globalAlpha = Math.min(1, lucky); text('LUCKY', mid, TABLE.slotTop + 73, 8, '#aa8243'); ctx.restore(); }
      }
    }
    // Pockets that meet share one board-colored wall. A wide mouth keeps the
    // dark 漏 hatch instead, so a plain separator never uses the leak color.
    {
      const pictured = layout.regions.filter(region => region.kind === 'slot' && region.x1 - region.x0 >= 8);
      for (let i = 0; i < pictured.length - 1; i++) {
        const left = pictured[i], right = pictured[i + 1];
        const gap = right.x0 - left.x1;
        if (gap > DRAIN_WALL + 0.75) continue;
        const x = (left.x1 + right.x0) / 2;
        box(x - DRAIN_WALL / 2, TABLE.slotTop, DRAIN_WALL, 90, 1, '#aebf99', '#dce6ce');
      }
    }
    for (const hole of game.holes) {
      const treasure = (fx.celebrations || []).find(b => b.kind === 'jackpot' && b.x === hole.x && b.y === hole.y);
      const glow = Math.max(hole.glow, treasure ? rewardSceneAt(treasure, state.calm).alpha * .8 : 0);
      const pulse = 1 + Math.sin(t * 2.5) * .07;
      circle(hole.x, hole.y, 23 * pulse + glow * 8, null, glow ? '#efb750' : '#d6bc8170', 2);
      circle(hole.x, hole.y + 2, 19, '#968873');
      const gradient = ctx.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, 19); gradient.addColorStop(0, paintColor('#293b39')); gradient.addColorStop(.7, paintColor('#536753')); gradient.addColorStop(1, paintColor('#b5b697'));
      circle(hole.x, hole.y, 18, gradient, '#ede0a2', 3);
      star(hole.x, hole.y, 7, '#ecda90', t * .25);
      text(`+${500 * bonus.multiplier}`, hole.x, hole.y - 51, 15, '#b39153', 'bold');
      text('秘密洞', hole.x, hole.y + 52, 12, '#9e9375');
    }
    for (const guard of game.guards) bodyShape(guard, guard.plugin.storage ? '#b9a6ce' : '#d8c69c', guard.plugin.storage ? '#f4eafb' : '#efe5c8', false);
    const storage = game.collector;
    // The cup, live counter and visible inlet all share the physical coordinates.
    circle(storage.x, storage.y + 2, 22, '#827590');
    const cup = ctx.createRadialGradient(storage.x, storage.y, 0, storage.x, storage.y, 22);
    cup.addColorStop(0, paintColor('#405c59')); cup.addColorStop(1, paintColor('#8eaaa1'));
    circle(storage.x, storage.y, 21, cup, storage.glow ? '#f3cf7b' : '#eae0f3', 2);
    text(`${storage.stored.length}/20`, storage.x, storage.y + 3, 11, '#fff9e9', 'bold');
    text('蓄球罐', storage.x, storage.y - 49, 12, '#8b769f', 'bold');
    text(storage.remaining ? `落球中 · 余 ${storage.remaining}` : '存 20 · 落 20', storage.x, storage.y + 48, 11, '#8b769f');
    // Every bottom slot has a corresponding mouth at the top of the board.
    for (const outlet of storage.outlets) {
      box(outlet.x - 26, outlet.y - 9, 52, 17, 8, outlet.glow ? '#f6daa0' : '#d8d0e3', '#fff8ef');
      box(outlet.x - 22, outlet.y - 4, 44, 7, 3, '#526961');
      if (outlet.glow && !state.calm) { ctx.save(); ctx.globalAlpha = outlet.glow; text('↓', outlet.x, outlet.y + 31, 15, '#aa86bc', 'bold'); ctx.restore(); }
    }
    for (const platform of game.deflectors) {
      const { x, y } = platform.position, { glow, angle } = platform.plugin;
      ctx.save(); ctx.setLineDash([3, 7]); circle(x, y, 42, null, '#c6b69780', 1.5); ctx.restore();
      bodyShape(platform, glow > .2 ? '#f8d283' : theme.accent, '#fff9eb');
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      // The arrow follows the physical launch direction, including calm mode.
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(13, 0); ctx.moveTo(5, -7); ctx.lineTo(13, 0); ctx.lineTo(5, 7);
      ctx.strokeStyle = paintColor('#fffaf0', 'line'); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      if (glow && !state.calm) { ctx.globalAlpha = glow; text('› ›', 47 + (1 - glow) * 15, 0, 18, '#c69951', 'bold'); }
      ctx.restore();
      text('撞击换向', x, y + 54, 12, '#9e9375');
    }
    for (const rail of game.rails) {
      if (rail.plugin.motion) {
        const motion = rail.plugin.motion;
        ctx.save(); ctx.setLineDash([3, 6]); ctx.strokeStyle = paintColor('#c7b4a86b', 'line'); ctx.lineWidth = 2;
        const dx = motion.axisX * motion.amplitude, dy = motion.axisY * motion.amplitude;
        ctx.beginPath(); ctx.moveTo(motion.x - dx, motion.y - dy); ctx.lineTo(motion.x + dx, motion.y + dy); ctx.stroke(); ctx.restore();
      }
      bodyShape(rail, rail.plugin.glow > .3 ? '#ffdea2' : theme.accent, '#fff5df');
      ctx.save(); ctx.translate(rail.position.x, rail.position.y); ctx.rotate(rail.angle); text('›  ›  ›', 0, -1, 13, '#fff8ec', 'bold'); ctx.restore();
    }
    for (const diamond of game.diamonds) { bodyShape(diamond, diamond.plugin.glow > .3 ? '#fff1c0' : '#bdafcc', '#f6eaf9'); star(diamond.position.x, diamond.position.y, 9, '#fff9e9', diamond.angle); }
    for (const spinner of game.spinners) {
      ctx.save(); ctx.setLineDash([4, 9]); circle(spinner.position.x, spinner.position.y, 72, null, '#b2c79c5c'); ctx.restore();
      bodyShape(spinner, spinner.plugin.glow > .25 ? '#f4cf83' : '#9fbba0', '#e9f3d9');
      circle(spinner.position.x, spinner.position.y + 3, 16, '#607b61'); circle(spinner.position.x, spinner.position.y, 14, '#f7ebc3', '#d1be8c', 2);
      text('✿', spinner.position.x, spinner.position.y, 19, '#bb9470');
    }
    for (const pin of game.pins) {
      const { x, y } = pin.position;
      circle(x, y + 3, 8.5, '#65794c2b');
      circle(x, y, pin.plugin.glow > 0 ? 8.5 : 7.5, pin.plugin.glow > .3 ? '#ffe2a1' : theme.pin, '#f4f8e1', 1.5);
      circle(x - 2, y - 2, 2.2, '#ffffffa0');
    }
    for (const kicker of game.kickers) {
      const { x, y } = kicker.position, glow = kicker.plugin.glow;
      circle(x, y + 3, 15, '#65794c35');
      circle(x, y, 13, glow > .3 ? '#ffe2a1' : theme.accent, '#fff8e8', 2);
      circle(x, y, 8, null, '#fff8e8', 1);
      text('✦', x, y, 13, '#fff8e8', 'bold');
    }
    for (const bumper of game.bumpers) {
      const { x, y } = bumper.position, r = bumper.plugin.radius, glow = bumper.plugin.glow;
      circle(x, y + 7, r + 6, '#9b8b743b');
      ctx.save(); if (glow) { ctx.shadowColor = paintColor('#f7c065', 'glow'); ctx.shadowBlur = 30 * glow; }
      circle(x, y, r + 6 + glow * 4, glow > .2 ? '#ffd879' : theme.accent, '#fff9ec', 3);
      circle(x, y - 2, r - 3, theme.colors[bumper.plugin.index * 2], '#fffefa', 3);
      ctx.restore();
      text(theme.motifs[bumper.plugin.index], x, y - (bumper.plugin.index === 2 ? 10 : 3) + (state.calm ? 0 : Math.sin(t * 2 + bumper.id)), r * .85, '#6e7f60');
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; circle(x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10), 2.2, Math.sin(t * 3 + i) > 0 ? '#ecd5a4' : '#ffffff90'); }
      const index=bumper.plugin.index,goal=game.rewards.goals[index],count=game.rewards.hits[index]%goal;
      ctx.beginPath();ctx.arc(x,y,r+14,-Math.PI/2,-Math.PI/2+Math.PI*2*(count/goal));ctx.strokeStyle = paintColor('#c59450', 'line');ctx.lineWidth=3;ctx.stroke();
      // The center counter sits inside its drum. The reels are down by the
      // center pocket, so this label no longer has to reserve that gap.
      if (index === 2) {
        const enlarged = game.rewards.enlargedUntil > game.clock;
        box(x-28,y+10,56,17,8,'#fff9e9ee','#ddd3b6');text(`${count} / ${goal}`,x,y+19,10,'#997747','bold');
        if (enlarged) text(`变大 ${((game.rewards.enlargedUntil-game.clock)/1000).toFixed(1)}s`,x,y+39,10,'#b38643','bold');
      } else { box(x-39,y+r+21,78,22,11,'#fff9e9dd','#ddd3b6');text(`${count} / ${goal}`,x,y+r+32,12,'#997747','bold'); }
      if(index===2&&game.rewards.burstUntil>game.clock){
        for(let i=0;i<12;i++){const angle=-Math.PI/2+i*Math.PI/6;circle(x+Math.cos(angle)*(r+27),y+Math.sin(angle)*(r+27),i===game.rewards.burstStep?5:3,i<=game.rewards.burstStep?'#dbaa45':'#e3d8b8');}
      }
    }
    // Three separate squares. Balls stay free to pass in front of them.
    const reelCount = REEL_WEIGHTS.length;
    const drawReelIcon = (symbol, x, y, size) => {
      if (symbol === BALL_SYMBOL) {
        paintingBall = true;
        const r = size * 0.38;
        circle(x, y, r + 1.1, '#a4425d');
        const shine = ctx.createRadialGradient(x - r * 0.28, y - r * 0.34, 0, x, y, r);
        shine.addColorStop(0, '#ffffff'); shine.addColorStop(0.55, '#fffde8'); shine.addColorStop(1, '#ffdb76');
        circle(x, y, r, shine); circle(x - r * 0.28, y - r * 0.32, r * 0.26, '#fff');
        paintingBall = false;
        return;
      }
      if (!drawReelSymbol(ctx, symbol, x, y, size)) text('·', x, y, size, '#52664c');
    };
    for (let reel = 0; reel < 3; reel++) {
      const spot = reelBox(reel), moving = bonus.spinning && !bonus.stopped[reel];
      const left = spot.x - spot.size / 2, top = spot.y - spot.size / 2;
      box(left, top, spot.size, spot.size, 4, moving ? '#f4ecff' : '#fffaf0', moving ? '#6d4cb5' : '#d0bd98');
      ctx.save(); ctx.beginPath(); ctx.rect(left + 2, top + 2, spot.size - 4, spot.size - 4); ctx.clip();
      if (moving && !state.calm) {
        const phase = (game.clock - bonus.startedAt) / (70 + reel * 15), index = Math.floor(phase) % reelCount, offset = (phase % 1) * (spot.size * 0.8);
        drawReelIcon(index, spot.x, spot.y + offset, 18);
        drawReelIcon((index + 1) % reelCount, spot.x, spot.y - spot.size * 0.8 + offset, 18);
      } else drawReelIcon(moving ? -1 : bonus.reels[reel], spot.x, spot.y, 18);
      ctx.restore();
      if (moving) {
        ctx.save();
        ctx.lineWidth = 3; ctx.strokeStyle = paintColor('#6d4cb5', 'line');
        ctx.beginPath(); ctx.roundRect(left - 3, top - 3, spot.size + 6, spot.size + 6, 6); ctx.stroke();
        ctx.fillStyle = paintColor('#6d4cb5', 'object');
        ctx.beginPath(); ctx.moveTo(spot.x - 5, top - 8); ctx.lineTo(spot.x + 5, top - 8); ctx.lineTo(spot.x, top - 1); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    const barLeft = SLOT_DISPLAY.x - SLOT_DISPLAY.width / 2;
    const barWidth = SLOT_DISPLAY.width - 28;
    box(barLeft, PROGRESS_TOP, barWidth, PROGRESS_HEIGHT, 3, '#efe6d4', '#d0bd98');
    const filled = barWidth * (bonus.goal ? bonus.progress / bonus.goal : 0);
    if (filled > 0) box(barLeft, PROGRESS_TOP, Math.min(barWidth, Math.max(PROGRESS_HEIGHT, filled)), PROGRESS_HEIGHT, 3, '#c59450');
    text(`${bonus.progress}/${bonus.goal}`, barLeft + barWidth + 14, PROGRESS_TOP + PROGRESS_HEIGHT / 2, 9, '#6d5430', 'bold');
    // The spring compresses while held. A ready ball remains visually separate
    // from any live ball travelling along the lane.
    const compression = state.charging ? state.charge * LAUNCH_SQUASH : 0;
    const springTop = 813 + compression, springBottom = 865;
    if (!textureMode) {
    ctx.beginPath(); ctx.moveTo(713, springTop);
    for (let i = 0; i <= 12; i++) ctx.lineTo(713 + (i % 2 ? 11 : -11), springTop + (springBottom - springTop) * i / 12);
    ctx.strokeStyle = paintColor('#8e9f7b', 'line'); ctx.lineWidth = 4; ctx.stroke();
    }
    box(695, springTop - 6, 36, 8, 4, '#71896a', '#ecf1d6');
    if (!game.balls.some(b => b.body.position.x > 683 && b.body.position.y > 730)) {
      if (state.charging && !textureMode) {
        const glow = chargeEffectsAt(state.chargeElapsed), x = TABLE.launchX, y = TABLE.launchY + compression;
        ctx.save();
        // These are charge cues: retain their gold/rainbow hues in every time-of-day palette.
        if (glow.goldRadius > 0) {
          ctx.globalAlpha = glow.goldAlpha * .55;
          ctx.strokeStyle = '#edc674'; ctx.lineWidth = 1.7;
          ctx.shadowColor = '#f8d78a'; ctx.shadowBlur = state.calm ? 0 : 8;
          ctx.beginPath(); ctx.arc(x, y, state.calm ? 16 : glow.goldRadius, 0, Math.PI * 2); ctx.stroke();
        }
        if (glow.coronaRadius) {
          const radius = state.calm ? 25 : glow.coronaRadius;
          ctx.globalAlpha = state.calm ? .22 : glow.coronaAlpha;
          ctx.shadowBlur = 0;
          const hues = ['#ffbbba', '#ffe8ad', '#c7efbf', '#aae8e8', '#bdcaff', '#e9b7f1'];
          for (let i = 0; i < 24; i++) {
            const angle = i * Math.PI / 12 + (state.calm ? 0 : state.chargeElapsed / 9000);
            const outer = radius * (i % 2 ? .78 : 1), width = .18;
            const gradient = ctx.createRadialGradient(x, y, 5, x, y, outer);
            gradient.addColorStop(0, '#fffdf5'); gradient.addColorStop(.25, hues[i % hues.length]); gradient.addColorStop(1, hues[i % hues.length] + '00');
            ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(x, y);
            ctx.arc(x, y, outer, angle - width, angle + width); ctx.closePath(); ctx.fill();
          }
          const center = ctx.createRadialGradient(x, y, 0, x, y, radius * .6);
          center.addColorStop(0, '#ffffff'); center.addColorStop(.32, '#fff8d7aa'); center.addColorStop(1, '#fff8d700');
          ctx.fillStyle = center; ctx.beginPath(); ctx.arc(x, y, radius * .6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      ball(TABLE.launchX, TABLE.launchY + compression, .88, false, false, state.equippedSkin);
    }
    text('PULL', 713, 850 + compression * .3, 9, '#65785c', 'bold');
    if (game.star) starMemory = { id: game.star.id, x: game.star.x, y: game.star.y, multiplier: game.star.multiplier };
    else if (starMemory) { starFlash = { ...starMemory, at: game.clock }; starMemory = null; }
    if (game.star && !textureMode) {
      const s = game.star, purple = s.multiplier === 5, daylight = activePalette?.phase?.id !== 'night';
      const pulse = state.calm ? 1 : 1 + Math.sin(t * 4) * .08;
      const flicker = state.calm ? .9 : .72 + .28 * Math.sin(game.clock / 140);
      const remaining = Math.max(0, s.expiresAt - game.clock);
      const label = `×${s.multiplier} · ${Math.ceil(remaining / 1000)}s`;
      ctx.save(); ctx.translate(s.x, s.y); ctx.globalCompositeOperation = 'source-over';
      if (daylight) {
        const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 16 * pulse);
        halo.addColorStop(0, purple ? 'rgba(196,150,230,.45)' : 'rgba(232,164,42,.5)');
        halo.addColorStop(1, 'rgba(232,164,42,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining / (s.expiresAt - s.born));
        ctx.strokeStyle = purple ? '#6d4c93' : '#8a4e08'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.scale(pulse, pulse);
        ctx.shadowColor = purple ? 'rgba(70,40,100,.35)' : 'rgba(90,50,10,.4)';
        ctx.shadowBlur = state.calm ? 0 : 3; ctx.shadowOffsetY = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? 5 : 11;
          if (i) ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); else ctx.moveTo(0, -radius);
        }
        ctx.closePath();
        const fill = ctx.createRadialGradient(0, -3, 1, 0, 0, 12);
        fill.addColorStop(0, purple ? '#fff8ff' : '#fff4c8');
        fill.addColorStop(.45, purple ? '#e4c8ff' : '#f6c453');
        fill.addColorStop(1, purple ? '#9a6cc8' : '#e0941c');
        ctx.fillStyle = fill; ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.strokeStyle = purple ? '#5c3484' : '#8a4e08'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.restore();
        const sparks = state.calm ? 2 : 3;
        for (let i = 0; i < sparks; i++) {
          const angle = game.clock / 420 + i * Math.PI * 2 / sparks, radius = 15 + Math.sin(game.clock / 260 + i) * 2;
          ctx.globalAlpha = .8;
          ctx.fillStyle = purple ? '#8d62c4' : '#c47a12';
          ctx.beginPath(); ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 1.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff8e8'; ctx.strokeText(label, 0, 29);
        ctx.fillStyle = purple ? '#5c3484' : '#7a4208'; ctx.fillText(label, 0, 29);
      } else {
        const core = purple ? '#f4e8ff' : '#fff6d0', mid = purple ? '#c9a0ee' : '#f5cd70', edge = purple ? '#8d62c4' : '#e0b04a';
        ctx.globalAlpha = flicker;
        const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 30 * pulse);
        halo.addColorStop(0, core); halo.addColorStop(.35, mid); halo.addColorStop(1, edge + '00');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 30 * pulse, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining / (s.expiresAt - s.born));
        ctx.strokeStyle = paintColor(purple ? '#a477d4' : '#d8ae58', 'line'); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.scale(pulse, pulse); ctx.shadowColor = paintColor(purple ? '#e7d4ff' : '#ffe7a1', 'glow'); ctx.shadowBlur = state.calm ? 0 : 16;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? 5 : 11;
          if (i) ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); else ctx.moveTo(0, -radius);
        }
        ctx.closePath();
        const fill = ctx.createRadialGradient(0, -3, 1, 0, 0, 12);
        fill.addColorStop(0, '#fffef8'); fill.addColorStop(.5, core); fill.addColorStop(1, mid);
        ctx.fillStyle = fill; ctx.fill(); ctx.shadowBlur = 0;
        ctx.strokeStyle = paintColor(purple ? '#f7eaff' : '#fff8dc', 'line'); ctx.lineWidth = 1.2; ctx.stroke();
        const sparks = state.calm ? 3 : 6;
        for (let i = 0; i < sparks; i++) {
          const angle = game.clock / 420 + i * Math.PI * 2 / sparks, radius = 15 + Math.sin(game.clock / 260 + i) * 3;
          ctx.globalAlpha = flicker * (.45 + .55 * ((i + game.clock / 80) % 1));
          ctx.fillStyle = i % 2 ? '#fff' : mid;
          ctx.beginPath(); ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 1.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
        text(label, 0, 29, 10, purple ? '#8b59b5' : '#b58b42', 'bold');
      }
      ctx.restore();
    }
    if (!textureMode && starFlash && game.clock - starFlash.at < 420) {
      const age = (game.clock - starFlash.at) / 420, radius = 12 + age * 36;
      ctx.save(); ctx.globalAlpha = (1 - age) * (state.calm ? .45 : .9);
      const burst = ctx.createRadialGradient(starFlash.x, starFlash.y, 2, starFlash.x, starFlash.y, radius);
      burst.addColorStop(0, '#fffef6'); burst.addColorStop(.4, starFlash.multiplier === 5 ? '#e7d2ff' : '#ffe39a'); burst.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = burst; ctx.beginPath(); ctx.arc(starFlash.x, starFlash.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    } else if (starFlash && game.clock - starFlash.at >= 420) starFlash = null;
    // Celebration scenery stays behind every live ball.
    for (const burst of activeRewardScenes(fx.celebrations || [])) {
      const scene = rewardSceneAt(burst, state.calm), age = burst.age, color = burst.profile.color;
      ctx.save();
      // Restrict the wash and sparkles to the tabletop; balls render afterwards.
      ctx.beginPath(); ctx.roundRect(12, 16, W - 24, H - 28, 24); ctx.clip();
      if (scene.scene === 'lucky') {
        if (!scene.reduced) {
          const glow = ctx.createRadialGradient(350, 435, 35, 350, 435, 570);
          glow.addColorStop(0, paintColor('#fff1b9', 'glow')); glow.addColorStop(1, paintColor('#efbc5630', 'glow'));
          ctx.globalAlpha = scene.alpha * .2; ctx.fillStyle = glow; ctx.fillRect(12, 16, W - 24, H - 28);
          ctx.globalAlpha = scene.alpha * .1;
          for (let i = 0; i < 11; i++) {
            const angle = Math.PI + i * Math.PI / 10;
            ctx.beginPath(); ctx.moveTo(burst.x, burst.y);
            ctx.lineTo(burst.x + Math.cos(angle - .022) * 1100, burst.y + Math.sin(angle - .022) * 1100);
            ctx.lineTo(burst.x + Math.cos(angle + .022) * 1100, burst.y + Math.sin(angle + .022) * 1100);
            ctx.closePath(); ctx.fillStyle = paintColor('#efc264', 'glow'); ctx.fill();
          }
          // One advancing head, never modulo-wrapped into a second lap.
          for (let i = 0; i < 96; i++) {
            const position = i / 96, point = marqueePoint(position);
            const behind = scene.progress - position;
            const trail = scene.marquee && behind >= 0 && behind < .09 ? 1 - behind / .09 : 0;
            ctx.globalAlpha = scene.alpha * (.14 + trail * .86);
            ctx.shadowBlur = trail ? 14 : 0; ctx.shadowColor = paintColor('#ffe199', 'glow');
            circle(point.x, point.y, trail ? 4.2 : 2.4, trail ? '#fff3be' : '#d9b46c');
          }
          ctx.shadowBlur = 0;
          for (let i = 0; i < 30; i++) {
            const x = 65 + (i * 137 % 580), y = 65 + (i * 211 % 695);
            ctx.globalAlpha = scene.alpha * (.25 + .35 * (1 + Math.sin(age / 200 + i)) / 2);
            star(x, y - age / 90 % 15, 3 + i % 4, i % 3 ? '#efc264' : '#fff3ce', age / 900 + i);
          }
        }
        ctx.globalAlpha = scene.alpha * (scene.reduced ? .75 : .95);
        box(193, 158, 314, 42, 18, '#fff5dcf0', '#d9b667');
        text('✦ LUCKY · 全台金色庆典 ✦', 350, 180, 17, '#a27830', 'bold');
      } else if (scene.scene === 'stars' && !scene.reduced) {
        // Staggered star clusters appear across the playfield, beyond the slot.
        for (let i = 0; i < 18; i++) {
          const localAge = age - i % 6 * 105;
          if (localAge < 0) continue;
          const life = Math.max(0, Math.sin(Math.min(1, localAge / 2100) * Math.PI));
          const x = 80 + (i * 131 % 545), y = 170 + (i * 173 % 540);
          ctx.globalAlpha = scene.alpha * life * .75;
          circle(x, y, 9 + localAge / 80, null, '#b4a0d8', 1);
          star(x, y, 4 + life * 5, color, localAge / 800 + i);
          for (let j = 0; j < 3; j++) {
            const angle = j * Math.PI * 2 / 3 + i, radius = 12 + localAge / 100;
            star(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 2.5, '#f1c774', angle);
          }
        }
      } else if (scene.scene === 'treasure') {
        ctx.globalAlpha = scene.alpha * (scene.reduced ? .3 : .65);
        circle(burst.x, burst.y, 33 + (scene.reduced ? 0 : Math.sin(age / 350) * 4), null, color, 3);
        if (!scene.reduced) {
          circle(burst.x, burst.y, 53 + Math.sin(age / 450) * 5, null, '#efcf81', 1.5);
          for (let i = 0; i < 10; i++) {
            const angle = i * Math.PI / 5 + age / 2200;
            star(burst.x + Math.cos(angle) * 48, burst.y + Math.sin(angle) * 48, 3 + i % 2, '#efc264', angle);
          }
        }
      }
      ctx.restore();
    }
    for (const burst of fx.celebrations || []) {
      const p = burst.profile, fade = Math.max(0, 1 - burst.age / p.duration), calm = state.calm || burst.calm;
      ctx.save();
      if (burst.kind === 'clock') {
        const x = burst.x, y = burst.y, radius = calm ? 75 : 75 + (1 - fade) * 95;
        ctx.globalAlpha = fade * (calm ? .25 : .65);
        circle(x, y, radius, null, p.color, 3);
        if (!calm) {
          circle(x, y, radius + 22, null, '#c5a0da', 2);
          for (let i = 0; i < 12; i++) {
            const angle = -Math.PI / 2 + i * Math.PI / 6;
            const length = i <= Math.floor(burst.age / (1000 / 12)) ? 32 : 12;
            ctx.beginPath(); ctx.moveTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
            ctx.lineTo(x + Math.cos(angle) * (radius + length), y + Math.sin(angle) * (radius + length));
            ctx.lineWidth = 3; ctx.strokeStyle = paintColor(i % 2 ? '#c5a0da' : p.color, 'line'); ctx.stroke();
            star(x + Math.cos(angle) * (radius + length + 8), y + Math.sin(angle) * (radius + length + 8), 6, p.color, angle);
          }
          ctx.lineWidth = 4; ctx.strokeStyle = paintColor('#e2ae48', 'line'); ctx.beginPath(); ctx.roundRect(39, 45, 617, 739, 25); ctx.stroke();
          for (let i = 0; i < 14; i++) star(i % 2 ? 641 : 54, 90 + Math.floor(i / 2) * 105, 7 + Math.sin(burst.age / 180 + i) * 2, i % 3 ? p.color : '#c5a0da');
        }
        ctx.globalAlpha = Math.min(1, fade * 3);
        box(178, 119, 344, 48, 20, '#fff5dcf0', '#d9b667');
        text('✦ 30 次碰撞 · 十二时钟盛典 ✦', 350, 144, 19, '#a27830', 'bold');
      } else if (p.tier >= 3 && !calm) {
        const height = 65 + p.tier * 23;
        const gradient = ctx.createLinearGradient(0, burst.y - height, 0, burst.y);
        gradient.addColorStop(0, paintColor('transparent')); gradient.addColorStop(1, paintColor(p.color));
        ctx.globalAlpha = fade * .2;
        ctx.beginPath(); ctx.moveTo(burst.x - 22, burst.y); ctx.lineTo(burst.x - 52, burst.y - height);
        ctx.lineTo(burst.x + 52, burst.y - height); ctx.lineTo(burst.x + 22, burst.y); ctx.closePath(); ctx.fillStyle = paintColor(gradient, 'object'); ctx.fill();
        ctx.globalAlpha = fade * .8;
        for (let i = 0; i < p.tier; i++) star(burst.x + (i - (p.tier - 1) / 2) * 24, burst.y - 48 - Math.sin(i + burst.age / 300) * 15, 5, p.color, burst.age / 800);
      }
      ctx.restore();
    }
    for (const ripple of fx.ripples) { ctx.save(); ctx.globalAlpha = ripple.life * .65; circle(ripple.x, ripple.y, 10 + (1 - ripple.life) * (ripple.radius ?? (ripple.big ? 85 : 30)), null, ripple.color, ripple.width ?? (ripple.big ? 4 : 2)); ctx.restore(); }
    for (const p of fx.particles) {
      ctx.save(); ctx.globalAlpha = Math.max(0, p.life) * .85; ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
      if (p.star || p.shape === 'star') star(0, 0, p.size * 1.6, p.color);
      else if (p.shape === 'bubble') circle(0, 0, p.size, null, p.color, 1.5);
      else if (p.shape === 'petal') { ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.6, p.size * .7, 0, 0, Math.PI * 2); ctx.fillStyle = paintColor(p.color, 'object'); ctx.fill(); }
      else { ctx.fillStyle = paintColor(p.color, 'object'); ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (p.shape === 'ribbon' ? 2.6 : .65)); }
      ctx.restore();
    }
    for (const p of fx.popups) {
      ctx.save(); ctx.globalAlpha = Math.min(1, p.life * 2); ctx.font = `bold ${p.size ?? (p.big ? 26 : 23)}px "Trebuchet MS", sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = paintColor('#fffbee', 'line');
      const x = Math.max(115, Math.min(550, p.x)); ctx.strokeText(p.text, x, p.y); ctx.fillStyle = paintColor(p.color || (p.big ? '#b67a26' : '#b1667b'), 'ink'); ctx.fillText(p.text, x, p.y); ctx.restore();
    }
    const crowded = game.balls.length >= BOARD_CROWD_LOCK;
    for (const b of game.balls) {
      if (!state.calm && !(crowded && b.bonus)) b.trail.forEach((pos, i) => { ctx.save(); ctx.globalAlpha = i / b.trail.length * .5; circle(pos.x, pos.y, 3 + i / b.trail.length * 7, b.bonus ? '#d9cff6' : '#f7b863'); ctx.restore(); });
      ball(b.body.position.x, b.body.position.y, 1, crowded && b.bonus, b.bonus, state.equippedSkin);
      if (!textureMode) ownRim(b.body.position.x, b.body.position.y, ballOwnFactor(b), state.calm || crowded, b.bonus);
    }
    ctx.restore();
  }
  return { draw, resize, project: (x, y) => project2DMotion(x, y, motion, W, H),
    snapshot: () => ({ mode: '2d', motion: { ...motion }, readyBall: project2DMotion(TABLE.launchX, TABLE.launchY, motion, W, H), star: starMemory ? project2DMotion(starMemory.x, starMemory.y, motion, W, H) : null }),
    dispose: () => observer?.disconnect() };
}
