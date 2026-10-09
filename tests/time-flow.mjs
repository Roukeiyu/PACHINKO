import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TIME_CYCLE, TIME_PHASES, timePhase, createTimePalette } from '../src/time-flow.js';
assert.equal(TIME_CYCLE, 600000);
assert.deepEqual(TIME_PHASES.map(p=>p.duration), [240000,60000,240000,60000]);
const totals = [0,0,0,0];
for (let ms = 0; ms < TIME_CYCLE; ms += 1000) totals[timePhase(ms).index]++;
assert.deepEqual(totals, [240,60,240,60]);
for (const [ms,id] of [[0,'day'],[239999,'day'],[240000,'dusk'],[299999,'dusk'],[300000,'night'],[539999,'night'],[540000,'dawn'],[599999,'dawn'],[600000,'day'],[840000,'dusk']]) assert.equal(timePhase(ms).id,id);
assert.equal(timePhase(-10).id, 'day'); assert.equal(timePhase(NaN).id, 'day');
const samples = ['#fbf3e9','#344d42','#e994a4','#b2c3a1','#fff9e9dd','#fff','#abcd'];
const roles = ['surface','object','ink','line','glow','shadow'];
const rgb = h => { if (h.length === 4 || h.length === 5) h = '#' + [...h.slice(1)].map(c=>c+c).join(''); return [0,2,4].map(i=>parseInt(h.slice(i+1,i+3),16)); };
const distance = (a,b) => Math.max(...rgb(a).map((v,i)=>Math.abs(v-rgb(b)[i])));
for (const sample of samples) for (const role of roles) {
  assert.equal(createTimePalette(0).color(sample,role),sample, 'first daylight preserves the selected theme exactly');
  assert.equal(createTimePalette(20000).color(sample,role),sample);
  for (const boundary of [240000,300000,540000,600000,840000,1200000]) assert.ok(distance(createTimePalette(boundary-1).color(sample,role),createTimePalette(boundary).color(sample,role)) <= 1, 'phase boundaries have no color jump');
  for (const elapsed of [270000,330000,570000]) {
    const color=createTimePalette(elapsed).color(sample,role);
    assert.match(color,/^#[\da-f]{6}(?:[\da-f]{2})?$/i);
    if (sample.length===9) assert.equal(color.slice(7),sample.slice(7));
    if (sample.length===5) assert.equal(color.slice(7),sample.at(-1).repeat(2));
  }
  assert.equal(createTimePalette(670000).color(sample,role),createTimePalette(1270000).color(sample,role),'repeated cycles have identical palettes at identical phases');
}
// Scan every paint interval, including transition completion. Checking only
// phase boundaries misses the old contrast threshold's 252-channel jumps.
const inks = [...new Set([
  ...samples, '#69815d', '#997747', '#fffdf2', '#8e9681',
  ...[...(await readFile(new URL('../src/style.css',import.meta.url),'utf8')).matchAll(/--flow-ink-([\da-f]{3,8})\b/gi)].map(m=>`#${m[1]}`),
])];
for (const ink of inks) for (const start of [240000,300000,540000,600000]) {
  let previous = createTimePalette(start-250).color(ink,'ink');
  for (let ms=start; ms<=start+20250; ms+=250) {
    const next=createTimePalette(ms).color(ink,'ink');
    assert.ok(distance(previous,next)<=6, `${ink}: text cannot flip during transition at ${ms}`);
    previous=next;
  }
  const from=rgb(createTimePalette(start).color(ink,'ink')), to=rgb(createTimePalette(start+20000).color(ink,'ink'));
  for (const offset of [5000,10000,15000]) {
    const t=timePhase(start+offset).blend, actual=rgb(createTimePalette(start+offset).color(ink,'ink'));
    assert.ok(actual.every((v,i)=>Math.abs(v-(from[i]+(to[i]-from[i])*t))<=1),'text lerps between phase endpoints along the same timeline as the theme');
  }
}
for(const start of [240000,300000,540000,600000]) {
  let previous=parseFloat(createTimePalette(start-1).gameColorStrength);
  for(let ms=start;ms<=start+20250;ms+=250) {
    const current=parseFloat(createTimePalette(ms).gameColorStrength);
    assert.ok(Math.abs(current-previous)<1,'puzzle color lighting must interpolate continuously');previous=current;
  }
}
const dusk=rgb(createTimePalette(270000).color('#fbf3e9','surface')), night=rgb(createTimePalette(330000).color('#fbf3e9','surface'));
assert.ok(dusk[0]>dusk[1] && dusk[1]>dusk[2], 'dusk shifts the scene warm orange/red');
assert.ok(night[2]>night[0] && night.every(v=>v<100), 'night produces a dark blue/purple scene');
const marker={};assert.equal(createTimePalette(330000).color(marker),marker,'CanvasGradient objects pass through unchanged');
assert.equal(createTimePalette(330000).color('transparent'),'transparent');
console.log('PASS: exact 40/10/40/10 phase occupancy, repeating ten-minute cycles, continuous surface/text transitions, daylight identity, warm dusk/blue night and preserved alpha.');
