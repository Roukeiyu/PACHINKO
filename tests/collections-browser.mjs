import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:process.platform==='linux'?['--no-sandbox']:[]});
await mkdir('test-results',{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const epoch=Date.UTC(2026,9,10,12);
  await page.clock.install({time:epoch});await page.clock.pauseAt(epoch+1000);
  await page.addInitScript(()=>{
    if(!localStorage.getItem('ponpon-settings'))localStorage.setItem('ponpon-settings',JSON.stringify({sound:false,calm:true,collections:{2:19,3:49,5:99,10:99}}));
    window.__collectionLabels=[];
    const text=CanvasRenderingContext2D.prototype.fillText,clear=CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect=function(...args){if(args[2]===760&&args[3]===900)window.__collectionLabels=[];return clear.apply(this,args);};
    CanvasRenderingContext2D.prototype.fillText=function(value,x,y,...args){window.__collectionLabels.push({value:String(value),x,y,filter:this.filter});return text.call(this,value,x,y,...args);};
  });
  await page.route('**/src/physics.js*',async route=>{
    const response=await route.fetch();let body=await response.text();
    assert.ok(body.includes('return { engine, balls'));
    body=body.replace('return { engine, balls',`window.__collectionFixture={
      slot(multiplier,last=false,factor=1,global=false){
        if(global)slotMachine.state.tripleUntil=clock+60000;
        const column=last?slotMultipliers(slots).lastIndexOf(multiplier):slotMultipliers(slots).indexOf(multiplier);
        const ball=launch();ball.entered=true;ball.scoreFactor=factor;
        Body.setPosition(ball.body,{x:TABLE.left+(column+.5)*(TABLE.right-TABLE.left)/slots,y:TABLE.scoreLine-1});Body.setVelocity(ball.body,{x:0,y:6});step();
      }
    };return { engine, balls`);
    await route.fulfill({response,body});
  });
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');await page.clock.runFor(50);
  const snapshot=()=>page.evaluate(()=>({score:window.__ponpon.score,counts:window.__ponpon.collections,mode:window.__ponpon.rendering.mode,clock:window.__ponpon.gameClock}));
  let total=0;
  for(const [fruit,points,level] of [[2,20,1],[3,45,2],[5,100,3],[10,200,3]]) {
    await page.evaluate(fruit=>window.__collectionFixture.slot(fruit),fruit);await page.clock.runFor(50);total+=points;
    assert.equal((await snapshot()).score,total);
    assert.match(await page.locator('#toast').textContent(),new RegExp(`Lv.${level}`));
  }
  await page.evaluate(()=>window.__collectionFixture.slot(2,true,2,true));await page.clock.runFor(50);total+=300;
  assert.equal((await snapshot()).score,total);assert.equal((await snapshot()).counts[2],21,'mirror slot and stacked bonuses still add one fruit');
  const counts=(await snapshot()).counts;
  await page.locator('#collection-button').click();assert.equal(await page.locator('#collection-book').evaluate(el=>el.open),true);
  const clock=(await snapshot()).clock;await page.clock.runFor(500);assert.equal((await snapshot()).clock,clock,'collection book pauses the game');
  for(const [fruit,level,points] of [[2,1,30],[3,2,60],[5,3,150],[10,3,300]]) {
    const item=page.locator(`[data-collection="${fruit}"]`);
    assert.equal(await item.getAttribute('data-level'),String(level));
    assert.match(await item.locator('.collection-reward').textContent(),new RegExp(`→ ${points} 分`));
    assert.ok(await item.locator('progress').getAttribute('aria-label'));
  }
  assert.match(await page.locator('[data-collection="5"] .collection-count').textContent(),/已收集 100/);
  await page.screenshot({path:'test-results/collections-mobile-book.png',fullPage:true});
  for(const render3D of [false,true]) {
    await page.evaluate(enabled=>{const input=document.querySelector('#three-d');if(input.checked!==enabled)input.click();},render3D);await page.clock.runFor(50);
    assert.equal((await snapshot()).mode,render3D?'webgl':'2d');assert.deepEqual((await snapshot()).counts,counts);
    for(const slots of [5,9,7]) {
      await page.evaluate(slots=>document.querySelector(`[data-slots="${slots}"]`).click(),slots);await page.clock.runFor(50);
      assert.deepEqual((await snapshot()).counts,counts);
      const labels=await page.evaluate(()=>window.__collectionLabels);
      const multipliers=slots===5?[2,3,10,3,2]:slots===9?[2,2,3,5,10,5,3,2,2]:[2,3,5,10,5,3,2];
      const bonus={2:1.5,3:2,5:3,10:3},icons={2:'🍒',3:'🍊',5:'🍇',10:'🍍'};
      assert.deepEqual(labels.filter(l=>l.y===851).map(l=>l.value),multipliers.map(m=>`×${m*bonus[m]*5}`),'displayed slot multipliers include collection and active global bonus');
      assert.deepEqual(labels.filter(l=>l.y===820).map(l=>l.value),multipliers.map(m=>icons[m]),'upgrades preserve fruit identity');
      assert.equal(labels.filter(l=>l.y===805).length,slots,'each slot shows a collection level');
    }
    await page.locator('#collection-return').click();await page.clock.runFor(50);
    assert.equal(await page.locator('#settings').evaluate(el=>el.open),false,'collection book returns directly to the table');
    await page.screenshot({path:`test-results/collections-${render3D?'3d':'2d'}-slots.png`,fullPage:true});
    await page.locator('#collection-button').click();
  }
  await page.evaluate(()=>{document.querySelector('[data-theme="dessert"]').click();document.querySelector('#time-flow').click();});
  await page.clock.fastForward(330000);assert.deepEqual((await snapshot()).counts,counts);
  await page.screenshot({path:'test-results/collections-night-book.png',fullPage:true});
  assert.equal(await page.locator('.collection-icon').first().evaluate(el=>getComputedStyle(el).filter),'none');
  await page.reload();await page.clock.runFor(50);assert.deepEqual((await snapshot()).counts,counts,'reload restores counts');
  await page.locator('#collection-button').click();assert.equal(await page.locator('[data-collection="10"]').getAttribute('data-level'),'3');
  await page.evaluate(()=>document.querySelector('#three-d').click());await page.clock.runFor(50);
  for(const viewport of [{width:320,height:720},{width:844,height:390}]) {
    await page.setViewportSize(viewport);await page.clock.runFor(50);
    assert.ok(await page.locator('#collection-book').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'collection book fits small and landscape screens');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page does not overflow horizontally');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: real collection and upgrade scoring, shared mirror progress, saved counts, collection book pause, 2D/3D upgraded labels, all slot layouts, unchanged icons, night theme and mobile sizing.');
} finally {await browser.close();}
