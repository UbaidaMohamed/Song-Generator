import { chordPitches, clampMelodyPitch, diatonicLoop, scaleDegree } from "./chords";
import {
  BASSES,
  DRUMS,
  LEADS,
  MODES,
  PADS,
  TIME_SIGNATURES,
  TONICS,
  type GenerateInput,
  type RawSong,
  type Song,
} from "./schema";

const ENERGY_BPM: Record<GenerateInput["energy"], [number, number]> = {
  low: [66, 94],
  medium: [92, 124],
  high: [118, 164],
};

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function cleanText(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function snapBeats(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const allowed = [0.5, 1, 2, 3, 4];
  return allowed.reduce((best, current) =>
    Math.abs(current - value) < Math.abs(best - value) ? current : best,
  );
}

export function defaultDrums(energy: GenerateInput["energy"]): Song["drums"] {
  const steps = Array.from({ length: 16 }, () => ({ kick: false, snare: false, hat: false }));
  const hatEvery = energy === "high" ? 1 : 2;
  for (let index = 0; index < 16; index += hatEvery) steps[index].hat = true;
  steps[0].kick = true;
  steps[8].kick = true;
  if (energy === "high") steps[10].kick = true;
  steps[4].snare = true;
  steps[12].snare = true;
  if (energy === "low") {
    steps[2].hat = false;
    steps[6].hat = false;
    steps[10].hat = false;
    steps[14].hat = false;
  }
  return steps;
}

function fallbackMelody(total: number, tonic: Song["tonic"], mode: Song["mode"]): Song["melody"] {
  const pattern = [0, 2, 4, 2, 5, 4, 2, 0];
  const notes: Song["melody"] = [];
  let remaining = total;
  let index = 0;
  while (remaining > 0.01) {
    const beats = remaining >= 2 ? 2 : Math.round(remaining * 2) / 2;
    notes.push({
      pitch: scaleDegree(tonic, mode, pattern[index % pattern.length], 4),
      beats,
    });
    remaining = Math.round((remaining - beats) * 2) / 2;
    index += 1;
  }
  return notes;
}

function fitMelody(
  notes: RawSong["melody"],
  total: number,
  tonic: Song["tonic"],
  mode: Song["mode"],
): Song["melody"] {
  const cleaned = notes
    .map((note) => {
      const pitch = note.pitch.trim().toLowerCase() === "rest" ? "rest" : clampMelodyPitch(note.pitch);
      if (!pitch) return null;
      return { pitch, beats: snapBeats(note.beats) };
    })
    .filter((note): note is Song["melody"][number] => note !== null)
    .slice(0, 32);

  const source = cleaned.length >= 4 ? cleaned : fallbackMelody(total, tonic, mode);
  const fitted: Song["melody"] = [];
  let sum = 0;
  for (const note of source) {
    if (sum >= total - 0.01) break;
    const room = Math.round((total - sum) * 2) / 2;
    const beats = Math.min(note.beats, room);
    if (beats <= 0) break;
    fitted.push({ pitch: note.pitch, beats });
    sum = Math.round((sum + beats) * 2) / 2;
  }
  if (sum < total - 0.01) {
    fitted.push({ pitch: "rest", beats: Math.round((total - sum) * 2) / 2 });
  }
  return fitted;
}

export function normalizeSong(
  raw: RawSong,
  input: Pick<GenerateInput, "energy" | "tempo">,
): Song {
  const tonic = oneOf(raw.tonic, TONICS, "C");
  const mode = oneOf(raw.mode, MODES, "major");
  const timeSignature = oneOf(raw.timeSignature, TIME_SIGNATURES, "4/4");
  const palette: Song["palette"] = {
    lead: oneOf(raw.palette.lead, LEADS, "sine"),
    pad: oneOf(raw.palette.pad, PADS, "warm"),
    bass: oneOf(raw.palette.bass, BASSES, "round"),
    drums: oneOf(raw.palette.drums, DRUMS, input.energy === "low" ? "soft" : "tight"),
  };

  let bpm = Math.round(raw.bpm);
  if (typeof input.tempo === "number") {
    bpm = input.tempo;
  } else {
    const [min, max] = ENERGY_BPM[input.energy];
    if (!Number.isFinite(bpm)) bpm = Math.round((min + max) / 2);
    bpm = Math.min(max, Math.max(min, bpm));
  }
  bpm = Math.min(180, Math.max(60, bpm));

  let chords = raw.chords
    .map((chord) => ({
      symbol: cleanText(chord.symbol, 12),
      beats: chord.beats === 2 || chord.beats === 3 || chord.beats === 4 ? chord.beats : 4,
    }))
    .filter((chord) => chord.symbol.length > 0 && chordPitches(chord.symbol))
    .slice(0, 8);

  if (chords.length < 4) chords = diatonicLoop(tonic, mode);

  let total = chords.reduce((sum, chord) => sum + chord.beats, 0);
  while (total > 32 && chords.length > 4) {
    chords = chords.slice(0, -1);
    total = chords.reduce((sum, chord) => sum + chord.beats, 0);
  }

  let drums = raw.drums.slice(0, 16).map((step) => ({
    kick: step.kick,
    snare: step.snare,
    hat: step.hat,
  }));
  if (drums.length === 0) drums = defaultDrums(input.energy);
  while (drums.length < 16) drums.push({ ...drums[drums.length % Math.max(drums.length, 1)] });
  if (palette.drums !== "none" && drums.every((step) => !step.kick && !step.snare && !step.hat)) {
    drums = defaultDrums(input.energy);
  }

  const lyrics = raw.lyrics
    .map((section) => ({
      section: cleanText(section.section, 32) || "Verse",
      lines: section.lines.map((line) => cleanText(line, 140)).filter(Boolean).slice(0, 6),
    }))
    .filter((section) => section.lines.length > 0)
    .slice(0, 5);

  if (lyrics.length === 0) throw new Error("The song did not include lyrics.");

  const title = cleanText(raw.title, 80);
  if (title.length < 2) throw new Error("The song did not include a title.");

  return {
    title,
    blurb: cleanText(raw.blurb, 180) || `An original ${mode} song in ${tonic}.`,
    tonic,
    mode,
    bpm,
    timeSignature,
    palette,
    lyrics,
    chords,
    melody: fitMelody(raw.melody, total, tonic, mode),
    drums,
    keyLabel: `${tonic} ${mode}`,
  };
}
