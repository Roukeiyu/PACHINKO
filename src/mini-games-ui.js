import { createMiniGame, MINI_GAMES, MINI_DURATION, BLOCK_CLEAR_TARGET, BLOCK_COLORS, BLOCK_SYMBOLS, MINI_HIT_SHAKE, MINI_HIT_MS, comboMultiplier, formatComboMultiplier, PAIR_DURATION, PAIR_TARGET, PAIR_CLEAR_BONUS, AFK_BALL_TEXT, miniGameIdle, miniIntro, MOLE_FLIP_MS } from './mini-games.js';
import { PAIR_SVG } from './pair-icons.js';
import { secretPayout } from './secret-wave.js';
import { SECRET_BALLS } from './round.js';

export const miniGameMarkup = `<dialog id="mini-game" class="mini-dialog" aria-labelledby="mini-title" aria-describedby="mini-rule" data-phase="intro"><div class="mini-inner"><div class="mini-heading"><span class="mini-eyebrow">秘密小游戏</span><span id="mini-round" hidden></span></div><h2 id="mini-title"></h2><div id="mini-intro"><p id="mini-rule"></p><dl class="mini-facts"><div><dt>时间</dt><dd id="mini-intro-time"></dd></div><div><dt>目标</dt><dd id="mini-intro-goal"></dd></div><div><dt>奖励</dt><dd id="mini-intro-reward"></dd></div></dl><button type="button" id="mini-start">开始</button></div><div id="mini-play" hidden><div class="mini-hud"><span>剩余 <strong id="mini-time">30</strong> 秒</span><span id="mini-combo" class="mini-combo" aria-live="polite"></span><span>本局 <strong id="mini-score">0</strong> 分<span id="mini-bonus" class="mini-bonus">×2</span></span></div><progress id="mini-progress" max="${MINI_DURATION}" value="${MINI_DURATION}" aria-label="小游戏剩余时间"></progress><div id="mini-stage"><div id="mini-fx" class="mini-fx" aria-hidden="true"></div><div id="mini-grid" class="mini-grid"></div></div><p id="mini-message" role="status"></p><div id="mini-result" hidden><div class="mini-result-mark">✦</div><h3 id="mini-result-title"></h3><p id="mini-result-math" class="mini-result-math" hidden></p><p id="mini-result-score"></p><p id="mini-result-balls" class="mini-result-balls" hidden></p><button class="done-button" id="mini-return">返回球台</button></div></div></div></dialog>`;
export function createMiniGamesUI({ root, onFinish, onExit, onPoints = () => {}, vibrate = () => {} }) {
  const $ = selector => root.querySelector(selector);
  let game=null, source=null, scoreMultiplier=1, revision=-1, fxId=0, settled=false, buttons=[], ballGrant=SECRET_BALLS, busy=false, motionSeen=0, motionToken=0, pending=null, confirmKey=false, flipping=false, flipToken=0;
  const calm = () => document.documentElement.classList.contains('calm');
  const gentle = () => calm() || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  // Play time follows foreground frames only. A hidden tab must not spend the 30s.
  let visibleAt=0, lastWall=0;
  document.addEventListener('visibilitychange', () => { if (document.hidden) lastWall = 0; });
  function visibleNow(now) {
    if (document.hidden) { lastWall = 0; return visibleAt; }
    if (!lastWall) { lastWall = now; return visibleAt; }
    visibleAt += Math.max(0, now - lastWall);
    lastWall = now;
    return visibleAt;
  }
  function burst(fx) {
    const score=$('#mini-score');
    if (!fx.broken) { score.classList.remove('mini-score-pop'); void score.offsetWidth; score.classList.add('mini-score-pop'); }
    if (fx.broken || calm()) return;
    const layer=$('#mini-fx'); layer.replaceChildren();
    const origin=layer.getBoundingClientRect();
    const tier=Math.min(4, fx.combo||1);
    const cells=(fx.cells||[]).slice(0,8);
    for (const [nth, index] of cells.entries()) {
      const button=buttons[index]; if (!button) continue;
      const rect=button.getBoundingClientRect();
      const x=rect.left-origin.left+rect.width/2, y=rect.top-origin.top+rect.height/2;
      if (fx.kind==='moles') {
        const hammer=document.createElement('span'); hammer.className='mini-hammer'; hammer.textContent='🔨'; hammer.style.left=`${x}px`; hammer.style.top=`${y}px`; layer.append(hammer);
        button.classList.add('mini-squash');
      } else if (fx.kind==='pairs') {
        const ghost=document.createElement('span'); ghost.className='mini-ghost';
        const markup=PAIR_SVG[fx.icons?.[nth]];
        if (markup) ghost.innerHTML=markup; else ghost.textContent='✦';
        ghost.style.left=`${x}px`; ghost.style.top=`${y}px`; layer.append(ghost);
      } else if (fx.kind!=='blocks') button.classList.add('mini-burst');
      const count=Math.min(14, 4+tier*2);
      for (let i=0;i<count;i++) {
        const bit=document.createElement('i'); bit.className='mini-bit';
        bit.style.left=`${x}px`; bit.style.top=`${y}px`;
        bit.style.setProperty('--dx',`${Math.cos(i*1.3)* (10+tier*6)}px`);
        bit.style.setProperty('--dy',`${Math.sin(i*1.3)* (10+tier*6)}px`);
        layer.append(bit);
      }
    }
    if (fx.points) {
      const anchor=buttons[cells[0]];
      const rect=anchor?anchor.getBoundingClientRect():layer.getBoundingClientRect();
      const pop=document.createElement('b'); pop.className='mini-float'; pop.dataset.tier=String(tier);
      pop.textContent=`+${fx.points.toLocaleString()}${fx.chains?` 连锁${fx.chains}`:''}`;
      pop.style.left=`${rect.left-origin.left+rect.width/2}px`; pop.style.top=`${rect.top-origin.top}px`;
      layer.append(pop);
    }
    const flash=document.createElement('span'); flash.className='mini-flash'; layer.append(flash);
    const distance=Math.min(2.5, MINI_HIT_SHAKE+(tier-1)*.25);
    root.animate([{transform:'translate(0,0)'},{transform:`translate(${distance}px,${distance*-.4}px)`},{transform:`translate(${-distance}px,0)`},{transform:'translate(0,0)'}],{duration:MINI_HIT_MS,easing:'ease-out'});
    try { vibrate(Math.min(18, 10+tier)); } catch { /* the page can refuse vibration */ }
    setTimeout(()=>{ layer.replaceChildren(); buttons.forEach(button=>button.classList.remove('mini-squash','mini-fly','mini-burst')); }, 280);
  }
  function endFlip() {
    flipping = false;
    busy = false;
    root.removeAttribute('data-busy');
    $('#mini-grid').classList.remove('is-flipping');
    buttons.forEach(button => {
      button.getAnimations().forEach(anim => anim.cancel());
      button.classList.remove('mini-squash');
      button.style.transform = '';
      button.style.opacity = '';
    });
  }
  // Every hole turns over together, on the game clock. Reduced motion fades.
  function playFlip(s) {
    if (flipToken === s.flipUntil) return;
    flipToken = s.flipUntil;
    flipping = true;
    busy = true;
    root.dataset.busy = '1';
    $('#mini-grid').classList.add('is-flipping');
    buttons.forEach(button => {
      button.disabled = true;
      button.classList.remove('mini-squash');
      button.getAnimations().forEach(anim => anim.cancel());
    });
  }
  function poseFlip(s, now) {
    const soft = gentle();
    const duration = soft ? 180 : 260;
    buttons.forEach((button, index) => {
      const delay = soft ? 0 : index * 4;
      const elapsed = Math.min(MOLE_FLIP_MS, Math.max(0, now - s.flipFrom)) - delay;
      const local = Math.min(1, Math.max(0, elapsed / duration));
      if (soft) {
        button.style.transform = '';
        button.style.opacity = String(1 - Math.sin(local * Math.PI) * 0.85);
      } else {
        const angle = local <= 0.5 ? local * 180 : (1 - local) * 180;
        button.style.opacity = '';
        button.style.transform = `rotateY(${angle.toFixed(2)}deg)`;
      }
    });
  }
  function rowStride() {
    if (buttons.length < 11) return 0;
    const first = buttons[0].getBoundingClientRect();
    const below = buttons[10].getBoundingClientRect();
    const stride = below.top - first.top;
    return stride > 1 ? stride : first.height + 4;
  }
  function faceBlock(button, cell, index) {
    button.dataset.tileId = String(cell.id);
    button.className = `mini-cell mini-color-${cell.color}`;
    button.hidden = false;
    button.disabled = true;
    button.textContent = BLOCK_SYMBOLS[cell.color];
    button.setAttribute('aria-label', `${BLOCK_COLORS[cell.color]}色方块，第 ${Math.floor(index / 10) + 1} 行 ${index % 10 + 1} 列`);
    button.style.opacity = '';
    button.style.transform = '';
  }
  function renderBoard(s) {
    const grid = $('#mini-grid');
    s.board.forEach((cell, index) => {
      const button = buttons[index];
      button.getAnimations().forEach(anim => anim.cancel());
      button.dataset.tileId = cell ? String(cell.id) : '';
      button.className = 'mini-cell';
      button.style.removeProperty('--fall');
      button.style.transform = '';
      button.style.opacity = '';
      button.hidden = false;
      button.disabled = busy || s.status !== 'playing';
      button.setAttribute('aria-pressed', String(s.selected === index));
      if (!cell) { button.classList.add('mini-removed'); button.disabled = true; button.textContent = ''; delete button.dataset.icon; button.setAttribute('aria-label', '已消除'); return; }
      if (s.kind === 'pairs') { button.dataset.icon = cell.icon; button.innerHTML = PAIR_SVG[cell.icon] || ''; button.setAttribute('aria-label', `${cell.name}，第 ${index + 1} 格`); button.classList.toggle('mini-selected', s.selected === index); }
      if (s.kind === 'blocks') {
        button.classList.add(`mini-color-${cell.color}`);
        button.textContent = BLOCK_SYMBOLS[cell.color];
        button.setAttribute('aria-label', `${BLOCK_COLORS[cell.color]}色方块，第 ${Math.floor(index / 10) + 1} 行 ${index % 10 + 1} 列`);
      }
      if (s.kind === 'moles') {
        button.classList.add('mini-hole');
        button.classList.toggle('mini-hit', cell.hit);
        button.classList.toggle('mini-mole', cell.type === 'mole' && !cell.hit);
        button.textContent = cell.hit ? '✧' : cell.type === 'mole' ? '🐹' : '🥬';
        button.disabled ||= cell.hit;
        button.setAttribute('aria-label', cell.hit ? '已打中' : cell.type === 'mole' ? '地鼠' : '白菜');
      }
    });
    if (!busy) grid.classList.remove('is-falling');
  }
  function playMotion(steps) {
    const token = ++motionToken;
    const soft = gentle();
    busy = true;
    root.dataset.busy = '1';
    const grid = $('#mini-grid');
    grid.classList.add('is-falling');
    buttons.forEach(button => { button.disabled = true; });
    game.setInputLock(true, visibleNow(performance.now()));
    (async () => {
      try {
        for (const step of steps) {
          if (token !== motionToken || !game) return;
          const popMs = soft ? 50 : 80;
          const pops = [];
          for (const pop of step.pops) {
            const button = buttons[pop.index];
            if (!button) continue;
            pops.push(button.animate([
              { transform: 'scale(1)', opacity: 1, offset: 0 },
              { transform: 'scale(1.15)', opacity: 1, offset: 0.35 },
              { transform: 'scale(0.2)', opacity: 0, offset: 1 },
            ], { duration: popMs, easing: 'ease-in', fill: 'forwards' }));
          }
          await wait(popMs);
          if (token !== motionToken || !game) return;
          pops.forEach(anim => anim.cancel());
          const stride = rowStride();
          let dropMs = soft ? 50 : 90;
          step.board.forEach((cell, index) => faceBlock(buttons[index], cell, index));
          const drops = [];
          for (const move of step.moves) {
            const button = buttons[move.to];
            if (!button) continue;
            const down = move.distance * stride;
            const duration = soft ? Math.min(120, 55 + move.distance * 12) : Math.min(260, 100 + move.distance * 24);
            dropMs = Math.max(dropMs, duration);
            const frames = soft ? [
              { transform: `translateY(${-down}px)` },
              { transform: 'translateY(0px)' },
            ] : [
              { transform: `translateY(${-down}px)`, easing: 'cubic-bezier(.18,.8,.28,1)' },
              { transform: `translateY(${down * 0.08}px)`, offset: 0.74, easing: 'ease-out' },
              { transform: `translateY(${-down * 0.03}px)`, offset: 0.88, easing: 'ease-out' },
              { transform: 'translateY(0px)', offset: 1 },
            ];
            drops.push(button.animate(frames, { duration, easing: soft ? 'ease-out' : 'linear', fill: 'both' }));
          }
          await wait(dropMs);
          if (token !== motionToken || !game) return;
          drops.forEach(anim => anim.cancel());
          buttons.forEach(button => { button.style.transform = ''; button.style.opacity = ''; });
        }
      } finally {
        if (token === motionToken) {
          busy = false;
          root.removeAttribute('data-busy');
          grid.classList.remove('is-falling');
          if (game) {
            game.setInputLock(false, visibleNow(performance.now()));
            renderBoard(game.state);
            paint();
          }
        }
      }
    })();
  }
  function showResult(s) {
    settled=true;$('#mini-grid').hidden=true;$('#mini-message').hidden=true;$('#mini-result').hidden=false;
    $('#mini-result-title').textContent=s.status==='complete'?'挑战完成！':'时间到啦';
    const math=$('#mini-result-math');
    if (s.kind==='blocks') {
      math.hidden=false;
      const peak = comboMultiplier(s.bestCombo);
      const peakText = Number.isInteger(peak) ? String(peak) : peak.toFixed(1);
      math.textContent=`${s.baseScore.toLocaleString()} × ${peakText} = ${s.score.toLocaleString()}`;
      math.classList.remove('is-on'); void math.offsetWidth; math.classList.add('is-on');
    } else if (s.kind==='pairs' && s.clearBonus) {
      math.hidden=false;
      math.textContent=`全部配对 +${PAIR_CLEAR_BONUS}`;
      math.classList.remove('is-on'); void math.offsetWidth; math.classList.add('is-on');
    } else { math.hidden=true; math.textContent=''; math.classList.remove('is-on'); }
    const paid=secretPayout(s.score, scoreMultiplier);
    const moleNote=s.kind==='moles'?` · 打中 ${s.hit}/40 只`:'';
    const doubleNote=scoreMultiplier>1?' · 双球入洞 ×2':'';
    $('#mini-result-score').textContent=`收下 ${paid.toLocaleString()} 分快乐${moleNote}${doubleNote}`;
    const ballLine = $('#mini-result-balls');
    const idle = miniGameIdle(s);
    ballLine.classList.toggle('is-afk', idle);
    if (source === 'secret' && !idle) { ballLine.hidden = false; ballLine.textContent = `+${ballGrant} 球`; }
    else if (idle) { ballLine.hidden = false; ballLine.textContent = AFK_BALL_TEXT; }
    else { ballLine.hidden = true; ballLine.textContent = ''; }
    onFinish({kind:s.kind,score:paid,baseScore:s.score,multiplier:scoreMultiplier,source,status:s.status,bestCombo:s.bestCombo,played:s.played===true,idle});
    $('#mini-return').focus();
  }
  function paint() {
    if (!game) return;
    const s=game.state;
    $('#mini-time').textContent=String(Math.ceil(game.remaining(visibleAt)/1000));
    $('#mini-score').textContent=s.score.toLocaleString();
    $('#mini-score').classList.toggle('is-hot', s.combo>=4);
    const combo=$('#mini-combo');
    combo.textContent=s.kind==='blocks'||s.combo?`${s.combo} 连击 ${formatComboMultiplier(s.combo)}`:'连击 —';
    combo.dataset.tier=String(Math.min(4,s.combo));
    combo.classList.toggle('is-on', s.combo>0);
    $('#mini-bonus').classList.toggle('is-on', scoreMultiplier > 1);
    $('#mini-bonus').textContent=`×${scoreMultiplier}`;
    const progress=$('#mini-progress');
    if (s.kind==='blocks') {
      progress.max=BLOCK_CLEAR_TARGET;
      progress.value=Math.min(s.removed, BLOCK_CLEAR_TARGET);
      progress.setAttribute('aria-label','已消除方块');
      $('#mini-round').textContent=`已消除 ${Math.min(s.removed, BLOCK_CLEAR_TARGET)}/${BLOCK_CLEAR_TARGET}`;
    } else if (s.kind==='pairs') {
      progress.max=PAIR_DURATION;
      progress.value=game.remaining(visibleAt);
      progress.setAttribute('aria-label','小游戏剩余时间');
      $('#mini-round').textContent=`${s.removed / 2}/${PAIR_TARGET} 对`;
    } else {
      progress.max=MINI_DURATION;
      progress.value=game.remaining(visibleAt);
      progress.setAttribute('aria-label','小游戏剩余时间');
      $('#mini-round').textContent=`第 ${s.wave}/10 轮 · ${s.hit}/40 只`;
    }
    if (revision !== s.revision) {
      revision = s.revision;
      $('#mini-message').textContent = s.message;
      const falling = s.kind === 'blocks' && s.motionSeq !== motionSeen && s.motion?.length;
      const clearing = s.kind === 'moles' && s.flipUntil > 0;
      if (falling) { motionSeen = s.motionSeq; playMotion(s.motion); }
      else if (clearing) { if (!flipping) renderBoard(s); playFlip(s); }
      else if (!busy) renderBoard(s);
      if (s.fx && s.fx.id !== fxId) {
        fxId = s.fx.id;
        const cells = falling && s.motion[0]?.pops?.length ? s.motion[0].pops.map(pop => pop.index) : s.fx.cells;
        burst({ ...s.fx, cells });
      }
    }
    if (flipping && s.flipUntil > 0) poseFlip(s, visibleAt);
    if (flipping && !(s.flipUntil > 0)) {
      endFlip();
      if (s.status === 'playing') renderBoard(s);
    }
    if (!busy && s.status !== 'playing' && !settled) showResult(s);
  }
  function beginRound() {
    if (!pending || game) return;
    const kind=pending.kind; pending=null;
    const now=performance.now(); visibleAt=now; lastWall=now;
    game=createMiniGame(kind,{now}); settled=false; revision=-1; fxId=0; busy=false; flipping=false; flipToken=0; motionSeen=0; motionToken++;
    root.removeAttribute('data-busy');
    const definition=MINI_GAMES[kind];
    root.dataset.phase='play'; root.removeAttribute('aria-describedby');
    $('#mini-intro').hidden=true; $('#mini-play').hidden=false; $('#mini-round').hidden=false;
    $('#mini-grid').hidden=false; $('#mini-grid').classList.remove('is-falling','is-flipping'); $('#mini-message').hidden=false; $('#mini-result').hidden=true;
    $('#mini-grid').style.setProperty('--columns',definition.columns);
    buttons=Array.from({length:definition.columns*definition.rows},(_,index)=>{const button=document.createElement('button');button.type='button';button.dataset.cell=index;return button;});
    $('#mini-grid').replaceChildren(...buttons);
    paint(); buttons.find(b=>!b.disabled)?.focus();
  }
  function start(kind, origin='secret', multiplier=1, holeBalls=SECRET_BALLS) {
    if (root.open) return false;
    source=origin; scoreMultiplier=origin==='secret'&&multiplier>=2?2:1; ballGrant=Math.max(0, Math.floor(Number(holeBalls)) || 0) || SECRET_BALLS;
    pending={kind}; game=null; settled=false; revision=-1; fxId=0; busy=false; motionSeen=0; motionToken++; confirmKey=false;
    root.removeAttribute('data-busy'); visibleAt=0; lastWall=0;
    const card=miniIntro(kind,{source,ballGrant,doubled:scoreMultiplier>1});
    $('#mini-title').textContent=card.title; $('#mini-rule').textContent=card.rule;
    $('#mini-intro-time').textContent=card.time; $('#mini-intro-goal').textContent=card.goal; $('#mini-intro-reward').textContent=card.reward;
    root.dataset.kind=kind; root.dataset.phase='intro'; root.setAttribute('aria-describedby','mini-rule');
    $('#mini-intro').hidden=false; $('#mini-play').hidden=true; $('#mini-round').hidden=true;
    $('#mini-grid').replaceChildren(); buttons=[];
    $('#mini-return').textContent=source==='gm'?'返回设置':'返回球台';
    root.showModal(); $('#mini-start').focus(); return true;
  }
  $('#mini-start').addEventListener('click',()=>beginRound());
  root.addEventListener('keydown',event=>{
    if (event.key!=='Enter' && event.key!==' ') return;
    if (root.dataset.phase!=='intro' && !confirmKey) return;
    event.preventDefault(); event.stopPropagation();
    if (root.dataset.phase!=='intro' || event.repeat) return;
    confirmKey=true; beginRound();
  });
  root.addEventListener('keyup',event=>{ if (event.key==='Enter' || event.key===' ') confirmKey=false; });
  window.addEventListener('blur',()=>{ confirmKey=false; });
  $('#mini-grid').addEventListener('click',event=>{
    const button=event.target.closest('[data-cell]');if(!button||!game||settled||busy)return;
    const points=game.select(+button.dataset.cell,visibleNow(performance.now()));if(points)onPoints(points);paint();
  });
  $('#mini-return').addEventListener('click',()=>{if(!settled)return;motionToken++;busy=false;confirmKey=false;pending=null;const origin=source;root.close();game=null;source=null;onExit(origin);});
  root.addEventListener('cancel',event=>event.preventDefault());
  return { start, update(now){if(!(root.open&&game&&!settled)||document.hidden){if(document.hidden)lastWall=0;return;}game.tick(visibleNow(now));paint();}, get open(){return root.open;}, get source(){return source;}, snapshot:()=>game?.snapshot()??null };
}
