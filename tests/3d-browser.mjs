import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
await mkdir('test-results', {recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1180}}), errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.addInitScript(()=>{if(!localStorage.getItem('ponpon-settings'))localStorage.setItem('ponpon-settings',JSON.stringify({sound:false,calm:true}));});
  await page.route('**/src/physics.js',async route=>{
    const response=await route.fetch();let body=await response.text();
    assert.ok(body.includes('return { engine, balls'));
    body=body.replace('return { engine, balls',`window.__modelFixture = {
      enlarge() { for(let i=0;i<10;i++) recordBumperHit(bumpers[1]); },
      settle() { const ball = balls.find(b=>!b.bonus); if(ball) { ball.entered=true; Body.setPosition(ball.body,{x:347,y:TABLE.scoreLine-1});Body.setVelocity(ball.body,{x:0,y:6});step(); } }
    }; return { engine, balls`);
    await route.fulfill({response,body});
  });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(()=>window.__ponpon?.rendering.meshes>80);
  let state=await page.evaluate(()=>window.__ponpon), r=state.rendering;
  assert.equal(r.mode,'webgl');assert.ok(r.triangles>20000);assert.equal(r.alignmentError,0);
  assert.equal(r.bodies.filter(b=>b.kind==='pin').length,28);
  assert.deepEqual(r.bodies.filter(b=>b.kind==='bumper').map(b=>[b.x,b.y]),[[238,236],[462,236],[350,367]]);
  assert.ok(r.bodies.every(b=>b.height>0),'all obstacle models have real depth');
  const initialGeometryCount=r.geometries;
  const box=await page.locator('#board').boundingBox();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.15);await page.mouse.down();await page.mouse.move(box.x+box.width*.95,box.y+box.height*.15,{steps:5});await page.mouse.up();
  await page.waitForFunction(()=>window.__ponpon.rendering.cameraAngle===5);
  assert.equal(await page.evaluate(()=>window.__ponpon.stats.launches),0,'camera gestures never launch a ball');
  const right=await page.locator('#board').screenshot({path:'test-results/3d-right.png'});
  await page.locator('#board').focus();for(let i=0;i<24;i++)await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(()=>window.__ponpon.rendering.cameraAngle),-5,'keyboard orbit clamps at minus five degrees');
  const left=await page.locator('#board').screenshot({path:'test-results/3d-left.png'});assert.ok(!left.equals(right),'the rendered view changes with camera rotation');
  await page.keyboard.press('Home');await page.waitForFunction(()=>window.__ponpon.rendering.cameraAngle===0);
  await page.locator('#settings-button').click();
  for(const count of [5,9,7,5,9,7]) {
    await page.locator(`[data-slots="${count}"]`).click();
    await page.waitForFunction(n=>window.__ponpon.rendering.bodies.filter(b=>b.kind==='divider').length===n-1,count);
    assert.equal(await page.evaluate(()=>window.__ponpon.rendering.alignmentError),0);
  }
  assert.equal(await page.evaluate(()=>window.__ponpon.rendering.geometries),initialGeometryCount,'changing slot layout disposes old 3D geometry');
  await page.locator('#camera-angle').fill('5');await page.locator('#camera-angle').dispatchEvent('input');
  await page.locator('#done-settings').click();
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
  assert.ok(await page.evaluate(()=>{const b=document.querySelector('#board').getBoundingClientRect(),p=document.querySelector('#plunger').getBoundingClientRect();return p.width>=44&&p.x>=b.x&&p.right<=b.right+.5;}),'the full 44px spring hit target remains inside the mobile board');
  await page.locator('#plunger').hover();await page.mouse.down();await page.waitForTimeout(700);await page.mouse.up();
  await page.waitForFunction(()=>window.__ponpon.rendering.balls.length===1);
  state=await page.evaluate(()=>window.__ponpon);r=state.rendering;
  assert.equal(r.cameraAngle,5);assert.equal(r.balls.length,state.positions.length);
  assert.ok(r.balls.every((b,i)=>Math.hypot(b.x-state.positions[i].x,b.y-state.positions[i].y)<1e-8),'3D ball centers follow the actual physical balls');
  assert.ok(await page.evaluate(()=>{const c=document.querySelector('#board').getBoundingClientRect(),p=document.querySelector('#plunger').getBoundingClientRect(),r=window.__ponpon.rendering.readyBall;const x=c.x+c.width*r.x,y=c.y+c.height*r.y;return x>=p.x&&x<=p.right&&y>=p.y&&y<=p.bottom;}),'spring hit target contains the projected 3D ready ball at +5 degrees');
  await page.evaluate(()=>window.__modelFixture.settle());await page.waitForFunction(()=>window.__ponpon.score>0);
  await page.evaluate(()=>window.__modelFixture.enlarge());
  await page.waitForFunction(()=>window.__ponpon.rendering.bodies.find(b=>b.kind==='bumper'&&b.x===350).scale>1.3);
  r=await page.evaluate(()=>window.__ponpon.rendering);
  assert.equal(r.bodies.find(b=>b.kind==='bumper'&&b.x===350).radius,58.5,'the 3D drum grows with the existing reward');
  assert.equal(r.alignmentError,0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1));
  await page.screenshot({path:'test-results/3d-mobile.png',fullPage:true});
  await page.reload();await page.waitForFunction(()=>window.__ponpon?.rendering.cameraAngle===5);
  assert.deepEqual(errors,[]);
  console.log('PASS: real WebGL solids, one-to-one physical coordinates, ±5° drag/keyboard/settings controls, persistent view, mobile spring hit target, independent scoring, growing drum and layout resource cleanup.');
  const fallback=await browser.newPage({viewport:{width:390,height:844}});
  await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};});
  await fallback.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  await fallback.waitForFunction(()=>window.__ponpon?.rendering.mode==='2d');
  await fallback.locator('#launch').hover();await fallback.mouse.down();await fallback.waitForTimeout(600);await fallback.mouse.up();
  await fallback.waitForFunction(()=>window.__ponpon.stats.launches===1);
  assert.equal(await fallback.locator('#camera-angle').isDisabled(),true);
  await fallback.close();
  console.log('PASS: devices without WebGL retain working charge and launch controls.');
} finally {await browser.close();}
