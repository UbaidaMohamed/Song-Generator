"use client";

import { useMemo, useState } from "react";
import { Player } from "@/components/player";
import { ENERGY, EXAMPLES, GENRES, MOODS, type EnergyId } from "@/lib/moods";
import { sampleSong } from "@/lib/sample-song";
import type { Song } from "@/lib/schema";
import type { Vocal } from "@/lib/tts";
import { VOICES } from "@/lib/voices";

const THEMES: Record<string, { accent: string; accent2: string }> = {
  sad: { accent: "#8fb4e6", accent2: "#d5e4f7" },
  happy: { accent: "#f0b429", accent2: "#ffe7a3" },
  excited: { accent: "#ff5d73", accent2: "#ffd0a8" },
  calm: { accent: "#7dcec4", accent2: "#d7f3ef" },
  angry: { accent: "#ff6b3d", accent2: "#ffc2a8" },
  romantic: { accent: "#f08ab4", accent2: "#ffd6e5" },
  nostalgic: { accent: "#e2a36b", accent2: "#f3d7b5" },
  dreamy: { accent: "#b9a0f0", accent2: "#e4daf8" },
  hopeful: { accent: "#f2a36b", accent2: "#ffe1c2" },
  melancholic: { accent: "#8e95c9", accent2: "#d5d8ee" },
};

function themeFor(mood: string) {
  const known = THEMES[mood.toLowerCase()];
  if (known) return known;
  const values = Object.values(THEMES);
  const index = [...mood].reduce((sum, char) => sum + char.charCodeAt(0), 0) % values.length;
  return values[index] ?? THEMES.nostalgic;
}

type Result = {
  song: Song;
  mood: string;
  genre: string;
  source: "generated" | "sample";
  vocal: Vocal | null;
  notice: string;
};

export function Studio() {
  const [moodId, setMoodId] = useState("nostalgic");
  const [customMood, setCustomMood] = useState("");
  const [genreId, setGenreId] = useState("Lo-fi");
  const [customGenre, setCustomGenre] = useState("");
  const [energy, setEnergy] = useState<EnergyId>("low");
  const [autoTempo, setAutoTempo] = useState(true);
  const [tempo, setTempo] = useState(92);
  const [voice, setVoice] = useState("auto");
  const [description, setDescription] = useState(EXAMPLES[0].description);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<(Result & { id: number }) | null>(null);
  const [resultId, setResultId] = useState(0);

  const mood = moodId === "custom" ? customMood.trim() : moodId;
  const genre = genreId === "custom" ? customGenre.trim() : genreId === "surprise" ? "" : genreId;
  const theme = useMemo(() => themeFor(mood || "nostalgic"), [mood]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (mood.length < 2) {
      setError("Pick a mood, or type your own.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood,
          genre,
          energy,
          tempo: autoTempo ? null : tempo,
          description: description.trim(),
          voice,
        }),
      });
      const payload = (await response.json()) as {
        song?: Song;
        vocal?: Vocal | null;
        vocalError?: string;
        error?: string;
      };
      if (!response.ok || !payload.song) {
        setError(payload.error || "The song didn't come through. Try again.");
        return;
      }
      const id = resultId + 1;
      setResultId(id);
      setResult({
        id,
        song: payload.song,
        mood: labelFor(mood),
        genre,
        source: "generated",
        vocal: payload.vocal ?? null,
        notice: payload.vocalError ?? "",
      });
    } catch {
      setError("Couldn't reach the studio. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function playSample() {
    setError("");
    const id = resultId + 1;
    setResultId(id);
    setResult({
      id,
      song: sampleSong,
      mood: "Happy",
      genre: "Pop",
      source: "sample",
      vocal: null,
      notice: "",
    });
  }

  return (
    <main
      className="shell"
      style={{ ["--accent" as string]: theme.accent, ["--accent-2" as string]: theme.accent2 }}
    >
      <header className="top">
        <div>
          <div className="brand">
            <div className="mark" aria-hidden="true">
              <svg viewBox="0 0 32 32">
                <circle cx="11" cy="22" r="4.2" fill="#1a120c" />
                <path d="M15 22V7.5l12-2.4v6.4L15 14.2" fill="#1a120c" />
              </svg>
            </div>
            <h1>Song Generator</h1>
          </div>
          <p className="lede">
            Pick a mood, a voice, and a scene. You get original lyrics, a vocal, and a band you can play.
          </p>
        </div>
        <p className="note">Played in the browser. Nothing is uploaded with the audio.</p>
      </header>

      <div className="layout">
        <form className="panel" onSubmit={(event) => void onSubmit(event)}>
          <h2>Write from a feeling</h2>
          <p className="hint">The arrangement follows the mood. A short description gives the lyrics something specific to hold.</p>

          <fieldset>
            <legend>Mood</legend>
            <div className="moods">
              {MOODS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="mood"
                  aria-pressed={moodId === item.id}
                  onClick={() => setMoodId(item.id)}
                >
                  <strong>{item.label}</strong>
                  <span>{item.line}</span>
                </button>
              ))}
              <button
                type="button"
                className="mood"
                aria-pressed={moodId === "custom"}
                onClick={() => setMoodId("custom")}
              >
                <strong>Other</strong>
                <span>Type a mood of your own</span>
              </button>
            </div>
          </fieldset>

          {moodId === "custom" ? (
            <label className="field">
              <span>Your mood</span>
              <input
                type="text"
                maxLength={40}
                value={customMood}
                placeholder="Hopeful, wistful, restless…"
                onChange={(event) => setCustomMood(event.target.value)}
              />
            </label>
          ) : null}

          <fieldset>
            <legend>Style</legend>
            <div className="chips">
              <button type="button" className="chip" aria-pressed={genreId === "surprise"} onClick={() => setGenreId("surprise")}>
                Surprise me
              </button>
              {GENRES.map((item) => (
                <button key={item} type="button" className="chip" aria-pressed={genreId === item} onClick={() => setGenreId(item)}>
                  {item}
                </button>
              ))}
              <button type="button" className="chip" aria-pressed={genreId === "custom"} onClick={() => setGenreId("custom")}>
                Other
              </button>
            </div>
          </fieldset>

          {genreId === "custom" ? (
            <label className="field">
              <span>Your style</span>
              <input
                type="text"
                maxLength={40}
                value={customGenre}
                placeholder="Bossa nova, gospel, synthwave…"
                onChange={(event) => setCustomGenre(event.target.value)}
              />
            </label>
          ) : null}

          <fieldset>
            <legend>Energy</legend>
            <div className="energies">
              {ENERGY.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="energy"
                  aria-pressed={energy === item.id}
                  onClick={() => setEnergy(item.id)}
                >
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <div className="tempo-head">
              <span>Tempo</span>
              <label className="counter">
                <input type="checkbox" checked={autoTempo} onChange={(event) => setAutoTempo(event.target.checked)} /> Let the mood decide
              </label>
            </div>
            <input
              type="range"
              min={60}
              max={180}
              step={1}
              value={tempo}
              disabled={autoTempo}
              aria-label="Tempo in beats per minute"
              onChange={(event) => setTempo(Number(event.target.value))}
            />
            <div className="counter-row">
              <span className="bpm">{autoTempo ? "Automatic" : `${tempo} BPM`}</span>
              <span className="bpm">60–180</span>
            </div>
          </div>

          <label className="field">
            <span>Voice</span>
            <select aria-label="Voice" value={voice} onChange={(event) => setVoice(event.target.value)}>
              <option value="auto">Match the mood</option>
              {VOICES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} — {item.note}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>What should it be about?</span>
            <textarea
              maxLength={400}
              value={description}
              placeholder="A late train, city lights, and the friend you meant to call."
              onChange={(event) => setDescription(event.target.value)}
            />
            <span className="counter">{description.trim().length}/400</span>
          </label>

          <div className="examples">
              {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                className="ghost"
                onClick={() => {
                  setMoodId(example.mood);
                  setGenreId(example.genre);
                  setEnergy(example.energy);
                  setDescription(example.description);
                  setAutoTempo(true);
                }}
              >
                {example.label}
              </button>
            ))}
          </div>

          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}

          <div className="actions">
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "Writing and singing…" : "Generate song"}
            </button>
            <button className="ghost" type="button" onClick={playSample}>
              Play a sample
            </button>
          </div>
        </form>

        {result ? (
          <Player
            key={result.id}
            song={result.song}
            mood={result.mood}
            genre={result.genre}
            source={result.source}
            vocal={result.vocal}
            notice={result.notice}
          />
        ) : (
          <section className="panel empty">
            <p className="kicker">Listening room</p>
            <h2>Your song will land here.</h2>
            <p className="hint">
              Generate one from the form, or play the built-in sample to hear the band. The sample never calls the API and has no vocal.
            </p>
          </section>
        )}
      </div>
      <p className="footer">
        Grok writes the song. xAI speaks the vocal, on the same server key. Five songs per half hour from each network.
      </p>
    </main>
  );
}

function labelFor(mood: string) {
  const known = MOODS.find((item) => item.id === mood);
  if (known) return known.label;
  return mood.slice(0, 1).toUpperCase() + mood.slice(1);
}
