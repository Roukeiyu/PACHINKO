export const TIME_CYCLE = 600000;
export const TIME_TRANSITION = 20000;
export const TIME_PHASES = Object.freeze([
  Object.freeze({ id: 'day', label: '白天', duration: TIME_CYCLE * .4 }),
  Object.freeze({ id: 'dusk', label: '黄昏', duration: TIME_CYCLE * .1 }),
  Object.freeze({ id: 'night', label: '夜间', duration: TIME_CYCLE * .4 }),
  Object.freeze({ id: 'dawn', label: '清晨', duration: TIME_CYCLE * .1 }),
]);
export function timePhase(elapsed) {
  elapsed = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
  const position = elapsed % TIME_CYCLE;
  let start = 0, index = 0;
  while (index < TIME_PHASES.length - 1 && position >= start + TIME_PHASES[index].duration) start += TIME_PHASES[index++].duration;
  const phase = TIME_PHASES[index], into = position - start;
  const linear = Math.min(1, into / TIME_TRANSITION);
  // The first activation opens in ordinary daylight. Later dawn→day transitions
  // use the same smooth interpolation as every other phase boundary.
  const blend = index === 0 && elapsed < TIME_CYCLE ? 1 : linear * linear * (3 - 2 * linear);
  return { ...phase, index, position, into, remaining: phase.duration - into, blend, previous: TIME_PHASES[(index + 3) % 4].id };
}
function rgb(hex) {
  let value = hex.slice(1);
  if (value.length === 3 || value.length === 4) value = [...value].map(c => c + c).join('');
  return [parseInt(value.slice(0,2),16), parseInt(value.slice(2,4),16), parseInt(value.slice(4,6),16)];
}
const lerp = (a,b,t) => a.map((v,i) => v + (b[i] - v) * t);
const range = (a,b,t) => lerp(rgb(a),rgb(b),t);
function phaseColor(original, phase, role) {
  if (phase === 'day') return original;
  const light = (.2126 * original[0] + .7152 * original[1] + .0722 * original[2]) / 255;
  const warmth = Math.max(0, Math.min(1, .5 + (original[0] - original[1]) / 128));
  const palettes = {
    dusk: { surface: ['#e9b9a5','#ffead6'], object: ['#bd725f','#f3c296'], ink: ['#583b3f','#6b423e'], line: ['#c38f7f','#e7b69d'], shadow: ['#593c40','#76524a'] },
    night: { surface: ['#151c32','#2c3554'], object: ['#405980','#72649b'], ink: ['#f3eeff','#bbcae9'], line: ['#657aa3','#a99fca'], shadow: ['#050919','#151b30'] },
    dawn: { surface: ['#d8ebeb','#fff4f5'], object: ['#82b8c0','#e7b2cf'], ink: ['#3b5a6e','#526775'], line: ['#9ac7cc','#dcc0d3'], shadow: ['#486c7a','#b59cae'] },
  };
  if (role === 'glow') return lerp(original, phaseColor(original, phase, 'object'), .28);
  const stops = palettes[phase][role] || palettes[phase].object;
  return range(...stops, role === 'object' ? light * .55 + warmth * .45 : light);
}
function luminance(channels) {
  return channels.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum,v,i) => sum + v * [.2126,.7152,.0722][i], 0);
}
function readableInk(ink, background) {
  const contrast = color => { const a = luminance(color), b = luminance(background); return (Math.max(a,b) + .05) / (Math.min(a,b) + .05); };
  if (contrast(ink) >= 4.6) return ink;
  const dark = [0,0,0], light = [255,255,255], target = contrast(dark) > contrast(light) ? dark : light;
  if (contrast(target) < 4.6) return target;
  // Correct each fixed phase endpoint before blending. Choosing dark/light
  // against the moving background would cause a discontinuous color flip.
  let low = 0, high = 1;
  for (let i = 0; i < 12; i++) { const middle = (low + high) / 2; if (contrast(lerp(ink,target,middle)) >= 4.6) high = middle; else low = middle; }
  return lerp(ink,target,high);
}
export function createTimePalette(elapsed) {
  const phase = timePhase(elapsed), cache = new Map();
  function color(value, role = 'object') {
    if (typeof value !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) return value;
    if (phase.id === 'day' && phase.blend === 1) return value;
    const key = `${role}:${value}`;
    if (!cache.has(key)) {
      const original = rgb(value);
      function endpoint(id) {
        const channels = phaseColor(original, id, role);
        // Daylight must remain identical to the selected theme, including at
        // the end of dawn→day. Other endpoints retain their readable shades.
        if (role !== 'ink' || id === 'day') return channels;
        // Originally near-white labels sit on the dark launch/done buttons;
        // ordinary labels sit on the page, dialog or painted board surface.
        const reference = (.2126*original[0]+.7152*original[1]+.0722*original[2])/255 > .9 ? rgb('#385442') : rgb('#fffdf5');
        return readableInk(channels, phaseColor(reference, id, 'surface'));
      }
      // Text shares the same continuous blend as surfaces and objects. Apply
      // no threshold-based contrast correction to intermediate colors.
      const channels = lerp(endpoint(phase.previous), endpoint(phase.id), phase.blend);
      const mixed = channels.map(n => Math.round(n).toString(16).padStart(2,'0')).join('');
      const alpha = value.length === 9 ? value.slice(7) : value.length === 5 ? value.at(-1).repeat(2) : '';
      cache.set(key, `#${mixed}${alpha}`);
    }
    return cache.get(key);
  }
  // Semantic game colors retain their own hues under the changing ambient
  // light, so four-color puzzles never collapse into one blue/purple palette.
  const strengths = { day: .85, dusk: .72, night: .28, dawn: .8 };
  const gameColorStrength = `${(strengths[phase.previous] + (strengths[phase.id] - strengths[phase.previous]) * phase.blend) * 100}%`;
  return { phase, color, gameColorStrength };
}
// Tokens include CSS rules and SVG presentation attributes. Discovering them
// keeps the shared palette aligned with newly added controls and decorations.
export function collectTimeTokens(doc) {
  const names = new Set(), collect = text => { for (const match of text.matchAll(/--flow-(surface|object|ink|line|shadow)-([\da-f]{3,8})\b/gi)) names.add(match[0]); };
  for (const sheet of doc.styleSheets) {
    try { for (const rule of sheet.cssRules) collect(rule.cssText); } catch { /* Ignore unrelated cross-origin stylesheets. */ }
  }
  collect(doc.querySelector('#app').innerHTML);
  return [...names].map(name => { const [,role,hex] = /^--flow-(\w+)-([\da-f]+)$/i.exec(name); return { name, role, value: `#${hex}` }; });
}
export function applyTimePalette(root, tokens, palette) {
  root.classList.toggle('time-flow', !!palette);
  for (const token of tokens) {
    if (palette) root.style.setProperty(token.name, palette.color(token.value, token.role));
    else root.style.removeProperty(token.name);
  }
  if (palette) { root.style.setProperty('--mini-color-strength', palette.gameColorStrength); }
  else { root.style.removeProperty('--mini-color-strength'); }
}
