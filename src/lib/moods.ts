export const MOODS = [
  {
    id: "sad",
    label: "Sad",
    line: "Slow, close, a little blue",
  },
  {
    id: "happy",
    label: "Happy",
    line: "Bright and easy to hum",
  },
  {
    id: "excited",
    label: "Excited",
    line: "Forward motion, big chorus",
  },
  {
    id: "calm",
    label: "Calm",
    line: "Soft edges, lots of air",
  },
  {
    id: "angry",
    label: "Angry",
    line: "Tension, grit, short lines",
  },
  {
    id: "romantic",
    label: "Romantic",
    line: "Warm, intimate, unhurried",
  },
  {
    id: "nostalgic",
    label: "Nostalgic",
    line: "Old light, familiar chords",
  },
  {
    id: "dreamy",
    label: "Dreamy",
    line: "Hazy, floating, half-awake",
  },
] as const;

export const GENRES = [
  "Pop",
  "Lo-fi",
  "Indie",
  "Rock",
  "Jazz",
  "Electronic",
  "Folk",
  "R&B",
  "Cinematic",
  "Hip-hop",
  "Ambient",
] as const;

export const ENERGY = [
  { id: "low", label: "Gentle", hint: "Slow and spacious" },
  { id: "medium", label: "Steady", hint: "A walking pulse" },
  { id: "high", label: "Driving", hint: "Up and forward" },
] as const;

export type EnergyId = (typeof ENERGY)[number]["id"];

export const EXAMPLES = [
  {
    label: "Kitchen radio",
    mood: "nostalgic",
    genre: "Lo-fi",
    energy: "low" as const,
    description: "A kitchen radio at dusk and a summer you can almost name.",
  },
  {
    label: "Missed train",
    mood: "happy",
    genre: "Pop",
    energy: "high" as const,
    description: "Two friends missing the last train and laughing about it.",
  },
  {
    label: "City lights",
    mood: "romantic",
    genre: "R&B",
    energy: "medium" as const,
    description: "City lights on a windshield and a hand that stays.",
  },
  {
    label: "Rain on a tent",
    mood: "calm",
    genre: "Ambient",
    energy: "low" as const,
    description: "Rain on a tent and nowhere you need to be.",
  },
];
