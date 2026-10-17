import { normalizeSong } from "./normalize";
import type { RawSong } from "./schema";

const raw: RawSong = {
  title: "Last Train Home",
  blurb: "A bright little pop loop about missing the train and not minding.",
  tonic: "C",
  mode: "major",
  bpm: 118,
  timeSignature: "4/4",
  palette: { lead: "pluck", pad: "warm", bass: "round", drums: "tight" },
  lyrics: [
    {
      section: "Verse",
      lines: [
        "Platform lights blink twice and fade",
        "We wave the timetable away",
        "Your laugh arrives before the rain",
      ],
    },
    {
      section: "Chorus",
      lines: [
        "Missed the last train, caught the night",
        "City humming, holding tight",
        "If we're late then let it be",
        "The long way home still sounds like we",
      ],
    },
  ],
  chords: [
    { symbol: "C", beats: 4 },
    { symbol: "G", beats: 4 },
    { symbol: "Am", beats: 4 },
    { symbol: "F", beats: 4 },
  ],
  melody: [
    { pitch: "E4", beats: 1 },
    { pitch: "G4", beats: 1 },
    { pitch: "C5", beats: 2 },
    { pitch: "B4", beats: 1 },
    { pitch: "G4", beats: 1 },
    { pitch: "A4", beats: 2 },
    { pitch: "G4", beats: 1 },
    { pitch: "E4", beats: 1 },
    { pitch: "F4", beats: 2 },
    { pitch: "E4", beats: 1 },
    { pitch: "D4", beats: 1 },
    { pitch: "C4", beats: 2 },
  ],
  drums: [
    { kick: true, snare: false, hat: true },
    { kick: false, snare: false, hat: false },
    { kick: false, snare: false, hat: true },
    { kick: false, snare: false, hat: false },
    { kick: false, snare: true, hat: true },
    { kick: false, snare: false, hat: false },
    { kick: false, snare: false, hat: true },
    { kick: false, snare: false, hat: false },
    { kick: true, snare: false, hat: true },
    { kick: false, snare: false, hat: false },
    { kick: true, snare: false, hat: true },
    { kick: false, snare: false, hat: false },
    { kick: false, snare: true, hat: true },
    { kick: false, snare: false, hat: false },
    { kick: false, snare: false, hat: true },
    { kick: false, snare: false, hat: true },
  ],
};

export const sampleSong = normalizeSong(raw, { energy: "high", tempo: 118 });
