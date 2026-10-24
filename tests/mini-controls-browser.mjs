import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { MINI_GAMES } from '../src/mini-games.js';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
await mkdir('test-results',{recursive:true});const errors=[];
try {
  for(const [name,viewport,mobile,soft] of [['desktop',{width:1280,height:900},false,false],['touch',{width:390,height:844},true,false],['small',{width:320,height:568},true,true]]) {
    const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile,reducedMotion:soft?'reduce':'no-preference'});
    page.on('pageerror',e=>errors.push(e.message));
    const epoch=Date.UTC(2026,9,24,12);await page.clock.install({time:epoch});await page.clock.pauseAt(epoch+1000);
    await page.addInitScript(()=>localStorage.setItem('ponpon-settings',JSON.stringify({sound:false,music:false,calm:false})));
    await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');
    await page.evaluate(async()=>{
      const {createMiniGamesUI,miniGameMarkup}=await import('/src/mini-games-ui.js');
      const host=document.createElement('div');host.id='mini-controls-fixture';host.innerHTML=miniGameMarkup;document.body.append(host);
      const root=host.querySelector('dialog'),flags={gm:false},rounds=[];
      const ui=createMiniGamesUI({root,isGM:()=>flags.gm,onFinish:r=>rounds.push(r),onExit:()=>{}});
      window.__controls={ui,root,flags,rounds};
    });
    const scope=page.locator('#mini-controls-fixture');
    const snapshot=()=>page.evaluate(()=>window.__controls.ui.snapshot());
    const paint=()=>page.evaluate(()=>window.__controls.ui.update(performance.now()));
    const input=async locator=>mobile?locator.tap({force:true}):locator.click({force:true});
    async function advance(ms){await page.clock.runFor(ms);await paint();}
    async function gm(on){await page.evaluate(on=>{window.__controls.flags.gm=on;window.__controls.ui.update(performance.now());},on);}
    async function start(kind){await page.evaluate(kind=>window.__controls.ui.start(kind,'secret'),kind);await input(scope.locator('#mini-start'));await paint();}
    async function metrics(){return page.evaluate(()=>{
      const r=window.__controls.root,f=r.querySelector('#mini-field').getBoundingClientRect(),p=r.querySelector('#mini-star-control').getBoundingClientRect();
      return{field:{x:f.x,y:f.y,width:f.width,height:f.height},pad:{x:p.x,y:p.y,width:p.width,height:p.height},overflow:r.scrollHeight-r.clientHeight};
    });}
    // Every extant game checks live GM state at the entry, even if a hidden
    // button is forced to dispatch a click. The normal round stays running.
    for(const kind of Object.keys(MINI_GAMES)) {
      await gm(false);await start(kind);const stop=scope.locator('#mini-stop');
      assert.equal(await stop.isVisible(),false);assert.equal(await stop.evaluate(b=>b.offsetHeight),0);
      const before=await snapshot();await stop.evaluate(b=>{b.hidden=false;b.click();});
      assert.deepEqual(await snapshot(),before,'non-GM handler rejects a forced stop');await paint();assert.equal(await stop.isVisible(),false);
      await gm(true);assert.equal(await stop.isVisible(),true);
      if(kind==='pairs'){
        const group=Object.values(Object.groupBy(before.board.map((c,i)=>({...c,i})),c=>c.pair))[0];
        await input(scope.locator(`[data-cell="${group[0].i}"]`));await input(scope.locator(`[data-cell="${group[1].i}"]`));
      } else if(kind==='blocks') {
        const index=await page.evaluate(async()=>{const{connectedBlocks}=await import('/src/mini-games.js');const b=window.__controls.ui.snapshot().board;return b.findIndex((_,i)=>connectedBlocks(b,i).length>=3);});
        await input(scope.locator(`[data-cell="${index}"]`));assert.equal(await scope.locator('dialog').getAttribute('data-busy'),'1');
      } else if(kind==='moles') {
        for(const i of before.board.flatMap((c,i)=>c.type==='mole'?[i]:[]))await input(scope.locator(`[data-cell="${i}"]`));
        assert.ok((await snapshot()).flipUntil>0);
      }
      const paidBefore=await page.evaluate(()=>window.__controls.rounds.length);
      await input(stop);assert.equal((await snapshot()).status,'aborted');assert.equal(await stop.isVisible(),false);
      const frozen=await snapshot();assert.equal(await scope.locator('dialog').getAttribute('data-busy'),null);
      await stop.evaluate(b=>b.click());await advance(1500);assert.deepEqual(await snapshot(),frozen,'GM stop freezes the round and prevents late animation writes');
      assert.equal(await page.evaluate(()=>window.__controls.rounds.length),paidBefore+1,'aborting settles once');
      assert.equal(await scope.locator('.mini-catch-pop,.mini-bit,.mini-flash').count(),0);
      await input(scope.locator('#mini-return'));await start(kind);assert.equal((await snapshot()).score,0);
      await input(scope.locator('#mini-stop'));await input(scope.locator('#mini-return'));
    }
    await gm(false);await start('stars');let m=await metrics();
    assert.ok(m.pad.height>=48 && m.pad.y+m.pad.height<=viewport.height+1,'bottom control stays visible and clear of the viewport edge');
    assert.ok(m.field.width>=180 && m.field.height>=230,'star playfield remains readable');assert.ok(m.overflow<=1);
    if(mobile) {
      const cdp=await page.context().newCDPSession(page),x=m.pad.x+m.pad.width/2,y=m.pad.y+m.pad.height/2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y}]});const centered=(await snapshot()).basketX;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y},{id:2,x:2,y}]});
      assert.equal((await snapshot()).basketX,centered,'second finger is ignored');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:viewport.width-2,y},{id:2,x:2,y}]});
      assert.equal((await snapshot()).basketX,281);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:3,x,y}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:3,x:2,y:35}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.equal((await snapshot()).basketX,39,'drag outside the board and release clamps the whole basket');await cdp.detach();
    } else {
      await page.mouse.move(m.pad.x+m.pad.width/2,m.pad.y+m.pad.height/2);await page.mouse.down();await page.mouse.move(viewport.width-2,35);await page.mouse.up();
      assert.equal((await snapshot()).basketX,281,'dialog backdrop controls the basket without touching falling items');
      await page.mouse.click(2,35);assert.equal((await snapshot()).basketX,39);
    }
    await scope.locator('dialog').evaluate(el=>el.style.zoom='.85');m=await metrics();
    const target=m.field.x+m.field.width*.7;
    if(mobile)await page.touchscreen.tap(target,m.pad.y+m.pad.height/2);else await page.mouse.click(target,m.pad.y+m.pad.height/2);
    assert.ok(Math.abs((await snapshot()).basketX-224)<1,'input coordinates follow scaled board bounds');
    await scope.locator('dialog').evaluate(el=>el.style.zoom='');m=await metrics();
    // Move from the separate pad to catch real spawned objects. Successful
    // catches stay local; bombs retain their own damage feedback.
    await advance(300);let star=(await snapshot()).items.find(i=>i.kind==='star');assert.ok(star);
    const park=async x=>{const r=await metrics();const px=r.field.x+x/320*r.field.width,py=r.pad.y+r.pad.height/2;if(mobile)await page.touchscreen.tap(px,py);else await page.mouse.click(px,py);};
    await park(star.x);await advance(2200);assert.ok((await snapshot()).hit>0);
    assert.equal(await scope.locator('.mini-flash').count(),0);assert.ok(await scope.locator('.mini-catch-spark').count()>0);
    if(soft)assert.ok(await scope.locator('.mini-catch-spark').count()<=1);
    await page.screenshot({path:`test-results/star-controls-${name}.png`});
    for(let n=0;n<120 && !(await snapshot()).bombs;n++){
      const s=await snapshot(),bomb=s.items.find(i=>i.kind==='bomb');if(bomb)await park(bomb.x);
      await advance(40);assert.ok(await scope.locator('.mini-catch-spark').count()<=15,'rapid catches have a bounded local particle pool');
    }
    assert.ok((await snapshot()).bombs>0);assert.equal(await scope.locator('.mini-basket').evaluate(b=>b.classList.contains('is-hurt')),true);
    assert.equal(await scope.locator('.mini-flash').count(),0);
    await gm(true);const basket=(await snapshot()).basketX;await input(scope.locator('#mini-stop'));
    assert.equal((await snapshot()).basketX,basket,'stop button cannot move the basket');assert.equal(await scope.locator('.mini-catch-pop').count(),0);
    await input(scope.locator('#mini-return'));await page.close();console.log(`PASS: ${name} star pad/backdrop, clamp, capture/cancel, zoom, local catch/damage FX; all five GM-only stops and replay.`);
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
