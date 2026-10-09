import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
await mkdir('test-results', {recursive:true});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>errors.push(e.message));
  const epoch=Date.UTC(2026,9,10,12);
  await page.clock.install({time:epoch}); await page.clock.pauseAt(epoch+1000);
  // A previous version's camera preference must not opt an existing user into 3D.
  await page.addInitScript(()=>{if(!localStorage.getItem('ponpon-settings'))localStorage.setItem('ponpon-settings',JSON.stringify({sound:false,calm:false,cameraAngle:5}));});
  await page.route('**/src/physics.js*',async route=>{
    const response=await route.fetch(); let body=await response.text();
    assert.ok(body.includes('return { engine, balls'));
    body=body.replace('return { engine, balls',`window.__modelFixture = {
      enlarge() { for(let i=0;i<10;i++) recordBumperHit(bumpers[1]); },
      settle() { const ball=balls.find(b=>!b.bonus)||launch(); ball.entered=true;Body.setPosition(ball.body,{x:347,y:TABLE.scoreLine-1});Body.setVelocity(ball.body,{x:0,y:6});step(); }
    }; return { engine, balls`);
    await route.fulfill({response,body});
  });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173'); await page.clock.runFor(50);
  assert.equal(await page.evaluate(()=>window.__ponpon.rendering.mode),'2d');
  assert.equal(await page.locator('#three-d').isChecked(),false);
  assert.equal(await page.locator('#camera-angle').count(),0,'settings only offer a display-mode switch');
  assert.ok(!(await page.locator('#board').getAttribute('aria-label')).includes('拖动'));
  await page.locator('#launch').focus(); await page.keyboard.down('Space');await page.clock.fastForward(700);await page.keyboard.up('Space');await page.clock.runFor(50);
  assert.equal(await page.evaluate(()=>window.__ponpon.stats.launches),1);
  await page.screenshot({path:'test-results/mode-default-2d.png',fullPage:true});
  await page.evaluate(()=>{window.__originalBoard=document.querySelector('#board');document.querySelector('#settings-button').click();});
  const physical=()=>page.evaluate(()=>({positions:window.__ponpon.positions,stats:window.__ponpon.stats,score:window.__ponpon.score,clock:window.__ponpon.gameClock,rewards:window.__ponpon.rewards,slotMachine:window.__ponpon.slotMachine,collector:window.__ponpon.collector}));
  const preserved=await physical();
  async function mode(enabled) {
    await page.evaluate(value=>{const el=document.querySelector('#three-d');if(el.checked!==value)el.click();},enabled);
    await page.clock.runFor(50);
  }
  await mode(true);
  assert.equal(await page.evaluate(()=>document.querySelector('#board')===window.__originalBoard),false,'mode changes replace the claimed canvas context');
  assert.deepEqual(await physical(),preserved,'switching to 3D retains live balls, scores, rewards and clocks');
  let state=await page.evaluate(()=>window.__ponpon),r=state.rendering;
  assert.equal(r.mode,'webgl');assert.ok(r.meshes>80 && r.triangles>20000);assert.equal(r.alignmentError,0);
  assert.equal(r.bodies.filter(b=>b.kind==='pin').length,28);
  assert.deepEqual(r.bodies.filter(b=>b.kind==='bumper').map(b=>[b.x,b.y]),[[238,236],[462,236],[350,367]]);
  assert.ok(r.bodies.every(b=>b.height>0));
  const geometryCount=r.geometries;
  for(let i=0;i<3;i++) {
    await mode(false);assert.deepEqual(await physical(),preserved);assert.equal(await page.evaluate(()=>window.__ponpon.rendering.mode),'2d');
    await mode(true);assert.deepEqual(await physical(),preserved);assert.equal(await page.evaluate(()=>window.__ponpon.rendering.geometries),geometryCount,'repeated mode switches release and rebuild the same geometry');
  }
  await page.evaluate(()=>document.querySelector('#done-settings').click());
  const board=await page.locator('#board').boundingBox();
  await page.mouse.move(board.x+board.width*.5,board.y+board.height*.15);await page.mouse.down();await page.mouse.move(board.x+board.width*.8,board.y+board.height*.15);await page.mouse.up();
  await page.locator('#board').focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('Home');await page.clock.runFor(50);
  assert.equal(await page.evaluate(()=>window.__ponpon.rendering.cameraAngle),0,'drag and arrow keys do not adjust the fixed camera');
  assert.equal(await page.evaluate(()=>window.__ponpon.stats.launches),1);
  await page.evaluate(()=>document.querySelector('#settings-button').click());
  for(const count of [5,9,7]) {
    await page.evaluate(n=>document.querySelector(`[data-slots="${n}"]`).click(),count);await page.clock.runFor(50);
    assert.equal(await page.evaluate(()=>window.__ponpon.rendering.bodies.filter(b=>b.kind==='divider').length),count-1);
    assert.equal(await page.evaluate(()=>window.__ponpon.rendering.alignmentError),0);
  }
  assert.equal(await page.evaluate(()=>window.__ponpon.rendering.geometries),geometryCount);
  await page.evaluate(()=>document.querySelector('#done-settings').click());
  await page.evaluate(()=>window.__modelFixture.settle());await page.clock.runFor(50);
  const score=await page.evaluate(()=>window.__ponpon.score);assert.ok(score>0);
  await page.evaluate(()=>window.__modelFixture.enlarge());await page.clock.runFor(50);
  r=await page.evaluate(()=>window.__ponpon.rendering);
  assert.equal(r.bodies.find(b=>b.kind==='bumper'&&b.x===350).radius,58.5);
  assert.ok(r.bodies.find(b=>b.kind==='bumper'&&b.x===350).scale>1.3);
  await page.locator('#launch').focus();await page.keyboard.down('Space');await page.clock.fastForward(5100);await page.clock.runFor(100);
  r=await page.evaluate(()=>window.__ponpon.rendering);
  assert.equal(r.motion.intensity,1);assert.ok(Math.abs(r.motion.rotation)>0 && Math.abs(r.motion.rotation)<=3);
  assert.deepEqual(r.tableTransform,{position:[0,0,0],rotation:[0,0,0]},'camera shake never translates or rotates the model');
  assert.notDeepEqual(r.cameraPosition,[0,-Math.sin(14*Math.PI/180)*1400,Math.cos(14*Math.PI/180)*1400],'shake moves the actual camera');
  const matrix=await page.evaluate(()=>{const m=new DOMMatrix(getComputedStyle(document.querySelector('.game-layout')).transform);return {a:m.a,b:m.b,c:m.c,d:m.d,x:m.e,y:m.f};});
  assert.deepEqual([matrix.a,matrix.b,matrix.c,matrix.d],[1,0,0,1],'the UI never rotates');
  assert.ok(Math.abs(matrix.x)<=.45 && Math.abs(matrix.y)<=.3,'UI movement stays below half a pixel');
  assert.ok(await page.evaluate(()=>{const b=document.querySelector('#board').getBoundingClientRect(),p=document.querySelector('#plunger').getBoundingClientRect(),r=window.__ponpon.rendering.readyBall;const x=b.x+b.width*r.x,y=b.y+b.height*r.y;return p.width>=44 && p.x>=b.x-.5 && p.right<=b.right+.5 && x>=p.x && x<=p.right && y>=p.y && y<=p.bottom;}),'mobile spring target follows the moving scene');
  await page.screenshot({path:'test-results/mode-3d-shaking.png',fullPage:true});
  await page.keyboard.up('Space');await page.clock.runFor(550);
  assert.equal(await page.evaluate(()=>window.__ponpon.stats.launches),7,'the initial ball, scored fixture and full-charge burst are independent launches');
  await page.evaluate(()=>document.querySelector('#settings-button').click());
  const afterBurst=await physical();await mode(false);assert.deepEqual(await physical(),afterBurst);
  await page.evaluate(()=>document.querySelector('#calm').click());await page.clock.runFor(50);
  assert.equal(await page.evaluate(()=>window.__ponpon.rendering.motion.intensity),0);
  assert.equal(await page.evaluate(()=>document.querySelector('.game-layout').style.transform),'');
  await mode(true);await page.reload();await page.clock.runFor(50);
  assert.equal(await page.evaluate(()=>window.__ponpon.rendering.mode),'webgl');assert.equal(await page.locator('#three-d').isChecked(),true);
  await page.evaluate(()=>document.querySelector('#settings-button').click());await mode(false);
  await page.reload();await page.clock.runFor(50);assert.equal(await page.evaluate(()=>window.__ponpon.rendering.mode),'2d');
  console.log('PASS: default 2D, boolean 3D setting, fixed camera, state-preserving mode switches, released model resources, bounded scene/UI motion, moving mobile target, five-ball firing and saved display preference.');
  const fallback=await browser.newPage({viewport:{width:390,height:844}});
  fallback.on('pageerror',e=>errors.push(e.message));
  await fallback.addInitScript(()=>{
    localStorage.setItem('ponpon-settings',JSON.stringify({render3D:true,sound:false,calm:true}));
    const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};
  });
  await fallback.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await fallback.waitForFunction(()=>window.__ponpon?.rendering.mode==='2d');
  assert.equal(await fallback.locator('#three-d').isDisabled(),true);assert.equal(await fallback.locator('#three-d').isChecked(),false);
  await fallback.locator('#launch').hover();await fallback.mouse.down();await fallback.waitForTimeout(600);await fallback.mouse.up();
  await fallback.waitForFunction(()=>window.__ponpon.stats.launches===1);
  assert.deepEqual(errors,[]);
  console.log('PASS: requesting 3D on a device without WebGL safely retains functional 2D firing.');
} finally {await browser.close();}
