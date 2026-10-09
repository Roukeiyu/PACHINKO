import { TABLE, slotMultipliers } from './physics.js';
import { rewardProfile } from './reward-effects.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const { width: W, height: H } = TABLE;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.getBoundingClientRect().width;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(width * dpr * H / W);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  const circle = (x, y, r, color, stroke, line = 1) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (color) { ctx.fillStyle = color; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); } };
  const box = (x, y, w, h, radius, color, stroke) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = color; ctx.fill(); if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke(); } };
  const text = (value, x, y, size, color, weight = '') => { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${weight} ${size}px "Trebuchet MS", "PingFang SC", sans-serif`; ctx.fillStyle = color; ctx.fillText(value, x, y); };
  function star(x, y, r, color, angle = 0) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = angle + i * Math.PI / 4, rr = i % 2 ? r * .35 : r; if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
  function bodyShape(body, color, stroke = '#ffffffb0', shadow = true) {
    ctx.save(); if (shadow) { ctx.shadowColor = '#45523d35'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 5; }
    ctx.beginPath(); body.vertices.forEach((v, i) => { if (!i) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y); }); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.shadowOffsetY = 0; ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); ctx.restore();
  }
  function ball(x, y, opacity = 1) {
    ctx.save(); ctx.globalAlpha = opacity; ctx.shadowColor = '#ffd862'; ctx.shadowBlur = 25;
    circle(x, y, 14, '#a4425d'); ctx.shadowBlur = 0;
    const g = ctx.createRadialGradient(x - 3, y - 4, 0, x, y, 12); g.addColorStop(0, '#ffffff'); g.addColorStop(.6, '#fffde8'); g.addColorStop(1, '#ffdb76');
    circle(x, y, 11.5, g); circle(x - 3, y - 4, 3.5, '#fff'); ctx.restore();
  }
  function draw(game, theme, state, fx) {
    const t = state.calm ? 0 : game.clock / 1000;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (!state.calm && fx.shake > 0) ctx.translate(Math.sin(t * 81) * fx.shake, Math.cos(t * 65) * fx.shake * .6);
    ctx.fillStyle = '#b8b08b1d';
    for (let x = 12; x < W; x += 24) for (let y = 12; y < H; y += 24) circle(x, y, .8, '#b8b08b26');
    // The shooter remains separate, without a flight-mode label or booster.
    box(38, 43, 620, 741, 30, '#ffffff29', '#c3c4a93b');
    box(689, 128, 47, 739, 21, '#d9e6d299');
    ctx.save(); ctx.strokeStyle = '#afc09a75'; ctx.lineWidth = 2; ctx.setLineDash([3, 10]); ctx.beginPath(); ctx.moveTo(713, 750); ctx.lineTo(713, 154); ctx.stroke(); ctx.restore();
    for (let i = 0; i < 3; i++) { const y = 650 + i * 60 - (t * 45 % 60); ctx.beginPath(); ctx.moveTo(704, y + 8); ctx.lineTo(713, y); ctx.lineTo(722, y + 8); ctx.strokeStyle = '#86a869a0'; ctx.lineWidth = 3; ctx.stroke(); }
    text('P O N  P O N', 351, 112, 24, '#69815d', 'bold');
    text('LITTLE PINBALL CLUB', 351, 133, 11, '#9ca184');
    text('↖', 651, 103, 27, '#a0b28d');
    star(209, 112, 7, '#d7b57a', t * .3); star(495, 112, 7, '#d7b57a', -t * .3);
    [[104, 209], [597, 647], [402, 196], [86, 639]].forEach(([x, y], i) => star(x, y + Math.sin(t + i) * 3, 4, '#d4b78475', t * .1));
    // Painted guide rings provide motion cues without competing with the ball.
    for (const bumper of game.bumpers) { const { x, y } = bumper.position; ctx.save(); ctx.setLineDash([3, 9]); circle(x, y, bumper.plugin.radius + 17, null, '#cfbf9a55'); ctx.restore(); }
    for (const wall of game.walls) bodyShape(wall, '#aebf99', '#dce6ce');
    // A diagonal one-way flap intercepts descending balls; the dashed vertical
    // line shows the separate upward path, which is never blocked by the flap.
    ctx.save();ctx.globalAlpha=.8;bodyShape(game.gates[1], game.rewards.gateGlow ? '#f8cc77' : '#d7bf97', '#fff3d6', false);ctx.restore();
    ctx.save();ctx.setLineDash([5,6]);ctx.strokeStyle='#a7ba8e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(676,539);ctx.lineTo(676,615);ctx.stroke();ctx.restore();
    text('↙ 回流口', 624, 640, 12, '#9b8965');
    const sw = (TABLE.right - TABLE.left) / state.slots, multipliers = slotMultipliers(state.slots);
    for (let i = 0; i < state.slots; i++) {
      const x = TABLE.left + i * sw, glow = fx.slotGlows[i] || 0;
      box(x + 3, TABLE.slotTop, sw - 6, 86, 12, theme.colors[Math.round(i * 6 / (state.slots - 1))]);
      if (glow) { const p = rewardProfile({ multiplier: multipliers[i] }); ctx.save(); ctx.globalAlpha = glow * .65; ctx.shadowBlur = 8 + p.tier * 5; ctx.shadowColor = p.color; box(x + 3, TABLE.slotTop, sw - 6, 86, 12, p.color); ctx.restore(); }
      text(theme.motifs[i % 4], x + sw / 2, TABLE.slotTop + 23, state.slots === 9 ? 22 : 26, '#627454');
      text(`×${multipliers[i]}`, x + sw / 2, TABLE.slotTop + 54, 17, '#4c6648', 'bold');
      if (multipliers[i] === 10) text('LUCKY', x + sw / 2, TABLE.slotTop + 73, 9, '#aa8243');
    }
    for (const hole of game.holes) {
      const pulse = 1 + Math.sin(t * 2.5) * .07;
      circle(hole.x, hole.y, 23 * pulse + hole.glow * 8, null, hole.glow ? '#efb750' : '#d6bc8170', 2);
      circle(hole.x, hole.y + 2, 19, '#968873');
      const gradient = ctx.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, 19); gradient.addColorStop(0, '#293b39'); gradient.addColorStop(.7, '#536753'); gradient.addColorStop(1, '#b5b697');
      circle(hole.x, hole.y, 18, gradient, '#ede0a2', 3);
      star(hole.x, hole.y, 7, '#ecda90', t * .25);
      text('+500', hole.x, hole.y - 51, 15, '#b39153', 'bold');
      text('秘密洞', hole.x, hole.y + 52, 12, '#9e9375');
    }
    for (const guard of game.guards) bodyShape(guard, guard.plugin.storage ? '#b9a6ce' : '#d8c69c', guard.plugin.storage ? '#f4eafb' : '#efe5c8', false);
    const storage = game.collector;
    // The cup, live counter and visible inlet all share the physical coordinates.
    circle(storage.x, storage.y + 2, 22, '#827590');
    const cup = ctx.createRadialGradient(storage.x, storage.y, 0, storage.x, storage.y, 22);
    cup.addColorStop(0, '#405c59'); cup.addColorStop(1, '#8eaaa1');
    circle(storage.x, storage.y, 21, cup, storage.glow ? '#f3cf7b' : '#eae0f3', 2);
    text(`${storage.stored.length}/20`, storage.x, storage.y + 3, 11, '#fff9e9', 'bold');
    text('蓄球罐', storage.x, storage.y - 49, 12, '#8b769f', 'bold');
    text(storage.remaining ? `落球中 · 余 ${storage.remaining}` : '存 20 · 落 40', storage.x, storage.y + 48, 11, '#8b769f');
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
      ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      if (glow && !state.calm) { ctx.globalAlpha = glow; text('› ›', 47 + (1 - glow) * 15, 0, 18, '#c69951', 'bold'); }
      ctx.restore();
      text('撞击换向', x, y + 54, 12, '#9e9375');
    }
    for (const rail of game.rails) {
      if (rail.plugin.motion) {
        const motion = rail.plugin.motion;
        ctx.save(); ctx.setLineDash([3, 6]); ctx.strokeStyle = '#c7b4a86b'; ctx.lineWidth = 2;
        const dx = motion.axisX * motion.amplitude, dy = motion.axisY * motion.amplitude;
        ctx.beginPath(); ctx.moveTo(motion.x - dx, motion.y - dy); ctx.lineTo(motion.x + dx, motion.y + dy); ctx.stroke(); ctx.restore();
      }
      bodyShape(rail, rail.plugin.glow > .3 ? '#ffdea2' : theme.accent, '#fff5df');
      ctx.save(); ctx.translate(rail.position.x, rail.position.y); ctx.rotate(rail.angle); text('›  ›  ›', 0, -1, 13, '#fff8ec', 'bold'); ctx.restore();
    }
    for (const diamond of game.diamonds) { bodyShape(diamond, diamond.plugin.glow > .3 ? '#fff1c0' : '#bdafcc', '#f6eaf9'); star(diamond.position.x, diamond.position.y, 9, '#fff9e9'); }
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
      ctx.save(); if (glow) { ctx.shadowColor = '#f7c065'; ctx.shadowBlur = 30 * glow; }
      circle(x, y, r + 6 + glow * 4, glow > .2 ? '#ffd879' : theme.accent, '#fff9ec', 3);
      circle(x, y - 2, r - 3, theme.colors[bumper.plugin.index * 2], '#fffefa', 3);
      ctx.restore();
      text(theme.motifs[bumper.plugin.index], x, y - 3 + (state.calm ? 0 : Math.sin(t * 2 + bumper.id)), r * .85, '#6e7f60');
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; circle(x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10), 2.2, Math.sin(t * 3 + i) > 0 ? '#ecd5a4' : '#ffffff90'); }
      const index=bumper.plugin.index,goal=game.rewards.goals[index],count=game.rewards.hits[index]%goal;
      ctx.beginPath();ctx.arc(x,y,r+14,-Math.PI/2,-Math.PI/2+Math.PI*2*(count/goal));ctx.strokeStyle='#c59450';ctx.lineWidth=3;ctx.stroke();
      box(x-39,y+r+21,78,22,11,'#fff9e9dd','#ddd3b6');text(`${count} / ${goal}`,x,y+r+32,12,'#997747','bold');
      if(index===2&&game.rewards.enlargedUntil>game.clock)text(`变大 ${((game.rewards.enlargedUntil-game.clock)/1000).toFixed(1)}s`,x,y-r-27,13,'#b38643','bold');
      if(index===2&&game.rewards.burstUntil>game.clock){
        for(let i=0;i<12;i++){const angle=-Math.PI/2+i*Math.PI/6;circle(x+Math.cos(angle)*(r+27),y+Math.sin(angle)*(r+27),i===game.rewards.burstStep?5:3,i<=game.rewards.burstStep?'#dbaa45':'#e3d8b8');}
      }
    }
    // The spring compresses while held. A ready ball remains visually separate
    // from any live ball travelling along the lane.
    const compression = state.charging ? state.charge * 22 : 0;
    const springTop = 813 + compression, springBottom = 865;
    ctx.beginPath(); ctx.moveTo(713, springTop);
    for (let i = 0; i <= 12; i++) ctx.lineTo(713 + (i % 2 ? 11 : -11), springTop + (springBottom - springTop) * i / 12);
    ctx.strokeStyle = '#8e9f7b'; ctx.lineWidth = 4; ctx.stroke();
    box(695, springTop - 6, 36, 8, 4, '#71896a', '#ecf1d6');
    if (!game.balls.some(b => b.body.position.x > 683 && b.body.position.y > 730)) ball(TABLE.launchX, TABLE.launchY + compression, .88);
    text('PULL', 713, 850 + compression * .3, 9, '#65785c', 'bold');
    if (game.star) {
      const s = game.star, pulse = state.calm ? 1 : 1 + Math.sin(t * 4) * .09;
      const purple = s.multiplier === 5, color = purple ? '#a477d4' : '#d8ae58';
      const remaining = Math.max(0, s.expiresAt - game.clock);
      ctx.save(); ctx.translate(s.x, s.y); ctx.scale(pulse, pulse);
      ctx.beginPath(); ctx.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining / (s.expiresAt - s.born));
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.shadowColor = purple ? '#b98de7' : '#efc264'; ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? 5 : 11;
        if (i) ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); else ctx.moveTo(0, -radius);
      }
      ctx.closePath(); ctx.fillStyle = purple ? '#b58ae0' : '#f5cd70'; ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = purple ? '#f7eaff' : '#fff8dc'; ctx.lineWidth = 1.5; ctx.stroke();
      text(`×${s.multiplier} · ${Math.ceil(remaining / 1000)}s`, 0, 29, 10, purple ? '#8b59b5' : '#b58b42', 'bold'); ctx.restore();
    }
    // Celebration scenery stays behind every live ball.
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
            ctx.lineWidth = 3; ctx.strokeStyle = i % 2 ? '#c5a0da' : p.color; ctx.stroke();
            star(x + Math.cos(angle) * (radius + length + 8), y + Math.sin(angle) * (radius + length + 8), 6, p.color, angle);
          }
          ctx.lineWidth = 4; ctx.strokeStyle = '#e2ae48'; ctx.beginPath(); ctx.roundRect(39, 45, 617, 739, 25); ctx.stroke();
          for (let i = 0; i < 14; i++) star(i % 2 ? 641 : 54, 90 + Math.floor(i / 2) * 105, 7 + Math.sin(burst.age / 180 + i) * 2, i % 3 ? p.color : '#c5a0da');
        }
        ctx.globalAlpha = Math.min(1, fade * 3);
        box(178, 119, 344, 48, 20, '#fff5dcf0', '#d9b667');
        text('✦ 50 次碰撞 · 十二时钟盛典 ✦', 350, 144, 19, '#a27830', 'bold');
      } else if (p.tier >= 3 && !calm) {
        const height = 65 + p.tier * 23;
        const gradient = ctx.createLinearGradient(0, burst.y - height, 0, burst.y);
        gradient.addColorStop(0, 'transparent'); gradient.addColorStop(1, p.color);
        ctx.globalAlpha = fade * .2;
        ctx.beginPath(); ctx.moveTo(burst.x - 22, burst.y); ctx.lineTo(burst.x - 52, burst.y - height);
        ctx.lineTo(burst.x + 52, burst.y - height); ctx.lineTo(burst.x + 22, burst.y); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
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
      else if (p.shape === 'petal') { ctx.beginPath(); ctx.ellipse(0, 0, p.size * 1.6, p.size * .7, 0, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill(); }
      else { ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (p.shape === 'ribbon' ? 2.6 : .65)); }
      ctx.restore();
    }
    for (const p of fx.popups) {
      ctx.save(); ctx.globalAlpha = Math.min(1, p.life * 2); ctx.font = `bold ${p.size ?? (p.big ? 26 : 23)}px "Trebuchet MS", sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = '#fffbee';
      const x = Math.max(115, Math.min(550, p.x)); ctx.strokeText(p.text, x, p.y); ctx.fillStyle = p.color || (p.big ? '#b67a26' : '#b1667b'); ctx.fillText(p.text, x, p.y); ctx.restore();
    }
    for (const b of game.balls) {
      if (!state.calm) b.trail.forEach((pos, i) => { ctx.save(); ctx.globalAlpha = i / b.trail.length * .5; circle(pos.x, pos.y, 3 + i / b.trail.length * 7, '#f7b863'); ctx.restore(); });
      ball(b.body.position.x, b.body.position.y);
      if (b.scoreFactor > 1) {
        circle(b.body.position.x, b.body.position.y, 18, null, '#e8b446b0', 1.5);
        text(`×${b.scoreFactor}`, b.body.position.x, b.body.position.y - 25, 13, '#a87535', 'bold');
      }
    }
    ctx.restore();
  }
  return { draw, resize };
}
