const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const FLATS: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Fb: "E",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
  Cb: "B",
};

export type ParsedPitch = {
  name: string;
  octave: number;
  midi: number;
};

export function parsePitch(raw: string): ParsedPitch | null {
  const match = raw.trim().match(/^([A-Ga-g])([#bB])?(-?\d)$/);
  if (!match) return null;
  let name = match[1].toUpperCase() + (match[2] ? match[2].replace("B", "b") : "");
  if (name.endsWith("b")) {
    const spelled = FLATS[name];
    if (!spelled) return null;
    name = spelled;
  }
  const octave = Number(match[3]);
  const pc = NAMES.indexOf(name as (typeof NAMES)[number]);
  if (pc < 0 || !Number.isInteger(octave) || octave < 0 || octave > 8) return null;
  return { name, octave, midi: (octave + 1) * 12 + pc };
}

export function formatPitch(midi: number): string {
  const wrapped = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NAMES[wrapped]}${octave}`;
}

export function clampMelodyPitch(raw: string): string | null {
  if (raw.trim().toLowerCase() === "rest") return "rest";
  const parsed = parsePitch(raw);
  if (!parsed) return null;
  const midi = Math.min(84, Math.max(60, parsed.midi));
  return formatPitch(midi);
}

export function transposeOctave(pitch: string, octaves: number): string {
  const parsed = parsePitch(pitch);
  if (!parsed) return pitch;
  return formatPitch(parsed.midi + octaves * 12);
}

export function transposeSemitones(pitch: string, semitones: number): string {
  const parsed = parsePitch(pitch);
  if (!parsed) return pitch;
  return formatPitch(parsed.midi + semitones);
}

function rootPitchClass(symbol: string): { pc: number; quality: string } | null {
  const match = symbol.trim().match(/^([A-Ga-g])([#bB])?(.*)$/);
  if (!match) return null;
  let name = match[1].toUpperCase() + (match[2] ? match[2].replace("B", "b") : "");
  if (name.endsWith("b")) {
    const spelled = FLATS[name];
    if (!spelled) return null;
    name = spelled;
  }
  const pc = NAMES.indexOf(name as (typeof NAMES)[number]);
  if (pc < 0) return null;
  return { pc, quality: match[3].toLowerCase().replace(/\s+/g, "") };
}

function intervalsFor(quality: string): number[] {
  const minor = quality.startsWith("m") && !quality.startsWith("maj");
  let intervals = minor || quality.startsWith("min") ? [0, 3, 7] : [0, 4, 7];
  if (quality.includes("dim")) intervals = [0, 3, 6];
  else if (quality.includes("aug")) intervals = [0, 4, 8];
  else if (quality.includes("sus2")) intervals = [0, 2, 7];
  else if (quality.includes("sus4")) intervals = [0, 5, 7];

  if (quality.includes("maj7")) intervals = [...intervals.slice(0, 3), 11];
  else if (minor && quality.includes("7")) intervals = [0, 3, 7, 10];
  else if (quality === "7" || quality.endsWith("7") || quality.includes("dom7")) {
    intervals = [...intervals.slice(0, 3), 10];
  }
  return intervals;
}

export function chordPitches(symbol: string, octave = 3): string[] | null {
  const parsed = rootPitchClass(symbol);
  if (!parsed) return null;
  const rootMidi = (octave + 1) * 12 + parsed.pc;
  return intervalsFor(parsed.quality).map((interval) => formatPitch(rootMidi + interval));
}

export function tonicToPitchClass(tonic: string): number {
  const parsed = rootPitchClass(tonic);
  return parsed?.pc ?? 0;
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

export function scaleDegree(tonic: string, mode: "major" | "minor", degree: number, octave = 4): string {
  const scale = mode === "minor" ? MINOR_SCALE : MAJOR_SCALE;
  const pc = (tonicToPitchClass(tonic) + scale[((degree % 7) + 7) % 7]) % 12;
  return formatPitch((octave + 1) * 12 + pc);
}

export function diatonicLoop(tonic: string, mode: "major" | "minor"): { symbol: string; beats: number }[] {
  const degrees = mode === "minor" ? [0, 5, 2, 6] : [0, 4, 5, 3];
  const qualities = mode === "minor" ? ["m", "", "", ""] : ["", "", "m", ""];
  return degrees.map((degree, index) => {
    const scale = mode === "minor" ? MINOR_SCALE : MAJOR_SCALE;
    const pc = (tonicToPitchClass(tonic) + scale[degree]) % 12;
    return { symbol: `${NAMES[pc]}${qualities[index]}`, beats: 4 };
  });
}
