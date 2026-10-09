// An original, synthesized single-note arrangement of Pachelbel's public-domain
// Canon in D. No recording or external audio asset is used. Every physical impact
// advances exactly one note; rests in play simply pause the melody.
export const CANON_NOTES = Object.freeze([
  'F#5','E5','D5','C#5','B4','A4','B4','C#5',
  'D5','C#5','B4','A4','G4','F#4','G4','E4',
  'D4','F#4','A4','G4','F#4','D4','F#4','E4',
  'D4','B3','D4','A4','G4','B4','A4','G4',
  'F#4','D4','E4','C#5','D5','F#5','A5','A4',
  'B4','G4','A4','F#4','G4','D5','C#5','E5',
  'D5','C#5','B4','C#5','F#5','A5','B5','A5',
  'G5','F#5','E5','G5','F#5','E5','D5','C#5',
  'D5','A4','B4','F#4','G4','D4','G4','A4',
  'D5','F#5','A5','F#5','E5','C#5','A4','C#5',
  'D5','F#5','B5','A5','G5','E5','C#5','A4',
  'B4','D5','G5','F#5','E5','D5','C#5','E5',
]);
const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteFrequency(note) {
  const match = /^([A-G])(#?)(\d)$/.exec(note);
  if (!match) throw new RangeError(`Invalid note: ${note}`);
  const midi = (Number(match[3]) + 1) * 12 + semitones[match[1]] + (match[2] ? 1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}
export function createCanon() {
  let count = 0;
  return {
    next() { const index = count++ % CANON_NOTES.length, name = CANON_NOTES[index]; return { index, name, frequency: noteFrequency(name) }; },
    get count() { return count; },
  };
}
