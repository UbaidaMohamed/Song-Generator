import { afterEach, describe, expect, it, vi } from "vitest";
import { extractJson, generateSong, readModelText } from "./grok";
import { sampleSong } from "./sample-song";
import type { GenerateInput } from "./schema";

const input: GenerateInput = {
  mood: "nostalgic",
  genre: "Lo-fi",
  energy: "low",
  tempo: 76,
  description: "A kitchen radio at dusk.",
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.XAI_MODEL;
  delete process.env.XAI_REASONING_EFFORT;
});

describe("model text", () => {
  it("reads Responses API output and fenced JSON", () => {
    expect(
      readModelText({
        output: [{ type: "message", content: [{ type: "output_text", text: "{\"title\":\"Ok\"}" }] }],
      }),
    ).toContain("Ok");
    expect(extractJson("Sure:\n```json\n{\"title\":\"Ok\"}\n```")).toEqual({ title: "Ok" });
  });
});

describe("generateSong", () => {
  it("posts a structured request and returns a normalized song", async () => {
    const raw = {
      title: sampleSong.title,
      blurb: sampleSong.blurb,
      tonic: sampleSong.tonic,
      mode: sampleSong.mode,
      bpm: 90,
      timeSignature: sampleSong.timeSignature,
      palette: sampleSong.palette,
      lyrics: sampleSong.lyrics,
      chords: sampleSong.chords,
      melody: sampleSong.melody,
      drums: sampleSong.drums,
    };
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://api.x.ai/v1/responses");
      expect(init.headers).toMatchObject({ Authorization: "Bearer test-key" });
      const body = JSON.parse(String(init.body)) as {
        model: string;
        reasoning: { effort: string };
        store: boolean;
        text: { format: { type: string; name: string } };
        input: Array<{ content: string }>;
      };
      expect(body.model).toBe("grok-4.7");
      expect(body.reasoning.effort).toBe("low");
      expect(body.store).toBe(false);
      expect(body.text.format).toEqual({ type: "json_schema", name: "song", strict: true, schema: expect.any(Object) });
      expect(JSON.stringify(body)).not.toContain("test-key");
      expect(body.input[1]?.content).toContain("Use exactly 76 BPM");
      return Response.json({
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(raw) }] }],
      });
    });

    const song = await generateSong(input, { fetchImpl, apiKey: "test-key" });
    expect(song.title).toBe("Last Train Home");
    expect(song.bpm).toBe(76);
    expect(song.lyrics[0]?.lines.length).toBeGreaterThan(0);
  });

  it("fails clearly when the key is missing or the JSON is nonsense", async () => {
    await expect(generateSong(input, { apiKey: "" })).rejects.toThrow(/XAI_API_KEY/);

    const fetchImpl = vi.fn(async () => Response.json({ output_text: "not json" }));
    await expect(generateSong(input, { fetchImpl, apiKey: "test-key" })).rejects.toThrow(/couldn't read/i);

    const rejected = vi.fn(async () => new Response("nope", { status: 401 }));
    await expect(generateSong(input, { fetchImpl: rejected, apiKey: "test-key" })).rejects.toThrow(/rejected/i);
  });
});
