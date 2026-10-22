import { createTable, STEP, TABLE, DRUM_SIDE_HITS, DRUM_CENTER_HITS, ENLARGE_MS } from './physics.js';
import { createRenderer } from './renderer.js';
import { createCanon } from './canon.js';
import { SLOT_SYMBOLS, BALL_SYMBOL, ballPayout, SLOT_DISPLAY, slotBonusLabel, REEL_WEIGHTS, BALL_ONE, BALL_PAIR, BALL_JACKPOT } from './slot-machine.js';
import { reelIconSvg } from './reel-icons.js';
import { createTimePalette, collectTimeTokens, applyTimePalette, TIME_PHASES, TIME_CYCLE } from './time-flow.js';
import { createBackgroundMusic } from './music.js';
import { chargeAt, chargePercent, overchargeAt, chargeEffectsAt, CHARGE_DURATION, OVERCHARGE_DURATION, BURST_READY_AT } from './charge.js';
import { randomMiniGame, MINI_GAMES } from './mini-games.js';
import { createSecretWave } from './secret-wave.js';
import { createHaptics } from './haptics.js';
import { createMiniGamesUI, miniGameMarkup } from './mini-games-ui.js';
import { sceneMotionAt } from './scene-motion.js';
import { celebrateReward, advanceCelebrations } from './reward-effects.js';
import { createCrowdFireworks } from './crowd-fireworks.js';
import { COLLECTION_TYPES, restoreCollections } from './collections.js';
import { nextSlotCount, SLOT_UNLOCK_7, SLOT_UNLOCK_9 } from './slots.js';
import { SLOT_TRANSITION_MS } from './slot-transition.js';
import { createLeaderboard, createRunId, PRESET_BOARD, sanitizeName } from './leaderboard.js';
import { START_BALLS, LOW_BALLS, LAUNCH_COST, BURST_COST, SECRET_BALLS, SLOT_MACHINE_BALLS, DRUM_RANDOM_BALLS, DRUM_ENLARGE_BALLS, DRUM_CLOCK_BALLS, secretHoleBalls, shotCost, clampBallCost, nextBallCost, roundCanEnd, jarRefundable, qualifiesForLeaderboard, freshRound, restoreRun, pocketCenter, slotFrame, ballValue, triggeringGiftScale, BOARD_CROWD_LOCK, boardCrowdUnlock, crowdLaunchLocked } from './round.js';
import { slotIcon } from './slot-icons.js';
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
const animalScene = { motifs: ['🐰','🐻','🐱'], bg: '#fbf3e9', pin: '#b2c3a1', accent: '#e994a4', colors: ['#e6ecca','#f8dfb1','#efc2cb','#d5e6d3','#f6dba7','#efc2cb','#e6ecca'] };

let saved = {};
try { saved = JSON.parse(localStorage.getItem('ponpon-settings') || '{}'); } catch {}
const savedBest = Number.isFinite(saved.best) ? Math.max(0, saved.best) : 0;
const keepProgress = saved.keepProgress === true;
const resumed = keepProgress ? restoreRun(saved.run, savedBest) : freshRound(savedBest);
const state = {
  collections: restoreCollections(saved?.collections),
  slots: resumed.slots,
  sound: saved.sound !== false, volume: Number.isFinite(saved.volume) ? Math.max(0,Math.min(1,saved.volume)) : .55,
  music: saved.music !== false, musicVolume: Number.isFinite(saved.musicVolume) ? Math.max(0,Math.min(1,saved.musicVolume)) : .35,
  timeFlow: saved.timeFlow === true, timeFlowStartedAt: Number.isFinite(saved.timeFlowStartedAt) && saved.timeFlowStartedAt > 0 ? saved.timeFlowStartedAt : Date.now(),
  calm: saved.calm ?? matchMedia('(prefers-reduced-motion: reduce)').matches,
  vibrate: saved.vibrate !== false,
  render3D: saved.render3D === true, fullWindow: saved.fullWindow === true, secretPending: false, gm: false, keepProgress,
  score: resumed.score, stock: resumed.balls, best: savedBest, ballCost: resumed.ballCost, power: 65, auto: false, charging: false, charge: 0, chargeElapsed: 0,
  launches: resumed.launches, combo: 0, bestCombo: resumed.bestCombo, bestSlot: resumed.bestSlot, bestBefore: resumed.bestBefore,
  over: resumed.over, nameDecided: resumed.nameDecided,
  slotTransition: null,
};
document.documentElement.classList.toggle('full-window', state.fullWindow === true);
let runId = keepProgress && typeof saved.run?.runId === 'string' && saved.run.runId ? saved.run.runId : createRunId();
let lastMiniGame = keepProgress && MINI_GAMES[saved.run?.lastMiniGame] ? saved.run.lastMiniGame : null;
const leaderboard = createLeaderboard({ url: import.meta.env.VITE_LEADERBOARD_URL || '' });
let playerName = '';
const persist = () => {
  try {
    const payload = { render3D: state.render3D, fullWindow: state.fullWindow === true, slots: state.slots, sound: state.sound, volume: state.volume, music: state.music, musicVolume: state.musicVolume, timeFlow: state.timeFlow, timeFlowStartedAt: state.timeFlowStartedAt, calm: state.calm, vibrate: state.vibrate, best: state.best, collections: state.collections, keepProgress: state.keepProgress };
    if (state.keepProgress) payload.run = { score: state.score, balls: availableBalls(), slots: state.slots, launches: state.launches, bestCombo: state.bestCombo, bestSlot: state.bestSlot, bestBefore: state.bestBefore, over: state.over, nameDecided: state.nameDecided, doubleBall: state.ballCost > 1, ballCost: state.ballCost, tableBalls: game.carriedBalls, runId, ...(lastMiniGame ? { lastMiniGame } : {}) };
    localStorage.setItem('ponpon-settings', JSON.stringify(payload));
  } catch {}
};

document.querySelector('#app').innerHTML = `
<div class="shell">
  <header><div class="brand"><div class="brand-mark"><svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="#fff9e9"/><circle cx="15" cy="18" r="1.5" fill="#435444"/><circle cx="25" cy="18" r="1.5" fill="#435444"/><path d="M16 24q4 4 8 0" fill="none" stroke="#435444" stroke-width="1.5" stroke-linecap="round"/></svg></div><div class="brand-copy"><div class="brand-name">PON <span>PON</span><span style="font-size:13px;color:var(--flow-ink-89957a,#89957a)"> ✳</span></div><div class="brand-caption">A LITTLE JOY MACHINE</div></div><h1 class="mobile-title">弹一点，小快乐</h1></div><div class="header-actions"><span class="quiet-tag">TAKE A BREAK. MAKE A PON.</span><button class="icon-button" id="sound-button" aria-label="关闭声音"></button><button class="settings-button" id="settings-button" aria-label="游乐场设置">${icon('settings')}<span>游乐场设置</span></button></div></header>
  <section class="intro"><div><div class="eyebrow">YOUR DAILY DOSE OF HAPPY</div><h1>弹一点，小快乐<em>✧</em></h1><p>蓄一点力，弹进一场奇妙的小冒险。</p></div><div class="intro-sticker">100% 快乐<br>0% 压力</div></section>
  <main class="game-layout">
    <section class="machine" aria-label="柏青哥游戏区"><div class="mobile-hud"><div class="hud-score-row"><span class="hud-score-label">快乐积分</span><strong id="mobile-score">0</strong><span class="hud-ball-label">小球</span><strong id="mobile-balls" class="ball-count">0</strong></div><div class="hud-meta-row"><span class="hud-best">最高<strong id="mobile-best">0</strong></span><span id="shot-state">右下角 · 弹珠就位</span><span class="bonus-label">秘密洞 <b id="hole-points">+500</b></span><button type="button" id="info-toggle" class="info-toggle" aria-expanded="false" aria-controls="game-sidebar">奖励</button></div></div><div class="machine-top"><span class="machine-label"><i class="status-dot"></i> <span id="machine-caption">THE HAPPY LITTLE PACHINKO</span></span><span class="tiny-dots">● ● ●</span></div><div class="board-stage"><div class="board-wrap"><canvas id="board" tabindex="0" width="760" height="900" aria-describedby="slot-status" aria-label="${state.render3D ? '3D' : '2D'} 球台；弹珠从右下角沿轨道发射；长按下方按钮或右侧弹簧蓄力，${CHARGE_DURATION/1000}秒满蓄力，再按${OVERCHARGE_DURATION/1000}秒松手五球连发。右侧秘密洞奖励500分，左侧三角平台随机换向；左下蓄球罐存满20颗，落下颗数跟随最后一颗的倍数；赠球只计罐，不退回剩余球；每进洞50次三格一起转；正中LUCKY槽每进一球随机转一格，图案没变不重复发奖。两格相同全场3分钟双倍，三格相同全场1分钟五倍；弹珠图案1个+${BALL_ONE}球，2个+${BALL_PAIR}球，3个大奖+${BALL_JACKPOT}球，再乘触发这格的弹珠倍数。"></canvas><div id="slot-upgrade" class="slot-upgrade" hidden></div><span id="slot-status" class="sr-only" role="status">老虎机：进洞 0/50；正中 LUCKY 槽每次随机转一格；两格相同全场 ×2 三分钟，三格相同全场 ×5 一分钟。</span><div id="table-charge" class="table-charge" role="button" tabindex="-1" aria-label="按住球台蓄力，松开发射"></div><button class="plunger-hit" id="plunger" aria-label="长按右侧弹簧${CHARGE_DURATION/1000}秒满蓄力，再按${OVERCHARGE_DURATION/1000}秒松手五球连发"></button></div></div><div class="launch-control"><div class="compact-tools"><button class="icon-button" id="compact-sound" aria-label="关闭声音"></button><button class="settings-button" id="compact-settings" aria-label="游乐场设置">${icon('settings')}<span>设置</span></button></div><div class="launch-row"><div class="launch-mode"><button type="button" id="double-ball" class="double-ball is-locked" aria-pressed="false" disabled><span id="double-ball-label"></span><small id="double-ball-note" class="sr-only">${SLOT_UNLOCK_7} 分解锁 ×2</small></button><button class="launch-button" id="launch">${icon('arrow')} <span id="launch-label">按住蓄力 · 松开发射</span><kbd>SPACE</kbd></button><label class="power-row" id="auto-power" for="power" hidden><span>弹射力度</span><output id="power-value" for="power">65%</output><input type="range" min="1" max="100" value="65" id="power" aria-label="自动弹射力度"/></label></div></div><p class="machine-foot">蓄力 ${CHARGE_DURATION/1000} 秒满 · 再按 ${OVERCHARGE_DURATION/1000} 秒五球连发 · 拾星本球加倍 · 蓄满 20 颗，落下颗数 ×最后一颗；赠球入罐不退球 · 台上满 ${BOARD_CROWD_LOCK} 颗锁定发射</p><div class="toast" id="toast" role="status"></div></div></section>
    <aside class="sidebar" id="game-sidebar"><button type="button" id="info-close" class="info-close">收起</button><section class="card score-card"><div class="card-label">今日份快乐 <span class="small-label">HAPPY POINTS</span></div><div class="score-value"><span id="score">0</span><span class="score-unit">分</span></div><div class="score-divider"></div><div class="score-stats"><span>剩余小球 &nbsp;<strong id="ball-count" class="ball-count">0</strong></span><span>最高纪录 &nbsp;<strong id="best">0</strong></span></div></section><section class="card how-card"><div class="card-label">快乐使用说明 <span>↗</span></div><ol><li><span class="step-no">01</span>力度决定高度，回流口重返球场</li><li><span class="step-no">02</span>左右鼓满 ${DRUM_SIDE_HITS} 次：左鼓赠球颗数 ×这颗弹珠，右鼓只放大中央 ${ENLARGE_MS / 1000} 秒</li><li><span class="step-no">03</span>中央满 30 次，十二时钟大爆发，×N 球打出 12×N 颗</li><li><span class="step-no">04</span>蓄球罐存满 20 颗，落下颗数 ×最后一颗。自己打出的球算回剩余，赠球只计罐</li><li><span class="step-no">05</span>进洞满 50 次三格齐转；正中 LUCKY 每次只转一格。两同 ×2，三同 ×5；弹珠 1/2/3 个 +${BALL_ONE}/+${BALL_PAIR}/+${BALL_JACKPOT} 球，再乘触发球。图案没变不重复发奖</li></ol></section><div class="little-note">✿ &nbsp; 不用赶路，弹一会儿也很好</div><div class="side-actions"><button type="button" id="collection-button" class="side-action" aria-label="打开水果收集册">收集册</button><button type="button" id="leaderboard-button" class="side-action" aria-label="打开排行榜">排行</button></div><section class="card reward-card"><div class="global-multiplier" id="global-multiplier" aria-live="polite"><span>全场当前倍率</span><strong id="global-multiplier-value">×1</strong><small id="global-multiplier-time" hidden></small></div><div class="card-label">奖励进度</div><div class="reward-dashboard" aria-label="奖励进度"><div class="reward-slot"><span>老虎机 <span class="reward-reels" aria-hidden="true">${[0, 1, 2].map(reel => `<i data-reel="${reel}">${reelIconSvg(reel)}</i>`).join('')}</span><b id="reward-slot-count">0/50</b></span><progress id="reward-slot-progress" max="50" value="0" aria-label="老虎机进洞进度"></progress><small id="reward-slot-caption">两同 ×2 / 三同 ×5 / 球 1·2·3 个 +${BALL_ONE}/+${BALL_PAIR}/+${BALL_JACKPOT} ×触发球</small></div><div><span>左鼓 · 随机赠球 <b id="reward-0">0/${DRUM_SIDE_HITS}</b></span><progress id="reward-progress-0" max="${DRUM_SIDE_HITS}" value="0" aria-label="左侧反弹点命中次数"></progress><small>满 ${DRUM_SIDE_HITS} 次，赠球 ×这颗弹珠</small></div><div><span>中央 · 时钟爆发 <b id="reward-2">0/${DRUM_CENTER_HITS}</b></span><progress id="reward-progress-2" max="${DRUM_CENTER_HITS}" value="0" aria-label="中央反弹点命中次数"></progress><small>12 颗 ×这颗弹珠，进度也 ×N</small></div><div><span>右鼓 · 中央变大 <b id="reward-1">0/${DRUM_SIDE_HITS}</b></span><progress id="reward-progress-1" max="${DRUM_SIDE_HITS}" value="0" aria-label="右侧反弹点命中次数"></progress><small id="reward-timer">满 ${DRUM_SIDE_HITS} 次放大 ${ENLARGE_MS / 1000} 秒</small></div><div><span>蓄球罐 <b id="reward-jar">0/20</b></span><progress id="reward-jar-progress" max="20" value="0" aria-label="蓄球罐存量"></progress><small>存满 20 颗，落下 ×最后一颗；赠球只计罐</small></div></div></section></aside>
  </main><div class="bottom-info"><span>✧ &nbsp; 真实物理碰撞 · 球数就是这一局的生命</span><span class="sound-indicator"><span class="sound-bars"><i></i><i></i><i></i></span><span id="sound-status">声音已开启，快乐有回响</span></span></div><footer class="footer"><span>PON PON · YOUR POCKET-SIZED HAPPY PLACE</span><span>MADE WITH <b>♡</b> & A LITTLE BOUNCE</span></footer>
</div><button type="button" id="info-backdrop" class="info-backdrop" hidden aria-label="收起奖励和说明"></button>
<dialog id="settings"><div class="dialog-inner"><div class="dialog-head"><button id="gm-dot" class="gm-dot" type="button" aria-label="边框装饰" aria-pressed="false"><span></span></button><h2>布置你的游乐场</h2><button class="icon-button" id="close-settings" aria-label="关闭设置">${icon('close')}</button></div><p class="dialog-sub">换一种心情，再接住一颗小快乐。</p><div id="gm-tools" class="gm-tools" hidden><span>GM · 小游戏试玩</span><label class="setting-row gm-keep" for="keep-progress"><span>保持分数模式<small>打开后，刷新会接着这一局。关掉则下次刷新重新开始</small></span><input id="keep-progress" type="checkbox" role="switch" ${state.keepProgress ? 'checked' : ''}/></label><div><button type="button" data-mini="pairs">对对碰</button><button type="button" data-mini="blocks">消消乐</button><button type="button" data-mini="moles">打地鼠</button></div></div><label class="setting-row auto-setting" for="auto"><span>自动弹射<small>关闭设置后连续发射，力度在球台下方调整</small></span><input id="auto" type="checkbox" role="switch" /></label><p id="slot-tier" class="setting-note">本局从 5 槽开始。快乐积分 ${SLOT_UNLOCK_7.toLocaleString()} 立刻升至 7 槽，${SLOT_UNLOCK_9.toLocaleString()} 立刻升至 9 槽，台上有球也切换。新的一局重新从 5 槽开始。</p><label class="setting-row mode-setting" for="full-window"><span>全屏幕宽度<small>去掉页面边距，球台按窗口铺满。窄屏仍用原来的手机布局</small></span><input id="full-window" type="checkbox" role="switch" ${state.fullWindow?'checked':''}/></label><button type="button" id="browser-fullscreen" class="fullscreen-button">浏览器全屏</button><label class="setting-row mode-setting" for="three-d"><span>3D 模式<small>关闭使用 2D 画面，开启使用立体球台</small></span><input id="three-d" type="checkbox" role="switch" ${state.render3D?'checked':''}/></label><label class="setting-row time-setting" for="time-flow"><span>时间流逝模式<small>白天 4 分钟 → 黄昏 1 分钟 → 夜间 4 分钟 → 清晨 1 分钟</small></span><input id="time-flow" type="checkbox" role="switch" ${state.timeFlow?'checked':''}/></label><div id="time-cycle-info" class="time-cycle-info" ${state.timeFlow?'':'hidden'}><div class="time-cycle-head"><strong id="time-phase">白天</strong><span id="time-phase-clock"></span></div><progress id="time-cycle-progress" max="${TIME_CYCLE}" value="0" aria-label="十分钟昼夜循环进度"></progress></div><label class="setting-row music-setting" for="music"><span>律动背景音乐<small>120 BPM · 轻快入场，随后律动循环</small></span><input id="music" type="checkbox" role="switch" ${state.music?'checked':''}/></label><label class="setting-row" for="music-volume">音乐音量<input id="music-volume" type="range" min="0" max="100" value="${state.musicVolume*100}" /></label><label class="setting-row" for="volume">音效音量<input id="volume" type="range" min="0" max="100" value="${state.volume*100}" /></label><label class="setting-row mode-setting" for="vibrate"><span>震动<small>碰撞轻一下，进普通洞稍强，Lucky 和秘密洞更明显。静音不影响；不支持的手机会自动跳过</small></span><input id="vibrate" type="checkbox" role="switch" ${state.vibrate?'checked':''}/></label><label class="setting-row" for="calm">轻柔模式（减少装饰动效）<input id="calm" type="checkbox" ${state.calm?'checked':''}/></label><button class="done-button" id="done-settings">好啦，继续快乐</button><p class="setting-note">设置、最高纪录和收集册会自动保存。刷新重新开始这一局。只有 GM 的「保持分数模式」打开时，刷新才会接着球数、积分和槽位。积分越过 ${SLOT_UNLOCK_7.toLocaleString()} 或 ${SLOT_UNLOCK_9.toLocaleString()} 时槽位立刻增加，底部大约 ${(SLOT_TRANSITION_MS / 1000).toFixed(1)} 秒过渡。</p></div></dialog><dialog id="collection-book" class="collection-dialog" aria-labelledby="collection-title"><div class="dialog-inner"><div class="dialog-head"><h2 id="collection-title">水果收集册</h2><button type="button" id="close-collection" class="icon-button" aria-label="关闭收集册">${icon('close')}</button></div><div class="collection-book"><p>每种水果进槽一次记 1 个。这里只囤积数量，留给以后的功能使用，不改变槽位得分。</p><div class="collection-grid">${COLLECTION_TYPES.map(({id,name})=>`<article class="collection-item" data-collection="${id}"><span class="collection-icon" aria-hidden="true">${slotIcon(id)}</span><div><strong>${name}</strong><small class="collection-count"></small></div></article>`).join('')}</div><p class="collection-note">数量自动保存在当前浏览器。星星和老虎机加倍只增加积分，不增加收集数量。</p><button type="button" id="collection-return" class="done-button">返回弹珠台</button></div></div></dialog><dialog id="leaderboard" class="arcade-dialog" aria-labelledby="lb-title"><div class="dialog-inner arcade-inner"><div class="dialog-head"><h2 id="lb-title">HIGH SCORES</h2><button type="button" id="close-leaderboard" class="icon-button" aria-label="关闭排行榜">${icon('close')}</button></div><p class="arcade-sub">前 20 名</p><ol id="lb-list" class="lb-list"></ol><button type="button" id="leaderboard-return" class="done-button">返回弹珠台</button></div></dialog><dialog id="name-entry" class="arcade-dialog name-dialog" aria-labelledby="name-title"><div class="dialog-inner arcade-inner"><p class="arcade-kicker">NEW RECORD</p><h2 id="name-title">留下你的名字</h2><p class="arcade-sub">这一局的成绩可以留下名字。1 到 12 个字符，提交的是本局最终分。</p><form id="name-form"><input id="player-name" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done" aria-label="玩家名字" placeholder="AAA" /><p id="name-error" class="name-error" hidden>请输入 1 到 12 个字符</p><div class="name-actions"><button type="submit" class="done-button">确定</button><button type="button" id="name-skip">这次先不留名</button></div></form></div></dialog><dialog id="settlement" class="arcade-dialog"><div class="dialog-inner arcade-inner"><p class="arcade-kicker">GAME OVER</p><h2>本局结束</h2><dl class="settle-list"><div><dt>快乐积分</dt><dd id="settle-score">0</dd></div><div><dt>发射数</dt><dd id="settle-launches">0</dd></div><div><dt>最高连击</dt><dd id="settle-combo">0</dd></div><div><dt>最高槽位</dt><dd id="settle-slot">—</dd></div><div><dt>纪录</dt><dd id="settle-record">未打破</dd></div></dl><button type="button" id="play-again" class="done-button">再来一局</button></div></dialog>${miniGameMarkup}`;

const $ = (s) => document.querySelector(s);
const panels = () => [$('#settings'), $('#collection-book'), $('#leaderboard'), $('#name-entry'), $('#settlement')];
const panelOpen = () => panels().some(panel => panel?.open);
const timeTokens = collectTimeTokens(document);
let timePalette = null, lastTimePaint = -Infinity;
function updateTimeFlow(now = performance.now(), force = false) {
  if (!force && now - lastTimePaint < 250) return;
  if (!state.timeFlow && !timePalette && !force) return;
  lastTimePaint = now;
  timePalette = state.timeFlow ? createTimePalette(Date.now() - state.timeFlowStartedAt) : null;
  applyTimePalette(document.documentElement, timeTokens, timePalette);
  $('#time-cycle-info').hidden = !state.timeFlow;
  document.documentElement.style.setProperty('--accent', timePalette?.color(animalScene.accent) ?? animalScene.accent);
  $('.board-wrap').style.background = timePalette?.color(animalScene.bg, 'surface') ?? animalScene.bg;
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
for (const type of ['selectstart', 'dragstart', 'contextmenu']) $('#app').addEventListener(type, event => { if (event.target.closest('input, textarea')) return; event.preventDefault(); });
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
  if(kind==='confirm'){tone(660,.12,'sine');tone(880,.16,'sine',.075);}
  if(kind==='star'){[880,1175,1568].forEach((n,i)=>tone(n,.24,'sine',i*.055,.22));}
}

const fx = { celebrations: [], particles: [], ripples: [], popups: [], slotGlows: Array(state.slots).fill(0), shake: 0 };
const perf = { on: false, samples: [], peak: 0, outs: 0, base: null };
let crowdLocked = false;
let heavyClock = false;
let secretGiftFactor = 1;
const pendingSlotAll = [];
const pendingSlotReel = [];
const haptics = createHaptics();
haptics.setEnabled(state.vibrate);
const game = createTable({ slots: state.slots, collections: state.collections, centerHitWeight: triggeringGiftScale, giftScale: triggeringGiftScale, onHit: hit => {
  playCanon(hit);
  haptics.collision(hit.speed);
  if (!state.calm) fx.ripples.push({ ...hit, life: 1, color: animalScene.accent });
}, onScore: award, onReturn: ({ reason } = {}) => { if (perf.on && reason === 'out') perf.outs += 1; state.combo = 0; toast(reason === 'timeout' ? '这颗弹珠停留太久，先收回来了' : reason === 'out' ? '弹珠掉出球台了，再来一颗吧' : '弹珠已回收，再试试另一种力度吧'); }, onDrain: miss => {
  state.combo = 0;
  fx.shake = Math.max(fx.shake, 2);
  fx.popups.push({ x: miss.x, y: miss.y - 28, text: '漏', life: 1, color: '#c2453a', size: 16 });
  if (!state.calm) fx.ripples.push({ x: miss.x, y: miss.y, life: 1, color: '#c2453a', radius: 18, width: 2 });
  tone(150, .16, 'triangle', 0, .14, 80);
  haptics.collision(6);
}, onSurprise: surprise });
if (keepProgress && Array.isArray(saved.run?.tableBalls)) game.restoreCarried(saved.run.tableBalls);
const renderer = createRenderer($('#board'));
const crowdCanvas = document.createElement('canvas');
crowdCanvas.id = 'crowd-fireworks';
crowdCanvas.setAttribute('aria-hidden', 'true');
const crowdBanner = document.createElement('div');
crowdBanner.id = 'crowd-banner';
crowdBanner.hidden = true;
crowdBanner.textContent = '✦ 礼花时间 · 球台热闹，稍等再发射';
$('#board').parentElement.append(crowdCanvas, crowdBanner);
const fireworks = createCrowdFireworks(crowdCanvas);
let fireworkAlive = 0;
function reducedMotion() {
  return state.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
}
let frame = 0, last = 0, accumulator = 0, lastDrop = -1000, lastAuto = 0;
let chargeStart = 0, chargeSource = null, suppressAssistClickUntil = 0;
const secretWave = createSecretWave();
let secretBallFlash = 0;
const miniGames = createMiniGamesUI({ root: $('#mini-game'), onFinish: result => {
  addScore(result.score);
  if (result.bestCombo) state.bestCombo = Math.max(state.bestCombo, result.bestCombo);
  if (result.source === 'secret' && !result.idle) {
    const gifts = secretHoleBalls({ valueFactor: secretGiftFactor });
    grantBalls(gifts.holeBalls, 615, 450, false);
    secretBallFlash = gifts.holeBalls;
  }
},
  onPoints: () => tone(784,.12,'sine',0,.12), vibrate: ms => haptics.tap(ms), onExit: source => {
    if (source === 'secret') {
      state.secretPending = false; game.setEmissionPaused(false); secretWave.reset();
      if (secretBallFlash) {
        const bonus = secretBallFlash;
        secretBallFlash = 0;
        flyBalls(bonus, 615, 450, `+${bonus} 球`);
        fx.popups.push({ x: 615, y: 430, text: `+${bonus} 球`, life: 1.6, decay: .008, rise: .35, big: true, color: '#8a5a12', size: 28 });
        toast(`+${bonus} 球`);
      }
    }
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
$('#keep-progress').addEventListener('change', event => {
  state.keepProgress = event.target.checked;
  persist();
});
function noteMiniGame(kind) {
  if (!MINI_GAMES[kind]) return;
  lastMiniGame = kind;
  if (state.keepProgress) persist();
}
document.querySelectorAll('[data-mini]').forEach(button => button.addEventListener('click', () => {
  if (!state.gm || miniGames.open) return;
  endCharge(false);$('#settings').close();
  if (miniGames.start(button.dataset.mini,'gm')) noteMiniGame(button.dataset.mini);
  syncLaunchControls();
}));
function spendable() { return state.stock + jarRefundable(game.collector.stored); }
function availableBalls() { return state.stock + jarRefundable(game.collector.stored) + game.collector.remaining; }
function updateBallHud() {
  const count = availableBalls();
  const low = count < LOW_BALLS;
  for (const el of [$('#ball-count'), $('#mobile-balls')]) {
    el.textContent = count.toLocaleString();
    el.classList.toggle('is-low', low);
  }
}
function ballCounterEl() {
  const card = $('.score-card');
  const shown = card && getComputedStyle(card).display !== 'none' && card.getBoundingClientRect().width > 0;
  return shown ? $('#ball-count') : $('#mobile-balls');
}
function flyBalls(count, x, y, label = `+${count}`) {
  if (state.calm || !(count > 0)) return;
  const start = renderer.project(x, y);
  const board = $('#board').getBoundingClientRect();
  const target = ballCounterEl().getBoundingClientRect();
  const el = document.createElement('span');
  el.className = 'ball-fly';
  el.textContent = label;
  const left = board.left + start.x * board.width;
  const top = board.top + start.y * board.height;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  document.body.append(el);
  const dx = target.left + target.width / 2 - left;
  const dy = target.top + target.height / 2 - top;
  const motion = el.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px)`, opacity: .15 }], { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' });
  motion.onfinish = () => el.remove();
}
function grantBalls(count, x, y, label) {
  const amount = Math.floor(Number(count) || 0);
  if (amount <= 0 || state.over) return;
  state.stock += amount;
  updateBallHud();
  if (label !== false) flyBalls(amount, x, y, label);
  persist();
}
function takeBalls(cost) {
  if (spendable() < cost) return false;
  let need = cost;
  const fromStock = Math.min(state.stock, need);
  state.stock -= fromStock;
  need -= fromStock;
  if (need) game.takeStored(need);
  updateBallHud();
  persist();
  return true;
}
function syncLaunchControls() {
  const locked = state.secretPending || miniGames.open || state.over;
  const crowd = crowdLocked && !locked;
  const broke = !locked && !crowd && spendable() < LAUNCH_COST;
  $('#launch').disabled = locked || crowd || broke;$('#plunger').disabled = locked || crowd || broke;$('#power').disabled = locked;
  $('#launch').classList.toggle('is-crowd-locked', crowd);
  $('#plunger').classList.toggle('is-crowd-locked', crowd);
  $('#launch').hidden = state.auto && !locked && !crowd;$('#auto-power').hidden = !state.auto || locked || crowd;
  if (crowd) $('#launch').title = `台上满 ${BOARD_CROWD_LOCK} 颗，少于 ${boardCrowdUnlock()} 颗再发射`;
  else $('#launch').removeAttribute('title');
  if (state.over) {
    $('#launch-label').textContent = '本局结束';
    $('#shot-state').textContent = '球数用完了';
  } else if (locked) {
    $('#launch-label').textContent = state.secretPending ? '等待“秘密出现”' : '小游戏进行中';
    $('#shot-state').textContent = state.secretPending ? '等待弹珠结算 · 秘密即将出现' : '秘密小游戏时间';
  } else if (crowd) {
    $('#launch-label').textContent = '礼花中 · 发射锁定';
    $('#shot-state').textContent = `礼花时间 · 台上 ${game.balls.length} 颗，少于 ${boardCrowdUnlock()} 再发射`;
  } else if (broke) $('#launch-label').textContent = '小球用完了';
  else if (!state.charging) $('#launch-label').textContent = '按住蓄力 · 松开发射';
}
function waitForSecret() {
  if (state.secretPending || miniGames.open) return;
  state.secretPending = true;
  const refund = game.setEmissionPaused(true);
  if (refund) grantBalls(refund, 713, 787);
  endCharge(false);syncLaunchControls();
}


function takeSlotScale(event) {
  if (event.mode !== 'reel' && event.mode !== 'all') return 1;
  const queue = event.mode === 'reel' ? pendingSlotReel : pendingSlotAll;
  return queue.length ? ballValue(queue.shift()) : 1;
}
function surprise(event) {
  if (event.kind === 'emit' && event.source === 'charged') sound('launch');
  if (event.kind === 'random') grantBalls(DRUM_RANDOM_BALLS, event.x, event.y);
  if (event.kind === 'enlarge') grantBalls(DRUM_ENLARGE_BALLS, event.x, event.y);
  if (event.kind === 'clock') grantBalls(DRUM_CLOCK_BALLS, event.x, event.y);
  if (event.kind === 'slot-result' && SLOT_MACHINE_BALLS > 0) grantBalls(SLOT_MACHINE_BALLS, event.x, event.y);
  if (event.kind.startsWith('slot-')) {
    if (event.kind === 'slot-start') {
      if (event.mode === 'reel') $('#slot-status').textContent = 'LUCKY 槽带动一格转动。';
      else {
        toast('✧ 进洞满 50 次，转一份好运！');
        $('#slot-status').textContent = '进洞满 50 次，老虎机正在转动。';
      }
      tone(440, .18, 'sine', 0, .12);
    }
    if (event.kind === 'slot-reel') tone([523, 659, 784][event.reel], .16, 'sine', 0, .12);
    if (event.kind === 'slot-result') {
      const scale = takeSlotScale(event);
      if (event.mode === 'reel' && !event.paid) {
        $('#slot-status').textContent = '这一格没有组成新的奖励。';
        return;
      }
      const symbols = event.reels.map(i => i === BALL_SYMBOL ? '球' : SLOT_SYMBOLS[i]).join(' ');
      const count = event.balls || 0;
      const payout = (event.ballPayout || 0) * scale;
      const ballText = payout <= 0 ? '' : count >= 3 ? `大奖 +${payout} 球` : `+${payout} 球`;
      const bonusText = event.multiplier > 1 ? `全场进洞 ×${event.multiplier}，持续 ${event.duration / 60000} 分钟` : '';
      const message = ballText || bonusText ? [symbols, ballText, bonusText].filter(Boolean).join(' · ') : `${symbols} · 下次好运继续！`;
      toast(message, count >= 3 ? 4200 : 2200); $('#slot-status').textContent = message;
      if (payout > 0) {
        grantBalls(payout, event.x, event.y, ballText);
        fx.popups.push({ x: event.x, y: event.y - 48, text: ballText, life: count >= 3 ? 2.6 : 1.3, decay: count >= 3 ? .006 : .012, rise: count >= 3 ? .22 : .4, big: count >= 3, size: count >= 3 ? 32 : 22, color: count >= 3 ? '#c48a12' : '#8a5a12' });
      }
      if (count >= 3) {
        const profile = celebrateReward(fx, { kind: 'ball-jackpot', x: event.x, y: event.y }, state.calm);
        rewardSound(profile);
        haptics.upgrade();
      } else if (count === 2) haptics.score({ kind: 'slot', multiplier: 10 });
      else if (count === 1) haptics.score({ kind: 'slot' });
      if (event.multiplier > 1) {
        const profile = celebrateReward(fx, { kind: 'slot-machine', multiplier: event.multiplier, x: event.x, y: event.y }, state.calm);
        rewardSound(profile);
      }
    }
    return;
  }
  if (event.kind === 'clock') heavyClock = (event.balls || 12) > 12;
  const names = {
    clock: event.balls > 12 ? `✦ 30 次碰撞！十二时钟爆发 ${event.balls} 颗` : '✦ 30 次碰撞！十二时钟爆发',
    random: event.balls > 1 ? `✧ 左鼓满 ${DRUM_SIDE_HITS} 次，送 ${event.balls} 颗弹珠` : `✧ 左鼓满 ${DRUM_SIDE_HITS} 次，送一颗弹珠`,
    enlarge: `✿ 右鼓满 ${DRUM_SIDE_HITS} 次，只放大中央 ${ENLARGE_MS / 1000} 秒`,
  };
  if (names[event.kind]) toast(names[event.kind]);
  if (event.kind === 'store') {
    tone(440 + event.count * 12, .12, 'sine', 0, .15);
    fx.popups.push({ x: event.x, y: event.y - 22, text: `存入 ${event.count}/${event.capacity}`, life: 1, color: '#9279aa', size: 14 });
  }
  if (event.kind === 'storage-burst') {
    toast(`✦ 蓄满 20 颗！顶部落下 ${event.amount} 颗弹珠`);
    [523, 659, 784, 1047].forEach((note, i) => tone(note, .3, 'sine', i * .08, .2));
  }
  const quietEmit = event.kind === 'emit' && (event.source === 'clock' || event.source === 'storage');
  if (!quietEmit) fx.ripples.push({ x: event.x, y: event.y, life: 1, big: event.kind === 'clock' || event.kind === 'enlarge', color: event.kind === 'redirect' ? '#92b68d' : event.multiplier === 5 ? '#b58ae0' : '#e6b44f' });
  if (event.kind === 'clock') {
    const profile = celebrateReward(fx, event, state.calm);
    rewardSound(profile);
  }
  if (event.kind === 'emit' && event.source === 'clock' && !heavyClock) {
    // A normal 12-ball clock keeps one flourish per shot. A multiplied burst
    // already played the celebration, so extra shots stay quiet.
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
  if ((event.kind === 'deflect' || (event.kind === 'emit' && event.source !== 'clock' && event.source !== 'storage')) && !state.calm) {
    for (let i = 0; i < 5; i++) fx.particles.push({ x: event.x, y: event.y, vx: Math.cos(event.angle) * (3 + i), vy: Math.sin(event.angle) * (3 + i), life: .8, size: 3, rotation: event.angle, color: '#edbf68', star: true });
  }
}

function addScore(points) {
  if (state.over || !(points > 0)) return;
  state.score += points; state.best = Math.max(state.best, state.score); persist();
  $('#score').textContent = state.score.toLocaleString(); $('#mobile-score').textContent = state.score.toLocaleString(); $('#best').textContent = state.best.toLocaleString(); $('#mobile-best').textContent = state.best.toLocaleString();
  $('.score-value').classList.remove('score-bump'); void $('.score-value').offsetWidth; $('.score-value').classList.add('score-bump');
  considerSlotUpgrade();
}
let slotUpgradeTimer = 0;
function applySlotUpgrade(next) {
  if (next <= state.slots) return;
  const from = state.slots;
  state.slots = next;
  game.setSlots(next, { keepBalls: true });
  fx.slotGlows = Array(next).fill(0);
  state.slotTransition = { from, to: next, startedAt: performance.now(), duration: SLOT_TRANSITION_MS };
  persist();
  const banner = $('#slot-upgrade');
  banner.textContent = `${next} 槽开启`;
  banner.hidden = false;
  banner.classList.remove('is-on'); void banner.offsetWidth; banner.classList.add('is-on');
  clearTimeout(slotUpgradeTimer);
  slotUpgradeTimer = setTimeout(() => { banner.hidden = true; banner.classList.remove('is-on'); }, 1600);
  toast(`槽位升级！${next} 个落袋已开启`);
  haptics.upgrade();
  updateSlotTier();
  updateDoubleControl();
}
function considerSlotUpgrade() {
  if (state.slotsPinned || state.over) return;
  const next = nextSlotCount(state.slots, state.score);
  if (next === state.slots) return;
  applySlotUpgrade(next);
}
function settlementQualifies() {
  return qualifiesForLeaderboard(state.score, [...PRESET_BOARD, ...leaderboard.readSaved()]);
}
function showSettlement() {
  const broken = state.score > state.bestBefore;
  $('#settle-score').textContent = state.score.toLocaleString();
  $('#settle-launches').textContent = state.launches.toLocaleString();
  $('#settle-combo').textContent = state.bestCombo.toLocaleString();
  $('#settle-slot').textContent = state.bestSlot ? `×${state.bestSlot}` : '—';
  const record = $('#settle-record');
  record.textContent = broken ? '新纪录！' : '未打破';
  record.classList.toggle('is-record', broken);
  if (!$('#settlement').open) $('#settlement').showModal();
  if (!state.nameDecided && settlementQualifies() && !$('#name-entry').open) {
    $('#player-name').value = '';
    $('#name-error').hidden = true;
    $('#name-entry').showModal();
    $('#player-name').focus();
  }
}
function finishRound() {
  if (state.over) { showSettlement(); return; }
  state.over = true;
  state.auto = false;
  endCharge(false);
  syncLaunchControls();
  persist();
  showSettlement();
}
function maybeEndRound() {
  if (state.over || panelOpen() || miniGames.open) return;
  if (!roundCanEnd({
    balls: state.stock,
    onTable: game.balls.length,
    stored: jarRefundable(game.collector.stored),
    pendingDrops: game.collector.remaining,
    pendingLaunches: game.pendingLaunches,
    secretPending: state.secretPending,
    miniOpen: miniGames.open,
  })) return;
  finishRound();
}
function restartRound() {
  state.over = false;
  state.nameDecided = false;
  $('#name-entry').close();
  $('#settlement').close();
  runId = createRunId();
  playerName = '';
  state.score = 0;
  state.stock = START_BALLS;
  state.launches = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.bestSlot = 0;
  state.bestBefore = state.best;
  state.slotsPinned = false;
  state.slotTransition = null;
  state.slots = 5;
  state.auto = false;
  state.ballCost = 1;
  secretGiftFactor = 1;
  pendingSlotAll.length = 0;
  pendingSlotReel.length = 0;
  game.resetRound();
  game.setSlots(5);
  fx.slotGlows = Array(5).fill(0);
  $('#score').textContent = '0'; $('#mobile-score').textContent = '0';
  updateBallHud();
  updateSlotTier();
  updateDoubleControl();
  setAuto(false);
  syncLaunchControls();
  persist();
}
function renderLeaderboard(rows) {
  const list = $('#lb-list');
  list.replaceChildren();
  rows.forEach((row, index) => {
    const item = document.createElement('li');
    item.className = 'lb-row';
    if (row.runId && row.runId === runId) item.classList.add('is-you');
    const rank = document.createElement('span');
    rank.className = 'lb-rank';
    rank.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = row.name;
    const score = document.createElement('span');
    score.className = 'lb-score';
    score.textContent = Number(row.score).toLocaleString();
    item.append(rank, name, score);
    list.append(item);
  });
}
async function showLeaderboard() {
  renderLeaderboard(await leaderboard.fetchTop());
  openPanel('leaderboard');
}
function award(result) {
  if (result.kind === 'hit') {
    addScore(result.points);
    fx.popups.push({
      x: result.x, y: result.y - 18, text: `+${result.points}`,
      life: 0.7, decay: 0.02, rise: 0.45, size: 16, color: '#b1667b',
    });
    return;
  }
  const jackpot = result.kind === 'jackpot';
  const settlement = jackpot ? secretWave.enter(result.points) : null;
  const points = settlement ? settlement.pay : result.points;
  if (settlement?.retro) addScore(settlement.retro);
  addScore(points);
  if (result.kind === 'slot' || result.kind === 'jackpot') {
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    if (result.kind === 'slot') state.bestSlot = Math.max(state.bestSlot, result.multiplier);
  }
  if (result.kind === 'slot') {
    const factor = ballValue(result.valueFactor);
    if ((game.slotMachine.entries + 1) % game.slotMachine.goal === 0) pendingSlotAll.push(factor);
    if (result.lucky) pendingSlotReel.push(factor);
  }
  if (result.collection) updateCollections();
  haptics.score(result);
  const profile = celebrateReward(fx, result, state.calm);
  if (!jackpot) fx.slotGlows[result.column] = 1;
  const title = jackpot ? '✦ 秘密洞！ ' : profile.tier >= 3 ? `${profile.name} · ` : '';
  const valueNote = result.valueFactor > 1 ? ` · 球 ×${result.valueFactor}` : '';
  fx.popups.push({ x: result.x, y: result.y - 45, text: `${title}+${points}${result.scoreFactor > 1 ? ` · 星星 ×${result.scoreFactor}` : ''}${result.globalMultiplier > 1 ? ` · 全场 ×${result.globalMultiplier}` : ''}${valueNote}`,
    life: 1, decay: jackpot ? 1000 / (60 * profile.duration) : .012, rise: jackpot ? .2 : .6, big: profile.tier >= 4, color: profile.color, size: 19 + profile.tier * 2 });
  if (jackpot && settlement.doubledNow) toast('双球入洞！秘密洞得分 ×2', profile.duration);
  else if (jackpot && settlement.startWait) {
    secretGiftFactor = ballValue(result.valueFactor);
    toast(`✦ 发现秘密洞！收下 ${points} 分，等待秘密出现`, profile.duration);
    waitForSecret();
  }
  rewardSound(profile);
}
function rewardSound(profile) {
  // Richer rewards add more notes and harmony, without escalating volume.
  const clock = profile.tier === 6;
  profile.notes.forEach((note, i) => tone(note, clock ? .5 : .18 + profile.tier * .035,
    profile.tier === 2 ? 'triangle' : 'sine', i * (clock ? .08 : .065), .2));
  if (profile.tier >= 4) [147, 220, 294].forEach(n => tone(n, clock ? 1.1 : .6, 'sine', 0, .08));
}

function updateDoubleControl() {
  const button = $('#double-ball');
  state.ballCost = clampBallCost(state.ballCost, state.slots);
  const factor = state.ballCost;
  const unlocked = state.slots >= 7;
  const on = factor > 1;
  button.disabled = !unlocked || state.over;
  button.classList.toggle('is-locked', !unlocked);
  button.classList.toggle('is-on', on);
  button.dataset.factor = String(factor);
  button.setAttribute('aria-pressed', String(on));
  $('#double-ball-label').textContent = factor > 1 ? `×${factor}` : '';
  const cost = on ? `单发 ${shotCost(factor)} · 五连发 ${shotCost(factor, true)}` : '关闭';
  const lock = state.slots >= 9 ? '' : state.slots >= 7 ? ` · ${SLOT_UNLOCK_9} 分解锁 ×4 ×8` : '';
  $('#double-ball-note').textContent = unlocked ? `${cost}${lock}` : `${SLOT_UNLOCK_7} 分解锁 ×2`;
  const ladder = state.slots >= 9 ? '点按循环 ×1 ×2 ×4 ×8' : state.slots >= 7 ? `当前最高 ×2，${SLOT_UNLOCK_9} 分解锁 ×4 和 ×8` : `${SLOT_UNLOCK_7} 分解锁 ×2，${SLOT_UNLOCK_9} 分解锁 ×4 和 ×8`;
  button.setAttribute('aria-label', `倍率 ×${factor}。${ladder}`);
}
function launch(power = state.auto ? state.power / 100 : 0, burst = false) {
  if (crowdLocked || panelOpen() || miniGames.open || state.secretPending || state.over || document.hidden) return;
  const wanted = clampBallCost(state.ballCost, state.slots);
  const hand = spendable();
  let factor = wanted;
  if (burst) {
    if (hand < shotCost(factor, true)) {
      if (!state.auto) toast(factor > 1 ? `×${factor} 五连发需要 ${shotCost(factor, true)} 颗球` : '小球不够，五连发先歇一下');
      syncLaunchControls();
      return;
    }
  } else if (hand < shotCost(factor, false)) {
    if (!(wanted > 1 && hand >= LAUNCH_COST)) {
      if (!state.auto) toast('小球用完了');
      syncLaunchControls();
      return;
    }
    factor = 1;
  }
  const now = performance.now(); if (now - lastDrop < 250) return;
  const cost = shotCost(factor, burst);
  unlockAudio();
  const ball = burst ? game.launchBurst(factor) : game.launch(power, factor);
  if (!ball) { if (!state.auto) toast('发射轨道准备中，稍等一下'); return; }
  if (!takeBalls(cost)) return;
  if (factor < wanted) toast(hand <= 1 ? '只剩 1 颗，这一发按普通消耗' : `不够 ×${wanted}，这一发按普通消耗`);
  state.launches += burst ? BURST_COST : LAUNCH_COST;
  lastDrop = now;
  if (!burst) sound('launch');
  $('#shot-state').textContent = burst ? '✦ 彩虹蓄满！五球连发！' : factor > 1 ? `↗ ×${factor} 弹珠出发！` : '↗ 弹射出发！';
  persist();
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
  if (crowdLocked || state.charging || panelOpen() || miniGames.open || state.secretPending || state.over || spendable() < LAUNCH_COST || document.hidden) return false;
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
  if (fire) { suppressAssistClickUntil = performance.now() + 400; launch(power, burst); }
}
for (const button of [$('#launch'), $('#plunger'), $('#table-charge')]) {
  button.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    if (event.target.closest('#double-ball')) return;
    if (beginCharge(button)) button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointerup', event => { if (!event.isPrimary || chargeSource !== button) return; endCharge(); if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId); });
  button.addEventListener('pointercancel', event => { if (event.isPrimary && chargeSource === button) endCharge(false); });
  button.addEventListener('lostpointercapture', event => { if (event.isPrimary && chargeSource === button) endCharge(false); });
  button.addEventListener('contextmenu', event => event.preventDefault());
  // Pointer and Enter already fire. A later detail=0 click is assistive activation,
  // and must not repeat a shot that just left the spring or launch at zero power.
  button.addEventListener('click', event => {
    if (button === $('#table-charge')) return;
    if (event.detail !== 0 || state.charging || performance.now() < suppressAssistClickUntil) return;
    launch(0.65);
  });
}
document.addEventListener('keydown', event => {
  const tag = document.activeElement.tagName;
  const launchFocused = document.activeElement === $('#launch') || document.activeElement === $('#plunger');
  const chargeKey = event.code === 'Space' || (event.code === 'Enter' && launchFocused);
  if (chargeKey && !crowdLocked && !panelOpen() && !miniGames.open && !state.secretPending && (launchFocused || !['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(tag))) {
    event.preventDefault(); if (!event.repeat) beginCharge('keyboard');
  }
});
document.addEventListener('keyup', event => { if ((event.code === 'Space' || event.code === 'Enter') && chargeSource === 'keyboard') { event.preventDefault(); endCharge(); } });
window.addEventListener('blur', () => endCharge(false));
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = performance.now();
  else if (hiddenAt) { game.advanceEnlarge(performance.now() - hiddenAt); hiddenAt = 0; }
  last = 0; accumulator = 0; if (document.hidden) endCharge(false); syncAudioVisibility();
});
$('#auto').addEventListener('change', event => { endCharge(false); unlockAudio(); setAuto(event.target.checked); lastAuto = performance.now(); });
$('#power').addEventListener('input', event => { state.power = +event.target.value; $('#power-value').textContent = `${state.power}%`; });
$('#double-ball').addEventListener('pointerdown', event => { event.stopPropagation(); });
$('#double-ball').addEventListener('click', event => {
  event.stopPropagation();
  if (state.slots < 7 || state.over) return;
  state.ballCost = nextBallCost(state.ballCost, state.slots);
  updateDoubleControl();
  persist();
  toast(state.ballCost > 1 ? `球消耗 ×${state.ballCost}` : '倍率 ×1');
});
function setInfoOpen(open) {
  document.documentElement.classList.toggle('info-open', open);
  const toggle = $('#info-toggle');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.textContent = open ? '收起' : '奖励';
  $('#info-backdrop').hidden = !open;
}
$('#info-toggle').addEventListener('pointerdown', event => event.stopPropagation());
$('#info-toggle').addEventListener('click', () => setInfoOpen(!document.documentElement.classList.contains('info-open')));
$('#info-close').addEventListener('click', () => setInfoOpen(false));
$('#info-backdrop').addEventListener('click', () => setInfoOpen(false));

function updateEffects(dt) {
  const factor = dt / (1000 / 60);
  advanceCelebrations(fx, dt, state.calm);
  fx.shake = Math.max(0, fx.shake - .18 * factor);
  for (let i = 0; i < fx.slotGlows.length; i++) fx.slotGlows[i] = Math.max(0, fx.slotGlows[i] - .015 * factor);
  for (let i = fx.ripples.length - 1; i >= 0; i--) { fx.ripples[i].life -= (fx.ripples[i].decay ?? .032) * factor; if (fx.ripples[i].life <= 0) fx.ripples.splice(i, 1); }
  for (let i = fx.particles.length - 1; i >= 0; i--) { const p = fx.particles[i]; p.x += p.vx * factor; p.y += p.vy * factor; p.vy += (p.gravity ?? .19) * factor; p.vx *= .99 ** factor; p.rotation += .07 * factor; p.life -= (p.decay ?? .016) * factor; if (p.life <= 0) fx.particles.splice(i, 1); }
  for (let i = fx.popups.length - 1; i >= 0; i--) { fx.popups[i].y -= (fx.popups[i].rise ?? .6) * factor; fx.popups[i].life -= (fx.popups[i].decay ?? .012) * factor; if (fx.popups[i].life <= 0) fx.popups.splice(i, 1); }
}
function updateRewardCard() {
  for (let i = 0; i < 3; i++) {
    const count = game.rewards.hits[i] % game.rewards.goals[i];
    const meter = $(`#reward-progress-${i}`);
    $(`#reward-${i}`).textContent = `${count}/${game.rewards.goals[i]}`;
    meter.max = game.rewards.goals[i];
    meter.value = count;
  }
  const machine = game.slotMachine;
  const reelCount = REEL_WEIGHTS.length;
  document.querySelectorAll('.reward-reels i').forEach((icon, reel) => {
    const moving = machine.spinning && !machine.stopped[reel];
    icon.classList.toggle('is-spinning', moving);
    let symbol = machine.reels[reel];
    if (moving && !state.calm) symbol = Math.floor((game.clock - machine.startedAt) / (70 + reel * 15)) % reelCount;
    const ball = symbol === BALL_SYMBOL;
    const key = ball ? 'ball' : String(symbol);
    if (icon.dataset.symbol === key) return;
    icon.dataset.symbol = key;
    icon.classList.toggle('is-ball', ball);
    icon.innerHTML = ball ? '' : (reelIconSvg(symbol) || '·');
  });
  const clockText = until => {
    const seconds = Math.max(0, Math.ceil((until - game.clock) / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  };
  $('#reward-slot-count').textContent = `${machine.progress}/${machine.goal}`;
  $('#reward-slot-progress').max = machine.goal;
  $('#reward-slot-progress').value = machine.progress;
  $('#reward-slot-caption').textContent = machine.multiplier > 1 ? clockText(machine.activeUntil) : `两同 ×2 / 三同 ×5 / 球 1·2·3 个 +${BALL_ONE}/+${BALL_PAIR}/+${BALL_JACKPOT} ×触发球`;
  const capacity = game.collector.capacity;
  const releasing = game.collector.remaining > 0;
  const jarValue = releasing ? game.collector.remaining : game.collector.stored.length;
  $('#reward-jar').textContent = releasing ? `余 ${jarValue}/${capacity}` : `${jarValue}/${capacity}`;
  $('#reward-jar-progress').max = capacity;
  $('#reward-jar-progress').value = jarValue;
  const holePoints = 500 * machine.multiplier;
  $('#hole-points').textContent = `+${holePoints}`;
  // The field card follows the slot machine only. A star doubles the ball that
  // picks it up, and the launch cost stays on that ball and the round button.
  const value = `×${machine.multiplier}`;
  const valueEl = $('#global-multiplier-value');
  const band = $('#global-multiplier');
  band.classList.toggle('is-on', machine.multiplier > 1);
  band.dataset.factor = String(machine.multiplier);
  if (valueEl.textContent !== value) {
    valueEl.textContent = value;
    band.classList.remove('is-changed');
    void band.offsetWidth;
    band.classList.add('is-changed');
  }
  const timeEl = $('#global-multiplier-time');
  timeEl.hidden = machine.multiplier <= 1;
  timeEl.textContent = machine.multiplier > 1 ? clockText(machine.activeUntil) : '';
  const globalBonus = slotBonusLabel(machine, game.clock);
  $('#machine-caption').textContent = globalBonus ? `全场${globalBonus}` : 'THE HAPPY LITTLE PACHINKO';
  $('#reward-timer').textContent = game.rewards.enlargedUntil > game.clock ? `放大中 ${(Math.max(0, game.rewards.enlargedUntil - game.clock) / 1000).toFixed(1)}s` : `满 ${DRUM_SIDE_HITS} 次，只放大中央 ${ENLARGE_MS / 1000} 秒`;
  updateDoubleControl();
}
function applyCrowdLock() {
  const next = crowdLaunchLocked(crowdLocked, game.balls.length);
  crowdBanner.hidden = !next;
  document.documentElement.classList.toggle('crowd-locked', next);
  if (next === crowdLocked) return crowdLocked;
  crowdLocked = next;
  if (next) fireworks.resize();
  if (next && state.charging) endCharge(false);
  else syncLaunchControls();
  return crowdLocked;
}
function avgOf(rows, key) {
  if (!rows.length) return 0;
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0) / rows.length;
}
function bandStats(rows) {
  const frames = rows.map(row => row.dt).filter(dt => dt > 0).sort((a, b) => a - b);
  if (!frames.length) return null;
  const sum = frames.reduce((total, value) => total + value, 0);
  const worstN = Math.max(1, Math.ceil(frames.length * 0.01));
  const worst = frames.slice(-worstN);
  const worstAvg = worst.reduce((total, value) => total + value, 0) / worst.length;
  const pct = p => frames[Math.min(frames.length - 1, Math.max(0, Math.ceil(frames.length * p) - 1))];
  const steps = rows.map(row => row.step).filter(step => step > 0).sort((a, b) => a - b);
  const stepPct = p => steps.length ? steps[Math.min(steps.length - 1, Math.max(0, Math.ceil(steps.length * p) - 1))] : 0;
  return {
    frames: frames.length,
    fps: 1000 / (sum / frames.length),
    fps1: 1000 / worstAvg,
    frameP95: pct(0.95),
    frameP99: pct(0.99),
    stepAvg: steps.length ? steps.reduce((total, value) => total + value, 0) / steps.length : 0,
    stepP95: stepPct(0.95),
    stepP99: stepPct(0.99),
    renderAvg: avgOf(rows, 'render'),
    jsAvg: avgOf(rows, 'js'),
    callsAvg: avgOf(rows, 'calls'),
    trianglesAvg: avgOf(rows, 'triangles'),
    ballsAvg: avgOf(rows, 'balls'),
  };
}
function perfStart() {
  perf.on = true;
  perf.samples = [];
  perf.peak = game.balls.length;
  perf.outs = 0;
  perf.base = {
    balls: game.balls.length,
    bonus: game.stats.bonusBalls,
    launches: game.stats.launches,
    scored: game.stats.scored,
    drains: game.stats.drains,
    returns: game.stats.returns,
    absorbed: game.stats.absorbed,
    stored: game.collector.stored.length,
    timeouts: game.stats.timeouts,
  };
  return true;
}
function perfRead() {
  const base = perf.base || { balls: 0, bonus: 0, launches: 0, scored: 0, drains: 0, returns: 0, absorbed: 0, stored: 0, timeouts: 0 };
  const spawned = (game.stats.bonusBalls - base.bonus) + (game.stats.launches - base.launches);
  const accounted = (game.balls.length - base.balls) + (game.stats.scored - base.scored) + (game.stats.drains - base.drains) + (game.stats.returns - base.returns) + (game.stats.absorbed - base.absorbed);
  const bands = [[0, 40], [40, 60], [60, 100], [100, 180], [180, 10000]].map(([min, max]) => ({ min, max, ...(bandStats(perf.samples.filter(sample => sample.balls >= min && sample.balls < max)) || {}) }));
  const windows = [20, 50, 100, 150].map(center => {
    const span = center <= 20 ? 5 : 10;
    return { center, ...(bandStats(perf.samples.filter(sample => Math.abs(sample.balls - center) <= span)) || {}) };
  });
  return {
    ...(bandStats(perf.samples) || {}),
    bands,
    windows,
    heap: performance.memory ? performance.memory.usedJSHeapSize : null,
    peak: perf.peak,
    balls: game.balls.length,
    pendingShots: game.pendingShotCount,
    pendingDrops: game.pendingDropCount,
    spawned,
    accounted,
    lost: spawned - accounted,
    outs: perf.outs,
    timeouts: game.stats.timeouts - base.timeouts,
    crowdLocked,
    lock: BOARD_CROWD_LOCK,
    unlock: boardCrowdUnlock(),
  };
}
function tick(now) {
  const frameStart = performance.now();
  updateTimeFlow(now);
  miniGames.update(now);
  const rawDelta = last ? now - last : 0; const delta = Math.min(rawDelta, 50); last = now;
  let frameStep = 0;
  const simulating = !document.hidden && !panelOpen() && !miniGames.open;
  // Hidden time is applied once on visibilitychange. Counting it here as well
  // would shrink the drum twice when a backgrounded tab still paints a frame.
  if (!simulating && !document.hidden && rawDelta > 0) game.advanceEnlarge(rawDelta);
  if (simulating) {
    accumulator += delta;
    while (accumulator >= STEP) {
      if (perf.on) {
        const started = performance.now();
        game.step();
        frameStep += performance.now() - started;
      } else game.step();
      updateEffects(STEP);
      accumulator -= STEP;
    }
    applyCrowdLock();
    if (crowdLocked || fireworkAlive) fireworkAlive = fireworks.frame(delta || 16, crowdLocked, reducedMotion());
    updateRewardCard();
    if (state.charging) {
      state.chargeElapsed = now - chargeStart; state.charge = chargeAt(state.chargeElapsed);
      const overcharge = overchargeAt(state.chargeElapsed);
      const percent = chargePercent(state.charge);
      $('#launch').style.setProperty('--charge', `${percent}%`);
      $('#launch-label').textContent = overcharge === 1 ? '蓄力 100% · 松手五球连发' : `蓄力 ${percent}% · 松开发射`;
      $('#shot-state').textContent = overcharge === 1 ? '✦ 五球连发已就绪！' : percent === 100 ? `✧ 彩虹蓄力 · 再按 ${((BURST_READY_AT - state.chargeElapsed) / 1000).toFixed(1)}s 五球连发` : '弹簧蓄力中…';
    } else if (crowdLocked && !state.secretPending) $('#shot-state').textContent = `礼花时间 · 台上 ${game.balls.length} 颗，少于 ${boardCrowdUnlock()} 再发射`;
    else if (!state.secretPending && now - lastDrop > 1700) $('#shot-state').textContent = game.balls.length ? `${game.balls.length} 颗小快乐在冒险` : '右下角 · 弹珠就位';
    if (state.auto && !crowdLocked && !state.secretPending && now - lastAuto > 1100) { launch(); lastAuto = now; }
    considerSlotUpgrade();
    updateBallHud();
    maybeEndRound();
  }
  if (state.secretPending && !game.balls.length && !miniGames.open && !panelOpen() && !document.hidden) {
    const kind = randomMiniGame(Math.random, lastMiniGame);
    noteMiniGame(kind);
    miniGames.start(kind, 'secret', secretWave.multiplier, secretHoleBalls({ valueFactor: secretGiftFactor }).holeBalls);
    syncLaunchControls();
  }
  if (miniGames.open) { $('.game-layout').style.removeProperty('transform'); frame = requestAnimationFrame(tick); return; }
  const motion = sceneMotionAt(game.clock, state, fx);
  if (motion.intensity) $('.game-layout').style.transform = `translate(${motion.uiX.toFixed(2)}px, ${motion.uiY.toFixed(2)}px)`;
  else $('.game-layout').style.removeProperty('transform');
  if (state.slotTransition && performance.now() >= state.slotTransition.startedAt + state.slotTransition.duration) state.slotTransition = null;
  const drawStart = performance.now();
  renderer.draw(game, animalScene, state, fx, timePalette);
  const drawEnd = performance.now();
  if (perf.on && rawDelta > 0 && !document.hidden && !miniGames.open) {
    const info = renderer.frameInfo?.() || {};
    const render = drawEnd - drawStart;
    perf.samples.push({
      dt: rawDelta,
      balls: game.balls.length,
      step: frameStep,
      render,
      js: Math.max(0, drawStart - frameStart - frameStep),
      calls: info.calls || 0,
      triangles: info.triangles || 0,
    });
    if (perf.samples.length > 4000) perf.samples.splice(0, perf.samples.length - 4000);
    if (game.balls.length > perf.peak) perf.peak = game.balls.length;
  }
  const hitPoints = [[686,724],[741,724],[741,884],[686,884]].map(([x,y]) => renderer.project(x,y,12));
  const left = Math.min(...hitPoints.map(p=>p.x)), right = Math.max(...hitPoints.map(p=>p.x));
  const top = Math.max(0, Math.min(...hitPoints.map(p=>p.y))), bottom = Math.min(1, Math.max(...hitPoints.map(p=>p.y)));
  const plunger = $('#plunger');
  const hitWidth = Math.min(1, Math.max(right-left, 44 / ($('#board').clientWidth || 760)));
  const plungerLeft = Math.max(0, Math.min(left, 1 - hitWidth));
  plunger.style.left = `${plungerLeft * 100}%`; plunger.style.top = `${top * 100}%`;
  plunger.style.width = `${hitWidth * 100}%`; plunger.style.height = `${(bottom - top) * 100}%`;
  plunger.style.right = 'auto'; plunger.style.bottom = 'auto';
  $('#table-charge').style.width = `${plungerLeft * 100}%`;
  frame = requestAnimationFrame(tick);
}
function updateCollections() {
  for (const { id, name } of COLLECTION_TYPES) {
    const item = document.querySelector(`[data-collection="${id}"]`);
    const count = state.collections[id] || 0;
    item.querySelector('.collection-count').textContent = `已收集 ${count.toLocaleString()} 个`;
    item.setAttribute('aria-label', `${name} 已收集 ${count.toLocaleString()} 个`);
  }
}
function updateSlotTier() {
  const tier = $('#slot-tier');
  if (tier) tier.textContent = `当前 ${state.slots} 槽。本局 ${SLOT_UNLOCK_7.toLocaleString()} 分立刻升至 7 槽，${SLOT_UNLOCK_9.toLocaleString()} 分立刻升至 9 槽，台上有球也切换。底部大约 ${(SLOT_TRANSITION_MS / 1000).toFixed(1)} 秒收窄旧槽、从两侧长出新槽，颜色和倍率一起缓动。5 槽、7 槽和 9 槽最外侧贴着侧墙，没有贴墙的漏槽。5 槽五格等宽，只去掉贴墙的两条斜纹漏口，中间四条漏口还在并且一样宽。7 槽七格等宽，只去掉最外侧两格旁边的两条斜纹漏口，中间四条漏口还在并且一样宽。9 槽九格等宽，四条斜纹漏口留在 ×3 与 ×5、×10 与 ×20、×20 与 ×10、×5 与 ×3 之间，一样宽；其余相邻计分槽只留浅色隔板。再来一局回到 5 槽；刷新重新开始。GM 保持分数模式才会接着这一局。`;
}
function updateLayout() {
  updateCollections(); updateSlotTier(); updateTimeFlow(performance.now(), true);
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
function openPanel(id) {
  if (miniGames.open) return;
  if (state.over && id !== 'leaderboard') return;
  endCharge(false);
  for (const panel of panels()) if (panel && panel.id !== id && panel.id !== 'settlement') panel.close();
  if (id === 'collection-book') updateCollections();
  const panel = $(`#${id}`); if (!panel.open) panel.showModal(); panel.scrollTop = 0;
}
$('#collection-return').addEventListener('click', () => $('#collection-book').close());
$('#close-collection').addEventListener('click', () => $('#collection-book').close());
$('#collection-button').addEventListener('click', () => openPanel('collection-book'));
$('#leaderboard-button').addEventListener('click', () => showLeaderboard());
$('#close-leaderboard').addEventListener('click', () => $('#leaderboard').close());
$('#leaderboard-return').addEventListener('click', () => $('#leaderboard').close());
$('#name-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = sanitizeName($('#player-name').value);
  if (!name) { $('#name-error').hidden = false; $('#player-name').focus(); return; }
  playerName = name;
  state.nameDecided = true;
  leaderboard.submit({ runId, name, score: state.score });
  persist();
  $('#name-entry').close();
  toast('名字已记下');
});
$('#name-skip').addEventListener('click', () => { state.nameDecided = true; persist(); $('#name-entry').close(); });
$('#name-entry').addEventListener('close', () => { if (state.over && !state.nameDecided) { state.nameDecided = true; persist(); } });
$('#play-again').addEventListener('click', () => restartRound());
$('#sound-button').addEventListener('click', () => { state.sound = !state.sound; unlockAudio(); updateSound(); persist(); if (state.sound) sound('confirm'); });
$('#settings-button').addEventListener('click', () => openPanel('settings'));
$('#close-settings').addEventListener('click', () => $('#settings').close()); $('#done-settings').addEventListener('click', () => $('#settings').close());
for (const panel of panels()) panel.addEventListener('click', event => { if (panel.id === 'settlement') return; if (event.target === panel) { const r = panel.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) panel.close(); } });
$('#volume').addEventListener('input', event => { state.volume = +event.target.value / 100; if (state.volume > 0) state.sound = true; unlockAudio(); updateSound(); persist(); });
$('#volume').addEventListener('change', () => sound('confirm'));
$('#music').addEventListener('change', event => { state.music = event.target.checked; unlockAudio(); updateSound(); persist(); });
$('#music-volume').addEventListener('input', event => { state.musicVolume = +event.target.value / 100; unlockAudio(); updateSound(); persist(); });
function applyFullWindow(enabled) {
  state.fullWindow = enabled === true;
  document.documentElement.classList.toggle('full-window', state.fullWindow);
  $('#full-window').checked = state.fullWindow;
  persist();
  requestAnimationFrame(() => { renderer.resize(); requestAnimationFrame(() => renderer.resize()); });
}
$('#full-window').addEventListener('change', event => applyFullWindow(event.target.checked));
if (!document.documentElement.requestFullscreen) $('#browser-fullscreen').hidden = true;
function syncFullscreenButton() {
  const on = document.fullscreenElement != null;
  $('#browser-fullscreen').textContent = on ? '退出浏览器全屏' : '浏览器全屏';
  $('#browser-fullscreen').setAttribute('aria-pressed', String(on));
}
$('#browser-fullscreen').addEventListener('click', () => {
  const root = document.documentElement;
  const action = document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.();
  if (action) action.catch(() => {});
});
document.addEventListener('fullscreenchange', () => { syncFullscreenButton(); renderer.resize(); });
syncFullscreenButton();
let fitTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(() => { renderer.resize(); fireworks.resize(); }, 80);
});
$('#time-flow').addEventListener('change', event => { state.timeFlow = event.target.checked; if (state.timeFlow) state.timeFlowStartedAt = Date.now(); updateTimeFlow(performance.now(), true); persist(); });
$('#calm').addEventListener('change', event => { state.calm = event.target.checked; updateCalm(); persist(); });
$('#vibrate').addEventListener('change', event => { state.vibrate = event.target.checked; haptics.setEnabled(state.vibrate); persist(); });
$('#best').textContent = state.best.toLocaleString(); $('#mobile-best').textContent = state.best.toLocaleString(); $('#score').textContent = state.score.toLocaleString(); $('#mobile-score').textContent = state.score.toLocaleString(); updateBallHud(); updateLayout(); updateSound(); updateCalm();
if (state.over) showSettlement();
frame = requestAnimationFrame(tick);
window.addEventListener('pagehide', () => { endCharge(false); persist(); cancelAnimationFrame(frame); frame = 0; audio?.suspend().catch(()=>{}); });
window.addEventListener('pageshow', () => { if (!frame) { last = 0; accumulator = 0; frame = requestAnimationFrame(tick); } syncAudioVisibility(); });
if (import.meta.env.DEV) Object.defineProperty(window, '__ponpon', { get: () => ({ score: state.score, runId, playerName, collections: structuredClone(state.collections), secretPending: state.secretPending, secretMultiplier: secretWave.multiplier, emissionPaused: game.emissionPaused, gm: state.gm, keepProgress: state.keepProgress, miniGame: miniGames.snapshot(), lastMiniGame, render3D: state.render3D, fullWindow: state.fullWindow, rendering: renderer.snapshot(), star: game.star ? { ...game.star } : null, activeBalls: game.balls.length, crowdLocked, boardLock: BOARD_CROWD_LOCK, boardUnlock: boardCrowdUnlock(), queueClock(factor = 8) { return game.queueClock(factor); }, queueJar(factor = 8) { return game.queueJar(factor); }, sealHole(on = true) { game.setScoreHoles(!on); return true; }, perfStart, perfRead, setRender3D(on) { setRenderMode(!!on); return state.render3D; }, setFullWindow(on) { applyFullWindow(!!on); return state.fullWindow; }, slots: state.slots, pins: game.pins.length,  auto: state.auto, charging: state.charging, charge: state.charge, chargeEffects: state.charging ? chargeEffectsAt(state.chargeElapsed) : null, pendingLaunches: game.pendingLaunches, stats: structuredClone(game.stats), rewards: structuredClone(game.rewards), collector: { count: game.collector.stored.length, capacity: game.collector.capacity, remaining: game.collector.remaining, outlets: game.collector.outlets.map(p => ({ ...p })) }, bumpers: game.bumpers.map(b => ({ ...b.position })), timeFlow: { enabled: state.timeFlow, startedAt: state.timeFlowStartedAt, phase: timePalette?.phase.id, position: timePalette?.phase.position, tokens: timeTokens.length }, gameClock: game.clock, slotMachine: structuredClone(game.slotMachine), centerRadius: game.bumpers[2].plugin.radius, canonNotes: canon.count, currentNote: currentNote?.name, positions: game.balls.map(b => ({ ...b.body.position, entered: b.entered, power: b.power, bonus: b.bonus, scoreFactor: b.scoreFactor, valueFactor: b.valueFactor })), music: backgroundMusic?.status, musicEnabled: state.music, musicVolume: state.musicVolume, audioState: audio?.state, setSlots(count) { state.slotsPinned = true; state.slotTransition = null; state.slots = count; game.setSlots(count); fx.slotGlows = Array(state.slots).fill(0); persist(); updateSlotTier(); updateDoubleControl(); }, doubleBall: state.ballCost > 1, ballCost: state.ballCost, tryLaunch(power = 0.65, burst = false) { launch(power, burst); const latest = game.balls.at(-1); return { stock: state.stock, available: availableBalls(), pending: game.pendingLaunches, valueFactor: latest ? latest.valueFactor : null, doubleBall: state.ballCost > 1, ballCost: state.ballCost }; }, grant(points) { state.slotsPinned = false; addScore(points); }, holdBall() { const ball = game.launch(1); return !!ball; }, releaseWave() { game.setSlots(state.slots); }, stock: state.stock, available: availableBalls(), over: state.over, launches: state.launches, bestCombo: state.bestCombo, bestSlot: state.bestSlot, setStock(n) { state.stock = Math.max(0, Math.floor(n)); updateBallHud(); persist(); }, dropSlot(column) { const ball = game.launch(1); if (!ball) return false; ball.entered = true; game.nudge(ball, pocketCenter(state.slots, column), TABLE.scoreLine - 1); game.step(); return true; }, dropDrain() { const drain = slotFrame(state.slots).regions.find(region => region.kind === 'drain'); const ball = game.launch(1); if (!ball || !drain) return false; ball.entered = true; game.nudge(ball, (drain.x0 + drain.x1) / 2, TABLE.scoreLine - 1); game.step(); return true; }, dropHole() { const hole = game.holes[0]; const ball = game.launch(1); if (!ball || !hole) return false; ball.entered = true; game.nudge(ball, hole.x - 40, hole.y, 0); game.step(); if (!game.balls.includes(ball)) return game.stats.jackpots > 0; game.nudge(ball, hole.x, hole.y, 0); game.step(); return game.stats.jackpots > 0; }, restart() { restartRound(); }, previewReels(reels, progress = 20) { const live = game.slotMachine; live.reels = [...reels]; live.stopped = [true, true, true]; live.spinning = false; live.spinMode = 'all'; live.activeReel = -1; live.progress = progress; }, previewJar(count) { const stored = game.collector.stored; stored.length = 0; for (let i = 0; i < count; i++) stored.push({ id: i + 1, scoreFactor: 1 }); }, setSlotMultiplier(n) { const live = game.slotMachine; const until = game.clock + 180000; live.tripleUntil = n >= 5 ? until : 0; live.pairUntil = n === 2 ? until : 0; }, previewRewards(hits) { hits.forEach((hit, index) => { if (Number.isFinite(hit)) game.rewards.hits[index] = hit; }); }, forceEnlarge() { return game.forceEnlarge(); }, tapScore(target = 'bunny', valueFactor = 8) { const named = { bunny: game.bumpers[0], bear: game.bumpers[1], cat: game.bumpers[2], diamond: game.diamonds[0], 'diamond-right': game.diamonds[1] }; const obstacle = named[target] || game.bumpers[0]; const ball = game.balls[0] || game.launch(0, valueFactor); if (!ball) return null; ball.entered = true; ball.bonus = false; ball.valueFactor = valueFactor; const before = state.score; game.nudge(ball, obstacle.position.x, obstacle.position.y + obstacle.plugin.radius + 15, -8); for (let i = 0; i < 16 && state.score === before; i++) game.step(); return { score: state.score, gained: state.score - before }; }, showGiftRims() { return game.parkBalls([[160, 118], [280, 118], [470, 118], [590, 118]].map(([x, y], index) => ({ x, y, bonus: true, valueFactor: [1, 2, 4, 8][index], scoreFactor: 1 }))); }, pinBall(x, y) { return game.pinBall(x, y); }, openSecret() { waitForSecret(); return state.secretPending; }, previewReelSpin(reels, reel, phase, next = BALL_SYMBOL) { const live = game.slotMachine; live.reels = phase === 'stop' ? reels.map((symbol, index) => index === reel ? next : symbol) : [...reels]; live.target = live.reels.slice(); live.stopped = [true, true, true]; live.spinning = phase === 'spin'; live.spinMode = phase === 'spin' ? 'reel' : 'all'; live.activeReel = phase === 'spin' ? reel : -1; if (phase === 'spin') { live.stopped[reel] = false; live.startedAt = game.clock - 180; live.stopAt = [0, 0, 0]; live.stopAt[reel] = game.clock + 60000; } live.progress = 12; }, presentSlot(reels) { const balls = reels.filter(reel => reel === BALL_SYMBOL).length; const distinct = new Set(reels).size; const multiplier = distinct === 1 ? 5 : distinct === 2 ? 2 : 1; const live = game.slotMachine; live.reels = [...reels]; live.stopped = [true, true, true]; live.spinning = false; live.spinMode = 'all'; live.activeReel = -1; surprise({ kind: 'slot-result', at: game.clock, reels: [...reels], multiplier, balls, ballPayout: ballPayout(balls), duration: multiplier === 5 ? 60000 : multiplier === 2 ? 180000 : 0, x: SLOT_DISPLAY.x, y: SLOT_DISPLAY.y }); } }) });
