import Matter from 'matter-js';
import './style.css';

const { Engine, Bodies, Body, Composite, Events } = Matter;
const icons = {
  sound: '<path d="M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"/>',
  settings: '<path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3h3l2 3 3-1 1-3 3-1 2-3-2-2 1-3-2-3h-3l-2-2Z"/><circle cx="11.5" cy="12" r="3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M12 3v17m-6-6 6 6 6-6"/>',
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
  score: 0, balls: 0, best: Number.isFinite(saved.best) ? Math.max(0,saved.best) : 0, aim: 50, auto: false,
};
const persist = () => { try { localStorage.setItem('ponpon-settings', JSON.stringify({theme:state.theme,slots:state.slots,sound:state.sound,volume:state.volume,calm:state.calm,best:state.best})); } catch {} };
const mascot = `<svg class="mascot" viewBox="0 0 130 135" fill="none" aria-hidden="true"><ellipse cx="46" cy="32" rx="14" ry="30" transform="rotate(-14 46 32)" fill="#fffaf0" stroke="#d9cdbb" stroke-width="2"/><ellipse cx="84" cy="32" rx="14" ry="30" transform="rotate(14 84 32)" fill="#fffaf0" stroke="#d9cdbb" stroke-width="2"/><ellipse cx="45" cy="29" rx="6" ry="18" transform="rotate(-14 45 29)" fill="#efc4cb"/><ellipse cx="85" cy="29" rx="6" ry="18" transform="rotate(14 85 29)" fill="#efc4cb"/><path d="M19 83C19 53 39 43 65 43S111 53 111 83C111 111 92 127 65 127S19 111 19 83Z" fill="#fffaf0" stroke="#d9cdbb" stroke-width="2"/><ellipse cx="37" cy="91" rx="10" ry="6" fill="#f0bdc6"/><ellipse cx="93" cy="91" rx="10" ry="6" fill="#f0bdc6"/><ellipse cx="48" cy="80" rx="3" ry="4" fill="#435444"/><ellipse cx="82" cy="80" rx="3" ry="4" fill="#435444"/><path d="m62 90 3 3 3-3m-3 3v4m-6-1q3 5 6 1 3 4 6-1" stroke="#705d50" stroke-width="2" stroke-linecap="round"/><path d="M102 110c-9-6-24 3-23 11 13 3 21-1 23-11Z" fill="#a6b88b"/><path d="M79 121c-1-17-9-22-14-19-4 12 5 19 14 19Z" fill="#bfcd9d"/></svg>`;

document.querySelector('#app').innerHTML = `
<div class="shell">
  <header><div class="brand"><div class="brand-mark"><svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="#fff9e9"/><circle cx="15" cy="18" r="1.5" fill="#435444"/><circle cx="25" cy="18" r="1.5" fill="#435444"/><path d="M16 24q4 4 8 0" fill="none" stroke="#435444" stroke-width="1.5" stroke-linecap="round"/></svg></div><div><div class="brand-name">PON <span>PON</span><span style="font-size:13px;color:#89957a"> ✳</span></div><div class="brand-caption">A LITTLE JOY MACHINE</div></div></div><div class="header-actions"><span class="quiet-tag">TAKE A BREAK. MAKE A PON.</span><button class="icon-button" id="sound-button" aria-label="关闭音效"></button><button class="settings-button" id="settings-button">${icon('settings')}<span>游乐场设置</span></button></div></header>
  <section class="intro"><div><div class="eyebrow">YOUR DAILY DOSE OF HAPPY</div><h1>弹一点，小快乐<em>✧</em></h1><p>让小球自由下落，让烦恼轻轻弹开。</p></div><div class="intro-sticker">100% 快乐<br>0% 压力</div></section>
  <main class="game-layout">
    <section class="machine" aria-label="柏青哥游戏区"><div class="machine-top"><span class="machine-label"><i class="status-dot"></i> THE HAPPY LITTLE PACHINKO</span><span class="tiny-dots">● ● ●</span></div><div class="board-wrap"><canvas id="board" width="760" height="760" aria-label="柏青哥弹球台，使用下方滑块调整位置，发射按钮或空格键发射小球"></canvas><div class="board-caption">GOOD THINGS ARE FALLING<span>✧ &nbsp; enjoy the little things</span></div><div class="board-hint">点击球台，选择落点</div></div><div class="launch-control"><label class="aim-row" for="aim"><span>↔ &nbsp;发射位置</span><input type="range" min="8" max="92" value="50" id="aim" aria-label="发射位置"/><span id="aim-value">50%</span></label><div class="launch-row"><button class="launch-button" id="launch">${icon('arrow')} 发射小快乐 <kbd>SPACE</kbd></button><button class="auto-button" id="auto" aria-pressed="false">${icon('auto',16)}<span>自动投球</span></button></div><p class="machine-foot">每一颗小球，都有属于它的奇妙路线</p></div></section>
    <aside class="sidebar"><section class="card score-card"><div class="card-label">今日份快乐 <span class="small-label">HAPPY POINTS</span></div><div class="score-value"><span id="score">0</span><span class="score-unit">分</span></div><div class="score-divider"></div><div class="score-stats"><span>已投小球 &nbsp;<strong id="ball-count">0</strong></span><span>最高纪录 &nbsp;<strong id="best">0</strong></span></div></section><section class="card theme-card"><div class="card-label">今天，想去哪里？<span class="small-label">THEME</span></div><div class="theme-preview"><span class="mascot-spark one">✧</span><div id="mascot">${mascot}</div><span class="mascot-spark two">✳</span></div><div class="theme-name" id="theme-name"></div><div class="theme-description" id="theme-description"></div><div class="theme-pills">${Object.entries(themes).map(([key,t])=>`<button class="theme-pill" data-theme="${key}">${t.label}</button>`).join('')}</div></section><section class="card how-card"><div class="card-label">快乐使用说明 <span>↗</span></div><ol><li><span class="step-no">01</span>移动滑块，选一个心仪的落点</li><li><span class="step-no">02</span>轻轻发射，交给重力和一点运气</li><li><span class="step-no">03</span>叮！把落袋的小快乐收集起来</li></ol></section><div class="little-note">✿ &nbsp; 不用赶路，弹一会儿也很好</div></aside>
  </main><div class="bottom-info"><span>✧ &nbsp; 真实物理碰撞 · 无限次小快乐</span><span class="sound-indicator"><span class="sound-bars"><i></i><i></i><i></i></span><span id="sound-status">声音已开启，快乐有回响</span></span></div><footer class="footer"><span>PON PON · YOUR POCKET-SIZED HAPPY PLACE</span><span>MADE WITH <b>♡</b> & A LITTLE BOUNCE</span></footer>
</div><div class="toast" id="toast" role="status"></div>
<dialog id="settings"><div class="dialog-inner"><div class="dialog-head"><h2>布置你的游乐场</h2><button class="icon-button" id="close-settings" aria-label="关闭设置">${icon('close')}</button></div><p class="dialog-sub">换一种心情，再接住一颗小快乐。</p><div class="setting-label">落袋槽位<small>越多槽位，越多惊喜</small></div><div class="choices">${[5,7,9].map(n=>`<button class="choice" data-slots="${n}">${n} 个槽位</button>`).join('')}</div><div class="setting-label">游乐场主题</div><div class="choices">${Object.entries(themes).map(([key,t])=>`<button class="choice theme-choice" data-theme="${key}"><span>${t.emoji}</span>${t.label}主题</button>`).join('')}</div><label class="setting-row" for="volume">音效音量<input id="volume" type="range" min="0" max="100" value="${state.volume*100}" /></label><label class="setting-row" for="calm">轻柔模式（减少装饰动效）<input id="calm" type="checkbox" ${state.calm?'checked':''}/></label><button class="done-button" id="done-settings">好啦，继续快乐</button><p class="setting-note">设置自动保存。调整槽位会清空在途小球，保留得分。</p></div></dialog>`;

const $ = (s) => document.querySelector(s);
let toastTimer;
function toast(message) { $('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2200); }

// All sounds are synthesized locally: no downloads, no autoplay and no audio assets.
let audio, master, lastPing=0;
function unlockAudio(){
  if(!state.sound) return;
  if(!audio){ const Audio = window.AudioContext || window.webkitAudioContext; if(!Audio) return; audio=new Audio();master=audio.createGain();master.gain.value=state.volume*.32;master.connect(audio.destination); }
  if(audio.state==='suspended') audio.resume().catch(()=>{});
}
function tone(freq,duration=.13,type='sine',delay=0,gain=.25,endFreq){
  if(!state.sound||!audio||audio.state!=='running')return;
  const t=audio.currentTime+delay, oscillator=audio.createOscillator(), envelope=audio.createGain();
  oscillator.type=type;oscillator.frequency.setValueAtTime(freq,t);if(endFreq)oscillator.frequency.exponentialRampToValueAtTime(endFreq,t+duration);
  envelope.gain.setValueAtTime(0,t);envelope.gain.linearRampToValueAtTime(gain,t+.008);envelope.gain.exponentialRampToValueAtTime(.001,t+duration);
  oscillator.connect(envelope);envelope.connect(master);oscillator.start(t);oscillator.stop(t+duration+.01);
  oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};
}
function sound(kind,value=0){
  if(kind==='launch'){tone(330,.14,'sine',0,.4,880);tone(110,.09,'triangle',0,.2);}
  if(kind==='pin'&&performance.now()-lastPing>45){lastPing=performance.now();tone([523,659,784,880,1047,1175][value%6],.11,'sine',0,.14);}
  if(kind==='score'){[523,659,784,value>=5?1319:1047].forEach((n,i)=>tone(n,.25,'sine',i*.065,.3));tone(180,.2,'triangle',0,.22,60);}
  if(kind==='theme'){tone(660,.12,'sine');tone(880,.16,'sine',.075);}
}

const canvas=$('#board'),ctx=canvas.getContext('2d'),W=760,H=760;
const engine=Engine.create({gravity:{x:0,y:1.22},positionIterations:8,velocityIterations:8});
const balls=[],pins=[],dividers=[],particles=[],ripples=[],popups=[];
const slotGlows=[];let frame=0, last=0,accumulator=0,lastDrop=-1000,lastAuto=0,clock=0;
const left=27,right=733,slotTop=651,scoreLine=715;
Composite.add(engine.world,[Bodies.rectangle(9,390,24,850,{isStatic:true,label:'wall',restitution:.7}),Bodies.rectangle(751,390,24,850,{isStatic:true,label:'wall',restitution:.7})]);
for(let row=0;row<10;row++){
  const cols=row%2===0?10:9;
  for(let col=0;col<cols;col++){
    const x=65+col*70+(row%2)*35,y=146+row*49;
    const body=Bodies.circle(x,y,6.6,{isStatic:true,restitution:.65,label:'pin',friction:.005});
    body.plugin={row,glow:0};pins.push(body);Composite.add(engine.world,body);
  }
}
function multipliers(){return state.slots===5?[2,3,10,3,2]:state.slots===7?[2,3,5,10,5,3,2]:[2,2,3,5,10,5,3,2,2];}
function makeSlots(){
  dividers.forEach(b=>Composite.remove(engine.world,b));dividers.length=0;
  balls.forEach(b=>Composite.remove(engine.world,b.body));balls.length=0;
  slotGlows.length=state.slots;slotGlows.fill(0);
  const width=(right-left)/state.slots;
  for(let i=1;i<state.slots;i++){
    const divider=Bodies.rectangle(left+i*width,705,6,108,{isStatic:true,chamfer:{radius:3},label:'divider',restitution:.5,friction:0});
    dividers.push(divider);Composite.add(engine.world,divider);
  }
}
makeSlots();
Events.on(engine,'collisionStart',event=>{
  for(const pair of event.pairs){
    const pin=pair.bodyA.label==='pin'?pair.bodyA:pair.bodyB.label==='pin'?pair.bodyB:null;
    const ball=pair.bodyA.label==='ball'?pair.bodyA:pair.bodyB.label==='ball'?pair.bodyB:null;
    if(!ball)continue;
    if(pin){pin.plugin.glow=1;sound('pin',pin.plugin.row);if(!state.calm)ripples.push({x:pin.position.x,y:pin.position.y,life:1,color:themes[state.theme].accent});}
  }
});

function launch(){
  if($('#settings').open)return;
  unlockAudio();
  const now=performance.now();if(now-lastDrop<150||balls.length>=35)return;
  lastDrop=now;
  const x=left+(right-left)*state.aim/100+(Math.random()-.5)*4;
  const body=Bodies.circle(x,64,10.5,{label:'ball',density:.009,restitution:.72,friction:.002,frictionAir:.0015});
  Body.setVelocity(body,{x:(Math.random()-.5)*1.1,y:1.2});
  Composite.add(engine.world,body);balls.push({body,trail:[],born:clock,lastY:64,stuck:0});
  state.balls++;$('#ball-count').textContent=state.balls;sound('launch');
}
function scoreBall(ball,index){
  const column=Math.max(0,Math.min(state.slots-1,Math.floor((ball.body.position.x-left)/((right-left)/state.slots))));
  const multiplier=multipliers()[column],points=multiplier*10;
  state.score+=points;state.best=Math.max(state.best,state.score);persist();
  $('#score').textContent=state.score.toLocaleString();$('#best').textContent=state.best.toLocaleString();
  $('.score-value').classList.remove('score-bump');void $('.score-value').offsetWidth;$('.score-value').classList.add('score-bump');
  slotGlows[column]=1;
  const x=left+(column+.5)*(right-left)/state.slots;
  popups.push({x,y:690,text:multiplier===10?`✦ 好幸运！ +${points}`:`+${points}`,life:1,big:multiplier===10});
  const count=state.calm?8:multiplier===10?65:35;
  for(let i=0;i<count;i++)particles.push({x,y:706,vx:(Math.random()-.5)*10,vy:-3-Math.random()*9,life:1,size:2+Math.random()*4,rotation:Math.random()*6,color:['#ee8d9d','#f0c26e','#8fae83','#fffef4','#bbabd5'][i%5],star:i%4===0});
  sound('score',multiplier);Composite.remove(engine.world,ball.body);balls.splice(index,1);
}
function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function star(x,y,r,rotation=0){ctx.beginPath();for(let i=0;i<8;i++){const a=rotation+i*Math.PI/4,rr=i%2?r*.3:r;const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fill();}
function draw(){
  const theme=themes[state.theme],t=state.calm?0:clock/1000;
  ctx.clearRect(0,0,W,H);ctx.fillStyle=theme.bg;ctx.fillRect(0,0,W,H);
  // Quiet texture and edge decorations stay behind the high-contrast glowing balls.
  ctx.fillStyle='#bdb39720';for(let x=16;x<W;x+=23)for(let y=15;y<H;y+=23){ctx.beginPath();ctx.arc(x,y,.8,0,Math.PI*2);ctx.fill();}
  ctx.save();ctx.globalAlpha=.33;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='29px sans-serif';
  [[44,105],[709,254],[43,409],[711,564]].forEach(([x,y],i)=>{ctx.save();ctx.translate(x+Math.sin(t*.8+i)*3,y+Math.sin(t+i)*5);ctx.rotate(Math.sin(t+i)*.1);ctx.fillText(theme.motifs[i],0,0);ctx.restore();});ctx.restore();
  ctx.fillStyle='#cfb47b60';[[121,98],[651,94],[40,537],[707,370],[339,618]].forEach(([x,y],i)=>star(x,y,4+Math.sin(t*1.5+i)*1.5,t*.13));
  const aimX=left+(right-left)*state.aim/100;
  ctx.setLineDash([3,7]);ctx.strokeStyle='#c3b4a16b';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(aimX,39);ctx.lineTo(aimX,120);ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.arc(aimX,63,17+Math.sin(t*3)*1.5,0,Math.PI*2);ctx.strokeStyle=theme.accent+'90';ctx.stroke();
  ctx.beginPath();ctx.arc(aimX,63,10,0,Math.PI*2);ctx.fillStyle='#fffdf4';ctx.fill();ctx.strokeStyle=theme.accent;ctx.lineWidth=2.5;ctx.stroke();
  ctx.fillStyle=theme.accent;ctx.beginPath();ctx.moveTo(aimX-4,91);ctx.lineTo(aimX+4,91);ctx.lineTo(aimX,96);ctx.fill();
  const sw=(right-left)/state.slots,ms=multipliers();
  for(let i=0;i<state.slots;i++){
    const x=left+i*sw,glow=slotGlows[i]||0;
    roundRect(x+3,slotTop,sw-6,89,12,theme.colors[Math.round(i*6/(state.slots-1))]);
    if(glow>0){ctx.save();ctx.globalAlpha=glow*.8;roundRect(x+3,slotTop,sw-6,89,12,'#fffbe0');ctx.restore();ctx.save();ctx.shadowBlur=25*glow;ctx.shadowColor='#e9b352';roundRect(x+3,slotTop,sw-6,89,12,null,'#f0b656');ctx.restore();}
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${state.slots===9?21:25}px sans-serif`;ctx.globalAlpha=.7;ctx.fillText(theme.motifs[i%4],x+sw/2,slotTop+25);ctx.globalAlpha=1;
    ctx.font='bold 16px Trebuchet MS, sans-serif';ctx.fillStyle='#647353';ctx.fillText(`×${ms[i]}`,x+sw/2,slotTop+60);
    if(ms[i]===10){ctx.fillStyle='#b28c4f';ctx.font='8px sans-serif';ctx.fillText('LUCKY',x+sw/2,slotTop+77);}
  }
  for(const pin of pins){
    const {x,y}=pin.position,g=pin.plugin.glow;
    ctx.beginPath();ctx.arc(x,y+2,7,0,Math.PI*2);ctx.fillStyle='#9aa88525';ctx.fill();
    if(g>0){ctx.save();ctx.shadowColor=theme.accent;ctx.shadowBlur=15*g;ctx.beginPath();ctx.arc(x,y,7+g*2,0,Math.PI*2);ctx.fillStyle=theme.accent;ctx.fill();ctx.restore();}
    ctx.beginPath();ctx.arc(x,y,6.4,0,Math.PI*2);ctx.fillStyle=g>.25?'#fff4dc':theme.pin;ctx.fill();
    ctx.beginPath();ctx.arc(x-1.4,y-1.7,2,0,Math.PI*2);ctx.fillStyle='#ffffff80';ctx.fill();
  }
  for(const r of ripples){ctx.globalAlpha=r.life*.5;ctx.strokeStyle=r.color;ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(r.x,r.y,8+(1-r.life)*25,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
  for(const p of particles){ctx.save();ctx.globalAlpha=p.life;ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.fillStyle=p.color;if(p.star)star(0,0,p.size*1.6);else ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*.65);ctx.restore();}
  // Render the ball last: white core, dark coral outline, gold halo and luminous trail.
  for(const ball of balls){
    const {x,y}=ball.body.position;
    if(!state.calm)ball.trail.forEach((pos,i)=>{ctx.globalAlpha=(i/ball.trail.length)*.35;ctx.fillStyle='#f5af66';ctx.beginPath();ctx.arc(pos.x,pos.y,3+i/ball.trail.length*7,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
    ctx.save();ctx.shadowColor='#f1b04e';ctx.shadowBlur=20;ctx.beginPath();ctx.arc(x,y,12.5,0,Math.PI*2);ctx.fillStyle='#b8536c';ctx.fill();ctx.shadowBlur=0;
    const gradient=ctx.createRadialGradient(x-3,y-4,0,x,y,10.8);gradient.addColorStop(0,'#fff');gradient.addColorStop(.6,'#fffbe4');gradient.addColorStop(1,'#ffdb8b');ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,10.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-3,y-4,3,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  for(const p of popups){ctx.save();ctx.globalAlpha=Math.min(1,p.life*2);ctx.textAlign='center';ctx.font=`bold ${p.big?26:22}px Trebuchet MS, sans-serif`;ctx.lineWidth=5;ctx.strokeStyle='#fff9eb';ctx.strokeText(p.text,p.x,p.y);ctx.fillStyle=p.big?'#bd7d36':'#b96b80';ctx.fillText(p.text,p.x,p.y);ctx.restore();}
}
function update(dt){
  clock+=dt;Engine.update(engine,dt);
  for(let i=balls.length-1;i>=0;i--){const ball=balls[i];const {x,y}=ball.body.position;
    ball.trail.push({x,y});if(ball.trail.length>11)ball.trail.shift();
    // A tiny nudge resolves rare perfect balances on round pins without altering gravity.
    if(ball.body.speed<.22)ball.stuck+=dt;else ball.stuck=0;
    if(ball.stuck>700){Body.setVelocity(ball.body,{x:(Math.random()>.5?1:-1)*.7,y:.15});ball.stuck=0;}
    if(y>scoreLine){scoreBall(ball,i);continue;}
    if(clock-ball.born>45000||x<-40||x>800||y<-100){Composite.remove(engine.world,ball.body);balls.splice(i,1);toast('小球去散步了，再来一颗吧');}
  }
  for(const pin of pins)pin.plugin.glow=Math.max(0,pin.plugin.glow-.045);
  for(let i=0;i<slotGlows.length;i++)slotGlows[i]=Math.max(0,slotGlows[i]-.014);
  for(let i=ripples.length-1;i>=0;i--){ripples[i].life-=.045;if(ripples[i].life<=0)ripples.splice(i,1);}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=.19;p.vx*=.986;p.rotation+=.08;p.life-=.017;if(p.life<=0)particles.splice(i,1);}
  for(let i=popups.length-1;i>=0;i--){popups[i].y-=.6;popups[i].life-=.013;if(popups[i].life<=0)popups.splice(i,1);}
}
function tick(now){
  if(!last)last=now;const delta=Math.min(now-last,50);last=now;
  if(!document.hidden&&!$('#settings').open){accumulator+=delta;while(accumulator>=1000/60){update(1000/60);accumulator-=1000/60;}if(state.auto&&now-lastAuto>700){launch();lastAuto=now;}}
  draw();frame=requestAnimationFrame(tick);
}
function resize(){const dpr=Math.min(window.devicePixelRatio||1,2),size=canvas.getBoundingClientRect().width;canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);}
new ResizeObserver(resize).observe(canvas);
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;});

function updateTheme(){
  const theme=themes[state.theme];$('#theme-name').textContent=theme.name;$('#theme-description').textContent=theme.description;
  $('#mascot').innerHTML=state.theme==='animal'?mascot:`<div class="mascot theme-emoji">${theme.emoji}</div>`;
  document.documentElement.style.setProperty('--accent',theme.accent);$('.board-wrap').style.background=theme.bg;
  document.querySelectorAll('[data-theme]').forEach(b=>{b.classList.toggle('selected',b.dataset.theme===state.theme);b.setAttribute('aria-pressed',String(b.dataset.theme===state.theme));});
  document.querySelectorAll('[data-slots]').forEach(b=>{b.classList.toggle('selected',+b.dataset.slots===state.slots);b.setAttribute('aria-pressed',String(+b.dataset.slots===state.slots));});
}
function updateSound(){
  $('#sound-button').innerHTML=icon(state.sound?'sound':'muted');$('#sound-button').setAttribute('aria-label',state.sound?'关闭音效':'开启音效');$('#sound-button').setAttribute('aria-pressed',String(state.sound));
  $('#sound-status').textContent=state.sound?'声音已开启，快乐有回响':'静音时光，也很美好';$('.sound-bars').classList.toggle('muted',!state.sound);
  if(master)master.gain.setTargetAtTime(state.sound?state.volume*.32:0,audio.currentTime,.03);
}
function updateCalm(){document.documentElement.classList.toggle('calm',state.calm);document.querySelectorAll('.mascot,.mascot-spark,.sound-bars i').forEach(el=>el.style.animationPlayState=state.calm?'paused':'running');}
$('#launch').addEventListener('click',launch);
$('#auto').addEventListener('click',()=>{unlockAudio();state.auto=!state.auto;$('#auto').classList.toggle('active',state.auto);$('#auto').setAttribute('aria-pressed',String(state.auto));$('#auto span').textContent=state.auto?'暂停投球':'自动投球';if(state.auto){launch();lastAuto=performance.now();}});
$('#aim').addEventListener('input',e=>{state.aim=+e.target.value;$('#aim-value').textContent=`${state.aim}%`;});
canvas.addEventListener('pointerdown',e=>{const rect=canvas.getBoundingClientRect();state.aim=Math.round(Math.max(8,Math.min(92,((e.clientX-rect.left)/rect.width*W-left)/(right-left)*100)));$('#aim').value=state.aim;$('#aim-value').textContent=`${state.aim}%`;});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!$('#settings').open&&!['INPUT','BUTTON','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();launch();}});
$('#sound-button').addEventListener('click',()=>{state.sound=!state.sound;unlockAudio();updateSound();persist();if(state.sound)sound('theme');});
$('#settings-button').addEventListener('click',()=>$('#settings').showModal());
$('#close-settings').addEventListener('click',()=>$('#settings').close());$('#done-settings').addEventListener('click',()=>$('#settings').close());
$('#settings').addEventListener('click',e=>{if(e.target===$('#settings')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>{state.theme=b.dataset.theme;updateTheme();updateCalm();persist();unlockAudio();sound('theme');}));
document.querySelectorAll('[data-slots]').forEach(b=>b.addEventListener('click',()=>{if(state.slots===+b.dataset.slots)return;state.slots=+b.dataset.slots;makeSlots();updateTheme();persist();}));
$('#volume').addEventListener('input',e=>{state.volume=+e.target.value/100;if(state.volume>0)state.sound=true;unlockAudio();updateSound();persist();});
$('#volume').addEventListener('change',()=>sound('theme'));
$('#calm').addEventListener('change',e=>{state.calm=e.target.checked;updateCalm();persist();});
$('#best').textContent=state.best.toLocaleString();updateTheme();updateSound();updateCalm();resize();frame=requestAnimationFrame(tick);
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);audio?.close();},{once:true});
// Read-only diagnostics help smoke tests check physical progress without bypassing play.
if(import.meta.env.DEV)Object.defineProperty(window,'__ponpon',{get:()=>({score:state.score,activeBalls:balls.length,slots:state.slots,pins:pins.length,theme:state.theme,auto:state.auto,positions:balls.map(b=>({...b.body.position})),audioState:audio?.state})});
