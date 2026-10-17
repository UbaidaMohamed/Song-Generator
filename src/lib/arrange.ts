import { chordPitches, transposeOctave, transposeSemitones } from "./chords";
import type { Song } from "./schema";

export type ScoreEvent =
  | { type: "lead"; time: number; duration: number; note: string; velocity: number }
  | { type: "pad"; time: number; duration: number; notes: string[]; velocity: number }
  | { type: "bass"; time: number; duration: number; note: string; velocity: number }
  | { type: "kick"; time: number; note: string; velocity: number }
  | { type: "snare"; time: number; velocity: number }
  | { type: "hat"; time: number; velocity: number };

export type Arrangement = {
  events: ScoreEvent[];
  loopSeconds: number;
  totalBeats: number;
};

export function totalBeats(song: Song): number {
  return song.chords.reduce((sum, chord) => sum + chord.beats, 0);
}

export function loopSeconds(song: Song): number {
  return (totalBeats(song) * 60) / song.bpm;
}

export function arrange(song: Song): Arrangement {
  const beats = totalBeats(song);
  const beatSeconds = 60 / song.bpm;
  const loop = loopSeconds(song);
  const events: ScoreEvent[] = [];
  const drumGain = song.palette.drums === "boom" ? 1 : song.palette.drums === "soft" ? 0.72 : 0.88;

  let cursor = 0;
  for (const chord of song.chords) {
    const time = cursor * beatSeconds;
    const duration = chord.beats * beatSeconds;
    const notes = chordPitches(chord.symbol) ?? ["C3", "E3", "G3"];
    if (song.palette.pad !== "none") {
      events.push({ type: "pad", time, duration: duration * 0.94, notes, velocity: 0.34 });
    }
    if (song.palette.bass !== "none") {
      const root = transposeOctave(notes[0], -1);
      events.push({
        type: "bass",
        time,
        duration: Math.min(beatSeconds * 0.92, duration * 0.9),
        note: root,
        velocity: 0.78,
      });
      if (chord.beats >= 4) {
        events.push({
          type: "bass",
          time: time + beatSeconds * 2,
          duration: beatSeconds * 0.7,
          note: transposeSemitones(root, 7),
          velocity: 0.62,
        });
      }
    }
    cursor += chord.beats;
  }

  let melodyBeat = 0;
  for (const note of song.melody) {
    if (note.pitch !== "rest") {
      events.push({
        type: "lead",
        time: melodyBeat * beatSeconds,
        duration: Math.max(0.08, note.beats * beatSeconds * 0.88),
        note: note.pitch,
        velocity: 0.64,
      });
    }
    melodyBeat += note.beats;
  }

  if (song.palette.drums !== "none") {
    const step = beatSeconds / 4;
    const bar = step * 16;
    for (let barStart = 0; barStart < loop - 0.001; barStart += bar) {
      song.drums.forEach((hit, index) => {
        const time = barStart + index * step;
        if (time >= loop - 0.001) return;
        if (hit.kick) events.push({ type: "kick", time, note: "C1", velocity: 0.95 * drumGain });
        if (hit.snare) events.push({ type: "snare", time, velocity: 0.55 * drumGain });
        if (hit.hat) {
          events.push({
            type: "hat",
            time,
            velocity: (index % 2 === 0 ? 0.28 : 0.16) * drumGain,
          });
        }
      });
    }
  }

  return { events, loopSeconds: loop, totalBeats: beats };
}

export function activeChordIndex(song: Song, positionSeconds: number): number {
  const beats = totalBeats(song);
  if (beats <= 0) return 0;
  const beat = (((positionSeconds * song.bpm) / 60) % beats + beats) % beats;
  let cursor = 0;
  for (let index = 0; index < song.chords.length; index += 1) {
    cursor += song.chords[index].beats;
    if (beat < cursor - 0.0001) return index;
  }
  return 0;
}
