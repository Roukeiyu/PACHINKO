import { noteFrequency } from './canon.js';

// Original 72 BPM lounge score in D: a two-bar welcome, then eight looping bars.
// The final A13 chord leads back to Dmaj9, alongside the impact melody in D.
export const MUSIC = Object.freeze({ bpm: 72, introBeats: 8, loopBeats: 32 });
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
  const attack = instrument === 'pad' ? .3 : .018;
  const release = instrument === 'pad' ? 1.4 : .8;
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(level, at + attack);
  envelope.gain.exponentialRampToValueAtTime(level * (instrument === 'piano' ? .24 : .65), at + duration);
  envelope.gain.exponentialRampToValueAtTime(.00001, at + duration + release);
  envelope.gain.linearRampToValueAtTime(0, at + duration + release + .02);
  stereo.pan.value = pan; envelope.connect(stereo); stereo.connect(output);
  const frequency = noteFrequency(name);
  // A fundamental and faint second partial give the keys a rounded bell tone.
  for (const [ratio, weight] of instrument === 'piano' ? [[1,1],[2,.15],[3,.025]] : [[1,1],[2,.035]]) {
    const oscillator = ctx.createOscillator(), partial = ctx.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency * ratio;
    partial.gain.value = weight; oscillator.connect(partial); partial.connect(envelope);
    oscillator.start(at); oscillator.stop(at + duration + release + .03);
  }
}

async function renderSection(OfflineAudio, sampleRate, intro) {
  const duration = (intro ? MUSIC.introBeats : MUSIC.loopBeats) * beat;
  const frames = Math.round(duration * sampleRate), tail = Math.ceil(4 * sampleRate);
  const ctx = new OfflineAudio(2, frames + tail, sampleRate);
  const dry = ctx.createGain(); dry.connect(ctx.destination);
  // Quiet stereo echoes provide space; all tails are included in the loop fold.
  const delay = ctx.createDelay(1), echo = ctx.createGain();
  delay.delayTime.value = beat * .5; echo.gain.value = .16;
  dry.connect(delay); delay.connect(echo); echo.connect(ctx.destination);
  const progression = intro ? [chords[0], chords[7]] : chords;
  progression.forEach(([bass, harmony], bar) => {
    const start = bar * 4 * beat;
    harmony.forEach((pitch, i) => note(ctx, dry, pitch, start, 3.65 * beat, .021, 'pad', (i - 1.5) * .35));
    note(ctx, dry, bass, start, 2.5 * beat, .065, 'bass');
    note(ctx, dry, bass, start + 2.5 * beat, .7 * beat, .028, 'bass');
    [.25,1.25,2.25,3.25].forEach((offset, i) => note(ctx, dry, harmony[i], start + offset * beat, .7 * beat, .055, 'piano', i % 2 ? .25 : -.25));
    const tune = intro ? (bar ? melody[7] : [[.5,'A4'],[2,'F#4']]) : melody[bar];
    tune.forEach(([offset,pitch]) => note(ctx, dry, pitch, start + offset * beat, .95 * beat, .067, 'piano', .1));
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
