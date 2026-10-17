/** Built-in xAI TTS voices from the voice table on docs.x.ai (October 2026). */
export const VOICES = [
  { id: "ara", label: "Ara", note: "Warm and friendly" },
  { id: "aurora", label: "Aurora", note: "Serene and steady" },
  { id: "carina", label: "Carina", note: "Soft and soothing" },
  { id: "castor", label: "Castor", note: "Easygoing" },
  { id: "celeste", label: "Celeste", note: "Reassuring" },
  { id: "cosmo", label: "Cosmo", note: "Bright and curious" },
  { id: "eve", label: "Eve", note: "Energetic, British" },
  { id: "helios", label: "Helios", note: "Upbeat" },
  { id: "helix", label: "Helix", note: "Bold and driving" },
  { id: "iris", label: "Iris", note: "Friendly and upbeat" },
  { id: "kepler", label: "Kepler", note: "Charismatic" },
  { id: "leo", label: "Leo", note: "Authoritative, British" },
  { id: "liora", label: "Liora", note: "Calm and grounded" },
  { id: "luna", label: "Luna", note: "Gentle" },
  { id: "lux", label: "Lux", note: "Quiet and wise" },
  { id: "naksh", label: "Naksh", note: "Warm, Indian accent" },
  { id: "orion", label: "Orion", note: "Cinematic" },
  { id: "perseus", label: "Perseus", note: "Strong and trustworthy" },
  { id: "rex", label: "Rex", note: "Confident and clear" },
  { id: "rigel", label: "Rigel", note: "Precise, Australian accent" },
  { id: "sal", label: "Sal", note: "Smooth and balanced" },
  { id: "sirius", label: "Sirius", note: "Playful" },
  { id: "ursa", label: "Ursa", note: "Warm and steadfast" },
  { id: "zagan", label: "Zagan", note: "Dramatic" },
  { id: "zenith", label: "Zenith", note: "Sharp and driven" },
  { id: "altair", label: "Altair", note: "Elegant" },
  { id: "atlas", label: "Atlas", note: "Commanding" },
  { id: "lumen", label: "Lumen", note: "Warm and engaging" },
] as const;

export type VoiceId = (typeof VOICES)[number]["id"];

const VOICE_IDS = new Set<string>(VOICES.map((voice) => voice.id));

const MOOD_VOICES: Record<string, VoiceId> = {
  sad: "carina",
  melancholic: "carina",
  calm: "liora",
  dreamy: "aurora",
  happy: "eve",
  excited: "helix",
  angry: "leo",
  romantic: "ara",
  nostalgic: "sal",
  hopeful: "iris",
};

export function isVoiceChoice(value: string): boolean {
  return value === "auto" || VOICE_IDS.has(value);
}

export function resolveVoice(mood: string, requested: string | undefined): VoiceId {
  const choice = (requested ?? "auto").trim().toLowerCase();
  if (choice !== "auto" && VOICE_IDS.has(choice)) return choice as VoiceId;
  return MOOD_VOICES[mood.trim().toLowerCase()] ?? "eve";
}

export function voiceLabel(id: string): string {
  return VOICES.find((voice) => voice.id === id)?.label ?? id;
}
