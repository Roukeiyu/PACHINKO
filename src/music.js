import { noteFrequency } from './canon.js';

// Original 120 BPM light funk score in D: a two-bar welcome, then eight looping bars.
// The final A13 chord leads back to Dmaj9, alongside the impact melody in D.
export const MUSIC = Object.freeze({ bpm: 120, introBeats: 8, loopBeats: 32 });
const beat = 60 / MUSIC.bpm;
const chords = [
  ['D2', ['F#3', 'A3', 'C#4', 'E4']], ['B1', ['F#3', 'A3', 'C#4', 'D4']],
  ['G2', ['B3', 'D4', 'F#4', 'A4']], ['A2', ['G3', 'B3', 'D4', 'E4']],
  ['F#2', ['A3', 'C#4', 'E4', 'F#4']], ['B1', ['A3', 'C#4', 'D4', 'F#4']],
  ['G2', ['B3', 'D4', 'F#4', 'A4']], ['A2', ['G3', 'C#4', 'E4', 'F#4']],
];
const melody = [
  [[.5,'F#4'],[2.5,'E4']], [[1,'D4'],[3,'C#4']],
  [[.5,'B4'],[2,'A4'],[3.25,'F#4']], [[1,'E4'],[3,'D4']],
  [[.5,'C#5'],[2.5,'A4']], [[1,'F#4'],[3,'E4']],
  [[.5,'D5'],[2,'B4'],[3.25,'A4']], [[1,'G4'],[2.5,'E4']],
];

function note(ctx, output, name, at, duration, level, instrument, pan = 0) {
  const envelope = ctx.createGain(), stereo = ctx.createStereoPanner();
  const attack = instrument === 'pad' ? .12 : .008;
  const release = instrument === 'pad' ? .7 : instrument === 'bass' ? .08 : .25;
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(level, at + attack);
  envelope.gain.exponentialRampToValueAtTime(level * (instrument === 'piano' ? .24 : .65), at + duration);
  envelope.gain.exponentialRampToValueAtTime(.00001, at + duration + release);
  envelope.gain.linearRampToValueAtTime(0, at + duration + release + .02);
  stereo.pan.value = pan; envelope.connect(stereo); stereo.connect(output);
  const frequency = noteFrequency(name);
  // A fundamental and faint second partial give the keys a rounded bell tone.
  for (const [ratio, weight] of instrument === 'piano' ? [[1,1],[2,.28],[3,.08]] : instrument === 'bass' ? [[1,1],[2,.25],[3,.08]] : [[1,1],[2,.035]]) {
    const oscillator = ctx.createOscillator(), partial = ctx.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency * ratio;
    partial.gain.value = weight; oscillator.connect(partial); partial.connect(envelope);
    oscillator.start(at); oscillator.stop(at + duration + release + .03);
  }
}

// Reuse deterministic noise for percussion, including the last intro bar:
// its ringing tail then matches the final loop bar at the A→B transition.
function percussion(ctx, output) {
  const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .3), ctx.sampleRate);
  let seed = 0x504f4e;
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[i] = seed / 2147483648 - 1;
  }
  return (kind, at, level, pan = 0) => {
    const envelope = ctx.createGain(), stereo = ctx.createStereoPanner();
    const duration = kind === 'kick' ? .22 : kind === 'snare' ? .14 : .055;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(level, at + .002);
    envelope.gain.exponentialRampToValueAtTime(.00001, at + duration);
    envelope.gain.linearRampToValueAtTime(0, at + duration + .005);
    stereo.pan.value = pan; envelope.connect(stereo); stereo.connect(output);
    if (kind === 'kick') {
      const oscillator = ctx.createOscillator();
      oscillator.frequency.setValueAtTime(135, at);
      oscillator.frequency.exponentialRampToValueAtTime(46, at + .08);
      oscillator.connect(envelope); oscillator.start(at); oscillator.stop(at + duration + .01);
    } else {
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      source.buffer = noise; filter.type = kind === 'snare' ? 'bandpass' : 'highpass';
      filter.frequency.value = kind === 'snare' ? 1900 : 6500; filter.Q.value = .7;
      source.connect(filter); filter.connect(envelope); source.start(at); source.stop(at + duration + .01);
    }
  };
}

async function renderSection(OfflineAudio, sampleRate, intro) {
  const duration = (intro ? MUSIC.introBeats : MUSIC.loopBeats) * beat;
  const frames = Math.round(duration * sampleRate), tail = Math.ceil(4 * sampleRate);
  const ctx = new OfflineAudio(2, frames + tail, sampleRate);
  const dry = ctx.createGain(); dry.connect(ctx.destination);
  // Only the keys echo: percussion stays crisp and the bass stays centered.
  const keys = ctx.createGain(); keys.connect(dry);
  const delay = ctx.createDelay(1), echo = ctx.createGain();
  delay.delayTime.value = beat * .75; echo.gain.value = .13;
  keys.connect(delay); delay.connect(echo); echo.connect(ctx.destination);
  const drum = percussion(ctx, dry);
  const progression = intro ? [chords[0], chords[7]] : chords;
  progression.forEach(([bass, harmony], bar) => {
    const start = bar * 4 * beat, welcome = intro && bar === 0;
    harmony.forEach((pitch, i) => note(ctx, keys, pitch, start, 3.6 * beat, .012, 'pad', (i - 1.5) * .35));
    // Short, syncopated bass answers the offbeat chord stabs.
    const octave = bass.replace(/\d$/, digit => Number(digit) + 1);
    [[0,bass],[.75,bass],[1.5,octave],[2,bass],[2.75,bass],[3.5,octave]].forEach(([offset,pitch], i) =>
      note(ctx, dry, pitch, start + offset * beat, .32 * beat, i % 3 === 0 ? .12 : .085, 'bass'));
    [.5,1.5,2.5,3.5].forEach((offset, i) => {
      harmony.forEach((pitch, j) => note(ctx, keys, pitch, start + offset * beat, .2 * beat, .03, 'piano', (j - 1.5) * .25));
      note(ctx, keys, harmony[i], start + (offset + .25) * beat, .24 * beat, .045, 'piano', i % 2 ? .4 : -.4);
    });
    const tune = intro ? (bar ? melody[7] : [[.5,'A4'],[2,'F#4']]) : melody[bar];
    tune.forEach(([offset,pitch]) => note(ctx, keys, pitch, start + offset * beat, .4 * beat, .065, 'piano', .1));
    for (let pulse = 0; pulse < 4; pulse++) drum('kick', start + pulse * beat, welcome ? .13 : .22);
    if (!welcome) [1,3].forEach(offset => drum('snare', start + offset * beat, .2, -.08));
    for (let tick = 0; tick < 8; tick++) drum('hat', start + tick * .5 * beat, tick % 2 ? .12 : .065, tick % 2 ? .35 : -.35);
    if (!welcome) [1.75,3.75].forEach(offset => drum('hat', start + offset * beat, .06, -.35));
  });
  const rendered = await ctx.startRendering();
  if (intro) {
    const welcome = ctx.createBuffer(2, frames, sampleRate);
    for (let channel = 0; channel < 2; channel++) welcome.copyToChannel(rendered.getChannelData(channel).subarray(0, frames), channel);
    // A ends on the same bar as B: the folded B tail continues its ringing notes
    // exactly once, at the first transition as well as every later loop.
    return { buffer: welcome, frames };
  }
  const loop = ctx.createBuffer(2, frames, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const source = rendered.getChannelData(channel), target = loop.getChannelData(channel);
    target.set(source.subarray(0, frames));
    // Carry ringing notes from the last bar over the seam, rather than cutting
    // them off or inserting a fade-to-silence between repetitions.
    for (let i = frames; i < source.length; i++) target[(i - frames) % frames] += source[i];
  }
  return { buffer: loop, frames };
}

export async function renderMusic(sampleRate = 44100, OfflineAudio = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext) {
  if (!OfflineAudio) throw new Error('Offline audio is unavailable');
  const [intro, loop] = await Promise.all([renderSection(OfflineAudio, sampleRate, true), renderSection(OfflineAudio, sampleRate, false)]);
  let peak = 0;
  for (const { buffer } of [intro, loop]) for (let channel = 0; channel < 2; channel++) for (const value of buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(value));
  for (const { buffer } of [intro, loop]) for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] *= .65 / Math.max(peak, .001);
  }
  return { intro: intro.buffer, loop: loop.buffer, introDuration: intro.frames / sampleRate, loopDuration: loop.frames / sampleRate };
}

export function createBackgroundMusic(context) {
  const gain = context.createGain(); gain.gain.value = 0; gain.connect(context.destination);
  let rendered, pending, startedAt, enabled = false, error = null;
  function start() {
    if (!enabled || startedAt !== undefined || context.state === 'closed') return;
    const welcome = context.createBufferSource(), loop = context.createBufferSource();
    welcome.buffer = rendered.intro; loop.buffer = rendered.loop; loop.loop = true;
    welcome.connect(gain); loop.connect(gain);
    startedAt = context.currentTime + .08;
    welcome.start(startedAt); loop.start(startedAt + rendered.introDuration);
    welcome.onended = () => welcome.disconnect();
  }
  return {
    setEnabled(value, volume) {
      enabled = value;
      gain.gain.setTargetAtTime(enabled ? volume * .24 : 0, context.currentTime, .08);
      if (!enabled || startedAt !== undefined || error) return;
      pending ||= renderMusic(context.sampleRate).then(result => { rendered = result; start(); }).catch(reason => { error = reason.message; });
      if (rendered) start();
    },
    get status() {
      const elapsed = startedAt === undefined ? 0 : Math.max(0, context.currentTime - startedAt);
      return { enabled, ready: !!rendered, startedAt, elapsed, section: startedAt === undefined ? null : elapsed < rendered.introDuration ? 'A' : 'B', introDuration: rendered?.introDuration, loopDuration: rendered?.loopDuration, gain: gain.gain.value, error };
    },
  };
}
