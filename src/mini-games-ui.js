import { createMiniGame, MINI_GAMES, MINI_DURATION, BLOCK_CLEAR_TARGET, BLOCK_COLORS, BLOCK_SYMBOLS, MINI_HIT_SHAKE, MINI_HIT_MS, comboMultiplier, formatComboMultiplier, PAIR_DURATION, PAIR_TARGET } from './mini-games.js';
import { PAIR_SVG } from './pair-icons.js';
import { secretPayout } from './secret-wave.js';
import { SECRET_BALLS } from './round.js';

export const miniGameMarkup = `<dialog id="mini-game" class="mini-dialog" aria-labelledby="mini-title" aria-describedby="mini-rule"><div class="mini-inner"><div class="mini-heading"><span class="mini-eyebrow">秘密小游戏</span><span id="mini-round"></span></div><h2 id="mini-title"></h2><p id="mini-rule"></p><div class="mini-hud"><span>剩余 <strong id="mini-time">30</strong> 秒</span><span id="mini-combo" class="mini-combo" aria-live="polite"></span><span>本局 <strong id="mini-score">0</strong> 分<span id="mini-bonus" class="mini-bonus">×2</span></span></div><progress id="mini-progress" max="${MINI_DURATION}" value="${MINI_DURATION}" aria-label="小游戏剩余时间"></progress><div id="mini-stage"><div id="mini-fx" class="mini-fx" aria-hidden="true"></div><div id="mini-grid" class="mini-grid"></div></div><p id="mini-message" role="status"></p><div id="mini-result" hidden><div class="mini-result-mark">✦</div><h3 id="mini-result-title"></h3><p id="mini-result-math" class="mini-result-math" hidden></p><p id="mini-result-score"></p><p id="mini-result-balls" class="mini-result-balls" hidden></p><button class="done-button" id="mini-return">返回球台</button></div></div></dialog>`;
export function createMiniGamesUI({ root, onFinish, onExit, onPoints = () => {}, vibrate = () => {} }) {
  const $ = selector => root.querySelector(selector);
  let game=null, source=null, scoreMultiplier=1, revision=-1, fxId=0, settled=false, buttons=[];
  const calm = () => document.documentElement.classList.contains('calm');
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
      } else button.classList.add('mini-burst');
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
      revision=s.revision;$('#mini-message').textContent=s.message;
      s.board.forEach((cell,index)=>{
        const button=buttons[index], previousTile=button.dataset.tileId;
        button.dataset.tileId=cell?String(cell.id):'';
        button.className='mini-cell';button.style.removeProperty('--fall');
        button.hidden=false;button.disabled=s.status!=='playing';button.setAttribute('aria-pressed',String(s.selected===index));
        if (!cell) { button.classList.add('mini-removed');button.disabled=true;button.textContent='';delete button.dataset.icon;button.setAttribute('aria-label','已消除');return; }
        if (s.kind==='pairs') { button.dataset.icon=cell.icon; button.innerHTML=PAIR_SVG[cell.icon]||''; button.setAttribute('aria-label',`${cell.name}，第 ${index+1} 格`); button.classList.toggle('mini-selected',s.selected===index); }
        if (s.kind==='blocks') {
          button.classList.add(`mini-color-${cell.color}`);button.textContent=BLOCK_SYMBOLS[cell.color];
          button.setAttribute('aria-label',`${BLOCK_COLORS[cell.color]}色方块，第 ${Math.floor(index/10)+1} 行 ${index%10+1} 列`);
          if(cell.fall && previousTile!==String(cell.id) && !document.documentElement.classList.contains('calm')) {button.style.setProperty('--fall',String(cell.fall));button.animate([{transform:`translateY(${-Math.min(cell.fall,3)*110}%)`,opacity:.4},{transform:'translateY(0)',opacity:1}],{duration:250,easing:'ease-out'});}
        }
        if (s.kind==='moles') {
          button.classList.add('mini-hole');button.classList.toggle('mini-hit',cell.hit);
          button.textContent=cell.hit?'✧':cell.type==='mole'?'🐹':cell.type==='cabbage'?'🥬':'';
          button.disabled ||= cell.hit || cell.type==='empty';
          button.setAttribute('aria-label',cell.hit?'已打中':cell.type==='mole'?'地鼠':cell.type==='cabbage'?'白菜':'空洞');
        }
      });
    }
      if (s.fx && s.fx.id!==fxId) { fxId=s.fx.id; burst(s.fx); }
      if (s.status!=='playing'&&!settled) {
      settled=true;$('#mini-grid').hidden=true;$('#mini-message').hidden=true;$('#mini-result').hidden=false;
      $('#mini-result-title').textContent=s.status==='complete'?'挑战完成！':'时间到啦';
      const math=$('#mini-result-math');
      if (s.kind==='blocks') {
        math.hidden=false;
        const peak = comboMultiplier(s.bestCombo);
        const peakText = Number.isInteger(peak) ? String(peak) : peak.toFixed(1);
        math.textContent=`${s.baseScore.toLocaleString()} × ${peakText} = ${s.score.toLocaleString()}`;
        math.classList.remove('is-on'); void math.offsetWidth; math.classList.add('is-on');
      } else { math.hidden=true; math.textContent=''; math.classList.remove('is-on'); }
      const paid=secretPayout(s.score, scoreMultiplier);
      const moleNote=s.kind==='moles'?` · 打中 ${s.hit}/40 只`:'';
      const doubleNote=scoreMultiplier>1?' · 双球入洞 ×2':'';
      $('#mini-result-score').textContent=`收下 ${paid.toLocaleString()} 分快乐${moleNote}${doubleNote}`;
      const ballLine = $('#mini-result-balls');
      if (source === 'secret') { ballLine.hidden = false; ballLine.textContent = `+${SECRET_BALLS} 球`; }
      else { ballLine.hidden = true; ballLine.textContent = ''; }
      onFinish({kind:s.kind,score:paid,baseScore:s.score,multiplier:scoreMultiplier,source,status:s.status,bestCombo:s.bestCombo});
      $('#mini-return').focus();
    }
  }
  function start(kind, origin='secret', multiplier=1) {
    if (root.open) return false;
    source=origin;scoreMultiplier=origin==='secret'&&multiplier>=2?2:1;const now=performance.now();visibleAt=now;lastWall=now;game=createMiniGame(kind,{now});settled=false;revision=-1;fxId=0;
    const definition=MINI_GAMES[kind];$('#mini-title').textContent=definition.title;$('#mini-rule').textContent=definition.rule;
    root.dataset.kind=kind;$('#mini-grid').hidden=false;$('#mini-message').hidden=false;$('#mini-result').hidden=true;
    $('#mini-grid').style.setProperty('--columns',definition.columns);
    buttons=Array.from({length:definition.columns*definition.rows},(_,index)=>{const button=document.createElement('button');button.type='button';button.dataset.cell=index;return button;});
    $('#mini-grid').replaceChildren(...buttons);$('#mini-return').textContent=source==='gm'?'返回设置':'返回球台';
    root.showModal();paint();buttons.find(b=>!b.disabled)?.focus();return true;
  }
  $('#mini-grid').addEventListener('click',event=>{
    const button=event.target.closest('[data-cell]');if(!button||!game||settled)return;
    const points=game.select(+button.dataset.cell,visibleNow(performance.now()));if(points)onPoints(points);paint();
  });
  $('#mini-return').addEventListener('click',()=>{if(!settled)return;const origin=source;root.close();game=null;source=null;onExit(origin);});
  root.addEventListener('cancel',event=>event.preventDefault());
  return { start, update(now){if(!(root.open&&game&&!settled)||document.hidden){if(document.hidden)lastWall=0;return;}game.tick(visibleNow(now));paint();}, get open(){return root.open;}, get source(){return source;}, snapshot:()=>game?.snapshot()??null };
}
