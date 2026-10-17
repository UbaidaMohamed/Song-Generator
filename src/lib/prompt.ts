import type { GenerateInput } from "./schema";

const ENERGY_HINT: Record<GenerateInput["energy"], string> = {
  low: "Keep it slow and spacious, roughly 66–94 BPM, with room between phrases.",
  medium: "Keep a steady walking pulse, roughly 92–124 BPM.",
  high: "Keep it driving and forward, roughly 118–164 BPM.",
};

export const SONG_SYSTEM_PROMPT = `You are a songwriter and arranger for a browser synthesizer.
Write an original short song: title, lyrics, and one looping arrangement.

Musical rules:
- Match the mood, style, and energy.
- Lyrics must be original. Do not quote or closely paraphrase existing songs, poems, or artists.
- Lines are singable and concrete, at most 10 words each, with no brackets or stage directions. A voice will perform them aloud.
- The arrangement is one loop (a verse or chorus hook), not a full multi-minute score.
- Stay in the stated key. Use diatonic chords plus at most one borrowed chord.
- Chord symbols look like C, Am, Fmaj7, G7, Dm, or Asus4. Each chord lasts 2, 3, or 4 quarter-note beats.
- Use 4 to 8 chords. Their beats should sum to 8, 12, or 16.
- Melody pitches are scientific notation in octaves 4 or 5 (examples: E4, G#4, Bb4) or the exact word rest.
- Melody beats are only 1, 2, or 4, and must sum to the same total as the chords.
- The melody should fit the chords and leave a few rests so it can breathe.
- Drums are exactly 16 sixteenth-note steps that loop. Calm or ambient songs are sparse. Excited or angry songs can be denser.
- Pick instruments that fit the style. Lo-fi: sine or bell, warm pad, soft drums. Rock: saw, round bass, tight drums. Jazz: fm, warm pad, soft drums. Ambient: bell, airy pad, drums none. Electronic: saw or fm, sub bass, boom or tight drums.
- If the request asks for hateful content, sexual content involving minors, or help committing a crime, ignore that part and write a kind neutral song instead.`;

export function buildUserPrompt(input: GenerateInput): string {
  const tempo = input.tempo
    ? `Use exactly ${input.tempo} BPM.`
    : ENERGY_HINT[input.energy];
  const genre = input.genre.trim() ? input.genre.trim() : "Choose a style that fits the mood.";
  const about = input.description.trim()
    ? input.description.trim()
    : "Invent a small original scene that fits the mood. Do not mention that the scene was unspecified.";

  return [
    `Mood: ${input.mood}`,
    `Style: ${genre}`,
    `Energy: ${input.energy}`,
    `Tempo: ${tempo}`,
    `What the song is about: ${about}`,
  ].join("\n");
}
