import { createMiniGame, MINI_GAMES, MINI_DURATION, BLOCK_COLORS, BLOCK_SYMBOLS } from './mini-games.js';

export const miniGameMarkup = `<dialog id="mini-game" class="mini-dialog" aria-labelledby="mini-title" aria-describedby="mini-rule"><div class="mini-inner"><div class="mini-heading"><span class="mini-eyebrow">秘密小游戏</span><span id="mini-round"></span></div><h2 id="mini-title"></h2><p id="mini-rule"></p><div class="mini-hud"><span>剩余 <strong id="mini-time">30</strong> 秒</span><span>本局 <strong id="mini-score">0</strong> 分</span></div><progress id="mini-progress" max="${MINI_DURATION}" value="${MINI_DURATION}" aria-label="小游戏剩余时间"></progress><div id="mini-grid" class="mini-grid"></div><p id="mini-message" role="status"></p><div id="mini-result" hidden><div class="mini-result-mark">✦</div><h3 id="mini-result-title"></h3><p id="mini-result-score"></p><button class="done-button" id="mini-return">返回球台</button></div></div></dialog>`;
export function createMiniGamesUI({ root, onFinish, onExit, onPoints = () => {} }) {
  const $ = selector => root.querySelector(selector);
  let game=null, source=null, revision=-1, settled=false, buttons=[];
  function paint() {
    if (!game) return;
    const s=game.state;
    $('#mini-time').textContent=String(Math.ceil(game.remaining(performance.now())/1000));
    $('#mini-score').textContent=s.score.toLocaleString();
    $('#mini-progress').value=game.remaining(performance.now());
    $('#mini-round').textContent=s.kind==='moles'?`第 ${s.wave}/10 轮 · ${s.hit}/40 只`:s.kind==='pairs'?`${s.removed/2}/20 对`:`目标 1000 分`;
    if (revision !== s.revision) {
      revision=s.revision;$('#mini-message').textContent=s.message;
      s.board.forEach((cell,index)=>{
        const button=buttons[index], previousTile=button.dataset.tileId;
        button.dataset.tileId=cell?String(cell.id):'';
        button.className='mini-cell';button.style.removeProperty('--fall');
        button.hidden=false;button.disabled=s.status!=='playing';button.setAttribute('aria-pressed',String(s.selected===index));
        if (!cell) { button.classList.add('mini-removed');button.disabled=true;button.textContent='';button.setAttribute('aria-label','已消除');return; }
        if (s.kind==='pairs') { button.textContent=cell.icon;button.setAttribute('aria-label',`${cell.icon}，第 ${index+1} 格`);button.classList.toggle('mini-selected',s.selected===index); }
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
    if (s.status!=='playing'&&!settled) {
      settled=true;$('#mini-grid').hidden=true;$('#mini-message').hidden=true;$('#mini-result').hidden=false;
      $('#mini-result-title').textContent=s.status==='complete'?'挑战完成！':'时间到啦';
      $('#mini-result-score').textContent=`收下 ${s.score.toLocaleString()} 分快乐${s.kind==='moles'?` · 打中 ${s.hit}/40 只`:''}`;
      onFinish({kind:s.kind,score:s.score,source,status:s.status});
      $('#mini-return').focus();
    }
  }
  function start(kind, origin='secret') {
    if (root.open) return false;
    source=origin;game=createMiniGame(kind,{now:performance.now()});settled=false;revision=-1;
    const definition=MINI_GAMES[kind];$('#mini-title').textContent=definition.title;$('#mini-rule').textContent=definition.rule;
    root.dataset.kind=kind;$('#mini-grid').hidden=false;$('#mini-message').hidden=false;$('#mini-result').hidden=true;
    $('#mini-grid').style.setProperty('--columns',definition.columns);
    buttons=Array.from({length:definition.columns*definition.rows},(_,index)=>{const button=document.createElement('button');button.type='button';button.dataset.cell=index;return button;});
    $('#mini-grid').replaceChildren(...buttons);$('#mini-return').textContent=source==='gm'?'返回设置':'返回球台';
    root.showModal();paint();buttons.find(b=>!b.disabled)?.focus();return true;
  }
  $('#mini-grid').addEventListener('click',event=>{
    const button=event.target.closest('[data-cell]');if(!button||!game||settled)return;
    const points=game.select(+button.dataset.cell,performance.now());if(points)onPoints(points);paint();
  });
  $('#mini-return').addEventListener('click',()=>{if(!settled)return;const origin=source;root.close();game=null;source=null;onExit(origin);});
  root.addEventListener('cancel',event=>event.preventDefault());
  return { start, update(now){if(root.open&&game&&!settled){game.tick(now);paint();}}, get open(){return root.open;}, get source(){return source;}, snapshot:()=>game?.snapshot()??null };
}
