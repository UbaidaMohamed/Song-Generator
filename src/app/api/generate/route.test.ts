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

beforeEach(() => {
  resetRateLimits();
  process.env.XAI_API_KEY = "test-key";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(raw) }] }],
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.XAI_API_KEY;
});

describe("POST /api/generate", () => {
  it("returns a song from a mocked Grok response", async () => {
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { song: { title: string; bpm: number; lyrics: unknown[] } };
    expect(payload.song.title).toBe("Last Train Home");
    expect(payload.song.bpm).toBe(120);
    expect(payload.song.lyrics.length).toBeGreaterThan(0);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects oversized descriptions and missing configuration", async () => {
    const tooLong = await POST(request({ ...validBody, description: "a".repeat(401) }));
    expect(tooLong.status).toBe(400);

    delete process.env.XAI_API_KEY;
    const missing = await POST(request(validBody, "203.0.113.11"));
    expect(missing.status).toBe(500);
    const payload = (await missing.json()) as { error: string };
    expect(payload.error).toMatch(/XAI_API_KEY/);
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
});
