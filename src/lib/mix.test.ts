import { describe, expect, it } from "vitest";
import { mixVocalOverMusic } from "./mix";

describe("mixVocalOverMusic", () => {
  it("places the vocal on top of the music and keeps the vocal tail", () => {
    const mixed = mixVocalOverMusic({
      music: [new Float32Array([0.2, 0.2, 0, 0])],
      musicRate: 4,
      vocal: [new Float32Array([0.4, 0])],
      vocalRate: 2,
      playbackRate: 1,
      vocalGain: 1,
      delaySeconds: 0,
      delayGain: 0,
    });

    expect(mixed.length).toBeGreaterThanOrEqual(4);
    expect(mixed.channels[0][0]).toBeCloseTo(0.6, 5);
    expect(mixed.channels[1][0]).toBeCloseTo(0.6, 5);
    expect(mixed.channels[0][1]).toBeCloseTo(0.4, 5);
    expect(Math.abs(mixed.channels[0][0])).toBeLessThanOrEqual(1);
    expect(mixed.sampleRate).toBe(4);
  });

  it("adds a delayed copy when a slap is requested", () => {
    const mixed = mixVocalOverMusic({
      music: [new Float32Array([0, 0, 0, 0])],
      musicRate: 10,
      vocal: [new Float32Array([0.5])],
      vocalRate: 10,
      playbackRate: 1,
      vocalGain: 1,
      delaySeconds: 0.2,
      delayGain: 0.5,
    });
    expect(mixed.channels[0][0]).toBeCloseTo(0.5, 5);
    expect(mixed.channels[0][2]).toBeCloseTo(0.25, 5);
  });
});
