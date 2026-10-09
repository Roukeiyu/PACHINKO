import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { connectedBlocks } from '../src/mini-games.js';
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
   enter(){const waiting=launch(.6);waiting.entered=true;Body.setPosition(waiting.body,{x:350,y:700});Body.setVelocity(waiting.body,{x:0,y:0});const secret=launch();secret.entered=true;Body.setPosition(secret.body,holes[0]);Body.setVelocity(secret.body,{x:0,y:0});step();},
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
 assert.equal((await mini()).score,50);assert.equal(await page.locator('.mini-removed').count(),2);
 await page.screenshot({path:'test-results/mini-pairs-night-mobile.png'});await page.screenshot({path:'test-results/mini-pairs-preview.jpg',type:'jpeg',quality:55});
 for(const group of Object.values(groups).slice(1)){await cell(group[0].index);await cell(group[1].index);}
 assert.equal((await mini()).status,'complete');assert.equal(await score(),initial+1000);await back();
 await start('blocks');assert.equal(await page.locator('#mini-grid button').count(),100);initial=await score();
 const colors=await page.evaluate(()=>[0,1,2,3].map(i=>{const el=document.querySelector(`.mini-color-${i}`),c=document.createElement('canvas').getContext('2d');c.fillStyle=getComputedStyle(el).backgroundColor;c.fillRect(0,0,1,1);return [...c.getImageData(0,0,1,1).data].slice(0,3);}));
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(Math.max(...colors[i].map((v,k)=>Math.abs(v-colors[j][k])))>=10,'night puzzle colors remain visually distinct');
 await page.screenshot({path:'test-results/mini-blocks-night-mobile.png'});await page.screenshot({path:'test-results/mini-blocks-preview.jpg',type:'jpeg',quality:55});
 let moves=0;
 while((await mini()).status==='playing'&&moves++<100){const board=(await mini()).board;const index=board.findIndex((_,i)=>connectedBlocks(board,i).length>=3);assert.ok(index>=0);await cell(index);await page.clock.runFor(300);}
 const blocks=await mini();assert.equal(blocks.status,'complete');assert.ok(blocks.score>=1000);assert.equal(await score(),initial+blocks.score);await back();
 await start('moles');initial=await score();assert.equal(await page.locator('#mini-grid button').count(),16);
 const plan=(await mini()).molePlan;assert.equal(plan.reduce((a,b)=>a+b),40);
 await page.screenshot({path:'test-results/mini-moles-night-mobile.png'});
 for(let wave=1;wave<=10;wave++){
  const moles=await mini();assert.equal(moles.wave,wave);
  await cell(moles.board.findIndex(c=>c.type==='cabbage'));assert.equal((await mini()).score,(await mini()).hit*25);
  for(const index of moles.board.flatMap((c,i)=>c.type==='mole'?[i]:[]))await cell(index);
  await page.clock.runFor(50);
 }
 assert.equal((await mini()).status,'complete');assert.equal((await mini()).hit,40);assert.equal(await score(),initial+1000);await back();
 // A timed wave advances even if the player does not hit any mole.
 await start('moles');await page.clock.fastForward(3000);assert.equal((await mini()).wave,2);
 await page.clock.fastForward(27100);assert.equal((await mini()).status,'complete');assert.equal((await mini()).score,0);await back();
 for(let i=0;i<3;i++){await page.locator('#gm-dot').click();await page.clock.runFor(200);}assert.equal((await state()).gm,false);assert.equal(await page.locator('#gm-tools').isVisible(),false);
 assert.equal(await page.locator('#gm-dot').getAttribute('aria-pressed'),'false');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1));
 assert.deepEqual(errors,[]);
 console.log('PASS: real secret entry blocks touch/keyboard/auto, drains all balls before a random game, freezes/resumes the table, credits scores once, and three-click GM shortcuts play all three games on mobile at night.');
}finally{await browser.close();}
