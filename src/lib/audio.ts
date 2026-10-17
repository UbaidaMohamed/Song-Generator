import { arrange, type ScoreEvent } from "./arrange";
import type { Song } from "./schema";
import { audioBufferToWav } from "./wav";

type ToneModule = typeof import("tone");

type Voices = {
  lead: { triggerAttackRelease: (note: string, duration: number, time: number, velocity: number) => void };
  pad: {
    triggerAttackRelease: (notes: string[], duration: number, time: number, velocity: number) => void;
  } | null;
  bass: { triggerAttackRelease: (note: string, duration: number, time: number, velocity: number) => void } | null;
  kick: { triggerAttackRelease: (note: string, duration: number, time: number, velocity: number) => void } | null;
  snareNoise: { triggerAttackRelease: (duration: number, time: number, velocity: number) => void } | null;
  snareBody: { triggerAttackRelease: (note: string, duration: number, time: number, velocity: number) => void } | null;
  hat: { triggerAttackRelease: (duration: number, time: number, velocity: number) => void } | null;
  dispose: () => void;
};

let toneModule: Promise<ToneModule> | null = null;

export function loadTone(): Promise<ToneModule> {
  toneModule ??= import("tone");
  return toneModule;
}

function trigger(voices: Voices, event: ScoreEvent, time: number) {
  switch (event.type) {
    case "lead":
      voices.lead.triggerAttackRelease(event.note, event.duration, time, event.velocity);
      break;
    case "pad":
      voices.pad?.triggerAttackRelease(event.notes, event.duration, time, event.velocity);
      break;
    case "bass":
      voices.bass?.triggerAttackRelease(event.note, event.duration, time, event.velocity);
      break;
    case "kick":
      voices.kick?.triggerAttackRelease(event.note, 0.18, time, event.velocity);
      break;
    case "snare":
      voices.snareNoise?.triggerAttackRelease(0.12, time, event.velocity);
      voices.snareBody?.triggerAttackRelease("A2", 0.07, time, event.velocity * 0.7);
      break;
    case "hat":
      voices.hat?.triggerAttackRelease(0.03, time, event.velocity);
      break;
    default:
      break;
  }
}

function createVoices(Tone: ToneModule, song: Song): Voices {
  const nodes: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(node: T) => {
    nodes.push(node);
    return node;
  };

  const limiter = track(new Tone.Limiter(-1.5).toDestination());
  const delay = track(new Tone.FeedbackDelay({ delayTime: 0.18, feedback: 0.2, wet: 0.14 }));
  delay.connect(limiter);

  const leadFilter = track(new Tone.Filter(song.palette.lead === "saw" ? 1600 : 4200, "lowpass"));
  leadFilter.connect(delay);

  const lead =
    song.palette.lead === "fm"
      ? track(
          new Tone.FMSynth({
            harmonicity: 1.5,
            modulationIndex: 6,
            envelope: { attack: 0.01, decay: 0.18, sustain: 0.25, release: 0.35 },
            modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 },
          }),
        )
      : track(
          new Tone.Synth({
            oscillator: {
              type:
                song.palette.lead === "saw"
                  ? "sawtooth"
                  : song.palette.lead === "pluck"
                    ? "square"
                    : song.palette.lead === "bell"
                      ? "triangle"
                      : "sine",
            },
            envelope:
              song.palette.lead === "pluck"
                ? { attack: 0.005, decay: 0.16, sustain: 0.04, release: 0.12 }
                : song.palette.lead === "bell"
                  ? { attack: 0.005, decay: 0.45, sustain: 0.08, release: 0.7 }
                  : song.palette.lead === "saw"
                    ? { attack: 0.02, decay: 0.12, sustain: 0.35, release: 0.22 }
                    : { attack: 0.02, decay: 0.1, sustain: 0.35, release: 0.28 },
          }),
        );
  lead.volume.value = song.palette.lead === "saw" || song.palette.lead === "pluck" ? -11 : -6;
  lead.connect(leadFilter);

  let pad: Voices["pad"] = null;
  if (song.palette.pad !== "none") {
    const synth = track(
      new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: song.palette.pad === "dark" ? "sawtooth" : "triangle" },
        envelope: {
          attack: song.palette.pad === "airy" ? 0.6 : 0.28,
          decay: 0.3,
          sustain: 0.65,
          release: song.palette.pad === "airy" ? 1.6 : 1.1,
        },
      }),
    );
    synth.volume.value = song.palette.pad === "dark" ? -20 : -16;
    synth.connect(delay);
    pad = synth;
  }

  let bass: Voices["bass"] = null;
  if (song.palette.bass !== "none") {
    const synth = track(
      new Tone.Synth({
        oscillator: { type: song.palette.bass === "sub" ? "sine" : "triangle" },
        envelope: { attack: 0.01, decay: 0.12, sustain: 0.7, release: 0.18 },
      }),
    );
    synth.volume.value = -8;
    synth.connect(limiter);
    bass = synth;
  }

  let kick: Voices["kick"] = null;
  let snareNoise: Voices["snareNoise"] = null;
  let snareBody: Voices["snareBody"] = null;
  let hat: Voices["hat"] = null;
  if (song.palette.drums !== "none") {
    const kickSynth = track(
      new Tone.MembraneSynth({
        pitchDecay: song.palette.drums === "boom" ? 0.08 : 0.05,
        octaves: song.palette.drums === "soft" ? 3 : 5,
        envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.08 },
      }),
    );
    kickSynth.volume.value = song.palette.drums === "soft" ? -8 : -3;
    kickSynth.connect(limiter);
    kick = kickSynth;

    const noise = track(
      new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
      }),
    );
    noise.volume.value = -12;
    noise.connect(limiter);
    snareNoise = noise;

    const body = track(
      new Tone.MembraneSynth({
        pitchDecay: 0.01,
        octaves: 2,
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
      }),
    );
    body.volume.value = -12;
    body.connect(limiter);
    snareBody = body;

    const hatFilter = track(new Tone.Filter(7000, "highpass"));
    hatFilter.connect(limiter);
    const hatSynth = track(
      new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: song.palette.drums === "soft" ? 0.03 : 0.045, sustain: 0 },
      }),
    );
    hatSynth.volume.value = -20;
    hatSynth.connect(hatFilter);
    hat = hatSynth;
  }

  return {
    lead,
    pad,
    bass,
    kick,
    snareNoise,
    snareBody,
    hat,
    dispose() {
      for (const node of nodes) node.dispose();
    },
  };
}

export type Performance = {
  loopSeconds: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  position: () => number;
};

export function mountPerformance(Tone: ToneModule, song: Song): Performance {
  const { events, loopSeconds } = arrange(song);
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel(0);
  const voices = createVoices(Tone, song);
  transport.bpm.value = song.bpm;
  transport.loop = true;
  transport.loopStart = 0;
  transport.loopEnd = loopSeconds;
  for (const event of events) {
    transport.schedule((time) => {
      trigger(voices, event, time);
    }, event.time);
  }

  return {
    loopSeconds,
    play() {
      transport.start();
    },
    pause() {
      transport.pause();
    },
    stop() {
      transport.pause();
      transport.stop();
      transport.cancel(0);
      transport.loop = false;
      voices.dispose();
    },
    position() {
      if (loopSeconds <= 0) return 0;
      const seconds = transport.seconds;
      return ((seconds % loopSeconds) + loopSeconds) % loopSeconds;
    },
  };
}

export async function renderSongWav(song: Song): Promise<Blob> {
  const Tone = await loadTone();
  const { events, loopSeconds } = arrange(song);
  const repeats = Math.max(2, Math.min(6, Math.round(28 / Math.max(loopSeconds, 1))));
  const duration = Math.min(48, loopSeconds * repeats + 1.5);
  const rendered = await Tone.Offline(() => {
    const voices = createVoices(Tone, song);
    for (let copy = 0; copy < repeats; copy += 1) {
      const offset = copy * loopSeconds;
      for (const event of events) trigger(voices, event, event.time + offset);
    }
  }, duration);
  const audio = rendered.get();
  if (!audio) throw new Error("Could not render audio.");
  return audioBufferToWav(audio);
}
