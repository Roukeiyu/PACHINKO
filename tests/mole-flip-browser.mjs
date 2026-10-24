import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { MOLE_FLIP_MS } from '../src/mini-games.js';

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
await mkdir('test-results',{recursive:true});
const errors=[];
try {
  for(const [name,viewport,mobile,soft] of [['desktop',{width:1280,height:900},false,false],['touch',{width:390,height:844},true,false],['reduced',{width:390,height:844},true,true]]) {
    const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile,colorScheme:mobile?'dark':'light'});
    page.on('pageerror',e=>errors.push(e.message));
    const epoch=Date.UTC(2026,9,24,12);await page.clock.install({time:epoch});await page.clock.pauseAt(epoch+1000);
    await page.addInitScript(soft=>localStorage.setItem('ponpon-settings',JSON.stringify({sound:false,music:false,calm:soft})),soft);
    await page.goto(process.env.TEST_URL||'http://127.0.0.1:5173');
    // Drive the real controller's public update clock exactly at the face swap.
    // The main app keeps running behind this isolated modal; no product hooks.
    await page.evaluate(async()=>{
      const {createMiniGamesUI,miniGameMarkup}=await import('/src/mini-games-ui.js');
      const host=document.createElement('div');host.id='mole-flip-fixture';host.innerHTML=miniGameMarkup;document.body.append(host);
      const root=host.querySelector('dialog');let awards=0;
      const ui=createMiniGamesUI({root,onFinish:()=>awards++,onExit:()=>{}});
      window.__moleFlip={ui,root,get awards(){return awards;}};ui.start('moles','gm');
    });
    const scope=page.locator('#mole-flip-fixture');
    const input=async locator=>mobile?locator.tap({force:true}):locator.click({force:true});
    const snapshot=()=>page.evaluate(()=>window.__moleFlip.ui.snapshot());
    const paint=()=>page.evaluate(()=>window.__moleFlip.ui.update(performance.now()));
    const faces=()=>page.evaluate(()=>[...window.__moleFlip.root.querySelectorAll('[data-cell]')].map(b=>({hit:b.classList.contains('mini-hit'),back:b.classList.contains('mini-back'),text:b.textContent,color:getComputedStyle(b).backgroundColor,disabled:b.disabled,transform:b.style.transform,opacity:b.style.opacity})));
    async function frameAt(at) {
      const now=await page.evaluate(()=>performance.now());assert.ok(now<=at+1e-6,'test frames move forward');
      if(at>now)await page.clock.runFor(at-now);await paint();
    }
    async function checkFlip(label) {
      const before=await snapshot(),front=await faces();assert.ok(before.flipUntil>0);assert.ok(front.some(b=>b.hit));
      const neutral=front.find(b=>!b.hit).color,firstHit=front.findIndex(b=>b.hit);
      const duration=soft?180:260,mid=i=>duration/2+(soft?0:i*4),hitMid=mid(firstHit);
      const times=[0,hitMid-1,hitMid,hitMid+40,MOLE_FLIP_MS-1];
      for(let i=0;i<16;i++)times.push(mid(i)-1,mid(i),mid(i)+1);
      for(const elapsed of [...new Set(times)].sort((a,b)=>a-b)) {
        await frameAt(before.flipFrom+elapsed);const current=await faces(),state=await snapshot();
        assert.equal(state.score,before.score);assert.equal(state.hit,before.hit);assert.equal(state.wave,before.wave);
        for(let i=0;i<16;i++) {
          assert.equal(current[i].back,elapsed>=mid(i),`disc ${i} swaps at its own edge-on frame (${elapsed}ms)`);
          assert.equal(current[i].disabled,true,'the neutral back never becomes a target');
          if(elapsed>=mid(i)){assert.equal(current[i].color,neutral);assert.equal(current[i].hit,false);assert.equal(current[i].text,'');}
          else {assert.equal(current[i].hit,front[i].hit);assert.equal(current[i].color,front[i].color);assert.equal(current[i].text,front[i].text);}
        }
        if(elapsed===hitMid) {
          if(soft)assert.ok(Math.abs(Number(current[firstHit].opacity)-.15)<1e-6);
          else assert.equal(current[firstHit].transform,'rotateY(90deg)');
          await scope.locator('[data-cell]').evaluateAll(buttons=>{for(let n=0;n<10;n++)buttons.forEach(b=>b.dispatchEvent(new MouseEvent('click',{bubbles:true})));});
          assert.equal((await snapshot()).score,before.score,'rapid clicks during the swap cannot score');
        }
        if([hitMid-1,hitMid,hitMid+40].includes(elapsed))await page.screenshot({path:`test-results/mole-flip-${name}-${label}-${elapsed}.png`});
      }
      await frameAt(before.flipUntil);const next=await snapshot();
      if(next.status==='playing')assert.ok((await faces()).every(b=>!b.back&&!b.hit&&b.text),'new wave restores faces and clears all old visual hit states');
    }
    await input(scope.locator('#mini-start'));await paint();
    let s=await snapshot();const first=s.board.findIndex(c=>c.type==='mole');
    await input(scope.locator(`[data-cell="${first}"]`));const once=(await snapshot()).score;
    await scope.locator(`[data-cell="${first}"]`).evaluate(b=>{for(let n=0;n<10;n++)b.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
    assert.equal((await snapshot()).score,once,'a hit cannot pay twice');
    await frameAt(s.waveUntil);await checkFlip('partial'); // A hit and missed moles/cabbages share the back color.
    for(let wave=2;wave<=10;wave++) {
      s=await snapshot();assert.equal(s.wave,wave);
      for(const i of s.board.flatMap((c,i)=>c.type==='mole'?[i]:[]))await input(scope.locator(`[data-cell="${i}"]`));
      await paint();
      if(wave===2)await checkFlip('all-hit');else await frameAt((await snapshot()).flipUntil);
    }
    assert.equal((await snapshot()).status,'complete');assert.equal(await page.evaluate(()=>window.__moleFlip.awards),1);
    await input(scope.locator('#mini-return'));await page.evaluate(()=>window.__moleFlip.ui.start('moles','gm'));
    await input(scope.locator('#mini-start'));await paint();
    assert.equal((await snapshot()).score,0);assert.equal((await snapshot()).hit,0);assert.ok((await faces()).every(b=>!b.hit&&!b.back));
    await page.close();console.log(`PASS: mole flip ${name}, exact midpoint colors, missed/hit discs, rapid clicks, repeated waves and replay.`);
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
