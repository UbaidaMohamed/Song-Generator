import { describe, expect, it } from "vitest";
import { chordPitches, clampMelodyPitch, diatonicLoop, parsePitch } from "./chords";

describe("chords", () => {
  it("parses scientific pitch and flats", () => {
    expect(parsePitch("C4")?.midi).toBe(60);
    expect(parsePitch("Bb4")?.name).toBe("A#");
    expect(parsePitch("rest")).toBeNull();
  });

  it("builds playable voicings", () => {
    expect(chordPitches("C")).toEqual(["C3", "E3", "G3"]);
    expect(chordPitches("Am")).toEqual(["A3", "C4", "E4"]);
    expect(chordPitches("F#m")).toEqual(["F#3", "A3", "C#4"]);
    expect(chordPitches("G7")).toEqual(["G3", "B3", "D4", "F4"]);
    expect(chordPitches("Cmaj7")).toEqual(["C3", "E3", "G3", "B3"]);
    expect(chordPitches("Asus4")).toEqual(["A3", "D4", "E4"]);
    expect(chordPitches("not a chord")).toBeNull();
  });

  it("keeps melody notes in a singable octave", () => {
    expect(clampMelodyPitch("C2")).toBe("C4");
    expect(clampMelodyPitch("C7")).toBe("C6");
    expect(clampMelodyPitch("rest")).toBe("rest");
    expect(clampMelodyPitch("hello")).toBeNull();
  });

  it("writes a diatonic loop in the requested key", () => {
    expect(diatonicLoop("C", "major").map((chord) => chord.symbol)).toEqual(["C", "G", "Am", "F"]);
    expect(diatonicLoop("A", "minor").map((chord) => chord.symbol)).toEqual(["Am", "F", "C", "G"]);
  });
});
