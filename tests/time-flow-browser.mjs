import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createTimePalette, timePhase } from '../src/time-flow.js';
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await chromium.launch({ executablePath, args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
await mkdir('test-results', { recursive: true });
const epoch = Date.UTC(2026,9,9,12);
const rgb = value => value.match(/[\d.]+/g).slice(0,3).map(Number);
const luminance = value => rgb(value).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast = (a,b) => {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1180 }, colorScheme: 'dark' });
  const errors = []; page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(epoch);
  await page.addInitScript(() => {
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    window.__timeFlowText = {};
    CanvasRenderingContext2D.prototype.fillText = function(value, ...args) {
      if (['P O N  P O N','0/20','秘密洞'].includes(value)) window.__timeFlowText[value] = { color: this.fillStyle, at: Date.now() };
      return fillText.call(this, value, ...args);
    };
  });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173');
  const domColors = () => page.evaluate(() => Object.fromEntries(['html','.machine','.board-wrap','#settings','.choice.selected','#launch','#done-settings'].map(selector=>{const c=getComputedStyle(document.querySelector(selector));return [selector,{ color:c.color, background:c.backgroundColor, image:c.backgroundImage,border:c.borderColor }];})));
  const original = await domColors();
  await page.locator('#settings-button').click();
  assert.equal(await page.locator('#time-flow').isChecked(),false);
  assert.ok(await page.evaluate(() => window.__ponpon.timeFlow.tokens > 100),'all style/SVG tokens are discovered');
  await page.locator('#time-flow').check();
  assert.equal(await page.locator('#time-phase').textContent(),'白天');
  assert.equal(await page.locator('#time-cycle-info').isVisible(),true);
  assert.deepEqual(await domColors(),original,'initial daylight retains the current theme exactly');
  const start = await page.evaluate(() => window.__ponpon.timeFlow.startedAt);
  assert.equal(start,epoch);
  const stageColors = {};
  for (const [position,id,label] of [[270000,'dusk','黄昏'],[330000,'night','夜间'],[570000,'dawn','清晨'],[630000,'day','白天']]) {
    await page.clock.setFixedTime(epoch + position);
    await page.waitForFunction(value=>window.__ponpon.timeFlow.position===value%600000,position);
    assert.equal(await page.locator('#time-phase').textContent(),label);
    await page.waitForTimeout(240); // Let existing button background transitions settle after the test clock jumps.
    stageColors[id] = await domColors();
    const dialog=stageColors[id]['#settings'];
    assert.ok(contrast(dialog.color,dialog.background)>=4.5,`${id}: settings text remains readable (${contrast(dialog.color,dialog.background)})`);
    assert.ok(contrast(stageColors[id]['#done-settings'].color,stageColors[id]['#done-settings'].background)>=4.5,`${id}: primary button remains readable`);
    await page.screenshot({ path:`test-results/time-flow-settings-${id}.png`,fullPage:true });
    await page.locator('#done-settings').click();
    await page.screenshot({ path:`test-results/time-flow-${id}.png`,fullPage:true });
    await page.locator('#settings-button').click();
  }
  const dusk=rgb(stageColors.dusk.html.background),night=rgb(stageColors.night.html.background);
  assert.ok(dusk[0]>dusk[2]);assert.ok(night[2]>night[0]&&Math.max(...night)<100);
  assert.deepEqual(stageColors.day,original,'next daylight also returns to original theme');
  const hexRgb = value => [1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
  // Assert real DOM text and real Canvas fillText output in both display modes.
  // Uniform contrast cannot be preserved while dark and light inks lerp through
  // mid-tones; endpoint readability is checked above, continuity below.
  for (const render3D of [false,true]) {
    await page.locator('#three-d').setChecked(render3D);
    assert.equal(await page.evaluate(()=>window.__ponpon.rendering.mode),render3D?'webgl':'2d');
    for (const start of [240000,300000,540000,600000]) {
      const inkSamples = { '#settings':'#344d42', '#done-settings':'#fffdf2', 'P O N  P O N':'#69815d', '0/20':'#fff9e9', '秘密洞':'#9e9375' };
      const from=createTimePalette(start),to=createTimePalette(start+20000);
      for (const offset of [0,5000,7500,10000,12500,15000,20000]) {
        const position=start+offset;
        await page.clock.setFixedTime(epoch+position);
        await page.waitForFunction(value=>window.__ponpon.timeFlow.position===value%600000&&window.__timeFlowText['P O N  P O N']?.at===value+Date.UTC(2026,9,9,12),position);
        const colors=await domColors(), painted=await page.evaluate(()=>window.__timeFlowText);
        for (const [label,ink] of Object.entries(inkSamples)) {
          const a=hexRgb(from.color(ink,'ink')),b=hexRgb(to.color(ink,'ink')),t=timePhase(position).blend;
          const actual=label.startsWith('#')?rgb(colors[label].color):hexRgb(painted[label].color);
          assert.ok(actual.every((v,i)=>Math.abs(v-(a[i]+(b[i]-a[i])*t))<=1),`${render3D?'3D':'2D'} ${label}: visible text lerps at ${position}`);
        }
      }
    }
  }
  await page.locator('#three-d').uncheck();
  await page.clock.setFixedTime(epoch+630000);
  await page.waitForFunction(()=>window.__ponpon.timeFlow.phase==='day');
  // Canvas samples verify the actual background, walls, pins and bumper faces,
  // rather than relying only on CSS or on the reported phase label.
  await page.locator('#calm').check();
  await page.evaluate(() => {document.querySelector('#settings').close();document.querySelector('#settings').show();document.querySelector('#settings').style.visibility='hidden';});
  const samples = () => page.evaluate(() => {
    const c=document.querySelector('#board'),copy=document.createElement('canvas');copy.width=c.width;copy.height=c.height;const ctx=copy.getContext('2d');ctx.drawImage(c,0,0);
    const points=window.__ponpon.rendering.samples ?? [[70,200],[23,280],[150,155],[350,367],[350,465],[615,482]].map(([x,y])=>({x:x/760,y:y/900}));
    return points.map(({x,y})=>[...ctx.getImageData(Math.round(x*c.width),Math.round(y*c.height),1,1).data]);
  });
  const canvasDay=await samples();
  await page.clock.setFixedTime(epoch+930000);
  await page.waitForFunction(()=>window.__ponpon.timeFlow.phase==='night');
  const canvasNight=await samples();
  assert.ok(canvasDay.every((color,i)=>color.some((v,k)=>k<3&&v!==canvasNight[i][k])),'background, wall, pin, drum, reels and secret cup actually change color');
  await page.evaluate(() => {const d=document.querySelector('#settings');d.close();d.style.visibility='';d.showModal();});
  await page.locator('[data-theme="dessert"]').click();
  assert.equal(await page.evaluate(()=>window.__ponpon.timeFlow.startedAt),start,'changing themes does not reset the day');
  assert.equal(await page.locator('#time-phase').textContent(),'夜间');
  await page.reload(); await page.locator('#settings-button').click();
  assert.equal(await page.locator('#time-flow').isChecked(),true);
  assert.equal(await page.locator('#time-phase').textContent(),'夜间','saved start time preserves phase across reload');
  await page.locator('#time-flow').uncheck();
  assert.equal(await page.locator('#time-cycle-info').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('time-flow')),false);
  const dessert=await domColors();assert.equal(dessert['.board-wrap'].background,'rgb(255, 240, 239)');
  await page.locator('[data-theme="animal"]').click();
  await page.waitForTimeout(240);
  assert.deepEqual(await domColors(),original,'disabling restores all original page and theme colors');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#time-flow').check();
  await page.clock.setFixedTime(epoch+1260000);
  await page.waitForFunction(()=>window.__ponpon.timeFlow.phase==='night');
  await page.screenshot({path:'test-results/time-flow-mobile-settings.png',fullPage:true});
  await page.locator('#done-settings').click();
  await page.screenshot({path:'test-results/time-flow-mobile-night.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1));
  await page.locator('#launch').hover();await page.mouse.down();await page.waitForTimeout(500);await page.mouse.up();
  await page.waitForFunction(()=>window.__ponpon.stats.entered>0);
  assert.deepEqual(errors,[]);
  console.log('PASS: actual DOM/canvas colors follow all four phases, continuous DOM/2D/3D text interpolation, readable phase endpoints, independent settings-time clock, saved phase, original-color restoration, mobile layout and real launching.');
} finally {await browser.close();}
