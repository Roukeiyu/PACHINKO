import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { CHARGE_DURATION, BURST_READY_AT } from '../src/charge.js';
import { VIEW_FOV, VIEW_PITCH_DEG, WALL_HEIGHT, RAIL_HEIGHT } from '../src/renderer.js';
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
      enlarge() { for(let i=0;i<5;i++) recordBumperHit(bumpers[1]); },
      settle() { const ball=balls.find(b=>!b.bonus)||launch(); ball.entered=true;Body.setPosition(ball.body,{x:90,y:TABLE.scoreLine-1});Body.setVelocity(ball.body,{x:0,y:6});step(); }
    }; return { engine, balls`);
    await route.fulfill({response,body});
  });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173'); await page.clock.runFor(50);
  assert.equal(await page.evaluate(()=>window.__ponpon.rendering.mode),'2d');
  assert.equal(await page.locator('#three-d').isChecked(),false);
  assert.equal(await page.locator('#camera-angle').count(),0,'settings only offer a display-mode switch');
  assert.ok(!(await page.locator('#board').getAttribute('aria-label')).includes('拖动'));
  await page.locator('#launch').focus(); await page.keyboard.down('Space');await page.clock.fastForward(CHARGE_DURATION);await page.keyboard.up('Space');await page.clock.runFor(50);
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
  assert.ok(r.pitch>=10&&r.pitch<=VIEW_PITCH_DEG+0.01,`pitch ${r.pitch} stays between the tall-phone fit and the desktop view`);assert.ok(r.fov>=VIEW_FOV-0.1&&r.fov<=90);assert.equal(r.decor,undefined,'off-board scenery is gone');
  assert.ok(r.bodies.filter(b=>b.kind==='wall').every(b=>b.height===WALL_HEIGHT));
  assert.ok(r.bodies.filter(b=>b.kind==='rail').every(b=>b.height===RAIL_HEIGHT));
  const fits=frame=>frame.every(p=>p.x>0.004&&p.x<0.996&&p.y>0.004&&p.y<0.996);
  assert.ok(fits(r.frame),'perspective keeps the full table inside the canvas');
  assert.ok(r.near.width>=0.95,'the near edge fills at least 95% of the mobile canvas');
  const nearMargin=await page.evaluate(()=>{const w=document.querySelector('#board').getBoundingClientRect().width;return window.__ponpon.rendering.near.minX*w;});
  assert.ok(nearMargin>=4&&nearMargin<=8,`portrait side margin stays near 4–8px (${nearMargin})`);
  assert.equal(r.bodies.filter(b=>b.kind==='pin').length,25);
  assert.deepEqual(r.bodies.filter(b=>b.kind==='bumper').map(b=>[b.x,b.y]),[[238,236],[462,236],[350,410]]);
  assert.ok(r.bodies.every(b=>b.height>0));
  const geometryCount=r.geometries, cameraQuaternion=r.cameraQuaternion;
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
  for(const count of [7,9,5]) {
    await page.evaluate(n=>window.__ponpon.setSlots(n),count);await page.clock.runFor(50);
    const lips = count === 9 ? 12 : count === 7 ? 10 : 8;
    assert.equal(await page.evaluate(()=>window.__ponpon.rendering.bodies.filter(b=>b.kind==='divider').length),lips, count === 9 ? 'nine slots keep four leaks and four plain walls' : count === 7 ? 'seven slots close only the two outer gaps' : 'five slots keep two lips on each inner mouth');
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
  await page.locator('#launch').focus();await page.keyboard.down('Space');await page.clock.fastForward(BURST_READY_AT + 100);await page.clock.runFor(100);
  r=await page.evaluate(()=>window.__ponpon.rendering);
  assert.equal(r.motion.intensity,1);assert.equal(r.motion.rotation,0);
  assert.ok(r.cameraQuaternion.every((v,i)=>Math.abs(v-cameraQuaternion[i])<1e-12),'full charge preserves actual camera orientation');
  assert.deepEqual(r.tableTransform,{position:[0,0,0],rotation:[0,0,0]},'camera shake never translates or rotates the model');
  assert.notDeepEqual(r.cameraPosition,r.cameraBase,'shake moves the actual camera');
  assert.ok(fits(r.frame),'charge shake does not crop the table');
  const matrix=await page.evaluate(()=>{const m=new DOMMatrix(getComputedStyle(document.querySelector('.game-layout')).transform);return {a:m.a,b:m.b,c:m.c,d:m.d,x:m.e,y:m.f};});
  assert.deepEqual([matrix.a,matrix.b,matrix.c,matrix.d],[1,0,0,1],'the UI never rotates');
  assert.ok(Math.abs(matrix.x)<=.45 && Math.abs(matrix.y)<=.3,'UI movement stays below half a pixel');
  assert.ok(await page.evaluate(()=>{const b=document.querySelector('#board').getBoundingClientRect(),p=document.querySelector('#plunger').getBoundingClientRect(),r=window.__ponpon.rendering.readyBall;const x=b.x+b.width*r.x,y=b.y+b.height*r.y;return p.width>=44 && p.x>=b.x-.5 && p.right<=b.right+.5 && x>=p.x && x<=p.right && y>=p.y && y<=p.bottom;}),'mobile spring target follows the moving scene');
  await page.screenshot({path:'test-results/mode-3d-shaking.png',fullPage:true});
  await page.setViewportSize({width:844,height:390});await page.clock.runFor(50);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1),'landscape keeps the page inside the screen');
  const landscape=await page.locator('#board').boundingBox();
  assert.ok(landscape.x>=-1&&landscape.y>=-1&&landscape.x+landscape.width<=845&&landscape.y+landscape.height<=391,'landscape does not crop the board');
  await page.setViewportSize({width:390,height:844});await page.clock.runFor(50);
  await page.keyboard.up('Space');await page.clock.runFor(550);
  assert.equal(await page.evaluate(()=>window.__ponpon.stats.launches),7,'the initial ball, scored fixture and full-charge burst are independent launches');
  await page.evaluate(()=>document.querySelector('#settings-button').click());
  const afterBurst=await physical();await mode(false);const switched=await physical();
  const aged=afterBurst.rewards.enlargedUntil-switched.rewards.enlargedUntil;
  assert.ok(aged>0&&aged<=50,`center enlarge keeps counting while settings are open (${aged}ms)`);
  const frozen=structuredClone(switched);frozen.rewards.enlargedUntil=afterBurst.rewards.enlargedUntil;
  assert.deepEqual(frozen,afterBurst,'a display-mode switch still freezes balls, scores and the simulation clock');
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
