import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { connectedBlocks, BLOCK_CLEAR_TARGET, BLOCK_DURATION, BLOCK_POINT, MINI_DURATION, comboPoints, formatComboMultiplier, PAIR_POINT, PAIR_TARGET, PAIR_DURATION, PAIR_CLEAR_BONUS, AFK_BALL_TEXT, MOLE_WAVE_MS, MOLE_FLIP_MS, STAR_DURATION, AIM_DURATION } from '../src/mini-games.js';
import { SECRET_BALLS } from '../src/round.js';
const executablePath=process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
const browser=await chromium.launch({executablePath,args:process.platform==='linux'?['--no-sandbox']:[]});
await mkdir('test-results',{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'dark'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const epoch=Date.UTC(2026,9,10,12);await page.clock.install({time:epoch});await page.clock.pauseAt(epoch+1000);
 await page.addInitScript(()=>localStorage.setItem('ponpon-settings',JSON.stringify({sound:false,calm:false})));
 await page.route('**/src/physics.js*',async route=>{
  const response=await route.fetch();let body=await response.text();assert.ok(body.includes('return { engine, balls'));
  body=body.replace('return { engine, balls',`window.__secretFixture={
   enter(waiting=1){for(let i=0;i<waiting;i++){const ball=launch(.6);ball.entered=true;ball.scoreFactor=1;Body.setPosition(ball.body,{x:350,y:700-i*30});Body.setVelocity(ball.body,{x:0,y:0});}const secret=launch();secret.entered=true;secret.scoreFactor=1;Body.setPosition(secret.body,holes[0]);Body.setVelocity(secret.body,{x:0,y:0});step();},
   holeNext(){const ball=balls[0];ball.entered=true;ball.scoreFactor=1;Body.setPosition(ball.body,holes[0]);Body.setVelocity(ball.body,{x:0,y:0});step();},
   drain(){for(const ball of [...balls]){ball.entered=true;Body.setPosition(ball.body,{x:90,y:TABLE.scoreLine-1});Body.setVelocity(ball.body,{x:0,y:6});}step();}
  };return { engine, balls`);await route.fulfill({response,body});
 });
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');await page.clock.runFor(50);
 async function parkBasket(x){
  await page.evaluate(x=>{
   const field=document.querySelector('#mini-field');
   const rect=field.getBoundingClientRect();
   const cx=rect.left+(x/320)*rect.width, cy=rect.top+rect.height*0.9;
   const opts={bubbles:true,clientX:cx,clientY:cy,pointerId:1,pointerType:'mouse',isPrimary:true};
   field.dispatchEvent(new PointerEvent('pointerdown',opts));
   field.dispatchEvent(new PointerEvent('pointerup',opts));
  },x);
 }
 async function idleStars(){
  const width=await page.locator('#mini-field').evaluate(el=>el.getBoundingClientRect().width);
  if(!(width>40)) throw new Error(`star field has no width (${width})`);
  for(let i=0;i<320;i++){
   const snap=await page.evaluate(()=>window.__ponpon.miniGame);
   if(!snap||snap.status!=='playing') break;
   const stars=(snap.items||[]).filter(item=>!item.resolved&&item.kind==='star'&&item.y+item.vy*0.15>=392);
   let x=snap.basketX;
   if(stars.length){
    x=48;
    for(let c=48;c<=272;c+=8) if(stars.every(item=>Math.abs(item.x-c)>80)){x=c;break;}
   }
   await parkBasket(x);
   await page.clock.fastForward(120);
   const after=await page.evaluate(()=>window.__ponpon.miniGame);
   if(after.hit>0) throw new Error(`caught a star basket=${after.basketX} items=${JSON.stringify(after.items.filter(item=>item.kind==='star').map(item=>({x:item.x,y:item.y,resolved:item.resolved})))}`);
  }
 }
 async function dragAim(dx,dy){
  await page.evaluate(({dx,dy})=>{
   const field=document.querySelector('#mini-field');
   const rect=field.getBoundingClientRect();
   const client=(x,y)=>({x:rect.left+(x/320)*rect.width,y:rect.top+(y/420)*rect.height});
   const rest=client(160,372), pulled=client(160-dx,372-dy);
   const opts=(x,y)=>({bubbles:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',isPrimary:true});
   field.dispatchEvent(new PointerEvent('pointerdown',opts(rest.x,rest.y)));
   field.dispatchEvent(new PointerEvent('pointermove',opts(pulled.x,pulled.y)));
   field.dispatchEvent(new PointerEvent('pointerup',opts(pulled.x,pulled.y)));
  },{dx,dy});
 }
 const state=()=>page.evaluate(()=>window.__ponpon);
 const mini=async()=> (await state()).miniGame;
 const score=async()=> (await state()).score;
 await page.locator('#settings-button').click();await page.locator('#auto').check();await page.locator('#done-settings').click();
 await page.evaluate(()=>window.__secretFixture.enter());await page.clock.runFor(50);
 let s=await state();assert.equal(s.secretPending,true);assert.equal(s.emissionPaused,true);assert.equal(s.activeBalls,1);assert.equal(s.miniGame,null);
 assert.equal(await page.locator('#launch').isDisabled(),true);assert.equal(await page.locator('#launch-label').textContent(),'等待“秘密出现”');
 assert.equal(await page.locator('#launch').isVisible(),true,'auto mode also shows the waiting button');
 assert.equal(await page.locator('#plunger').isDisabled(),true);
 await page.locator('#board').focus();await page.keyboard.down('Space');await page.clock.fastForward(4000);await page.keyboard.up('Space');
 await page.evaluate(()=>document.querySelector('#launch').click());s=await state();assert.equal(s.stats.launches,2);assert.equal(s.charging,false);assert.equal(s.miniGame,null,'the secret waits for every current ball');
 await page.screenshot({path:'test-results/secret-wait-mobile.png'});
 await page.evaluate(()=>window.__secretFixture.drain());await page.clock.runFor(50);s=await state();
 assert.equal(s.activeBalls,0);assert.equal(s.miniGame,null,'the intro card does not start the round');
 assert.equal(await page.locator('#mini-game').evaluate(el=>el.open),true);
 assert.equal(await page.locator('#mini-game').getAttribute('data-phase'),'intro');
 assert.equal(await page.locator('#mini-rule').isVisible(),true);
 assert.equal(await page.locator('#mini-play').evaluate(el=>el.hidden),true);
 assert.equal(await page.locator('#mini-start').textContent(),'开始');
 assert.match(await page.locator('#mini-intro-reward').textContent(),/挂机未操作，无小球奖励/);
 assert.equal(await page.locator('#mini-game').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,'the phone intro fits without scrolling');
 const before=await score(),clock=s.gameClock,stockBeforeMini=s.available,firstKind=s.lastMiniGame;
 assert.ok(['pairs','blocks','moles','stars','aim','sling'].includes(firstKind),'starting a secret mini-game remembers it before confirm');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#mini-game').evaluate(el=>el.open),true);
 await page.clock.fastForward(5000);s=await state();
 assert.equal(s.miniGame,null,'waiting on the intro does not create the game');
 assert.equal(s.gameClock,clock,'the table stays paused on the intro card');
 await page.keyboard.press('Space');await page.clock.runFor(50);s=await state();
 assert.equal(s.miniGame.kind,firstKind);assert.equal(s.miniGame.score,0);assert.equal(s.miniGame.played,false);
 if(s.miniGame.kind==='pairs') assert.equal(s.miniGame.selected,null);
 if(s.miniGame.kind==='moles') assert.equal(s.miniGame.hit,0);
 assert.equal(await page.locator('#mini-game').getAttribute('data-phase'),'play');
 assert.equal(await page.locator('#mini-rule').isVisible(),false,'the long rule leaves the in-game header');
 assert.equal(await page.locator('#mini-intro').evaluate(el=>el.hidden),true);
 if(firstKind==='stars') await idleStars();
 else await page.clock.fastForward(Math.max(PAIR_DURATION,BLOCK_DURATION,MINI_DURATION)+2000);
 s=await state();assert.notEqual(s.miniGame.status,'playing');assert.equal(s.gameClock,clock,'the table pauses during the mini-game');
 assert.equal(s.stats.launches,2);assert.equal(s.score,before+s.miniGame.score);
 assert.equal(s.miniGame.played,false);assert.equal(s.miniGame.score,0);assert.equal(s.available,stockBeforeMini,'an idle secret visit adds no balls');
 assert.equal(await page.locator('#mini-result-balls').textContent(),AFK_BALL_TEXT);
 await page.clock.fastForward(5000);assert.equal(await score(),s.score,'results are credited exactly once');
 await page.locator('#mini-return').click();await page.clock.runFor(50);s=await state();assert.equal(s.secretPending,false);assert.equal(s.emissionPaused,false);assert.equal(s.auto,true);
 assert.equal(s.available,stockBeforeMini,'leaving an idle secret visit still adds no balls');
 assert.notEqual(await page.locator('#toast').textContent(),`+${SECRET_BALLS} 球`);
 await page.clock.runFor(1200);assert.ok((await state()).stats.launches>2,'automatic firing resumes after returning');
 await page.locator('#settings-button').click();await page.locator('#auto').uncheck();
 assert.equal(await page.locator('#gm-tools').isVisible(),false);
 for(let clicks=1;clicks<=3;clicks++){await page.locator('#gm-dot').click();await page.clock.runFor(200);assert.equal((await state()).gm,clicks===3);}
 assert.equal(await page.locator('#gm-tools').isVisible(),true);assert.equal(await page.locator('#gm-dot').getAttribute('aria-pressed'),'true');
 await page.locator('#time-flow').check();await page.clock.fastForward(330000);assert.equal(await page.locator('#time-phase').textContent(),'夜间');
 async function start(kind){
  await page.locator(`[data-mini="${kind}"]`).click();await page.clock.runFor(50);
  assert.equal(await page.locator('#settings').evaluate(el=>el.open),false);
  assert.equal(await page.locator('#mini-game').getAttribute('data-phase'),'intro');
  assert.equal(await mini(),null);
  assert.equal(await page.locator('#mini-rule').isVisible(),true);
  assert.match(await page.locator('#mini-intro-reward').textContent(),/试玩只记快乐积分/);
  assert.equal(await page.locator('#mini-game').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,`${kind} intro fits without scrolling`);
  if(kind==='stars'){assert.equal(await page.locator('#mini-intro-time').textContent(),'30 秒');assert.equal(await page.locator('#mini-intro-goal').textContent(),'接住星星，躲开炸弹');}
  if(kind==='aim'){assert.equal(await page.locator('#mini-intro-time').textContent(),'30 秒，或 5 颗弹珠');assert.equal(await page.locator('#mini-intro-goal').textContent(),'打中滑动靶，或时间到');}
  await page.locator('#mini-start').click();await page.clock.runFor(50);
  assert.equal((await mini()).kind,kind);
  assert.equal(await page.locator('#mini-rule').isVisible(),false,'the long rule leaves the in-game header');
 }
 async function settleMotion(){for(let i=0;i<80;i++){if(await page.locator('#mini-game').getAttribute('data-busy')!=='1')return;await page.clock.runFor(80);}assert.notEqual(await page.locator('#mini-game').getAttribute('data-busy'),'1','gravity animation releases the board');}
 async function cell(index){await page.locator(`[data-cell="${index}"]`).evaluate(el=>el.click());}
 async function back(){await page.locator('#mini-return').click();await page.clock.runFor(50);assert.equal(await page.locator('#settings').evaluate(el=>el.open),true);}
 await page.setViewportSize({width:375,height:812});
 await start('pairs');assert.equal(await page.locator('#mini-grid button').count(),64);
 const cellBox=await page.locator('#mini-grid button').first().boundingBox();
 assert.ok(cellBox.width>=40&&cellBox.height>=40,`375px pair cell is ${cellBox?.width}×${cellBox?.height}`);
 const dialogBox=await page.locator('#mini-game').boundingBox();
 assert.ok(dialogBox.width>=370&&dialogBox.x<=2,`pairs dialog is ${dialogBox.width}px at x ${dialogBox.x}`);
 await page.setViewportSize({width:390,height:844});
 let initial=await score(),pairs=await mini();const groups=Object.groupBy(pairs.board.map((c,i)=>({...c,index:i})),c=>c.pair);
 assert.equal(Object.keys(groups).length,16);
 assert.ok(Object.values(groups).every(group=>group.length===4&&new Set(group.map(card=>card.icon)).size===1));
 await page.screenshot({path:'test-results/mini-pairs-board.png'});
 const first=Object.values(groups)[0];await page.locator(`[data-cell="${first[0].index}"]`).click();await page.clock.runFor(250);await cell(first[1].index);
 assert.equal((await mini()).score,PAIR_POINT);assert.equal((await mini()).combo,1);assert.equal(await page.locator('#mini-combo').textContent(),`1 连击 ${formatComboMultiplier(1)}`);
 assert.equal(await page.locator('#mini-round').textContent(),`1/${PAIR_TARGET} 对`);
 assert.equal(await page.locator('.mini-removed').count(),2);assert.ok(await page.locator('.mini-float').count()>=1);
 assert.equal(await page.locator('.mini-ghost svg').count(),2);
 await cell(first[2].index);await cell(first[3].index);
 assert.equal((await mini()).combo,2);assert.equal(await page.locator('#mini-round').textContent(),`2/${PAIR_TARGET} 对`);
 await page.screenshot({path:'test-results/mini-pairs-night-mobile.png'});await page.screenshot({path:'test-results/mini-pairs-preview.jpg',type:'jpeg',quality:55});
 for(const group of Object.values(groups).slice(1)){await cell(group[0].index);await cell(group[1].index);await cell(group[2].index);await cell(group[3].index);}
 const pairTotal=Array.from({length:PAIR_TARGET},(_,i)=>comboPoints(PAIR_POINT,i+1)).reduce((a,b)=>a+b);
 const pairScore=pairTotal+PAIR_CLEAR_BONUS;
 assert.equal((await mini()).status,'complete');assert.equal((await mini()).score,pairScore);assert.equal((await mini()).clearBonus,PAIR_CLEAR_BONUS);assert.ok(pairTotal>1000);assert.equal(await score(),initial+pairScore);
 assert.equal(await page.locator('#mini-round').textContent(),`${PAIR_TARGET}/${PAIR_TARGET} 对`);
 assert.equal(await page.locator('#mini-result-math').textContent(),`全部配对 +${PAIR_CLEAR_BONUS}`);
 assert.equal((await mini()).played,true);assert.equal(await page.locator('#mini-result-balls').evaluate(el=>el.hidden),true,'a played GM round does not show a ball grant');
 await back();
 await start('blocks');assert.equal(await page.locator('#mini-grid button').count(),100);initial=await score();
 const colors=await page.evaluate(()=>{const probe=document.createElement('div');probe.className='mini-cell';document.body.append(probe);const read=i=>{probe.className=`mini-cell mini-color-${i}`;const c=document.createElement('canvas').getContext('2d');c.fillStyle=getComputedStyle(probe).backgroundColor;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data].slice(0,3);};const found=[0,1,2,3,4].map(read);probe.remove();return found;});
 for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)assert.ok(Math.max(...colors[i].map((v,k)=>Math.abs(v-colors[j][k])))>=10,'night puzzle colors remain visually distinct');
 assert.equal(await page.locator('#mini-grid .mini-cell svg').count(),100,'block tiles use the pair fruit icons');
 await page.screenshot({path:'test-results/mini-blocks-night-mobile.png'});await page.screenshot({path:'test-results/mini-blocks-preview.jpg',type:'jpeg',quality:55});
 let moves=0;
 let sawLock=false;
 while((await mini()).status==='playing'&&(await mini()).removed<BLOCK_CLEAR_TARGET&&moves++<220){const board=(await mini()).board;const index=board.findIndex((_,i)=>connectedBlocks(board,i).length>=3);assert.ok(index>=0);await cell(index);if(!sawLock){assert.equal(await page.locator('#mini-game').getAttribute('data-busy'),'1','a clear locks input while tiles fall');sawLock=true;}await settleMotion();}
 await settleMotion();
 const blocks=await mini();
 assert.equal(blocks.status,'complete','200 cleared blocks end 消消乐');
 assert.equal(blocks.removed,BLOCK_CLEAR_TARGET);
 assert.equal(blocks.baseScore,BLOCK_CLEAR_TARGET*BLOCK_POINT);
 assert.equal(blocks.score,Math.round(blocks.baseScore*blocks.bestMultiplier));
 assert.equal(await page.locator('#mini-round').textContent(),`已消除 ${BLOCK_CLEAR_TARGET}/${BLOCK_CLEAR_TARGET}`);
 assert.equal(await score(),initial+blocks.score);
 assert.equal(await page.locator('#mini-score').textContent(), await page.evaluate(n=>n.toLocaleString(), blocks.score));
 assert.equal(await page.locator('#mini-result-math').textContent(), await page.evaluate(b=>{const text=Number.isInteger(b.bestMultiplier)?String(b.bestMultiplier):b.bestMultiplier.toFixed(1);return `${b.baseScore.toLocaleString()} × ${text} = ${b.score.toLocaleString()}`;}, blocks));
 assert.equal(await page.locator('#mini-result-score').textContent(), await page.evaluate(n=>`收下 ${n.toLocaleString()} 分快乐`, blocks.score));
 await back();
 await start('moles');initial=await score();assert.equal(await page.locator('#mini-grid button').count(),16);
 const plan=(await mini()).molePlan;assert.equal(plan.reduce((a,b)=>a+b),40);
 await page.screenshot({path:'test-results/mini-moles-night-mobile.png'});
 for(let wave=1;wave<=10;wave++){
  const moles=await mini();assert.equal(moles.wave,wave);
  const beforeCabbage=(await mini()).score;
  await cell(moles.board.findIndex(c=>c.type==='cabbage'));
  assert.equal((await mini()).score,beforeCabbage);assert.equal((await mini()).combo,0);
  for(const index of moles.board.flatMap((c,i)=>c.type==='mole'?[i]:[]))await cell(index);
  await page.clock.runFor(MOLE_FLIP_MS+40);
 }
 assert.equal((await mini()).status,'complete');assert.equal((await mini()).hit,40);assert.equal((await mini()).played,true);assert.equal(await score(),initial+(await mini()).score);await back();
 await start('stars');
 assert.equal(await page.locator('#mini-field').evaluate(el=>el.hidden),false);
 assert.equal(await page.locator('#mini-round').textContent(),'接住 0');
 for(let i=0;i<20&&!((await mini()).items||[]).some(item=>item.kind==='star'&&!item.resolved);i++) await page.clock.fastForward(100);
 const star = (await mini()).items.find(item=>item.kind==='star'&&!item.resolved);
 assert.ok(star);
 await parkBasket(star.x);
 for(let i=0;i<30&&(await mini()).hit<1;i++) await page.clock.fastForward(200);
 assert.ok((await mini()).hit>=1,'parking under a star counts as play');
 assert.equal((await mini()).played,true);
 await page.clock.fastForward(STAR_DURATION);
 assert.notEqual((await mini()).status,'playing');
 await back();
 await start('stars');
 await idleStars();
 assert.equal((await mini()).hit,0);
 assert.equal((await mini()).played,false);
 assert.equal(await page.locator('#mini-result-balls').textContent(),AFK_BALL_TEXT);
 await back();
 await start('aim');
 assert.equal(await page.locator('#mini-round').textContent(),'打中 0 · 剩余 5');
 await page.clock.fastForward(Math.max(0,1440-((await mini()).lastSim-(await mini()).startedAt)));
 await dragAim(24,-86);
 await page.clock.fastForward(1600);
 assert.ok((await mini()).hit>=1,'the aimed shot hits a target');
 assert.equal((await mini()).played,true);
 await page.clock.fastForward(AIM_DURATION);
 await back();
 await start('aim');
 await page.clock.fastForward(AIM_DURATION+50);
 assert.equal((await mini()).fired,0);
 assert.equal((await mini()).hit,0);
 assert.equal((await mini()).played,false);
 assert.equal(await page.locator('#mini-result-balls').textContent(),AFK_BALL_TEXT);
 await back();
 // A timed wave advances even if the player does not hit any mole.
 await start('moles');
 for(let wave=2;wave<=10;wave++){await page.clock.fastForward(MOLE_WAVE_MS+MOLE_FLIP_MS);assert.equal((await mini()).wave,wave,'each visible slice advances one wave');}
 await page.clock.fastForward(MOLE_WAVE_MS+MOLE_FLIP_MS);assert.equal((await mini()).status,'complete');assert.equal((await mini()).score,0);assert.equal((await mini()).played,false);
 assert.equal(await page.locator('#mini-result-balls').textContent(),AFK_BALL_TEXT);
 assert.equal(await page.locator('#mini-return').textContent(),'返回设置');await back();
 await start('moles');const pausedWave=(await mini()).wave;
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.fastForward(20000);
 assert.equal((await mini()).wave,pausedWave,'background time does not skip mole waves');
 assert.equal((await mini()).status,'playing');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 for(let i=0;i<14&&(await mini()).status==='playing';i++)await page.clock.fastForward(MOLE_WAVE_MS+MOLE_FLIP_MS);
 assert.equal((await mini()).status,'complete');await back();
 for(let i=0;i<3;i++){await page.locator('#gm-dot').click();await page.clock.runFor(200);}assert.equal((await state()).gm,false);assert.equal(await page.locator('#gm-tools').isVisible(),false);
 assert.equal(await page.locator('#gm-dot').getAttribute('aria-pressed'),'false');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1));
 await page.locator('#done-settings').click();
 await page.evaluate(()=>window.__secretFixture.drain());
 await page.clock.runFor(80);
 assert.equal((await state()).activeBalls,0);
 assert.equal((await state()).secretPending,false);
 const holeBase=await score();
 await page.evaluate(()=>window.__secretFixture.enter(2));
 assert.equal(await score(),holeBase+500);
 assert.equal((await state()).activeBalls,2);
 assert.equal((await state()).secretMultiplier,1);
 assert.equal((await state()).miniGame,null);
 await page.evaluate(()=>window.__secretFixture.holeNext());
 assert.equal(await score(),holeBase+2000,'the first entry is doubled retroactively and the second is paid at ×2');
 assert.equal((await state()).activeBalls,1);
 assert.equal((await state()).miniGame,null,'the second hole does not open another mini-game');
 assert.equal((await state()).secretMultiplier,2);
 assert.equal(await page.locator('#toast').textContent(),'双球入洞！秘密洞得分 ×2');
 const previousKind=(await state()).lastMiniGame;
 await page.evaluate(()=>window.__secretFixture.holeNext());
 assert.equal(await score(),holeBase+3000,'a third hole stays at ×2');
 assert.equal((await state()).secretMultiplier,2);
 assert.equal((await state()).miniGame,null);
 await page.clock.runFor(50);
 assert.equal(await page.locator('#mini-game').count(),1);
 assert.match(await page.locator('#mini-intro-reward').textContent(),/双球再 ×2/);
 assert.match(await page.locator('#mini-intro-reward').textContent(),/挂机未操作，无小球奖励/);
 await page.keyboard.press('Enter');await page.clock.runFor(50);
 assert.equal(await page.locator('#mini-bonus').textContent(),'×2');
 assert.equal(await page.locator('#mini-bonus').evaluate(el=>el.classList.contains('is-on')),true);
 const kind=(await mini()).kind;
 assert.notEqual(kind,previousKind,'the next secret mini-game differs from the previous one');
 assert.equal((await state()).lastMiniGame,kind);
 for(let step=0;step<160 && (await mini()).status==='playing' && (kind==='blocks'?(await mini()).removed<BLOCK_CLEAR_TARGET:(await mini()).score<1000);step++){
  const live=await mini();
  const board=live.board;
  if(kind==='pairs'){
   const open=board.flatMap((cell,index)=>cell?[{...cell,index}]:[]);
   const pair=Object.values(Object.groupBy(open,cell=>cell.pair)).find(group=>group.length>=2);
   if(!pair) break;
   await cell(pair[0].index);await cell(pair[1].index);
  }else if(kind==='blocks'){
   const index=board.findIndex((_,i)=>connectedBlocks(board,i).length>=3);
   if(index<0) break;
   await cell(index);
   await settleMotion();
  }else if(kind==='stars'){
   const star=live.items.find(item=>!item.resolved&&item.kind==='star');
   if(star) await parkBasket(star.x);
   await page.clock.fastForward(500);
  }else if(kind==='sling'){
   await page.evaluate(()=>{ const f=document.querySelector('#mini-field'),r=f.getBoundingClientRect(); const fire=(type,x,y)=>f.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,clientX:r.left+x/320*r.width,clientY:r.top+y/420*r.height})); fire('pointerdown',58,298);fire('pointermove',16,316);fire('pointerup',16,316); });
   await page.clock.fastForward(800);
  }else if(kind==='aim'){
   const shots=[{releaseAt:1440,dx:24,dy:-86},{releaseAt:5544,dx:24,dy:-86},{releaseAt:8568,dx:24,dy:-86},{releaseAt:11112,dx:-12,dy:-86},{releaseAt:13480,dx:0,dy:-86}];
   const elapsed=live.lastSim-live.startedAt;
   const shot=shots.find(item=>item.releaseAt>=elapsed-20);
   if(!shot) break;
   const wait=shot.releaseAt-elapsed;
   if(wait>0) await page.clock.fastForward(wait);
   await dragAim(shot.dx,shot.dy);
   await page.clock.fastForward(40);
  }else{
   const mole=board.findIndex(cell=>cell.type==='mole'&&!cell.hit);
   if(mole>=0) await cell(mole);
   else await page.clock.fastForward((await mini()).flipUntil?MOLE_FLIP_MS+40:MOLE_WAVE_MS+MOLE_FLIP_MS);
  }
 }
 const mid=await mini();
 const raw=mid.score;
 if(kind==='blocks'){assert.equal(mid.status,'complete');assert.equal(mid.removed,BLOCK_CLEAR_TARGET);assert.ok(mid.baseScore>=500);}
 else assert.ok(raw>=1000,'a played mini-game can still pass 1000');
 assert.equal(await page.locator('#mini-score').textContent(),await page.evaluate(n=>n.toLocaleString(),raw));
 const alreadyPaid=mid.status!=='playing';
 assert.equal(await score(),holeBase+3000+(alreadyPaid?raw*2:0),'mini-game points are credited when the round ends');
 if(!alreadyPaid) await page.clock.fastForward(Math.max(PAIR_DURATION,BLOCK_DURATION,MINI_DURATION)+MOLE_FLIP_MS*10+2000);
 const done=await mini();
 assert.notEqual(done.status,'playing');
 assert.ok(done.score>=raw);
 const paid=done.score*2;
 assert.equal(await score(),holeBase+3000+paid);
 const moleNote=done.kind==='moles'?` · 打中 ${done.hit}/40 只`:'';
 assert.equal(await page.locator('#mini-result-score').textContent(),await page.evaluate(({paid,moleNote})=>`收下 ${paid.toLocaleString()} 分快乐${moleNote} · 双球入洞 ×2`,{paid,moleNote}));
 assert.equal(done.played,true);assert.equal(await page.locator('#mini-result-balls').textContent(),`+${SECRET_BALLS} 球`);
 await page.screenshot({path:'test-results/secret-double-result.png'});
 await page.locator('#mini-return').click();await page.clock.runFor(50);
 assert.equal((await state()).secretPending,false);
 assert.equal((await state()).secretMultiplier,1);
 assert.equal((await state()).emissionPaused,false);
 assert.deepEqual(errors,[]);
 console.log('PASS: real secret entry blocks touch/keyboard/auto, drains all balls before a random game, freezes/resumes the table, credits scores once, lets combo scores pass 1000, doubles that full total once, and three-click GM shortcuts play all three games on mobile at night.');
}finally{await browser.close();}
