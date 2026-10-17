import { z } from "zod";

export const ENERGY_IDS = ["low", "medium", "high"] as const;

export const generateInputSchema = z.object({
  mood: z
    .string()
    .trim()
    .min(2, "Pick a mood or type one (at least 2 characters).")
    .max(40, "Keep the mood under 40 characters.")
    .refine((value) => !/[\u0000-\u001F]/.test(value), "Mood contains invalid characters."),
  genre: z
    .string()
    .trim()
    .max(40, "Keep the style under 40 characters.")
    .refine((value) => !/[\u0000-\u001F]/.test(value), "Style contains invalid characters.")
    .optional()
    .default(""),
  energy: z.enum(ENERGY_IDS),
  tempo: z.number().int().min(60).max(180).nullable().optional(),
  description: z
    .string()
    .trim()
    .max(400, "Keep the description under 400 characters.")
    .refine((value) => !/[\u0000-\u001F]/.test(value), "Description contains invalid characters.")
    .optional()
    .default(""),
});

export type GenerateInput = z.infer<typeof generateInputSchema>;

export const TONICS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
export const MODES = ["major", "minor"] as const;
export const TIME_SIGNATURES = ["4/4", "3/4"] as const;
export const LEADS = ["bell", "pluck", "saw", "sine", "fm"] as const;
export const PADS = ["warm", "airy", "dark", "none"] as const;
export const BASSES = ["sub", "round", "none"] as const;
export const DRUMS = ["soft", "tight", "boom", "none"] as const;

const lyricSectionSchema = z.object({
  section: z.string(),
  lines: z.array(z.string()),
});

const chordSchema = z.object({
  symbol: z.string(),
  beats: z.number(),
});

const melodyNoteSchema = z.object({
  pitch: z.string(),
  beats: z.number(),
});

const drumStepSchema = z.object({
  kick: z.boolean(),
  snare: z.boolean(),
  hat: z.boolean(),
});

export const rawSongSchema = z.object({
  title: z.string(),
  blurb: z.string(),
  tonic: z.string(),
  mode: z.string(),
  bpm: z.number(),
  timeSignature: z.string(),
  palette: z.object({
    lead: z.string(),
    pad: z.string(),
    bass: z.string(),
    drums: z.string(),
  }),
  lyrics: z.array(lyricSectionSchema).min(1),
  chords: z.array(chordSchema).min(1),
  melody: z.array(melodyNoteSchema).min(1),
  drums: z.array(drumStepSchema).min(1),
});

export type RawSong = z.infer<typeof rawSongSchema>;

export type Palette = {
  lead: (typeof LEADS)[number];
  pad: (typeof PADS)[number];
  bass: (typeof BASSES)[number];
  drums: (typeof DRUMS)[number];
};

export type Song = {
  title: string;
  blurb: string;
  tonic: (typeof TONICS)[number];
  mode: (typeof MODES)[number];
  bpm: number;
  timeSignature: (typeof TIME_SIGNATURES)[number];
  palette: Palette;
  lyrics: { section: string; lines: string[] }[];
  chords: { symbol: string; beats: number }[];
  melody: { pitch: string; beats: number }[];
  drums: { kick: boolean; snare: boolean; hat: boolean }[];
  keyLabel: string;
};

export const SONG_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "Original song title, two to six words." },
    blurb: { type: "string", description: "One sentence about the song." },
    tonic: { type: "string", enum: [...TONICS] },
    mode: { type: "string", enum: [...MODES] },
    bpm: { type: "integer", minimum: 64, maximum: 168 },
    timeSignature: { type: "string", enum: [...TIME_SIGNATURES] },
    palette: {
      type: "object",
      additionalProperties: false,
      properties: {
        lead: { type: "string", enum: [...LEADS] },
        pad: { type: "string", enum: [...PADS] },
        bass: { type: "string", enum: [...BASSES] },
        drums: { type: "string", enum: [...DRUMS] },
      },
      required: ["lead", "pad", "bass", "drums"],
    },
    lyrics: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          section: { type: "string", description: "Verse, Chorus, Bridge, or Outro." },
          lines: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "string" },
          },
        },
        required: ["section", "lines"],
      },
    },
    chords: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          symbol: {
            type: "string",
            description: "Chord symbol such as C, Am, Fmaj7, G, Dm7, or Asus4.",
          },
          beats: { type: "integer", enum: [2, 3, 4] },
        },
        required: ["symbol", "beats"],
      },
    },
    melody: {
      type: "array",
      minItems: 8,
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          pitch: {
            type: "string",
            description: "Scientific pitch such as E4 or G#4, or the word rest.",
          },
          beats: { type: "number", enum: [0.5, 1, 2, 4] },
        },
        required: ["pitch", "beats"],
      },
    },
    drums: {
      type: "array",
      minItems: 16,
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kick: { type: "boolean" },
          snare: { type: "boolean" },
          hat: { type: "boolean" },
        },
        required: ["kick", "snare", "hat"],
      },
    },
  },
  required: [
    "title",
    "blurb",
    "tonic",
    "mode",
    "bpm",
    "timeSignature",
    "palette",
    "lyrics",
    "chords",
    "melody",
    "drums",
  ],
} as const;
