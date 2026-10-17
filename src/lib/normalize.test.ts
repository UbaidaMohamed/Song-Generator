import { describe, expect, it } from "vitest";
import { arrange, totalBeats } from "./arrange";
import { normalizeSong } from "./normalize";
import { sampleSong } from "./sample-song";
import type { RawSong } from "./schema";
import { audioBufferToWav } from "./wav";

const raw: RawSong = {
  title: "  Window Rain  ",
  blurb: "A quiet song.",
  tonic: "A",
  mode: "minor",
  bpm: 40,
  timeSignature: "4/4",
  palette: { lead: "bell", pad: "airy", bass: "sub", drums: "soft" },
  lyrics: [{ section: "Verse", lines: ["Rain writes on the glass", "I leave the light on"] }],
  chords: [
    { symbol: "Nope", beats: 4 },
    { symbol: "??", beats: 4 },
  ],
  melody: [
    { pitch: "not-a-note", beats: 1 },
    { pitch: "C2", beats: 9 },
  ],
  drums: [{ kick: false, snare: false, hat: false }],
};

describe("normalizeSong", () => {
  it("repairs a sloppy model payload into a playable loop", () => {
    const song = normalizeSong(raw, { energy: "low", tempo: null });
    expect(song.title).toBe("Window Rain");
    expect(song.bpm).toBeGreaterThanOrEqual(66);
    expect(song.bpm).toBeLessThanOrEqual(94);
    expect(song.chords.length).toBeGreaterThanOrEqual(4);
    expect(song.melody.reduce((sum, note) => sum + note.beats, 0)).toBe(totalBeats(song));
    expect(song.drums).toHaveLength(16);
    expect(song.drums.some((step) => step.kick || step.hat || step.snare)).toBe(true);
    expect(song.melody.every((note) => note.pitch === "rest" || /^[A-G]#?\d$/.test(note.pitch))).toBe(true);
  });

  it("uses the visitor's tempo when they set one", () => {
    const song = normalizeSong(raw, { energy: "low", tempo: 72 });
    expect(song.bpm).toBe(72);
  });

  it("rejects a song without lyrics or a title", () => {
    expect(() => normalizeSong({ ...raw, lyrics: [{ section: "Verse", lines: ["  "] }] }, { energy: "low" })).toThrow(
      /lyrics/i,
    );
    expect(() => normalizeSong({ ...raw, title: " " }, { energy: "medium" })).toThrow(/title/i);
  });

  it("arranges the sample inside one loop", () => {
    const score = arrange(sampleSong);
    expect(score.totalBeats).toBe(16);
    expect(score.loopSeconds).toBeCloseTo((16 * 60) / 118, 5);
    const lead = score.events.filter((event) => event.type === "lead");
    expect(lead.length).toBe(sampleSong.melody.length);
    for (const event of score.events) {
      expect(event.time).toBeGreaterThanOrEqual(0);
      expect(event.time).toBeLessThan(score.loopSeconds);
    }
  });
});

describe("wav", () => {
  it("writes a 16-bit stereo header", () => {
    const samples = new Float32Array([0, 0.5, -1]);
    const blob = audioBufferToWav({
      numberOfChannels: 1,
      sampleRate: 22050,
      length: samples.length,
      getChannelData: () => samples,
    });
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + samples.length * 2);
  });
});
