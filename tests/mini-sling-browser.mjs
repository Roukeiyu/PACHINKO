import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { SLING_DURATION, SLING_TARGET } from '../src/mini-sling.js';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
await mkdir('test-results',{recursive:true});
const url=process.env.TEST_URL||'http://127.0.0.1:5173';
const errors=[];
async function setup(viewport, mobile=false) {
  const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile});
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('ponpon-settings',JSON.stringify({sound:false,music:false,calm:true})));
  const epoch=Date.UTC(2026,9,24,8);await page.clock.install({time:epoch});await page.clock.pauseAt(epoch+1000);
  await page.goto(url);await page.clock.runFor(50);
  return page;
}
const snapshot=page=>page.evaluate(()=>window.__ponpon);
const mini=async page=>(await snapshot(page)).miniGame;
async function gm() {}
async function start(page) {
  await page.evaluate(() => window.__ponpon.openMini('sling'));
  assert.equal((await snapshot(page)).miniGame,null,'intro never starts the timer');
  assert.match(await page.locator('#mini-intro-goal').textContent(),/25.*30/);
  await page.locator('#mini-start').click();await page.clock.runFor(20);
}

async function points(page, target={x:72,y:268}) {
  const r=await page.locator('#mini-field').boundingBox();
  const point=(x,y)=>({x:r.x+x/320*r.width,y:r.y+y/420*r.height});
  return {rest:point(160,365),pull:point(target.x,target.y),r};
}
async function shoot(page, touch=false, screenshot=null, shot=0) {
  const target=(await mini(page)).blocks.filter(b=>!b.down).sort((a,b)=>b.y-a.y)[0];
  const p=await points(page,target);
  if(touch) {
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p.rest]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p.pull]});
    const aimed=await mini(page);
    assert.ok(aimed.pull || aimed.status!=='playing',`real touch drag updates the pull: ${JSON.stringify({fired:aimed.fired,at:aimed.lastSim,ready:aimed.nextShotAt,status:aimed.status,p})}`);
    if(screenshot) await page.screenshot({path:screenshot});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  } else {
    await page.mouse.move(p.rest.x,p.rest.y);await page.mouse.down();await page.mouse.move(p.pull.x,p.pull.y,{steps:5});
    assert.ok((await mini(page)).pull,'mouse drag updates the pull');
    if(screenshot) await page.screenshot({path:screenshot});
    await page.mouse.up();
  }
}
try {
  for(const [name,viewport,mobile] of [['desktop',{width:1280,height:900},false],['mobile',{width:390,height:844},true],['small',{width:320,height:568},true],['landscape',{width:844,height:390},true]]) {
    const page=await setup(name==='landscape'?{width:390,height:844}:viewport,mobile);await gm(page);await start(page);
    if(name==='landscape'){await page.setViewportSize(viewport);await page.clock.runFor(20);}
    const before=await snapshot(page),p=await points(page);
    assert.ok(p.r.width>150 && p.r.width<=viewport.width);
    assert.ok(Math.abs(p.r.height/p.r.width-420/320)<.03,'the playfield keeps its portrait ratio');
    assert.ok(await page.locator('#mini-stop').isVisible());
    await shoot(page,mobile,`test-results/sling-${name}-aim.png`);
    assert.equal((await mini(page)).fired,1,'release fires exactly one ball');
    assert.ok((await mini(page)).shots[0].vy<0,'the shot travels from the bottom upward');
    assert.equal((await mini(page)).originX,160,'the turret stays fixed at the center');assert.equal((await mini(page)).originY,365);
    for(let t=0;t<40 && !(await mini(page)).blocks.some(b=>b.down);t++)await page.clock.runFor(40);
    const falling=(await mini(page)).blocks.find(b=>b.down);assert.ok(falling && falling.scale>0);
    await page.screenshot({path:`test-results/sling-${name}-fall.png`});await page.clock.runFor(250);
    const smaller=(await mini(page)).blocks.find(b=>b.id===falling.id);
    assert.ok(smaller.scale<falling.scale);assert.equal(smaller.x,falling.x);assert.equal(smaller.y,falling.y);

    for(let shot=1;shot<37 && (await mini(page)).status==='playing';shot++) {
      await page.clock.runFor(800);
      if((await mini(page)).status==='playing') await shoot(page,mobile,null,shot);
    }
    await page.clock.runFor(1200);
    const won=await mini(page),after=await snapshot(page);
    assert.equal(won.status,'complete');assert.ok(won.removed>=SLING_TARGET);
    assert.equal(after.score,before.score+won.score);
    assert.equal(after.gameClock,before.gameClock,'main table remains paused');
    assert.equal(await page.locator('#mini-result-title').textContent(),'推出成功！');
    assert.equal(await page.locator('#mini-stop').isVisible(),false);
    await page.screenshot({path:`test-results/sling-${name}-result.png`});
    await page.clock.fastForward(35000);assert.equal((await snapshot(page)).score,after.score,'award occurs once');
    await page.locator('#mini-return').click();assert.equal((await snapshot(page)).miniGame,null);

    await start(page);
    let clean=await mini(page);assert.equal(clean.fired,0);assert.equal(clean.removed,0);assert.equal(clean.score,0);
    // Cancel a drag, then simulate a second finger. Neither may create a shot.
    await page.locator('#mini-field').evaluate(field=>{
      const r=field.getBoundingClientRect();const emit=(type,id,x,y)=>field.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,clientX:r.left+x/320*r.width,clientY:r.top+y/420*r.height}));
      emit('pointerdown',7,160,365);emit('pointermove',7,50,365);emit('pointerup',8,50,365);emit('pointercancel',7,50,365);emit('pointerup',7,50,365);
    });
    assert.equal((await mini(page)).fired,0);
    await page.clock.fastForward(SLING_DURATION-100);
    assert.equal((await mini(page)).status,'playing');assert.equal((await mini(page)).removed,0);
    await page.clock.runFor(150);
    assert.equal((await mini(page)).status,'timeout');assert.equal((await mini(page)).score,0);
    await page.locator('#mini-return').click();await start(page);
    await shoot(page,mobile);await page.locator('#mini-stop').click();
    const stopped=await mini(page);assert.equal(stopped.status,'aborted');assert.equal(stopped.shots.length,0);
    await page.clock.fastForward(35000);assert.deepEqual(await mini(page),stopped,'early stop disposes physics');
    await page.locator('#mini-return').click();await page.close();console.log(`PASS: sling ${name}`);
  }
  // Exercise the actual secret-hole entry and its once-only ball/score reward.
  const page=await setup({width:390,height:844},true);
  await page.route('**/src/mini-games.js*',async route=>{
    const response=await route.fetch();let body=await response.text();
    const signature='function randomMiniGame(random = Math.random, previous = null) {';
    assert.ok(body.includes(signature));body=body.replace(signature,`${signature} return 'sling';`);
    await route.fulfill({response,body});
  });
  await page.reload();await page.clock.runFor(50);
  assert.equal(await page.evaluate(()=>window.__ponpon.dropHole()),true);
  await page.clock.runFor(100);assert.equal(await page.locator('#mini-game').getAttribute('data-kind'),'sling');
  await page.locator('#mini-start').click();const before=await snapshot(page);
  for(let i=0;i<37 && (await mini(page)).status==='playing';i++){await shoot(page,true,null,i);await page.clock.runFor(800);}
  const result=await mini(page),after=await snapshot(page);
  assert.equal(result.status,'complete');assert.equal(after.score,before.score+result.score);
  assert.equal(after.available,before.available+20,'a scoring secret visit grants the existing 20 balls');
  await page.clock.fastForward(35000);assert.equal((await snapshot(page)).available,after.available);
  await page.locator('#mini-return').click();await page.clock.runFor(50);
  assert.equal((await snapshot(page)).secretPending,false);assert.equal((await snapshot(page)).emissionPaused,false);
  assert.deepEqual(errors,[]);console.log('PASS: desktop, 320/390px touch and landscape; real drag, goal, timeout, cancel/multitouch, stop/replay and once-only secret score/ball payout.');
} finally {await browser.close();}
