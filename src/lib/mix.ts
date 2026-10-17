export type MixInput = {
  music: Float32Array[];
  musicRate: number;
  vocal: Float32Array[];
  vocalRate: number;
  playbackRate: number;
  vocalGain?: number;
  delaySeconds?: number;
  delayGain?: number;
};

export type MixedAudio = {
  channels: Float32Array[];
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  getChannelData: (channel: number) => Float32Array;
};

function softClip(value: number): number {
  if (value > 0.92 || value < -0.92) return Math.tanh(value);
  return value;
}

/** Mix a decoded vocal over rendered music, with a short slap delay for space. */
export function mixVocalOverMusic(input: MixInput): MixedAudio {
  const vocalGain = input.vocalGain ?? 0.92;
  const delaySeconds = input.delaySeconds ?? 0.085;
  const delayGain = input.delayGain ?? 0.2;
  const playbackRate = input.playbackRate > 0 ? input.playbackRate : 1;
  const musicRate = input.musicRate > 0 ? input.musicRate : 44100;
  const vocalRate = input.vocalRate > 0 ? input.vocalRate : musicRate;
  const music = input.music.length > 0 ? input.music : [new Float32Array()];
  const vocal = input.vocal.length > 0 ? input.vocal : [new Float32Array()];
  const step = (vocalRate / musicRate) * playbackRate;
  const vocalFrames = step > 0 ? Math.floor(vocal[0].length / step) : 0;
  const delayFrames = Math.max(0, Math.round(delaySeconds * musicRate));
  const length = Math.max(music[0]?.length ?? 0, vocalFrames + delayFrames, 1);
  const channels = [new Float32Array(length), new Float32Array(length)];

  for (let index = 0; index < (music[0]?.length ?? 0); index += 1) {
    channels[0][index] = music[0][index] ?? 0;
    channels[1][index] = music[Math.min(1, music.length - 1)][index] ?? 0;
  }

  for (let index = 0; index < vocalFrames; index += 1) {
    const position = index * step;
    const leftIndex = Math.floor(position);
    const fraction = position - leftIndex;
    for (let channel = 0; channel < 2; channel += 1) {
      const source = vocal[Math.min(channel, vocal.length - 1)];
      const first = source[leftIndex] ?? 0;
      const second = source[leftIndex + 1] ?? first;
      const sample = (first + (second - first) * fraction) * vocalGain;
      channels[channel][index] += sample;
      const delayed = index + delayFrames;
      if (delayGain > 0 && delayed < length && delayed !== index) {
        channels[channel][delayed] += sample * delayGain;
      }
    }
  }

  for (const channel of channels) {
    for (let index = 0; index < channel.length; index += 1) channel[index] = softClip(channel[index]);
  }

  return {
    channels,
    sampleRate: musicRate,
    length,
    numberOfChannels: 2,
    getChannelData(channel: number) {
      return channels[channel] ?? channels[0];
    },
  };
}
