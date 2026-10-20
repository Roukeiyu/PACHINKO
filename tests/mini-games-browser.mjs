import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { connectedBlocks, BLOCK_CLEAR_TARGET, comboPoints, formatComboMultiplier } from '../src/mini-games.js';
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
   drain(){for(const ball of [...balls]){ball.entered=true;Body.setPosition(ball.body,{x:347,y:TABLE.scoreLine-1});Body.setVelocity(ball.body,{x:0,y:6});}step();}
  };return { engine, balls`);await route.fulfill({response,body});
 });
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');await page.clock.runFor(50);
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
 assert.equal(s.activeBalls,0);assert.ok(['pairs','blocks','moles'].includes(s.miniGame.kind));
 assert.equal(await page.locator('#mini-game').evaluate(el=>el.open),true);
 const before=await score(),clock=s.gameClock;await page.keyboard.press('Escape');assert.equal(await page.locator('#mini-game').evaluate(el=>el.open),true);
 await page.clock.fastForward(30100);s=await state();assert.notEqual(s.miniGame.status,'playing');assert.equal(s.gameClock,clock,'the table pauses during the mini-game');
 assert.equal(s.stats.launches,2);assert.equal(s.score,before+s.miniGame.score);
 await page.clock.fastForward(5000);assert.equal(await score(),s.score,'results are credited exactly once');
 await page.locator('#mini-return').click();await page.clock.runFor(50);s=await state();assert.equal(s.secretPending,false);assert.equal(s.emissionPaused,false);assert.equal(s.auto,true);
 await page.clock.runFor(1200);assert.ok((await state()).stats.launches>2,'automatic firing resumes after returning');
 await page.locator('#settings-button').click();await page.locator('#auto').uncheck();
 assert.equal(await page.locator('#gm-tools').isVisible(),false);
 for(let clicks=1;clicks<=3;clicks++){await page.locator('#gm-dot').click();await page.clock.runFor(200);assert.equal((await state()).gm,clicks===3);}
 assert.equal(await page.locator('#gm-tools').isVisible(),true);assert.equal(await page.locator('#gm-dot').getAttribute('aria-pressed'),'true');
 await page.locator('#time-flow').check();await page.clock.fastForward(330000);assert.equal(await page.locator('#time-phase').textContent(),'夜间');
 async function start(kind){await page.locator(`[data-mini="${kind}"]`).click();await page.clock.runFor(50);assert.equal(await page.locator('#settings').evaluate(el=>el.open),false);assert.equal((await mini()).kind,kind);}
 async function cell(index){await page.locator(`[data-cell="${index}"]`).evaluate(el=>el.click());}
 async function back(){await page.locator('#mini-return').click();await page.clock.runFor(50);assert.equal(await page.locator('#settings').evaluate(el=>el.open),true);}
 await start('pairs');assert.equal(await page.locator('#mini-grid button').count(),40);
 let initial=await score(),pairs=await mini();const groups=Object.groupBy(pairs.board.map((c,i)=>({...c,index:i})),c=>c.pair);
 const first=Object.values(groups)[0];await page.locator(`[data-cell="${first[0].index}"]`).click();await page.clock.runFor(250);await cell(first[1].index);
 assert.equal((await mini()).score,50);assert.equal((await mini()).combo,1);assert.equal(await page.locator('#mini-combo').textContent(),`1 连击 ${formatComboMultiplier(1)}`);
 assert.equal(await page.locator('.mini-removed').count(),2);assert.ok(await page.locator('.mini-float').count()>=1);
 await page.screenshot({path:'test-results/mini-pairs-night-mobile.png'});await page.screenshot({path:'test-results/mini-pairs-preview.jpg',type:'jpeg',quality:55});
 for(const group of Object.values(groups).slice(1)){await cell(group[0].index);await cell(group[1].index);}
 const pairTotal=Array.from({length:20},(_,i)=>comboPoints(50,i+1)).reduce((a,b)=>a+b);
 assert.equal((await mini()).status,'complete');assert.equal((await mini()).score,pairTotal);assert.ok(pairTotal>1000);assert.equal(await score(),initial+pairTotal);await back();
 await start('blocks');assert.equal(await page.locator('#mini-grid button').count(),100);initial=await score();
 const colors=await page.evaluate(()=>[0,1,2,3].map(i=>{const el=document.querySelector(`.mini-color-${i}`),c=document.createElement('canvas').getContext('2d');c.fillStyle=getComputedStyle(el).backgroundColor;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data].slice(0,3);}));
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(Math.max(...colors[i].map((v,k)=>Math.abs(v-colors[j][k])))>=10,'night puzzle colors remain visually distinct');
 await page.screenshot({path:'test-results/mini-blocks-night-mobile.png'});await page.screenshot({path:'test-results/mini-blocks-preview.jpg',type:'jpeg',quality:55});
 let moves=0;
 while((await mini()).status==='playing'&&(await mini()).removed<BLOCK_CLEAR_TARGET&&moves++<80){const board=(await mini()).board;const index=board.findIndex((_,i)=>connectedBlocks(board,i).length>=3);assert.ok(index>=0);await cell(index);await page.clock.runFor(200);}
 const blocks=await mini();
 assert.equal(blocks.status,'complete','50 cleared blocks end 消消乐');
 assert.equal(blocks.removed,BLOCK_CLEAR_TARGET);
 assert.equal(blocks.baseScore,BLOCK_CLEAR_TARGET*10);
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
  await page.clock.runFor(50);
 }
 assert.equal((await mini()).status,'complete');assert.equal((await mini()).hit,40);assert.equal(await score(),initial+(await mini()).score);await back();
 // A timed wave advances even if the player does not hit any mole.
 await start('moles');
 for(let wave=2;wave<=10;wave++){await page.clock.fastForward(3000);assert.equal((await mini()).wave,wave,'each visible slice advances one wave');}
 await page.clock.fastForward(3000);assert.equal((await mini()).status,'complete');assert.equal((await mini()).score,0);await back();
 await start('moles');const pausedWave=(await mini()).wave;
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.fastForward(20000);
 assert.equal((await mini()).wave,pausedWave,'background time does not skip mole waves');
 assert.equal((await mini()).status,'playing');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 for(let i=0;i<12&&(await mini()).status==='playing';i++)await page.clock.fastForward(3000);
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
 await page.evaluate(()=>window.__secretFixture.holeNext());
 assert.equal(await score(),holeBase+3000,'a third hole stays at ×2');
 assert.equal((await state()).secretMultiplier,2);
 assert.equal((await state()).miniGame,null);
 await page.clock.runFor(50);
 assert.equal(await page.locator('#mini-game').count(),1);
 assert.equal(await page.locator('#mini-bonus').textContent(),'×2');
 assert.equal(await page.locator('#mini-bonus').evaluate(el=>el.classList.contains('is-on')),true);
 const kind=(await mini()).kind;
 for(let step=0;step<40 && (await mini()).status==='playing' && (kind==='blocks'?(await mini()).removed<BLOCK_CLEAR_TARGET:(await mini()).score<1000);step++){
  const board=(await mini()).board;
  if(kind==='pairs'){
   const open=board.flatMap((cell,index)=>cell?[{...cell,index}]:[]);
   const pair=Object.values(Object.groupBy(open,cell=>cell.pair)).find(group=>group.length===2);
   if(!pair) break;
   await cell(pair[0].index);await cell(pair[1].index);
  }else if(kind==='blocks'){
   const index=board.findIndex((_,i)=>connectedBlocks(board,i).length>=3);
   if(index<0) break;
   await cell(index);
  }else{
   const mole=board.findIndex(cell=>cell.type==='mole'&&!cell.hit);
   if(mole>=0) await cell(mole);
   else await page.clock.fastForward(3000);
  }
 }
 const mid=await mini();
 const raw=mid.score;
 if(kind==='blocks'){assert.equal(mid.status,'complete');assert.equal(mid.removed,BLOCK_CLEAR_TARGET);assert.equal(mid.baseScore,500);}
 else assert.ok(raw>=1000,'pairs and moles can still pass 1000');
 assert.equal(await page.locator('#mini-score').textContent(),await page.evaluate(n=>n.toLocaleString(),raw));
 const alreadyPaid=mid.status!=='playing';
 assert.equal(await score(),holeBase+3000+(alreadyPaid?raw*2:0),'mini-game points are credited when the round ends');
 if(!alreadyPaid) await page.clock.fastForward(30100);
 const done=await mini();
 assert.notEqual(done.status,'playing');
 assert.ok(done.score>=raw);
 const paid=done.score*2;
 assert.equal(await score(),holeBase+3000+paid);
 const moleNote=done.kind==='moles'?` · 打中 ${done.hit}/40 只`:'';
 assert.equal(await page.locator('#mini-result-score').textContent(),await page.evaluate(({paid,moleNote})=>`收下 ${paid.toLocaleString()} 分快乐${moleNote} · 双球入洞 ×2`,{paid,moleNote}));
 await page.screenshot({path:'test-results/secret-double-result.png'});
 await page.locator('#mini-return').click();await page.clock.runFor(50);
 assert.equal((await state()).secretPending,false);
 assert.equal((await state()).secretMultiplier,1);
 assert.equal((await state()).emissionPaused,false);
 assert.deepEqual(errors,[]);
 console.log('PASS: real secret entry blocks touch/keyboard/auto, drains all balls before a random game, freezes/resumes the table, credits scores once, lets combo scores pass 1000, doubles that full total once, and three-click GM shortcuts play all three games on mobile at night.');
}finally{await browser.close();}
