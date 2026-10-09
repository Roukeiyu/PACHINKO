import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
await mkdir('test-results', {recursive:true});
try {
  for (const render3D of (process.env.CHARGE_RENDERERS === '3d' ? [true] : [false, true])) for (const mode of (process.env.CHARGE_MODES?.split(',') || ['day', 'night', 'calm'])) {
    const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const epoch=Date.UTC(2026,9,9,12);
    await page.clock.install({time:epoch});await page.clock.pauseAt(epoch+1000);
    await page.addInitScript(({mode,epoch,render3D})=>localStorage.setItem('ponpon-settings',JSON.stringify({sound:false,render3D,calm:mode==='calm',timeFlow:mode==='night',timeFlowStartedAt:epoch-350000})),{mode,epoch,render3D});
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');await page.clock.fastForward(50);
    const session=await page.context().newCDPSession(page);
    async function hold() {
      const r=await page.locator('#plunger').boundingBox();
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});
    }
    // Charge depends on elapsed time, so skip idle hold frames while retaining
    // runFor below for every physics frame during the actual five-shot burst.
    const snapshot=()=>page.evaluate(()=>({motion:window.__ponpon.rendering.motion,effects:window.__ponpon.chargeEffects,charging:window.__ponpon.charging,charge:window.__ponpon.charge,count:window.__ponpon.stats.launches,pending:window.__ponpon.pendingLaunches,transform:document.querySelector('.game-layout').style.transform,overflow:document.documentElement.scrollWidth>innerWidth}));
    await hold();await page.clock.fastForward(700);
    let s=await snapshot();assert.equal(s.count,0);assert.ok(s.effects.goldRadius>15);
    await page.screenshot({path:`test-results/charge-${render3D ? '3d' : '2d'}-${mode}-gold.png`});
    await page.clock.fastForward(1400);s=await snapshot();assert.equal(s.charge,1);assert.ok(s.effects.coronaRadius>0 && s.effects.overcharge<.01);
    await page.screenshot({path:`test-results/charge-${render3D ? '3d' : '2d'}-${mode}-full.png`});
    const faint=s.effects;
    await page.clock.fastForward(1400);s=await snapshot();assert.ok(s.effects.coronaRadius>faint.coronaRadius && s.effects.coronaAlpha>faint.coronaAlpha);assert.ok(s.effects.overcharge>.45 && s.effects.overcharge<.55);
    await page.screenshot({path:`test-results/charge-${render3D ? '3d' : '2d'}-${mode}-growing.png`});
    await page.clock.fastForward(1600);s=await snapshot();assert.equal(s.effects.overcharge,1);assert.equal(s.count,0);assert.equal(s.overflow,false);
    assert.equal(s.motion.intensity,mode==='calm'?0:1);
    assert.ok(Math.abs(s.motion.rotation)<=5 && Math.abs(s.motion.uiX)<=.45 && Math.abs(s.motion.uiY)<=.3);
    assert.equal(s.transform==='',mode==='calm','calm mode cancels scene and UI shake');
    await page.screenshot({path:`test-results/charge-${render3D ? '3d' : '2d'}-${mode}-max.png`});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    s=await snapshot();assert.equal(s.effects,null);assert.equal(s.transform,'');assert.equal(s.count,1);assert.equal(s.pending,4);
    if (mode === 'calm') {
      await page.evaluate(() => document.querySelector('#settings-button').click());
      const positions = await page.evaluate(() => window.__ponpon.positions);
      await page.clock.runFor(550);s=await snapshot();assert.equal(s.count,1);assert.equal(s.pending,4);
      assert.deepEqual(await page.evaluate(() => window.__ponpon.positions), positions, 'settings pause both in-flight balls and pending shooter shots');
      await page.evaluate(() => document.querySelector('#done-settings').click());
    }
    await page.clock.runFor(550);s=await snapshot();assert.equal(s.count,5);assert.equal(s.pending,0);
    assert.equal(await page.locator('#ball-count').textContent(),'5','HUD counts each actual shot exactly once');
    await page.clock.runFor(600);
    // Releasing early after full charge retains normal single-ball behavior.
    await page.locator('#launch').focus();await page.keyboard.down('Space');await page.clock.fastForward(3000);await page.keyboard.up('Space');await page.clock.runFor(550);
    assert.equal((await snapshot()).count,6);
    // Cancel after full overcharge: never convert cancellation into a burst.
    await hold();await page.clock.fastForward(5100);await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.clock.runFor(550);
    s=await snapshot();assert.equal(s.count,6);assert.equal(s.effects,null);assert.equal(s.charging,false);
    // An independent scoring reward may still have its own tiny UI shake.
    assert.ok(Math.abs(s.motion.uiX)<=.45 && Math.abs(s.motion.uiY)<=.3);
    await page.keyboard.down('Space');await page.clock.fastForward(5100);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('Space');
    assert.equal((await snapshot()).count,6);
    // Settings also interrupt charging, with the next hold starting fresh.
    await page.keyboard.down('Space');await page.clock.fastForward(3000);await page.evaluate(()=>document.querySelector('#settings-button').click());await page.keyboard.up('Space');
    assert.equal((await snapshot()).effects,null);assert.equal((await snapshot()).count,6);
    await page.evaluate(()=>document.querySelector('#done-settings').click());await hold();await page.clock.fastForward(50);assert.ok((await snapshot()).charge<.25);
    await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    assert.deepEqual(errors,[]);await page.close();
    console.log(`PASS: ${render3D ? '3D' : '2D'} ${mode} mobile charging stages, growing corona, five-shot release, early release, touch cancellation, blur and settings interruption.`);
  }
} finally {await browser.close();}
