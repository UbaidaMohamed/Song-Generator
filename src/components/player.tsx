"use client";

import { useEffect, useRef, useState } from "react";
import { activeChordIndex, loopSeconds } from "@/lib/arrange";
import { loadTone, mountPerformance, renderSongWav, type Performance } from "@/lib/audio";
import type { Song } from "@/lib/schema";
import { songFilename } from "@/lib/wav";

type PlayerProps = {
  song: Song;
  mood: string;
  genre: string;
  source: "generated" | "sample";
};

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function Player({ song, mood, genre, source }: PlayerProps) {
  const toneRef = useRef<Awaited<ReturnType<typeof loadTone>> | null>(null);
  const performanceRef = useRef<Performance | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"paused" | "playing">("paused");
  const [position, setPosition] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadTone().then((Tone) => {
      if (!cancelled) {
        toneRef.current = Tone;
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      performanceRef.current?.stop();
      performanceRef.current = null;
    };
  }, [song]);

  useEffect(() => {
    if (status !== "playing") return;
    let frame = 0;
    const tick = () => {
      setPosition(performanceRef.current?.position() ?? 0);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status]);

  async function toggle() {
    const Tone = toneRef.current;
    if (!Tone) return;
    setError("");
    try {
      await Tone.start();
    } catch {
      setError("This browser blocked audio. Tap play again, or try another browser.");
      return;
    }
    if (!performanceRef.current) {
      performanceRef.current = mountPerformance(Tone, song);
    }
    if (status === "playing") {
      performanceRef.current.pause();
      setStatus("paused");
      return;
    }
    performanceRef.current.play();
    setStatus("playing");
  }

  async function download() {
    setRendering(true);
    setError("");
    performanceRef.current?.stop();
    performanceRef.current = null;
    setStatus("paused");
    try {
      const blob = await renderSongWav(song);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = songFilename(song.title);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't export a WAV from this browser. Playback still works.");
    } finally {
      setRendering(false);
    }
  }

  const loop = loopSeconds(song);
  const progress = loop > 0 ? Math.min(100, (position / loop) * 100) : 0;
  const active = activeChordIndex(song, position);
  const initials = song.title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <section className="panel stage" aria-live="polite">
      <div className="stage-head">
        <div className="cover" data-playing={status === "playing"} aria-hidden="true">
          <b>{initials}</b>
        </div>
        <div>
          <p className="kicker">{source === "sample" ? "Sample arrangement" : "Your song"}</p>
          <h2>{song.title}</h2>
          <p className="blurb">{song.blurb}</p>
          <div className="meta">
            <span>{song.keyLabel}</span>
            <span>{song.bpm} BPM</span>
            <span>{song.timeSignature}</span>
            <span>{mood}</span>
            {genre ? <span>{genre}</span> : null}
          </div>
        </div>
      </div>

      {error ? <p className="alert">{error}</p> : null}

      <div className="stage-tools">
        <button
          type="button"
          className="play"
          onClick={() => void toggle()}
          disabled={!ready}
          aria-pressed={status === "playing"}
          aria-label={status === "playing" ? "Pause" : "Play"}
        >
          {status === "playing" ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
              <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" />
            </svg>
          )}
        </button>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="time">
          {formatTime(position)} / {formatTime(loop)}
        </span>
        <button type="button" className="download" onClick={() => void download()} disabled={rendering}>
          {rendering ? "Rendering…" : "Download WAV"}
        </button>
      </div>

      <div className="chords" aria-label="Chord loop">
        {song.chords.map((chord, index) => (
          <div className="chord" data-active={index === active} key={`${chord.symbol}-${index}`}>
            <b>{chord.symbol}</b>
            <small>{chord.beats} beats</small>
          </div>
        ))}
      </div>

      <div className="lyrics">
        {song.lyrics.map((section, sectionIndex) => (
          <article className="verse" key={`${section.section}-${sectionIndex}`}>
            <h3>{section.section}</h3>
            {section.lines.map((line, lineIndex) => (
              <p key={`${sectionIndex}-${lineIndex}`}>{line}</p>
            ))}
          </article>
        ))}
      </div>
      <p className="source" style={{ display: "inline-block", marginTop: 16 }}>
        {source === "sample"
          ? "Built-in demo. It does not use the API."
          : "Lyrics and arrangement by Grok. Sound is synthesized in your browser."}
      </p>
    </section>
  );
}
