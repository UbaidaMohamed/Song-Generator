"use client";

import { useEffect, useRef, useState } from "react";
import { activeChordIndex, loopSeconds } from "@/lib/arrange";
import {
  decodeAudioBytes,
  loadTone,
  mountPerformance,
  renderSongWav,
  type Performance,
  type VocalBuffer,
} from "@/lib/audio";
import type { Song } from "@/lib/schema";
import { performedSpan, type Vocal } from "@/lib/tts";
import { voiceLabel } from "@/lib/voices";
import { decodeBase64, songFilename } from "@/lib/wav";

type PlayerProps = {
  song: Song;
  mood: string;
  genre: string;
  source: "generated" | "sample";
  vocal?: Vocal | null;
  notice?: string;
};

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function Player({ song, mood, genre, source, vocal = null, notice = "" }: PlayerProps) {
  const toneRef = useRef<Awaited<ReturnType<typeof loadTone>> | null>(null);
  const performanceRef = useRef<Performance | null>(null);
  const vocalBufferRef = useRef<VocalBuffer | null>(null);
  const endedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [vocalState, setVocalState] = useState<"pending" | "ready" | "failed">(vocal ? "pending" : "ready");
  const [status, setStatus] = useState<"paused" | "playing">("paused");
  const [position, setPosition] = useState(0);
  const [activeLine, setActiveLine] = useState(-1);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");

  const rate = vocal && vocal.playbackRate > 0 ? vocal.playbackRate : 1;
  const loop = loopSeconds(song);
  const span = vocal ? Math.max(loop, performedSpan(vocal)) : loop;

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
    if (!vocal) return;
    let cancelled = false;
    void (async () => {
      try {
        const Tone = await loadTone();
        const buffer = await decodeAudioBytes(Tone, decodeBase64(vocal.audioBase64));
        if (cancelled) return;
        vocalBufferRef.current = { buffer, playbackRate: vocal.playbackRate > 0 ? vocal.playbackRate : 1 };
        setVocalState("ready");
      } catch {
        if (cancelled) return;
        vocalBufferRef.current = null;
        setVocalState("failed");
        setError("The vocal couldn't be decoded in this browser. The instrumental still plays.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vocal]);

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
      const next = performanceRef.current?.position() ?? 0;
      if (vocal && next >= span - 0.05) {
        performanceRef.current?.pause();
        endedRef.current = true;
        setStatus("paused");
        setPosition(span);
        setActiveLine(-1);
        return;
      }
      setPosition(next);
      if (vocal) {
        const index = vocal.lines.findIndex((line) => next >= line.start / rate && next < line.end / rate);
        setActiveLine(index);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rate, span, status, vocal]);

  useEffect(() => {
    if (activeLine < 0) return;
    document.querySelector('.verse p[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeLine]);

  async function toggle() {
    const Tone = toneRef.current;
    if (!Tone) return;
    setError(vocalState === "failed" ? "The vocal couldn't be decoded in this browser. The instrumental still plays." : "");
    try {
      await Tone.start();
    } catch {
      setError("This browser blocked audio. Tap play again, or try another browser.");
      return;
    }
    if (endedRef.current) {
      performanceRef.current?.stop();
      performanceRef.current = null;
      endedRef.current = false;
      setPosition(0);
      setActiveLine(-1);
    }
    if (!performanceRef.current) {
      performanceRef.current = mountPerformance(Tone, song, vocalBufferRef.current);
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
    endedRef.current = false;
    setStatus("paused");
    try {
      const blob = await renderSongWav(song, vocalBufferRef.current);
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

  const progress = span > 0 ? Math.min(100, (position / span) * 100) : 0;
  const active = activeChordIndex(song, position);
  const initials = song.title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  const canPlay = ready && vocalState !== "pending";

  return (
    <section className="panel stage" aria-live="polite">
      <div className="stage-head">
        <div className="cover" data-playing={status === "playing"} aria-hidden="true">
          <b>{initials}</b>
        </div>
        <div>
          <p className="kicker">{source === "sample" ? "Sample arrangement" : vocal ? "Your song" : "Instrumental take"}</p>
          <h2>{song.title}</h2>
          <p className="blurb">{song.blurb}</p>
          <div className="meta">
            <span>{song.keyLabel}</span>
            <span>{song.bpm} BPM</span>
            <span>{song.timeSignature}</span>
            <span>{mood}</span>
            {genre ? <span>{genre}</span> : null}
            {vocal ? <span>{voiceLabel(vocal.voiceId)}</span> : null}
          </div>
        </div>
      </div>

      {notice ? <p className="alert">{notice}</p> : null}
      {error ? <p className="alert">{error}</p> : null}

      <div className="stage-tools">
        <button
          type="button"
          className="play"
          onClick={() => void toggle()}
          disabled={!canPlay}
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
          {formatTime(position)} / {formatTime(span)}
        </span>
        <button type="button" className="download" onClick={() => void download()} disabled={rendering || vocalState === "pending"}>
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
        {song.lyrics.map((section, sectionIndex) => {
          const start = song.lyrics
            .slice(0, sectionIndex)
            .reduce((sum, item) => sum + item.lines.length, 0);
          return (
            <article className="verse" key={`${section.section}-${sectionIndex}`}>
              <h3>{section.section}</h3>
              {section.lines.map((line, lineIndex) => {
                const timing = vocal?.lines[start + lineIndex];
                const highlighted = Boolean(
                  timing && position >= timing.start / rate && position < timing.end / rate,
                );
                return (
                  <p key={`${sectionIndex}-${lineIndex}`} data-active={highlighted ? "true" : "false"}>
                    {line}
                  </p>
                );
              })}
            </article>
          );
        })}
      </div>
      <p className="source" style={{ display: "inline-block", marginTop: 16 }}>
        {source === "sample"
          ? "Built-in demo. It does not use the API."
          : vocal
            ? "Lyrics and arrangement by Grok. Voice by xAI. The band is synthesized in your browser."
            : "Lyrics and arrangement by Grok. This take is instrumental."}
      </p>
    </section>
  );
}
