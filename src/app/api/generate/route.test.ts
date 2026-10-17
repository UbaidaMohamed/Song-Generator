import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { RATE_LIMIT_MAX, resetRateLimits } from "@/lib/rate-limit";
import { sampleSong } from "@/lib/sample-song";

const raw = {
  title: sampleSong.title,
  blurb: sampleSong.blurb,
  tonic: sampleSong.tonic,
  mode: sampleSong.mode,
  bpm: sampleSong.bpm,
  timeSignature: sampleSong.timeSignature,
  palette: sampleSong.palette,
  lyrics: sampleSong.lyrics,
  chords: sampleSong.chords,
  melody: sampleSong.melody,
  drums: sampleSong.drums,
};

const TINY_WAV =
  "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQAAAAA=";

function request(body: unknown, ip = "203.0.113.10") {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = {
  mood: "happy",
  genre: "Pop",
  energy: "high",
  tempo: 120,
  description: "Two friends missing the last train.",
};

type TtsBody = {
  text: string;
  voice_id: string;
  language: string;
  speed: number;
  with_timestamps: boolean;
  output_format: { codec: string; sample_rate: number };
};

let lastTts: TtsBody | null = null;

function mockApis(ttsStatus = 200) {
  lastTts = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const href = String(url);
      const headers = init.headers as { Authorization?: string };
      expect(headers.Authorization).toMatch(/^Bearer xai-/);
      expect(String(init.body)).not.toContain("xai-test-key");
      if (href.includes("/v1/tts")) {
        const body = JSON.parse(String(init.body)) as TtsBody;
        lastTts = body;
        if (ttsStatus !== 200) return new Response("nope", { status: ttsStatus });
        const chars = [...body.text];
        return Response.json({
          audio: TINY_WAV,
          content_type: "audio/wav",
          duration: chars.length * 0.05,
          audio_timestamps: {
            graph_chars: chars,
            graph_times: chars.map((_, index) => [index * 0.05, (index + 1) * 0.05]),
          },
        });
      }
      return Response.json({
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(raw) }] }],
      });
    }),
  );
}

beforeEach(() => {
  resetRateLimits();
  process.env.XAI_API_KEY = "xai-test-key";
  mockApis();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.XAI_API_KEY;
});

describe("POST /api/generate", () => {
  it("returns a song and a mocked xAI vocal", async () => {
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      song: { title: string; bpm: number; lyrics: unknown[] };
      vocal: { audioBase64: string; voiceId: string; lines: { line: string; start: number }[]; contentType: string };
    };
    expect(payload.song.title).toBe("Last Train Home");
    expect(payload.song.bpm).toBe(120);
    expect(payload.song.lyrics.length).toBeGreaterThan(0);
    expect(payload.vocal.audioBase64).toBe(TINY_WAV);
    expect(payload.vocal.contentType).toBe("audio/wav");
    expect(payload.vocal.voiceId).toBe("eve");
    expect(payload.vocal.lines[0]?.line).toContain("Platform lights");
    expect(payload.vocal.lines[0]?.start).toBeGreaterThanOrEqual(0);
    expect(lastTts?.language).toBe("en");
    expect(lastTts?.with_timestamps).toBe(true);
    expect(lastTts?.output_format.codec).toBe("wav");
    expect(lastTts?.text).toContain("Platform lights blink twice and fade");
    expect(lastTts?.text).toMatch(/<sing-song>|<singing>/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(payload)).not.toContain("xai-test-key");
  });

  it("sends the voice the visitor picked", async () => {
    const response = await POST(request({ ...validBody, mood: "sad", energy: "low", voice: "REX" }, "203.0.113.12"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { vocal: { voiceId: string } };
    expect(payload.vocal.voiceId).toBe("rex");
    expect(lastTts?.voice_id).toBe("rex");
    expect(lastTts?.text).toContain("<soft>");
    expect(lastTts?.speed).toBeLessThan(1);
  });

  it("rejects oversized descriptions, unknown voices, a missing key, and a key with the wrong prefix", async () => {
    const tooLong = await POST(request({ ...validBody, description: "a".repeat(401) }));
    expect(tooLong.status).toBe(400);

    const voice = await POST(request({ ...validBody, voice: "not-a-voice" }, "203.0.113.13"));
    expect(voice.status).toBe(400);

    delete process.env.XAI_API_KEY;
    const missing = await POST(request(validBody, "203.0.113.11"));
    expect(missing.status).toBe(500);
    const missingPayload = (await missing.json()) as { error: string };
    expect(missingPayload.error).toMatch(/XAI_API_KEY/);

    process.env.XAI_API_KEY = "sk-other-provider";
    const prefixed = await POST(request(validBody, "203.0.113.14"));
    expect(prefixed.status).toBe(500);
    const prefixPayload = (await prefixed.json()) as { error: string };
    expect(prefixPayload.error).toMatch(/xai-/);
  });

  it("rate limits an IP and reports an unreadable model response", async () => {
    for (let count = 0; count < RATE_LIMIT_MAX; count += 1) {
      const ok = await POST(request(validBody, "203.0.113.20"));
      expect(ok.status).toBe(200);
    }
    const limited = await POST(request(validBody, "203.0.113.20"));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ output_text: "hello" })));
    const broken = await POST(request(validBody, "203.0.113.21"));
    expect(broken.status).toBe(502);
    const payload = (await broken.json()) as { error: string };
    expect(payload.error).toMatch(/couldn't read/i);
  });

  it("keeps the song when the vocal fails, and fails the request when the key is rejected", async () => {
    mockApis(500);
    const soft = await POST(request(validBody, "203.0.113.30"));
    expect(soft.status).toBe(200);
    const softPayload = (await soft.json()) as { song: { title: string }; vocal: null; vocalError: string };
    expect(softPayload.song.title).toBe("Last Train Home");
    expect(softPayload.vocal).toBeNull();
    expect(softPayload.vocalError).toMatch(/instrumental/i);

    mockApis(401);
    const rejected = await POST(request(validBody, "203.0.113.31"));
    expect(rejected.status).toBe(502);
    const rejectedPayload = (await rejected.json()) as { error: string };
    expect(rejectedPayload.error).toMatch(/xai-/);
  });
});
