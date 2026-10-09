import { createTable, STEP } from './physics.js';
import { createRenderer } from './renderer.js';
import { createCanon } from './canon.js';
import { chargeAt, chargePercent } from './charge.js';
import './style.css';

const icons = {
  sound: '<path d="M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/>',
  settings: '<path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3h3l2 3 3-1 1-3 3-1 2-3-2-2 1-3-2-3h-3l-2-2Z"/><circle cx="11.5" cy="12" r="3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M12 21V4m-6 6 6-6 6 6"/>',
  auto: '<path d="M19 8a8 8 0 0 0-14-1L3 10m0-6v6h6m-4 6a8 8 0 0 0 14 1l2-3m0 6v-6h-6"/>',
};
const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const themes = {
  animal: { label: '动物', name: '小动物的游乐园', description: '和毛茸茸的朋友，接住好运气', emoji: '🐰', motifs: ['🐰','🐻','🐾','🥕'], bg: '#fbf3e9', pin: '#b2c3a1', accent: '#e994a4', colors: ['#e6ecca','#f8dfb1','#efc2cb','#d5e6d3','#f6dba7','#efc2cb','#e6ecca'] },
  dessert: { label: '甜品', name: '甜甜的白日梦', description: '每一次落下，都有一点点甜', emoji: '🍰', motifs: ['🍰','🍩','🍓','🍬'], bg: '#fff0ef', pin: '#d6b3c9', accent: '#d980ae', colors: ['#f6d7d8','#e6d5f2','#f8dfb1','#d6eae2','#f8dfb1','#e6d5f2','#f6d7d8'] },
  flower: { label: '花朵', name: '花园里的小确幸', description: '让快乐发芽，让心情开一朵花', emoji: '🌷', motifs: ['🌷','🌼','🍀','🌸'], bg: '#f4f6e9', pin: '#a5be9d', accent: '#d49ca7', colors: ['#d9e9c7','#f6e4b2','#efcbd5','#cadfd2','#f6e4b2','#efcbd5','#d9e9c7'] },
};
let saved = {};
try { saved = JSON.parse(localStorage.getItem('ponpon-settings') || '{}'); } catch {}
const state = {
  theme: themes[saved.theme] ? saved.theme : 'animal', slots: [5,7,9].includes(saved.slots) ? saved.slots : 7,
  sound: saved.sound !== false, volume: Number.isFinite(saved.volume) ? Math.max(0,Math.min(1,saved.volume)) : .55,
  calm: saved.calm ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
  score: 0, balls: 0, best: Number.isFinite(saved.best) ? Math.max(0,saved.best) : 0, power: 65, auto: false, charging: false, charge: 0,
};
const persist = () => { try { localStorage.setItem('ponpon-settings', JSON.stringify({theme:state.theme,slots:state.slots,sound:state.sound,volume:state.volume,calm:state.calm,best:state.best})); } catch {} };
const mascot = `<svg class="mascot" viewBox="0 0 130 135" fill="none" aria-hidden="true"><ellipse cx="46" cy="32" rx="14" ry="30" transform="rotate(-14 46 32)" fill="#fffaf0" stroke="#d9cdbb" stroke-width="2"/><ellipse cx="84" cy="32" rx="14" ry="30" transform="rotate(14 84 32)" fill="#fffaf0" stroke="#d9cdbb" stroke-width="2"/><ellipse cx="45" cy="29" rx="6" ry="18" transform="rotate(-14 45 29)" fill="#efc4cb"/><ellipse cx="85" cy="29" rx="6" ry="18" transform="rotate(14 85 29)" fill="#efc4cb"/><path d="M19 83C19 53 39 43 65 43S111 53 111 83C111 111 92 127 65 127S19 111 19 83Z" fill="#fffaf0" stroke="#d9cdbb" stroke-width="2"/><ellipse cx="37" cy="91" rx="10" ry="6" fill="#f0bdc6"/><ellipse cx="93" cy="91" rx="10" ry="6" fill="#f0bdc6"/><ellipse cx="48" cy="80" rx="3" ry="4" fill="#435444"/><ellipse cx="82" cy="80" rx="3" ry="4" fill="#435444"/><path d="m62 90 3 3 3-3m-3 3v4m-6-1q3 5 6 1 3 4 6-1" stroke="#705d50" stroke-width="2" stroke-linecap="round"/><path d="M102 110c-9-6-24 3-23 11 13 3 21-1 23-11Z" fill="#a6b88b"/><path d="M79 121c-1-17-9-22-14-19-4 12 5 19 14 19Z" fill="#bfcd9d"/></svg>`;

document.querySelector('#app').innerHTML = `
<div class="shell">
  <header><div class="brand"><div class="brand-mark"><svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="#fff9e9"/><circle cx="15" cy="18" r="1.5" fill="#435444"/><circle cx="25" cy="18" r="1.5" fill="#435444"/><path d="M16 24q4 4 8 0" fill="none" stroke="#435444" stroke-width="1.5" stroke-linecap="round"/></svg></div><div><div class="brand-name">PON <span>PON</span><span style="font-size:13px;color:#89957a"> ✳</span></div><div class="brand-caption">A LITTLE JOY MACHINE</div></div></div><div class="header-actions"><span class="quiet-tag">TAKE A BREAK. MAKE A PON.</span><button class="icon-button" id="sound-button" aria-label="关闭音效"></button><button class="settings-button" id="settings-button">${icon('settings')}<span>游乐场设置</span></button></div></header>
  <section class="intro"><div><div class="eyebrow">YOUR DAILY DOSE OF HAPPY</div><h1>弹一点，小快乐<em>✧</em></h1><p>蓄一点力，弹进一场奇妙的小冒险。</p></div><div class="intro-sticker">100% 快乐<br>0% 压力</div></section>
  <main class="game-layout">
    <section class="machine" aria-label="柏青哥游戏区"><div class="mobile-hud"><span>快乐积分 <strong id="mobile-score">0</strong></span><span id="shot-state">右下角 · 弹珠就位</span><span class="bonus-label">秘密洞 <b>+500</b></span></div><div class="machine-top"><span class="machine-label"><i class="status-dot"></i> THE HAPPY LITTLE PACHINKO</span><span class="tiny-dots">● ● ●</span></div><div class="board-wrap"><canvas id="board" width="760" height="900" aria-label="弹珠从右下角沿轨道发射；长按下方按钮或右侧弹簧蓄力，松开发射。右侧秘密洞奖励500分，左侧三角平台随机换向。"></canvas><button class="plunger-hit" id="plunger" aria-label="长按右侧弹簧蓄力，松开发射"></button></div><div class="launch-control"><div class="compact-tools"><button class="icon-button" id="compact-sound" aria-label="关闭音效"></button><button class="settings-button" id="compact-settings" aria-label="游乐场设置">${icon('settings')}<span>设置</span></button></div><div class="launch-row"><div class="launch-mode"><button class="launch-button" id="launch">${icon('arrow')} <span id="launch-label">按住蓄力 · 松开发射</span><kbd>SPACE</kbd></button><label class="power-row" id="auto-power" for="power" hidden><span>弹射力度</span><output id="power-value" for="power">65%</output><input type="range" min="1" max="100" value="65" id="power" aria-label="自动弹射力度"/></label></div><button class="auto-button" id="auto" aria-pressed="false">${icon('auto',16)}<span>自动弹射</span></button></div><p class="machine-foot">蓄力 2 秒满 · 拾星本球加倍 · 碰撞奏响卡农</p></div><div class="reward-dashboard" aria-label="反弹点惊喜进度"><div><span>左鼓 · 随机赠球 <b id="reward-0">0/10</b></span><progress id="reward-progress-0" max="10" value="0" aria-label="左侧反弹点命中次数"></progress><small>满 10 次送一颗</small></div><div><span>中央 · 时钟爆发 <b id="reward-2">0/100</b></span><progress id="reward-progress-2" max="100" value="0" aria-label="中央反弹点命中次数"></progress><small>1 秒发射 12 颗</small></div><div><span>右鼓 · 中央变大 <b id="reward-1">0/10</b></span><progress id="reward-progress-1" max="10" value="0" aria-label="右侧反弹点命中次数"></progress><small id="reward-timer">持续 5 秒</small></div></div></section>
    <aside class="sidebar"><section class="card score-card"><div class="card-label">今日份快乐 <span class="small-label">HAPPY POINTS</span></div><div class="score-value"><span id="score">0</span><span class="score-unit">分</span></div><div class="score-divider"></div><div class="score-stats"><span>已投小球 &nbsp;<strong id="ball-count">0</strong></span><span>最高纪录 &nbsp;<strong id="best">0</strong></span></div></section><section class="card how-card"><div class="card-label">快乐使用说明 <span>↗</span></div><ol><li><span class="step-no">01</span>力度决定高度，回流口重返球场</li><li><span class="step-no">02</span>左右鼓满 10 次，赠球或放大中央</li><li><span class="step-no">03</span>中央满 100 次，十二时钟大爆发</li></ol></section><div class="little-note">✿ &nbsp; 不用赶路，弹一会儿也很好</div></aside>
  </main><div class="bottom-info"><span>✧ &nbsp; 真实物理碰撞 · 无限次小快乐</span><span class="sound-indicator"><span class="sound-bars"><i></i><i></i><i></i></span><span id="sound-status">声音已开启，快乐有回响</span></span></div><footer class="footer"><span>PON PON · YOUR POCKET-SIZED HAPPY PLACE</span><span>MADE WITH <b>♡</b> & A LITTLE BOUNCE</span></footer>
</div><div class="toast" id="toast" role="status"></div>
<dialog id="settings"><div class="dialog-inner"><div class="dialog-head"><h2>布置你的游乐场</h2><button class="icon-button" id="close-settings" aria-label="关闭设置">${icon('close')}</button></div><p class="dialog-sub">换一种心情，再接住一颗小快乐。</p><div class="setting-label">落袋槽位<small>越多槽位，越多惊喜</small></div><div class="choices">${[5,7,9].map(n=>`<button class="choice" data-slots="${n}">${n} 个槽位</button>`).join('')}</div><div class="setting-label">游乐场主题</div><div class="settings-theme"><div class="theme-preview"><div id="mascot">${mascot}</div></div><div><div class="theme-name" id="theme-name"></div><div class="theme-description" id="theme-description"></div></div></div><div class="choices">${Object.entries(themes).map(([key,t])=>`<button class="choice theme-choice" data-theme="${key}"><span>${t.emoji}</span>${t.label}主题</button>`).join('')}</div><label class="setting-row" for="volume">音效音量<input id="volume" type="range" min="0" max="100" value="${state.volume*100}" /></label><label class="setting-row" for="calm">轻柔模式（减少装饰动效）<input id="calm" type="checkbox" ${state.calm?'checked':''}/></label><button class="done-button" id="done-settings">好啦，继续快乐</button><p class="setting-note">设置自动保存。调整槽位会清空在途小球，保留得分。</p></div></dialog>`;

const $ = (s) => document.querySelector(s);
// Cancel selection/callouts within the game without blocking page scrolling,
// pinch zoom, range dragging, focus or keyboard controls.
for (const type of ['selectstart', 'dragstart', 'contextmenu']) $('#app').addEventListener(type, event => event.preventDefault());
const canon = createCanon();
let currentNote = null;
let toastTimer;
function toast(message) { $('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2200); }

// All sounds are synthesized locally: no downloads, no autoplay and no audio assets.
let audio, master;
const voices = [];
function unlockAudio(){
  if(!state.sound) return;
  if(!audio){ const Audio = window.AudioContext || window.webkitAudioContext; if(!Audio) return; audio=new Audio();master=audio.createGain();master.gain.value=state.volume*.32;master.connect(audio.destination); }
  if(audio.state==='suspended') audio.resume().catch(()=>{});
}
function tone(freq,duration=.13,type='sine',delay=0,gain=.25,endFreq,pan=0){
  if(!state.sound||!audio||audio.state!=='running')return;
  const t=audio.currentTime+delay, oscillator=audio.createOscillator(), envelope=audio.createGain();
  oscillator.type=type;oscillator.frequency.setValueAtTime(freq,t);if(endFreq)oscillator.frequency.exponentialRampToValueAtTime(endFreq,t+duration);
  envelope.gain.setValueAtTime(0,t);envelope.gain.linearRampToValueAtTime(gain,t+.008);envelope.gain.exponentialRampToValueAtTime(.001,t+duration);
  const panner=audio.createStereoPanner();panner.pan.value=Math.max(-.8,Math.min(.8,pan));
  oscillator.connect(envelope);envelope.connect(panner);panner.connect(master);oscillator.start(t);oscillator.stop(t+duration+.01);
  const voice={oscillator,envelope,panner};voices.push(voice);
  // Keep impacts responsive during a twelve-ball burst; shorten old tails,
  // rather than skipping notes in the melody or creating unlimited voices.
  if(voices.length>32){const old=voices.shift();old.envelope.gain.cancelScheduledValues(audio.currentTime);old.envelope.gain.setTargetAtTime(.001,audio.currentTime,.006);old.oscillator.stop(audio.currentTime+.025);}
  oscillator.onended=()=>{const i=voices.indexOf(voice);if(i>=0)voices.splice(i,1);oscillator.disconnect();envelope.disconnect();panner.disconnect();};
}
function playCanon(hit) {
  currentNote = canon.next();
  tone(currentNote.frequency, .42, 'triangle', 0, hit.kind === 'bumper' ? .26 : .16, undefined, (hit.x - 380) / 475);
  $('#sound-status').textContent = state.sound ? `♪ 卡农 · ${currentNote.name.replace('#','♯')}` : '静音时光，也很美好';
}
function sound(kind,value=0){
  if(kind==='launch'){tone(330,.14,'sine',0,.4,880);tone(110,.09,'triangle',0,.2);}
  if(kind==='score'){[523,659,784,value>=5?1319:1047].forEach((n,i)=>tone(n,.25,'sine',i*.065,.3));tone(180,.2,'triangle',0,.22,60);}
  if(kind==='jackpot'){[523,659,784,1047,1319,1568].forEach((n,i)=>tone(n,.4,'sine',i*.09,.32));}
  if(kind==='theme'){tone(660,.12,'sine');tone(880,.16,'sine',.075);}
  if(kind==='star'){[880,1175,1568].forEach((n,i)=>tone(n,.24,'sine',i*.055,.22));}
}

const fx = { particles: [], ripples: [], popups: [], slotGlows: Array(state.slots).fill(0), shake: 0 };
const game = createTable({ slots: state.slots, onHit: hit => {
  playCanon(hit);
  if (!state.calm) fx.ripples.push({ ...hit, life: 1, color: themes[state.theme].accent });
}, onScore: award, onReturn: () => toast('弹珠已回收，再试试另一种力度吧'), onSurprise: surprise });
const renderer = createRenderer($('#board'));
let frame = 0, last = 0, accumulator = 0, lastDrop = -1000, lastAuto = 0;
let chargeStart = 0, chargeSource = null;

function surprise(event) {
  const names = { clock: '✦ 百次碰撞！十二时钟爆发', random: '✧ 左鼓满 10 次，送一颗弹珠', enlarge: '✿ 右鼓满 10 次，中央放大 5 秒', redirect: '↙ 回流出口，再冒险一次' };
  if (names[event.kind]) toast(names[event.kind]);
  fx.ripples.push({ x: event.x, y: event.y, life: 1, big: event.kind === 'clock' || event.kind === 'enlarge', color: event.kind === 'redirect' ? '#92b68d' : event.multiplier === 5 ? '#b58ae0' : '#e6b44f' });
  if (event.kind === 'clock' && !state.calm) fx.shake = 3;
  if (event.kind === 'star') {
    sound('star');
    fx.popups.push({ x: event.x, y: event.y - 20, text: `✦ 本球 ×${event.scoreFactor}`, life: 1, big: false });
    for (let i = 0; i < (state.calm ? 4 : 12); i++) {
      const angle = i * Math.PI / 6;
      fx.particles.push({ x: event.x, y: event.y, vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3, life: .8, size: 3, rotation: angle, color: event.multiplier === 5 ? '#b58ae0' : '#edbf68', star: true });
    }
  }
  if ((event.kind === 'emit' || event.kind === 'deflect') && !state.calm) {
    for (let i = 0; i < 5; i++) fx.particles.push({ x: event.x, y: event.y, vx: Math.cos(event.angle) * (3 + i), vy: Math.sin(event.angle) * (3 + i), life: .8, size: 3, rotation: event.angle, color: '#edbf68', star: true });
  }
}

function award(result) {
  state.score += result.points; state.best = Math.max(state.best, state.score); persist();
  $('#score').textContent = state.score.toLocaleString(); $('#mobile-score').textContent = state.score.toLocaleString(); $('#best').textContent = state.best.toLocaleString();
  $('.score-value').classList.remove('score-bump'); void $('.score-value').offsetWidth; $('.score-value').classList.add('score-bump');
  const jackpot = result.kind === 'jackpot', big = jackpot || result.multiplier === 10;
  if (!jackpot) fx.slotGlows[result.column] = 1;
  fx.popups.push({ x: result.x, y: result.y - 30, text: jackpot ? `✦ 秘密洞！ +${result.points}` : `+${result.points}${result.scoreFactor > 1 ? ` · 星星 ×${result.scoreFactor}` : ''}`, life: 1, big });
  fx.ripples.push({ x: result.x, y: result.y, big: true, life: 1, color: '#e6b44f' });
  if (jackpot) { toast(`✦ 发现秘密洞！收下 ${result.points} 分惊喜`); if (!state.calm) fx.shake = 4; }
  const count = state.calm ? 8 : jackpot ? 90 : big ? 60 : 30;
  for (let i = 0; i < count; i++) fx.particles.push({ x: result.x, y: result.y, vx: (Math.random() - .5) * 11, vy: -3 - Math.random() * 10, life: 1, size: 2 + Math.random() * 4, rotation: Math.random() * 6, color: ['#ee8d9d','#f0c26e','#8fae83','#fffef4','#bbabd5'][i % 5], star: i % 4 === 0 });
  if (fx.particles.length > 300) fx.particles.splice(0, fx.particles.length - 300);
  sound(jackpot ? 'jackpot' : 'score', result.multiplier || 10);
}
function launch(power = state.auto ? state.power / 100 : 0) {
  if ($('#settings').open || document.hidden) return;
  unlockAudio();
  const now = performance.now(); if (now - lastDrop < 250) return;
  const ball = game.launch(power);
  if (!ball) { if (!state.auto) toast('发射轨道准备中，稍等一下'); return; }
  lastDrop = now; state.balls++; $('#ball-count').textContent = state.balls;
  sound('launch'); $('#shot-state').textContent = '↗ 弹射出发！';
}
function setAuto(enabled) {
  state.auto = enabled; $('#launch').hidden = enabled; $('#auto-power').hidden = !enabled; $('#power-value').textContent = `${state.power}%`; $('#auto').classList.toggle('active', enabled); $('#auto').setAttribute('aria-pressed', String(enabled)); $('#auto span').textContent = enabled ? '暂停弹射' : '自动弹射';
}
function beginCharge(source) {
  if (state.charging || $('#settings').open) return false;
  unlockAudio(); setAuto(false); state.charging = true; chargeSource = source; chargeStart = performance.now(); state.charge = 0;
  $('#launch').style.setProperty('--charge', '0%'); $('#launch-label').textContent = '蓄力 0% · 松开发射';
  $('#launch').classList.add('charging'); return true;
}
function endCharge(fire = true) {
  if (!state.charging) return;
  const power = chargeAt(performance.now() - chargeStart);
  state.charging = false; state.charge = 0; chargeSource = null; $('#launch').classList.remove('charging');
  $('#launch').style.setProperty('--charge', '0%'); $('#launch-label').textContent = '按住蓄力 · 松开发射'; $('#power-value').textContent = `${state.power}%`;
  if (fire) launch(power);
}
for (const button of [$('#launch'), $('#plunger')]) {
  button.addEventListener('pointerdown', event => { if (!event.isPrimary || event.button !== 0) return; if (beginCharge(button)) button.setPointerCapture(event.pointerId); });
  button.addEventListener('pointerup', event => { if (!event.isPrimary || chargeSource !== button) return; endCharge(); if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId); });
  button.addEventListener('pointercancel', event => { if (event.isPrimary && chargeSource === button) endCharge(false); });
  button.addEventListener('lostpointercapture', event => { if (event.isPrimary && chargeSource === button) endCharge(false); });
  button.addEventListener('contextmenu', event => event.preventDefault());
  // Pointer release already fires. A detail=0 click covers assistive technology.
  button.addEventListener('click', event => { if (event.detail === 0) launch(); });
}
document.addEventListener('keydown', event => {
  const tag = document.activeElement.tagName;
  const launchFocused = document.activeElement === $('#launch') || document.activeElement === $('#plunger');
  if (event.code === 'Space' && !$('#settings').open && (launchFocused || !['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(tag))) {
    event.preventDefault(); if (!event.repeat) beginCharge('keyboard');
  }
});
document.addEventListener('keyup', event => { if (event.code === 'Space' && chargeSource === 'keyboard') { event.preventDefault(); endCharge(); } });
window.addEventListener('blur', () => endCharge(false));
document.addEventListener('visibilitychange', () => { last = 0; accumulator = 0; if (document.hidden) endCharge(false); });
$('#auto').addEventListener('click', () => { endCharge(false); unlockAudio(); setAuto(!state.auto); if (state.auto) { launch(); lastAuto = performance.now(); } });
$('#power').addEventListener('input', event => { state.power = +event.target.value; $('#power-value').textContent = `${state.power}%`; });

function updateEffects(dt) {
  const factor = dt / (1000 / 60);
  fx.shake = Math.max(0, fx.shake - .18 * factor);
  for (let i = 0; i < fx.slotGlows.length; i++) fx.slotGlows[i] = Math.max(0, fx.slotGlows[i] - .015 * factor);
  for (let i = fx.ripples.length - 1; i >= 0; i--) { fx.ripples[i].life -= .032 * factor; if (fx.ripples[i].life <= 0) fx.ripples.splice(i, 1); }
  for (let i = fx.particles.length - 1; i >= 0; i--) { const p = fx.particles[i]; p.x += p.vx * factor; p.y += p.vy * factor; p.vy += .19 * factor; p.vx *= .99 ** factor; p.rotation += .07 * factor; p.life -= .016 * factor; if (p.life <= 0) fx.particles.splice(i, 1); }
  for (let i = fx.popups.length - 1; i >= 0; i--) { fx.popups[i].y -= .6 * factor; fx.popups[i].life -= .012 * factor; if (fx.popups[i].life <= 0) fx.popups.splice(i, 1); }
}
function tick(now) {
  const delta = last ? Math.min(now - last, 50) : 0; last = now;
  if (!document.hidden && !$('#settings').open) {
    accumulator += delta;
    while (accumulator >= STEP) { game.step(); updateEffects(STEP); accumulator -= STEP; }
    for (let i = 0; i < 3; i++) {
      const count = game.rewards.hits[i] % game.rewards.goals[i];
      $(`#reward-${i}`).textContent = `${count}/${game.rewards.goals[i]}`;
      $(`#reward-progress-${i}`).value = count;
    }
    $('#reward-timer').textContent = game.rewards.enlargedUntil > game.clock ? `放大中 ${(Math.max(0, game.rewards.enlargedUntil - game.clock) / 1000).toFixed(1)}s` : '持续 5 秒';
    if (state.charging) {
      state.charge = chargeAt(now - chargeStart);
      const percent = chargePercent(state.charge);
      $('#launch').style.setProperty('--charge', `${percent}%`); $('#launch-label').textContent = `蓄力 ${percent}% · 松开发射`; $('#shot-state').textContent = percent === 100 ? '✦ 蓄力已满，松手！' : '弹簧蓄力中…';
    } else if (now - lastDrop > 1700) $('#shot-state').textContent = game.balls.length ? `${game.balls.length} 颗小快乐在冒险` : '右下角 · 弹珠就位';
    if (state.auto && now - lastAuto > 1100) { launch(); lastAuto = now; }
  }
  renderer.draw(game, themes[state.theme], state, fx); frame = requestAnimationFrame(tick);
}
function updateTheme() {
  const theme = themes[state.theme]; $('#theme-name').textContent = theme.name; $('#theme-description').textContent = theme.description;
  $('#mascot').innerHTML = state.theme === 'animal' ? mascot : `<div class="mascot theme-emoji">${theme.emoji}</div>`;
  document.documentElement.style.setProperty('--accent', theme.accent); $('.board-wrap').style.background = theme.bg;
  document.querySelectorAll('[data-theme]').forEach(b => { b.classList.toggle('selected', b.dataset.theme === state.theme); b.setAttribute('aria-pressed', String(b.dataset.theme === state.theme)); });
  document.querySelectorAll('[data-slots]').forEach(b => { b.classList.toggle('selected', +b.dataset.slots === state.slots); b.setAttribute('aria-pressed', String(+b.dataset.slots === state.slots)); });
}
function updateSound() {
  $('#sound-button').innerHTML = icon(state.sound ? 'sound' : 'muted'); $('#sound-button').setAttribute('aria-label', state.sound ? '关闭音效' : '开启音效'); $('#sound-button').setAttribute('aria-pressed', String(state.sound));
  $('#sound-status').textContent = state.sound ? '♪ 碰撞弹奏《卡农》' : '静音时光，也很美好'; $('.sound-bars').classList.toggle('muted', !state.sound);
  $('#compact-sound').innerHTML = $('#sound-button').innerHTML; $('#compact-sound').setAttribute('aria-label', $('#sound-button').getAttribute('aria-label')); $('#compact-sound').setAttribute('aria-pressed', String(state.sound));
  if (master) master.gain.setTargetAtTime(state.sound ? state.volume * .32 : 0, audio.currentTime, .03);
}
function updateCalm() { document.documentElement.classList.toggle('calm', state.calm); document.querySelectorAll('.mascot,.mascot-spark,.sound-bars i').forEach(el => el.style.animationPlayState = state.calm ? 'paused' : 'running'); }
$('#compact-sound').addEventListener('click', () => $('#sound-button').click());
$('#compact-settings').addEventListener('click', () => $('#settings-button').click());
$('#sound-button').addEventListener('click', () => { state.sound = !state.sound; unlockAudio(); updateSound(); persist(); if (state.sound) sound('theme'); });
$('#settings-button').addEventListener('click', () => { endCharge(false); $('#settings').showModal(); });
$('#close-settings').addEventListener('click', () => $('#settings').close()); $('#done-settings').addEventListener('click', () => $('#settings').close());
$('#settings').addEventListener('click', event => { if (event.target === $('#settings')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
document.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => { state.theme = b.dataset.theme; updateTheme(); updateCalm(); persist(); unlockAudio(); sound('theme'); }));
document.querySelectorAll('[data-slots]').forEach(b => b.addEventListener('click', () => { if (state.slots === +b.dataset.slots) return; state.slots = +b.dataset.slots; game.setSlots(state.slots); fx.slotGlows = Array(state.slots).fill(0); updateTheme(); persist(); }));
$('#volume').addEventListener('input', event => { state.volume = +event.target.value / 100; if (state.volume > 0) state.sound = true; unlockAudio(); updateSound(); persist(); });
$('#volume').addEventListener('change', () => sound('theme'));
$('#calm').addEventListener('change', event => { state.calm = event.target.checked; updateCalm(); persist(); });
$('#best').textContent = state.best.toLocaleString(); updateTheme(); updateSound(); updateCalm();
frame = requestAnimationFrame(tick);
window.addEventListener('pagehide', () => { endCharge(false); cancelAnimationFrame(frame); frame = 0; audio?.suspend(); });
window.addEventListener('pageshow', () => { if (!frame) { last = 0; accumulator = 0; frame = requestAnimationFrame(tick); } });
if (import.meta.env.DEV) Object.defineProperty(window, '__ponpon', { get: () => ({ score: state.score, star: game.star ? { ...game.star } : null, activeBalls: game.balls.length, slots: state.slots, pins: game.pins.length, theme: state.theme, auto: state.auto, charging: state.charging, charge: state.charge, stats: structuredClone(game.stats), rewards: structuredClone(game.rewards), centerRadius: game.bumpers[2].plugin.radius, canonNotes: canon.count, currentNote: currentNote?.name, positions: game.balls.map(b => ({ ...b.body.position, entered: b.entered, power: b.power, bonus: b.bonus, scoreFactor: b.scoreFactor })), audioState: audio?.state }) });
