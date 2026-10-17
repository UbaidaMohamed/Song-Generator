import { loopSeconds } from "./arrange";
import { GrokError, requireApiKey, XAI_KEY_REJECTED } from "./grok";
import type { GenerateInput, Song } from "./schema";
import { resolveVoice, type VoiceId } from "./voices";

const TTS_URL = "https://api.x.ai/v1/tts";

export type VocalLine = {
  section: string;
  line: string;
  start: number;
  end: number;
};

export type Vocal = {
  audioBase64: string;
  contentType: string;
  /** Duration of the audio file, before playback-rate fitting. */
  duration: number;
  /** Playback rate that pulls the vocal toward an integer number of loops. */
  playbackRate: number;
  voiceId: VoiceId;
  /** Line times are in the audio file, before playbackRate. */
  lines: VocalLine[];
};

export type VocalSynthesis =
  | { ok: true; vocal: Vocal }
  | { ok: false; status: number; fatal: boolean; message: string };

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

type ScriptSpan = {
  section: string;
  line: string;
  start: number;
  end: number;
};

type Delivery = {
  voiceId: VoiceId;
  speed: number;
  wraps: string[];
  betweenLines: string;
  betweenSections: string;
  leadIn: string;
};

const SOFT_MOODS = new Set(["sad", "melancholic", "calm", "dreamy", "romantic", "nostalgic"]);

function clampSpeed(value: number): number {
  const clamped = Math.min(1.5, Math.max(0.7, value));
  return Math.round(clamped * 100) / 100;
}

export function vocalDelivery(input: Pick<GenerateInput, "mood" | "energy" | "genre" | "voice">): Delivery {
  const mood = input.mood.trim().toLowerCase();
  const rhythmic =
    mood === "excited" || (/hip-?hop|\brap\b/i.test(input.genre) && !SOFT_MOODS.has(mood));

  let speed = 1;
  let wraps = ["singing"];
  let betweenLines = "[pause]";
  let betweenSections = "[long-pause]";
  let leadIn = "";

  if (mood === "sad" || mood === "melancholic") {
    wraps = ["soft", "singing"];
    speed = 0.82;
    leadIn = "[sigh]";
    betweenLines = "[pause]";
  } else if (mood === "calm") {
    wraps = ["soft", "singing"];
    speed = 0.88;
    leadIn = "[hum-tune]";
  } else if (mood === "dreamy") {
    wraps = ["soft", "sing-song"];
    speed = 0.86;
    leadIn = "[hum-tune]";
  } else if (rhythmic) {
    wraps = ["fast", "singing"];
    speed = 1.28;
    betweenSections = "[pause]";
  } else if (mood === "happy" || mood === "hopeful") {
    wraps = ["sing-song"];
    speed = 1.06;
  } else if (mood === "angry") {
    wraps = ["loud", "singing"];
    speed = 1.12;
    betweenLines = "[breath]";
    betweenSections = "[pause]";
  } else if (mood === "romantic") {
    wraps = ["soft", "singing"];
    speed = 0.92;
  } else if (mood === "nostalgic") {
    wraps = ["sing-song"];
    speed = 0.95;
  }

  if (input.energy === "high") speed += 0.05;
  if (input.energy === "low") speed -= 0.04;

  return {
    voiceId: resolveVoice(mood, input.voice),
    speed: clampSpeed(speed),
    wraps,
    betweenLines,
    betweenSections,
    leadIn,
  };
}

function sanitizeLine(line: string): string {
  return line.replace(/[<>[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

export function buildVocalScript(
  song: Song,
  input: Pick<GenerateInput, "mood" | "energy" | "genre" | "voice">,
): { text: string; speed: number; voiceId: VoiceId; spans: ScriptSpan[] } {
  const plan = vocalDelivery(input);
  let text = "";
  const spans: ScriptSpan[] = [];
  if (plan.leadIn) text += `${plan.leadIn} `;
  text += plan.wraps.map((tag) => `<${tag}>`).join("");

  for (const section of song.lyrics) {
    const lines = section.lines.map(sanitizeLine).filter(Boolean);
    if (lines.length === 0) continue;
    if (spans.length > 0) text += ` ${plan.betweenSections} `;
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) text += ` ${plan.betweenLines} `;
      const start = text.length;
      text += line;
      spans.push({ section: section.section, line, start, end: text.length });
    });
  }

  text += [...plan.wraps].reverse().map((tag) => `</${tag}>`).join("");
  return { text, speed: plan.speed, voiceId: plan.voiceId, spans };
}

function proportionalLines(spans: ScriptSpan[], duration: number): VocalLine[] {
  const slice = spans.length > 0 ? Math.max(duration, 0.2) / spans.length : 0;
  return spans.map((span, index) => ({
    section: span.section,
    line: span.line,
    start: index * slice,
    end: (index + 1) * slice,
  }));
}

export function alignVocalLines(
  text: string,
  spans: ScriptSpan[],
  graphChars: string[] | undefined,
  graphTimes: number[][] | undefined,
  duration: number,
): VocalLine[] {
  if (spans.length === 0) return [];
  if (!graphChars || !graphTimes || graphChars.length === 0 || graphChars.length !== graphTimes.length) {
    return proportionalLines(spans, duration);
  }

  const spoken = graphChars.join("");
  const direct = spoken.length === text.length;
  let cursor = 0;
  const lines: VocalLine[] = [];

  for (const span of spans) {
    let startIndex = span.start;
    let endIndex = span.end - 1;
    if (!direct) {
      const found = spoken.indexOf(span.line, cursor);
      if (found < 0) return proportionalLines(spans, duration);
      startIndex = found;
      endIndex = found + span.line.length - 1;
      cursor = found + span.line.length;
    }
    const start = graphTimes[startIndex]?.[0];
    const end = graphTimes[Math.min(endIndex, graphTimes.length - 1)]?.[1];
    if (typeof start !== "number" || typeof end !== "number" || !Number.isFinite(start) || !Number.isFinite(end)) {
      return proportionalLines(spans, duration);
    }
    lines.push({
      section: span.section,
      line: span.line,
      start: Math.max(0, start),
      end: Math.max(start + 0.05, end),
    });
  }

  return lines;
}

/** Speed up or slow down slightly so the vocal lands near a bar. 1 means leave it alone. */
export function fitPlaybackRate(vocalSeconds: number, loop: number): number {
  if (!(vocalSeconds > 0) || !(loop > 0)) return 1;
  const loops = Math.max(1, Math.round(vocalSeconds / loop));
  const target = loops * loop;
  const rate = vocalSeconds / target;
  if (rate < 0.8 || rate > 1.25) return 1;
  return Math.round(rate * 1000) / 1000;
}

export function performedSpan(vocal: Pick<Vocal, "duration" | "playbackRate">): number {
  const rate = vocal.playbackRate > 0 ? vocal.playbackRate : 1;
  return vocal.duration / rate;
}

type TtsPayload = {
  audio?: unknown;
  content_type?: unknown;
  contentType?: unknown;
  duration?: unknown;
  audio_timestamps?: { graph_chars?: unknown; graph_times?: unknown };
  audioTimestamps?: { graph_chars?: unknown; graphChars?: unknown; graph_times?: unknown; graphTimes?: unknown };
};

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return undefined;
  return value;
}

function asTimeArray(value: unknown): number[][] | undefined {
  if (!Array.isArray(value)) return undefined;
  const times: number[][] = [];
  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length < 2) return undefined;
    const start = pair[0];
    const end = pair[1];
    if (typeof start !== "number" || typeof end !== "number") return undefined;
    times.push([start, end]);
  }
  return times;
}

function readPayload(payload: TtsPayload) {
  const stamps = payload.audio_timestamps ?? payload.audioTimestamps;
  const chars = asStringArray(
    stamps && "graph_chars" in stamps ? stamps.graph_chars : stamps && "graphChars" in stamps ? stamps.graphChars : undefined,
  );
  const times = asTimeArray(
    stamps && "graph_times" in stamps ? stamps.graph_times : stamps && "graphTimes" in stamps ? stamps.graphTimes : undefined,
  );
  return {
    audio: typeof payload.audio === "string" ? payload.audio.replace(/\s/g, "") : "",
    contentType:
      typeof payload.content_type === "string"
        ? payload.content_type
        : typeof payload.contentType === "string"
          ? payload.contentType
          : "audio/wav",
    duration: typeof payload.duration === "number" && payload.duration > 0 ? payload.duration : 0,
    chars,
    times,
  };
}

export async function synthesizeVocals(
  song: Song,
  input: GenerateInput,
  options?: { fetchImpl?: FetchLike; apiKey?: string },
): Promise<VocalSynthesis> {
  let apiKey: string;
  try {
    apiKey = requireApiKey(options?.apiKey);
  } catch (error) {
    if (error instanceof GrokError) return { ok: false, status: error.status, fatal: true, message: error.message };
    throw error;
  }

  const script = buildVocalScript(song, input);
  if (script.spans.length === 0 || script.text.length < 2) {
    return {
      ok: false,
      status: 502,
      fatal: false,
      message: "The lyrics were empty, so this take is instrumental.",
    };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text: script.text,
        voice_id: script.voiceId,
        language: "en",
        speed: script.speed,
        text_normalization: false,
        with_timestamps: true,
        output_format: { codec: "wav", sample_rate: 24000 },
      }),
      signal: AbortSignal.timeout(18_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ok: false,
      status: 504,
      fatal: false,
      message: timedOut
        ? "The vocal took too long, so this take is instrumental. Try again if you want a voice."
        : "The vocal service could not be reached, so this take is instrumental.",
    };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("xAI vocal request failed", response.status, detail.slice(0, 300));
    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: 502, fatal: true, message: XAI_KEY_REJECTED };
    }
    if (response.status === 404) {
      return {
        ok: false,
        status: 502,
        fatal: false,
        message: "That voice isn't available. This take is instrumental — pick another voice.",
      };
    }
    if (response.status === 429) {
      return {
        ok: false,
        status: 429,
        fatal: false,
        message: "xAI is rate-limiting vocals. The instrumental is ready; try again in a minute for a voice.",
      };
    }
    return {
      ok: false,
      status: 502,
      fatal: false,
      message: "The vocal didn't come through, so this take is instrumental. Try again for a voice.",
    };
  }

  let payload: TtsPayload;
  try {
    payload = (await response.json()) as TtsPayload;
  } catch {
    return {
      ok: false,
      status: 502,
      fatal: false,
      message: "The vocal came back in an unexpected format, so this take is instrumental.",
    };
  }

  const parsed = readPayload(payload);
  if (!parsed.audio || parsed.audio.length < 32 || parsed.audio.length > 3_500_000) {
    return {
      ok: false,
      status: 502,
      fatal: false,
      message: "The vocal audio was unusable, so this take is instrumental.",
    };
  }

  const lines = alignVocalLines(script.text, script.spans, parsed.chars, parsed.times, parsed.duration);
  const duration = parsed.duration || lines.at(-1)?.end || 0;
  if (!(duration > 0)) {
    return {
      ok: false,
      status: 502,
      fatal: false,
      message: "The vocal had no duration, so this take is instrumental.",
    };
  }

  return {
    ok: true,
    vocal: {
      audioBase64: parsed.audio,
      contentType: parsed.contentType || "audio/wav",
      duration,
      playbackRate: fitPlaybackRate(duration, loopSeconds(song)),
      voiceId: script.voiceId,
      lines,
    },
  };
}
