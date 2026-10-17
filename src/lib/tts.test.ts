import { describe, expect, it, vi } from "vitest";
import { sampleSong } from "./sample-song";
import { alignVocalLines, buildVocalScript, fitPlaybackRate, synthesizeVocals } from "./tts";
import type { GenerateInput } from "./schema";

const base: GenerateInput = {
  mood: "excited",
  genre: "Hip-hop",
  energy: "high",
  tempo: 120,
  description: "A late train.",
  voice: "auto",
};

describe("vocal script", () => {
  it("uses a fast sung delivery for an excited or rap-like song", () => {
    const script = buildVocalScript(sampleSong, base);
    expect(script.voiceId).toBe("helix");
    expect(script.speed).toBeGreaterThan(1.2);
    expect(script.text.startsWith("<fast><singing>")).toBe(true);
    expect(script.text).toContain("Platform lights blink twice and fade");
    expect(script.text).not.toContain("[Verse]");
    expect(script.spans.length).toBe(sampleSong.lyrics.reduce((sum, section) => sum + section.lines.length, 0));
  });

  it("uses a soft slower delivery for a sad song unless a voice is chosen", () => {
    const script = buildVocalScript(sampleSong, { ...base, mood: "sad", energy: "low", genre: "Folk", voice: "sal" });
    expect(script.voiceId).toBe("sal");
    expect(script.speed).toBeLessThan(0.9);
    expect(script.text).toContain("<soft>");
    expect(script.text).toContain("[sigh]");
    expect(script.text).toContain("</singing></soft>");
  });

  it("strips brackets so lyric text cannot break speech tags", () => {
    const song = {
      ...sampleSong,
      lyrics: [{ section: "Verse", lines: ["Hello <loud> [pause] there"] }],
    };
    const script = buildVocalScript(song, { ...base, mood: "calm", energy: "low", genre: "Ambient" });
    expect(script.text).toContain("Hello loud pause there");
    expect(script.text).not.toContain("<loud>");
  });

  it("maps character timestamps onto lyric lines and falls back when they are missing", () => {
    const script = buildVocalScript(sampleSong, { ...base, mood: "happy", energy: "medium", genre: "Pop", voice: "eve" });
    const chars = [...script.text];
    const times = chars.map((_, index) => [index * 0.1, (index + 1) * 0.1]);
    const lines = alignVocalLines(script.text, script.spans, chars, times, chars.length * 0.1);
    expect(lines).toHaveLength(script.spans.length);
    expect(lines[0]?.start).toBeCloseTo(script.spans[0].start * 0.1, 5);
    expect(lines[0]?.line).toContain("Platform lights");
    expect(lines[1].start).toBeGreaterThan(lines[0].end - 0.001);

    const fallback = alignVocalLines(script.text, script.spans, undefined, undefined, 8);
    expect(fallback).toHaveLength(script.spans.length);
    expect(fallback[0]?.start).toBe(0);
    expect(fallback.at(-1)?.end).toBeCloseTo(8, 5);
  });

  it("only time-fits a vocal when the rate stays musical", () => {
    expect(fitPlaybackRate(10, 8)).toBe(1.25);
    expect(fitPlaybackRate(3, 8)).toBe(1);
    expect(fitPlaybackRate(0, 8)).toBe(1);
  });
});

describe("synthesizeVocals", () => {
  it("posts speech to the xAI TTS endpoint with the same key", async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://api.x.ai/v1/tts");
      expect(init.headers).toMatchObject({ Authorization: "Bearer xai-test-key" });
      const body = JSON.parse(String(init.body)) as {
        text: string;
        voice_id: string;
        language: string;
        with_timestamps: boolean;
        output_format: { codec: string };
      };
      expect(body.language).toBe("en");
      expect(body.with_timestamps).toBe(true);
      expect(body.output_format.codec).toBe("wav");
      expect(body.voice_id).toBe("ara");
      expect(JSON.stringify(body)).not.toContain("xai-test-key");
      const chars = [...body.text];
      return Response.json({
        audio: "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQAAAAA=",
        content_type: "audio/wav",
        duration: 4,
        audio_timestamps: {
          graph_chars: chars,
          graph_times: chars.map((_, index) => [index * 0.02, (index + 1) * 0.02]),
        },
      });
    });

    const result = await synthesizeVocals(
      sampleSong,
      { ...base, mood: "romantic", energy: "medium", genre: "R&B", voice: "auto" },
      { fetchImpl, apiKey: "xai-test-key" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.vocal.voiceId).toBe("ara");
    expect(result.vocal.lines.length).toBeGreaterThan(1);
    expect(result.vocal.playbackRate).toBeGreaterThan(0);
  });
});
