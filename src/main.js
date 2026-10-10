import { createTable, STEP } from './physics.js';
import { createRenderer } from './renderer.js';
import { createCanon } from './canon.js';
import { SLOT_SYMBOLS, slotBonusLabel } from './slot-machine.js';
import { createTimePalette, collectTimeTokens, applyTimePalette, TIME_PHASES, TIME_CYCLE } from './time-flow.js';
import { createBackgroundMusic } from './music.js';
import { chargeAt, chargePercent, overchargeAt, chargeEffectsAt, CHARGE_DURATION, OVERCHARGE_DURATION, BURST_READY_AT } from './charge.js';
import { randomMiniGame } from './mini-games.js';
import { createMiniGamesUI, miniGameMarkup } from './mini-games-ui.js';
import { sceneMotionAt } from './scene-motion.js';
import { celebrateReward, advanceCelebrations } from './reward-effects.js';
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
  animal: { label: '动物', name: '小动物的游乐园', description: '和毛茸茸的朋友，接住好运气', emoji: '🐰', motifs: ['🐰','🐻','🐱'], bg: '#fbf3e9', pin: '#b2c3a1', accent: '#e994a4', colors: ['#e6ecca','#f8dfb1','#efc2cb','#d5e6d3','#f6dba7','#efc2cb','#e6ecca'] },
  dessert: { label: '甜品', name: '甜甜的白日梦', description: '每一次落下，都有一点点甜', emoji: '🍰', motifs: ['🍰','🍩','🍬'], bg: '#fff0ef', pin: '#d6b3c9', accent: '#d980ae', colors: ['#f6d7d8','#e6d5f2','#f8dfb1','#d6eae2','#f8dfb1','#e6d5f2','#f6d7d8'] },
  flower: { label: '花朵', name: '花园里的小确幸', description: '让快乐发芽，让心情开一朵花', emoji: '🌷', motifs: ['🌷','🌼','🌸'], bg: '#f4f6e9', pin: '#a5be9d', accent: '#d49ca7', colors: ['#d9e9c7','#f6e4b2','#efcbd5','#cadfd2','#f6e4b2','#efcbd5','#d9e9c7'] },
};
let saved = {};
try { saved = JSON.parse(localStorage.getItem('ponpon-settings') || '{}'); } catch {}
const state = {
  theme: themes[saved.theme] ? saved.theme : 'animal', slots: [5,7,9].includes(saved.slots) ? saved.slots : 7,
  sound: saved.sound !== false, volume: Number.isFinite(saved.volume) ? Math.max(0,Math.min(1,saved.volume)) : .55,
  music: saved.music !== false, musicVolume: Number.isFinite(saved.musicVolume) ? Math.max(0,Math.min(1,saved.musicVolume)) : .35,
  timeFlow: saved.timeFlow === true, timeFlowStartedAt: Number.isFinite(saved.timeFlowStartedAt) && saved.timeFlowStartedAt > 0 ? saved.timeFlowStartedAt : Date.now(),
  calm: saved.calm ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
  render3D: saved.render3D === true, secretPending: false, gm: false,
  score: 0, balls: 0, best: Number.isFinite(saved.best) ? Math.max(0,saved.best) : 0, power: 65, auto: false, charging: false, charge: 0, chargeElapsed: 0,
};
const persist = () => { try { localStorage.setItem('ponpon-settings', JSON.stringify({theme:state.theme,render3D:state.render3D,slots:state.slots,sound:state.sound,volume:state.volume,music:state.music,musicVolume:state.musicVolume,timeFlow:state.timeFlow,timeFlowStartedAt:state.timeFlowStartedAt,calm:state.calm,best:state.best})); } catch {} };
const mascot = `<svg class="mascot" viewBox="0 0 130 135" fill="none" aria-hidden="true"><ellipse cx="46" cy="32" rx="14" ry="30" transform="rotate(-14 46 32)" fill="var(--flow-surface-fffaf0,#fffaf0)" stroke="var(--flow-line-d9cdbb,#d9cdbb)" stroke-width="2"/><ellipse cx="84" cy="32" rx="14" ry="30" transform="rotate(14 84 32)" fill="var(--flow-surface-fffaf0,#fffaf0)" stroke="var(--flow-line-d9cdbb,#d9cdbb)" stroke-width="2"/><ellipse cx="45" cy="29" rx="6" ry="18" transform="rotate(-14 45 29)" fill="var(--flow-object-efc4cb,#efc4cb)"/><ellipse cx="85" cy="29" rx="6" ry="18" transform="rotate(14 85 29)" fill="var(--flow-object-efc4cb,#efc4cb)"/><path d="M19 83C19 53 39 43 65 43S111 53 111 83C111 111 92 127 65 127S19 111 19 83Z" fill="var(--flow-surface-fffaf0,#fffaf0)" stroke="var(--flow-line-d9cdbb,#d9cdbb)" stroke-width="2"/><ellipse cx="37" cy="91" rx="10" ry="6" fill="var(--flow-object-f0bdc6,#f0bdc6)"/><ellipse cx="93" cy="91" rx="10" ry="6" fill="var(--flow-object-f0bdc6,#f0bdc6)"/><ellipse cx="48" cy="80" rx="3" ry="4" fill="var(--flow-ink-435444,#435444)"/><ellipse cx="82" cy="80" rx="3" ry="4" fill="var(--flow-ink-435444,#435444)"/><path d="m62 90 3 3 3-3m-3 3v4m-6-1q3 5 6 1 3 4 6-1" stroke="var(--flow-line-705d50,#705d50)" stroke-width="2" stroke-linecap="round"/><path d="M102 110c-9-6-24 3-23 11 13 3 21-1 23-11Z" fill="var(--flow-object-a6b88b,#a6b88b)"/><path d="M79 121c-1-17-9-22-14-19-4 12 5 19 14 19Z" fill="var(--flow-object-bfcd9d,#bfcd9d)"/></svg>`;

document.querySelector('#app').innerHTML = `
<div class="shell">
  <header><div class="brand"><div class="brand-mark"><svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="var(--flow-surface-fff9e9,#fff9e9)"/><circle cx="15" cy="18" r="1.5" fill="var(--flow-ink-435444,#435444)"/><circle cx="25" cy="18" r="1.5" fill="var(--flow-ink-435444,#435444)"/><path d="M16 24q4 4 8 0" fill="none" stroke="var(--flow-line-435444,#435444)" stroke-width="1.5" stroke-linecap="round"/></svg></div><div class="brand-copy"><div class="brand-name">PON <span>PON</span><span style="font-size:13px;color:var(--flow-ink-89957a,#89957a)"> ✳</span></div><div class="brand-caption">A LITTLE JOY MACHINE</div></div><h1 class="mobile-title">弹一点，小快乐</h1></div><div class="header-actions"><span class="quiet-tag">TAKE A BREAK. MAKE A PON.</span><button class="icon-button" id="sound-button" aria-label="关闭声音"></button><button class="settings-button" id="settings-button" aria-label="游乐场设置">${icon('settings')}<span>游乐场设置</span></button></div></header>
  <section class="intro"><div><div class="eyebrow">YOUR DAILY DOSE OF HAPPY</div><h1>弹一点，小快乐<em>✧</em></h1><p>蓄一点力，弹进一场奇妙的小冒险。</p></div><div class="intro-sticker">100% 快乐<br>0% 压力</div></section>
  <main class="game-layout">
    <section class="machine" aria-label="柏青哥游戏区"><div class="mobile-hud"><span>快乐积分 <strong id="mobile-score">0</strong></span><span id="shot-state">右下角 · 弹珠就位</span><span class="bonus-label">秘密洞 <b id="hole-points">+500</b></span></div><div class="machine-top"><span class="machine-label"><i class="status-dot"></i> <span id="machine-caption">THE HAPPY LITTLE PACHINKO</span></span><span class="tiny-dots">● ● ●</span></div><div class="board-wrap"><canvas id="board" tabindex="0" width="760" height="900" aria-describedby="slot-status" aria-label="${state.render3D ? '3D' : '2D'} 球台；弹珠从右下角沿轨道发射；长按下方按钮或右侧弹簧蓄力，${CHARGE_DURATION/1000}秒满蓄力，再按${OVERCHARGE_DURATION/1000}秒松手五球连发。右侧秘密洞奖励500分，左侧三角平台随机换向；左下蓄球罐存满20颗，从顶部均匀随机落下40颗；每进洞50次自动转动三格老虎机，两格相同全场3分钟双倍，三格相同全场1分钟五倍。"></canvas><span id="slot-status" class="sr-only" role="status">老虎机：进洞 0/50；两格相同全场 ×2 三分钟，三格相同全场 ×5 一分钟。</span><button class="plunger-hit" id="plunger" aria-label="长按右侧弹簧${CHARGE_DURATION/1000}秒满蓄力，再按${OVERCHARGE_DURATION/1000}秒松手五球连发"></button></div><div class="launch-control"><div class="compact-tools"><button class="icon-button" id="compact-sound" aria-label="关闭声音"></button><button class="settings-button" id="compact-settings" aria-label="游乐场设置">${icon('settings')}<span>设置</span></button></div><div class="launch-row"><div class="launch-mode"><button class="launch-button" id="launch">${icon('arrow')} <span id="launch-label">按住蓄力 · 松开发射</span><kbd>SPACE</kbd></button><label class="power-row" id="auto-power" for="power" hidden><span>弹射力度</span><output id="power-value" for="power">65%</output><input type="range" min="1" max="100" value="65" id="power" aria-label="自动弹射力度"/></label></div></div><p class="machine-foot">蓄力 ${CHARGE_DURATION/1000} 秒满 · 再按 ${OVERCHARGE_DURATION/1000} 秒五球连发 · 拾星本球加倍 · 蓄满 20 颗落 40 颗</p></div><div class="reward-dashboard" aria-label="反弹点惊喜进度"><div><span>左鼓 · 随机赠球 <b id="reward-0">0/10</b></span><progress id="reward-progress-0" max="10" value="0" aria-label="左侧反弹点命中次数"></progress><small>满 10 次送一颗</small></div><div><span>中央 · 时钟爆发 <b id="reward-2">0/30</b></span><progress id="reward-progress-2" max="30" value="0" aria-label="中央反弹点命中次数"></progress><small>1 秒发射 12 颗</small></div><div><span>右鼓 · 中央变大 <b id="reward-1">0/10</b></span><progress id="reward-progress-1" max="10" value="0" aria-label="右侧反弹点命中次数"></progress><small id="reward-timer">持续 10 秒</small></div></div></section>
    <aside class="sidebar"><section class="card score-card"><div class="card-label">今日份快乐 <span class="small-label">HAPPY POINTS</span></div><div class="score-value"><span id="score">0</span><span class="score-unit">分</span></div><div class="score-divider"></div><div class="score-stats"><span>已投小球 &nbsp;<strong id="ball-count">0</strong></span><span>最高纪录 &nbsp;<strong id="best">0</strong></span></div></section><section class="card how-card"><div class="card-label">快乐使用说明 <span>↗</span></div><ol><li><span class="step-no">01</span>力度决定高度，回流口重返球场</li><li><span class="step-no">02</span>左右鼓满 10 次，赠球或放大中央</li><li><span class="step-no">03</span>中央满 30 次，十二时钟大爆发</li><li><span class="step-no">04</span>蓄球罐存满 20 颗，顶部落下 40 颗</li><li><span class="step-no">05</span>进洞满 50 次转好运，两同 ×2，三同 ×5</li></ol></section><div class="little-note">✿ &nbsp; 不用赶路，弹一会儿也很好</div></aside>
  </main><div class="bottom-info"><span>✧ &nbsp; 真实物理碰撞 · 无限次小快乐</span><span class="sound-indicator"><span class="sound-bars"><i></i><i></i><i></i></span><span id="sound-status">声音已开启，快乐有回响</span></span></div><footer class="footer"><span>PON PON · YOUR POCKET-SIZED HAPPY PLACE</span><span>MADE WITH <b>♡</b> & A LITTLE BOUNCE</span></footer>
</div><div class="toast" id="toast" role="status"></div>
<dialog id="settings"><div class="dialog-inner"><div class="dialog-head"><button id="gm-dot" class="gm-dot" type="button" aria-label="边框装饰" aria-pressed="false"><span></span></button><h2>布置你的游乐场</h2><button class="icon-button" id="close-settings" aria-label="关闭设置">${icon('close')}</button></div><p class="dialog-sub">换一种心情，再接住一颗小快乐。</p><div id="gm-tools" class="gm-tools" hidden><span>GM · 小游戏试玩</span><div><button type="button" data-mini="pairs">对对碰</button><button type="button" data-mini="blocks">消消乐</button><button type="button" data-mini="moles">打地鼠</button></div></div><label class="setting-row auto-setting" for="auto"><span>自动弹射<small>关闭设置后连续发射，力度在球台下方调整</small></span><input id="auto" type="checkbox" role="switch" /></label><div class="setting-label">落袋槽位<small>越多槽位，越多惊喜</small></div><div class="choices">${[5,7,9].map(n=>`<button class="choice" data-slots="${n}">${n} 个槽位</button>`).join('')}</div><div class="setting-label">游乐场主题</div><div class="settings-theme"><div class="theme-preview"><div id="mascot">${mascot}</div></div><div><div class="theme-name" id="theme-name"></div><div class="theme-description" id="theme-description"></div></div></div><div class="choices">${Object.entries(themes).map(([key,t])=>`<button class="choice theme-choice" data-theme="${key}"><span>${t.emoji}</span>${t.label}主题</button>`).join('')}</div><label class="setting-row mode-setting" for="three-d"><span>3D 模式<small>关闭使用 2D 画面，开启使用立体球台</small></span><input id="three-d" type="checkbox" role="switch" ${state.render3D?'checked':''}/></label><label class="setting-row time-setting" for="time-flow"><span>时间流逝模式<small>白天 4 分钟 → 黄昏 1 分钟 → 夜间 4 分钟 → 清晨 1 分钟</small></span><input id="time-flow" type="checkbox" role="switch" ${state.timeFlow?'checked':''}/></label><div id="time-cycle-info" class="time-cycle-info" ${state.timeFlow?'':'hidden'}><div class="time-cycle-head"><strong id="time-phase">白天</strong><span id="time-phase-clock"></span></div><progress id="time-cycle-progress" max="${TIME_CYCLE}" value="0" aria-label="十分钟昼夜循环进度"></progress></div><label class="setting-row music-setting" for="music"><span>律动背景音乐<small>120 BPM · 轻快入场，随后律动循环</small></span><input id="music" type="checkbox" role="switch" ${state.music?'checked':''}/></label><label class="setting-row" for="music-volume">音乐音量<input id="music-volume" type="range" min="0" max="100" value="${state.musicVolume*100}" /></label><label class="setting-row" for="volume">音效音量<input id="volume" type="range" min="0" max="100" value="${state.volume*100}" /></label><label class="setting-row" for="calm">轻柔模式（减少装饰动效）<input id="calm" type="checkbox" ${state.calm?'checked':''}/></label><button class="done-button" id="done-settings">好啦，继续快乐</button><p class="setting-note">设置自动保存。调整槽位会清空在途小球，保留得分。</p></div></dialog>${miniGameMarkup}`;

const $ = (s) => document.querySelector(s);
const timeTokens = collectTimeTokens(document);
let timePalette = null, lastTimePaint = -Infinity;
function updateTimeFlow(now = performance.now(), force = false) {
  if (!force && now - lastTimePaint < 250) return;
  if (!state.timeFlow && !timePalette && !force) return;
  lastTimePaint = now;
  timePalette = state.timeFlow ? createTimePalette(Date.now() - state.timeFlowStartedAt) : null;
  applyTimePalette(document.documentElement, timeTokens, timePalette);
  $('#time-cycle-info').hidden = !state.timeFlow;
  const theme = themes[state.theme];
  document.documentElement.style.setProperty('--accent', timePalette?.color(theme.accent) ?? theme.accent);
  $('.board-wrap').style.background = timePalette?.color(theme.bg, 'surface') ?? theme.bg;
  if (timePalette) {
    const phase = timePalette.phase, seconds = Math.ceil(phase.remaining / 1000);
    $('#time-phase').textContent = phase.label;
    $('#time-phase-clock').textContent = `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')} 后进入${TIME_PHASES[(phase.index+1)%4].label}`;
    $('#time-cycle-progress').value = phase.position;
    $('#time-cycle-progress').setAttribute('aria-valuetext', `${phase.label}，${Math.ceil(phase.position/1000)} / ${TIME_CYCLE/1000} 秒`);
  }
}
// Cancel selection/callouts within the game without blocking page scrolling,
// pinch zoom, range dragging, focus or keyboard controls.
for (const type of ['selectstart', 'dragstart', 'contextmenu']) $('#app').addEventListener(type, event => event.preventDefault());
const canon = createCanon();
let currentNote = null;
let toastTimer;
function toast(message, duration = 2200) { $('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),duration); }

// All sounds are synthesized locally: no downloads, no autoplay and no audio assets.
let audio, master, backgroundMusic;
const voices = [];
function unlockAudio(){
  if(!state.sound) return;
  if(!audio){ const Audio = window.AudioContext || window.webkitAudioContext; if(!Audio) return; audio=new Audio();master=audio.createGain();master.gain.value=state.volume*.32;master.connect(audio.destination);backgroundMusic=createBackgroundMusic(audio); }
  if(audio.state==='suspended' && !document.hidden) audio.resume().catch(()=>{});
  backgroundMusic.setEnabled(state.sound && state.music, state.musicVolume);
}
// Browser autoplay policy: prepare music only after a real pointer/key gesture.
$('#app').addEventListener('pointerdown', unlockAudio);
document.addEventListener('keydown', event => { if (!event.repeat && ['Space','Enter'].includes(event.code)) unlockAudio(); });
function syncAudioVisibility() {
  if (!audio) return;
  if (document.hidden) audio.suspend().catch(()=>{});
  else if (state.sound) audio.resume().catch(()=>{});
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
  if(kind==='theme'){tone(660,.12,'sine');tone(880,.16,'sine',.075);}
  if(kind==='star'){[880,1175,1568].forEach((n,i)=>tone(n,.24,'sine',i*.055,.22));}
}

const fx = { celebrations: [], particles: [], ripples: [], popups: [], slotGlows: Array(state.slots).fill(0), shake: 0 };
const game = createTable({ slots: state.slots, onHit: hit => {
  playCanon(hit);
  if (!state.calm) fx.ripples.push({ ...hit, life: 1, color: themes[state.theme].accent });
}, onScore: award, onReturn: () => toast('弹珠已回收，再试试另一种力度吧'), onSurprise: surprise });
const renderer = createRenderer($('#board'));
let frame = 0, last = 0, accumulator = 0, lastDrop = -1000, lastAuto = 0;
let chargeStart = 0, chargeSource = null;
const miniGames = createMiniGamesUI({ root: $('#mini-game'), onFinish: result => addScore(result.score),
  onPoints: () => tone(784,.12,'sine',0,.12), onExit: source => {
    if (source === 'secret') { state.secretPending = false; game.setEmissionPaused(false); }
    last = 0; accumulator = 0; lastAuto = performance.now(); syncLaunchControls();
    if (source === 'gm') $('#settings').showModal();
  },
});
let gmClicks = 0;
$('#gm-dot').addEventListener('click', () => {
  if (++gmClicks < 3) return;
  gmClicks = 0; state.gm = !state.gm;
  $('#gm-dot').classList.toggle('enabled',state.gm);$('#gm-dot').setAttribute('aria-pressed',String(state.gm));$('#gm-tools').hidden = !state.gm;
  toast(state.gm ? 'GM 模式已开启' : 'GM 模式已关闭');
});
document.querySelectorAll('[data-mini]').forEach(button => button.addEventListener('click', () => {
  if (!state.gm || miniGames.open) return;
  endCharge(false);$('#settings').close();miniGames.start(button.dataset.mini,'gm');syncLaunchControls();
}));
function syncLaunchControls() {
  const locked = state.secretPending || miniGames.open;
  $('#launch').disabled = locked;$('#plunger').disabled = locked;$('#power').disabled = locked;
  $('#launch').hidden = state.auto && !locked;$('#auto-power').hidden = !state.auto || locked;
  if (locked) {
    $('#launch-label').textContent = state.secretPending ? '等待“秘密出现”' : '小游戏进行中';
    $('#shot-state').textContent = state.secretPending ? '等待弹珠结算 · 秘密即将出现' : '秘密小游戏时间';
  } else if (!state.charging) $('#launch-label').textContent = '按住蓄力 · 松开发射';
}
function waitForSecret() {
  if (state.secretPending || miniGames.open) return;
  state.secretPending = true;game.setEmissionPaused(true);endCharge(false);syncLaunchControls();
}


function surprise(event) {
  if (event.kind === 'emit' && event.source === 'charged') {
    state.balls++; $('#ball-count').textContent = state.balls;
    sound('launch');
  }
  if (event.kind.startsWith('slot-')) {
    if (event.kind === 'slot-start') {
      toast('✧ 进洞满 50 次，转一份好运！');
      $('#slot-status').textContent = '进洞满 50 次，老虎机正在转动。';
      tone(440, .18, 'sine', 0, .12);
    }
    if (event.kind === 'slot-reel') tone([523, 659, 784][event.reel], .16, 'sine', 0, .12);
    if (event.kind === 'slot-result') {
      const symbols = event.reels.map(i => SLOT_SYMBOLS[i]).join(' ');
      const message = event.multiplier > 1 ? `${symbols} · 全场进洞 ×${event.multiplier}，持续 ${event.duration / 60000} 分钟` : `${symbols} · 下次好运继续！`;
      toast(message); $('#slot-status').textContent = message;
      if (event.multiplier > 1) {
        const profile = celebrateReward(fx, { kind: 'slot-machine', multiplier: event.multiplier, x: event.x, y: event.y }, state.calm);
        rewardSound(profile);
      }
    }
    return;
  }
  const names = { clock: '✦ 30 次碰撞！十二时钟爆发', random: '✧ 左鼓满 10 次，送一颗弹珠', enlarge: '✿ 右鼓满 10 次，中央放大 10 秒', redirect: '↙ 回流出口，再冒险一次' };
  if (names[event.kind]) toast(names[event.kind]);
  if (event.kind === 'store') {
    tone(440 + event.count * 12, .12, 'sine', 0, .15);
    fx.popups.push({ x: event.x, y: event.y - 22, text: `存入 ${event.count}/${event.capacity}`, life: 1, color: '#9279aa', size: 14 });
  }
  if (event.kind === 'storage-burst') {
    toast(`✦ 蓄满 20 颗！顶部落下 ${event.amount} 颗弹珠`);
    [523, 659, 784, 1047].forEach((note, i) => tone(note, .3, 'sine', i * .08, .2));
  }
  fx.ripples.push({ x: event.x, y: event.y, life: 1, big: event.kind === 'clock' || event.kind === 'enlarge', color: event.kind === 'redirect' ? '#92b68d' : event.multiplier === 5 ? '#b58ae0' : '#e6b44f' });
  if (event.kind === 'clock') {
    const profile = celebrateReward(fx, event, state.calm);
    rewardSound(profile);
  }
  if (event.kind === 'emit' && event.source === 'clock') {
    // Each of the twelve physical shots gets its own directional flourish.
    const x = event.x + Math.cos(event.angle) * 76, y = event.y + Math.sin(event.angle) * 76;
    if (!state.calm) fx.ripples.push({ x, y, life: 1, color: '#e2ae48', radius: 48, width: 3 });
    tone(587 * 2 ** (event.ordinal / 12), .22, 'sine', 0, .17);
  }
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

function addScore(points) {
  state.score += points; state.best = Math.max(state.best, state.score); persist();
  $('#score').textContent = state.score.toLocaleString(); $('#mobile-score').textContent = state.score.toLocaleString(); $('#best').textContent = state.best.toLocaleString();
  $('.score-value').classList.remove('score-bump'); void $('.score-value').offsetWidth; $('.score-value').classList.add('score-bump');
}
function award(result) {
  addScore(result.points);
  const jackpot = result.kind === 'jackpot', profile = celebrateReward(fx, result, state.calm);
  if (!jackpot) fx.slotGlows[result.column] = 1;
  const title = jackpot ? '✦ 秘密洞！ ' : profile.tier >= 3 ? `${profile.name} · ` : '';
  fx.popups.push({ x: result.x, y: result.y - 45, text: `${title}+${result.points}${result.scoreFactor > 1 ? ` · 星星 ×${result.scoreFactor}` : ''}${result.globalMultiplier > 1 ? ` · 全场 ×${result.globalMultiplier}` : ''}`,
    life: 1, decay: jackpot ? 1000 / (60 * profile.duration) : .012, rise: jackpot ? .2 : .6, big: profile.tier >= 4, color: profile.color, size: 19 + profile.tier * 2 });
  if (jackpot) { toast(`✦ 发现秘密洞！收下 ${result.points} 分，等待秘密出现`, profile.duration); waitForSecret(); }
  rewardSound(profile);
}
function rewardSound(profile) {
  // Richer rewards add more notes and harmony, without escalating volume.
  const clock = profile.tier === 6;
  profile.notes.forEach((note, i) => tone(note, clock ? .5 : .18 + profile.tier * .035,
    profile.tier === 2 ? 'triangle' : 'sine', i * (clock ? .08 : .065), .2));
  if (profile.tier >= 4) [147, 220, 294].forEach(n => tone(n, clock ? 1.1 : .6, 'sine', 0, .08));
}

function launch(power = state.auto ? state.power / 100 : 0, burst = false) {
  if ($('#settings').open || miniGames.open || state.secretPending || document.hidden) return;
  unlockAudio();
  const now = performance.now(); if (now - lastDrop < 250) return;
  const ball = burst ? game.launchBurst() : game.launch(power);
  if (!ball) { if (!state.auto) toast('发射轨道准备中，稍等一下'); return; }
  lastDrop = now;
  if (!burst) { state.balls++; $('#ball-count').textContent = state.balls; sound('launch'); }
  $('#shot-state').textContent = burst ? '✦ 彩虹蓄满！五球连发！' : '↗ 弹射出发！';
}
function setRenderMode(enabled, save = false) {
  endCharge(false);
  state.render3D = renderer.setMode(enabled) === 'webgl';
  $('#three-d').checked = state.render3D;
  $('#board').setAttribute('aria-label', $('#board').getAttribute('aria-label').replace(/^[23]D 球台/, `${state.render3D ? '3D' : '2D'} 球台`));
  if (enabled && !state.render3D) {
    $('#three-d').disabled = true;
    $('.mode-setting small').textContent = '当前设备暂不支持 3D，继续使用 2D 画面';
    toast('当前设备暂不支持 3D，已使用 2D 画面');
  }
  if (save) persist();
}
$('#three-d').addEventListener('change', event => setRenderMode(event.target.checked, true));
setRenderMode(state.render3D);
function setAuto(enabled) {
  state.auto = enabled; syncLaunchControls(); $('#power-value').textContent = `${state.power}%`; $('#auto').checked = enabled;
}
function beginCharge(source) {
  if (state.charging || $('#settings').open || miniGames.open || state.secretPending || document.hidden) return false;
  unlockAudio(); setAuto(false); state.charging = true; chargeSource = source; chargeStart = performance.now(); state.charge = 0; state.chargeElapsed = 0;
  $('#launch').style.setProperty('--charge', '0%'); $('#launch-label').textContent = '蓄力 0% · 松开发射';
  $('#launch').classList.add('charging'); return true;
}
function endCharge(fire = true) {
  if (!state.charging) return;
  const elapsed = performance.now() - chargeStart, power = chargeAt(elapsed), burst = overchargeAt(elapsed) === 1;
  state.charging = false; state.charge = 0; state.chargeElapsed = 0;
  $('.game-layout').style.removeProperty('transform'); $('#shot-state').textContent = '右下角 · 弹珠就位';
  chargeSource = null; $('#launch').classList.remove('charging');
  $('#launch').style.setProperty('--charge', '0%'); $('#launch-label').textContent = '按住蓄力 · 松开发射'; $('#power-value').textContent = `${state.power}%`;
  syncLaunchControls();
  if (fire) launch(power, burst);
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
  if (event.code === 'Space' && !$('#settings').open && !miniGames.open && !state.secretPending && (launchFocused || !['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(tag))) {
    event.preventDefault(); if (!event.repeat) beginCharge('keyboard');
  }
});
document.addEventListener('keyup', event => { if (event.code === 'Space' && chargeSource === 'keyboard') { event.preventDefault(); endCharge(); } });
window.addEventListener('blur', () => endCharge(false));
document.addEventListener('visibilitychange', () => { last = 0; accumulator = 0; if (document.hidden) endCharge(false); syncAudioVisibility(); });
$('#auto').addEventListener('change', event => { endCharge(false); unlockAudio(); setAuto(event.target.checked); lastAuto = performance.now(); });
$('#power').addEventListener('input', event => { state.power = +event.target.value; $('#power-value').textContent = `${state.power}%`; });

function updateEffects(dt) {
  const factor = dt / (1000 / 60);
  advanceCelebrations(fx, dt, state.calm);
  fx.shake = Math.max(0, fx.shake - .18 * factor);
  for (let i = 0; i < fx.slotGlows.length; i++) fx.slotGlows[i] = Math.max(0, fx.slotGlows[i] - .015 * factor);
  for (let i = fx.ripples.length - 1; i >= 0; i--) { fx.ripples[i].life -= (fx.ripples[i].decay ?? .032) * factor; if (fx.ripples[i].life <= 0) fx.ripples.splice(i, 1); }
  for (let i = fx.particles.length - 1; i >= 0; i--) { const p = fx.particles[i]; p.x += p.vx * factor; p.y += p.vy * factor; p.vy += (p.gravity ?? .19) * factor; p.vx *= .99 ** factor; p.rotation += .07 * factor; p.life -= (p.decay ?? .016) * factor; if (p.life <= 0) fx.particles.splice(i, 1); }
  for (let i = fx.popups.length - 1; i >= 0; i--) { fx.popups[i].y -= (fx.popups[i].rise ?? .6) * factor; fx.popups[i].life -= (fx.popups[i].decay ?? .012) * factor; if (fx.popups[i].life <= 0) fx.popups.splice(i, 1); }
}
function tick(now) {
  updateTimeFlow(now);
  miniGames.update(now);
  const delta = last ? Math.min(now - last, 50) : 0; last = now;
  if (!document.hidden && !$('#settings').open && !miniGames.open) {
    accumulator += delta;
    while (accumulator >= STEP) { game.step(); updateEffects(STEP); accumulator -= STEP; }
    for (let i = 0; i < 3; i++) {
      const count = game.rewards.hits[i] % game.rewards.goals[i];
      $(`#reward-${i}`).textContent = `${count}/${game.rewards.goals[i]}`;
      $(`#reward-progress-${i}`).value = count;
    }
    const globalBonus = slotBonusLabel(game.slotMachine, game.clock);
    $('#machine-caption').textContent = globalBonus ? `全场${globalBonus}` : 'THE HAPPY LITTLE PACHINKO';
    $('#hole-points').textContent = `+${500 * game.slotMachine.multiplier}`;
    $('#reward-timer').textContent = game.rewards.enlargedUntil > game.clock ? `放大中 ${(Math.max(0, game.rewards.enlargedUntil - game.clock) / 1000).toFixed(1)}s` : '持续 10 秒';
    if (state.charging) {
      state.chargeElapsed = now - chargeStart; state.charge = chargeAt(state.chargeElapsed);
      const overcharge = overchargeAt(state.chargeElapsed);
      const percent = chargePercent(state.charge);
      $('#launch').style.setProperty('--charge', `${percent}%`);
      $('#launch-label').textContent = overcharge === 1 ? '蓄力 100% · 松手五球连发' : `蓄力 ${percent}% · 松开发射`;
      $('#shot-state').textContent = overcharge === 1 ? '✦ 五球连发已就绪！' : percent === 100 ? `✧ 彩虹蓄力 · 再按 ${((BURST_READY_AT - state.chargeElapsed) / 1000).toFixed(1)}s 五球连发` : '弹簧蓄力中…';
    } else if (!state.secretPending && now - lastDrop > 1700) $('#shot-state').textContent = game.balls.length ? `${game.balls.length} 颗小快乐在冒险` : '右下角 · 弹珠就位';
    if (state.auto && !state.secretPending && now - lastAuto > 1100) { launch(); lastAuto = now; }
  }
  if (state.secretPending && !game.balls.length && !miniGames.open && !$('#settings').open && !document.hidden) { miniGames.start(randomMiniGame()); syncLaunchControls(); }
  if (miniGames.open) { $('.game-layout').style.removeProperty('transform'); frame = requestAnimationFrame(tick); return; }
  const motion = sceneMotionAt(game.clock, state, fx);
  if (motion.intensity) $('.game-layout').style.transform = `translate(${motion.uiX.toFixed(2)}px, ${motion.uiY.toFixed(2)}px)`;
  else $('.game-layout').style.removeProperty('transform');
  renderer.draw(game, themes[state.theme], state, fx, timePalette);
  const hitPoints = [[686,724],[741,724],[741,884],[686,884]].map(([x,y]) => renderer.project(x,y,12));
  const left = Math.min(...hitPoints.map(p=>p.x)), right = Math.max(...hitPoints.map(p=>p.x));
  const top = Math.max(0, Math.min(...hitPoints.map(p=>p.y))), bottom = Math.min(1, Math.max(...hitPoints.map(p=>p.y)));
  const plunger = $('#plunger');
  const hitWidth = Math.min(1, Math.max(right-left, 44 / ($('#board').clientWidth || 760)));
  plunger.style.left = `${Math.max(0, Math.min(left, 1-hitWidth)) * 100}%`; plunger.style.top = `${top * 100}%`;
  plunger.style.width = `${hitWidth * 100}%`; plunger.style.height = `${(bottom-top) * 100}%`;
  plunger.style.right = 'auto'; plunger.style.bottom = 'auto';
  frame = requestAnimationFrame(tick);
}
function updateTheme() {
  const theme = themes[state.theme]; $('#theme-name').textContent = theme.name; $('#theme-description').textContent = theme.description;
  $('#mascot').innerHTML = state.theme === 'animal' ? mascot : `<div class="mascot theme-emoji">${theme.emoji}</div>`;
  updateTimeFlow(performance.now(), true);
  document.querySelectorAll('[data-theme]').forEach(b => { b.classList.toggle('selected', b.dataset.theme === state.theme); b.setAttribute('aria-pressed', String(b.dataset.theme === state.theme)); });
  document.querySelectorAll('[data-slots]').forEach(b => { b.classList.toggle('selected', +b.dataset.slots === state.slots); b.setAttribute('aria-pressed', String(+b.dataset.slots === state.slots)); });
}
function updateSound() {
  $('#sound-button').innerHTML = icon(state.sound ? 'sound' : 'muted'); $('#sound-button').setAttribute('aria-label', state.sound ? '关闭声音' : '开启声音'); $('#sound-button').setAttribute('aria-pressed', String(state.sound));
  $('#sound-status').textContent = state.sound ? (state.music ? '♪ 律动配乐 · 碰撞弹奏《卡农》' : '♪ 碰撞弹奏《卡农》') : '静音时光，也很美好'; $('.sound-bars').classList.toggle('muted', !state.sound);
  $('#compact-sound').innerHTML = $('#sound-button').innerHTML; $('#compact-sound').setAttribute('aria-label', $('#sound-button').getAttribute('aria-label')); $('#compact-sound').setAttribute('aria-pressed', String(state.sound));
  backgroundMusic?.setEnabled(state.sound && state.music, state.musicVolume);
  if (master) master.gain.setTargetAtTime(state.sound ? state.volume * .32 : 0, audio.currentTime, .03);
}
function updateCalm() { document.documentElement.classList.toggle('calm', state.calm); document.querySelectorAll('.mascot,.mascot-spark,.sound-bars i').forEach(el => el.style.animationPlayState = state.calm ? 'paused' : 'running'); }
$('#compact-sound').addEventListener('click', () => $('#sound-button').click());
$('#compact-settings').addEventListener('click', () => $('#settings-button').click());
$('#sound-button').addEventListener('click', () => { state.sound = !state.sound; unlockAudio(); updateSound(); persist(); if (state.sound) sound('theme'); });
$('#settings-button').addEventListener('click', () => { if (miniGames.open) return; endCharge(false); $('#settings').showModal(); });
$('#close-settings').addEventListener('click', () => $('#settings').close()); $('#done-settings').addEventListener('click', () => $('#settings').close());
$('#settings').addEventListener('click', event => { if (event.target === $('#settings')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
document.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => { state.theme = b.dataset.theme; updateTheme(); updateCalm(); persist(); unlockAudio(); sound('theme'); }));
document.querySelectorAll('[data-slots]').forEach(b => b.addEventListener('click', () => { if (state.slots === +b.dataset.slots) return; state.slots = +b.dataset.slots; game.setSlots(state.slots); fx.slotGlows = Array(state.slots).fill(0); updateTheme(); persist(); }));
$('#volume').addEventListener('input', event => { state.volume = +event.target.value / 100; if (state.volume > 0) state.sound = true; unlockAudio(); updateSound(); persist(); });
$('#volume').addEventListener('change', () => sound('theme'));
$('#music').addEventListener('change', event => { state.music = event.target.checked; unlockAudio(); updateSound(); persist(); });
$('#music-volume').addEventListener('input', event => { state.musicVolume = +event.target.value / 100; unlockAudio(); updateSound(); persist(); });
$('#time-flow').addEventListener('change', event => { state.timeFlow = event.target.checked; if (state.timeFlow) state.timeFlowStartedAt = Date.now(); updateTimeFlow(performance.now(), true); persist(); });
$('#calm').addEventListener('change', event => { state.calm = event.target.checked; updateCalm(); persist(); });
$('#best').textContent = state.best.toLocaleString(); updateTheme(); updateSound(); updateCalm();
frame = requestAnimationFrame(tick);
window.addEventListener('pagehide', () => { endCharge(false); cancelAnimationFrame(frame); frame = 0; audio?.suspend().catch(()=>{}); });
window.addEventListener('pageshow', () => { if (!frame) { last = 0; accumulator = 0; frame = requestAnimationFrame(tick); } syncAudioVisibility(); });
if (import.meta.env.DEV) Object.defineProperty(window, '__ponpon', { get: () => ({ score: state.score, secretPending: state.secretPending, emissionPaused: game.emissionPaused, gm: state.gm, miniGame: miniGames.snapshot(), render3D: state.render3D, rendering: renderer.snapshot(), star: game.star ? { ...game.star } : null, activeBalls: game.balls.length, slots: state.slots, pins: game.pins.length, theme: state.theme, auto: state.auto, charging: state.charging, charge: state.charge, chargeEffects: state.charging ? chargeEffectsAt(state.chargeElapsed) : null, pendingLaunches: game.pendingLaunches, stats: structuredClone(game.stats), rewards: structuredClone(game.rewards), collector: { count: game.collector.stored.length, capacity: game.collector.capacity, remaining: game.collector.remaining, outlets: game.collector.outlets.map(p => ({ ...p })) }, bumpers: game.bumpers.map(b => ({ ...b.position })), timeFlow: { enabled: state.timeFlow, startedAt: state.timeFlowStartedAt, phase: timePalette?.phase.id, position: timePalette?.phase.position, tokens: timeTokens.length }, gameClock: game.clock, slotMachine: structuredClone(game.slotMachine), centerRadius: game.bumpers[2].plugin.radius, canonNotes: canon.count, currentNote: currentNote?.name, positions: game.balls.map(b => ({ ...b.body.position, entered: b.entered, power: b.power, bonus: b.bonus, scoreFactor: b.scoreFactor })), music: backgroundMusic?.status, musicEnabled: state.music, musicVolume: state.musicVolume, audioState: audio?.state }) });
