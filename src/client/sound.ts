import type { WeaponId } from "../shared/game";
import type { WeaponEvent, EffectKind } from "../shared/weapon-timeline";
import { weaponPresentation, type WeaponFamily } from "./weapon-presentation";
export interface SoundCue {
  wave: OscillatorType;
  frequency: number;
  endFrequency: number;
  duration: number;
  noise: number;
  filter: BiquadFilterType;
  cutoff: number;
  endCutoff: number;
  pulses: number;
}
type SoundKind = "fire" | "impact" | "hit" | "click";
const cue = (
  wave: OscillatorType,
  frequency: number,
  endFrequency: number,
  duration: number,
  noise: number,
  cutoff: number,
  pulses = 1,
  filter: BiquadFilterType = "lowpass",
): SoundCue => ({
  wave,
  frequency,
  endFrequency,
  duration,
  noise,
  cutoff,
  endCutoff: Math.max(100, cutoff * 0.15),
  pulses,
  filter,
});
const signatures: Record<WeaponFamily, SoundCue> = {
  shell: cue("triangle", 140, 30, 0.32, 0.13, 1800),
  heavy: cue("sine", 85, 24, 0.85, 0.19, 1100),
  burst: cue("triangle", 220, 45, 0.28, 0.1, 3400, 3),
  bounce: cue("sine", 440, 110, 0.38, 0.035, 2100, 2),
  drill: cue("sawtooth", 95, 55, 0.65, 0.12, 1600, 7, "bandpass"),
  beam: cue("sawtooth", 1100, 130, 0.3, 0.025, 3000, 1, "bandpass"),
  electric: cue("sawtooth", 720, 90, 0.42, 0.09, 4600, 6, "highpass"),
  liquid: cue("sine", 300, 65, 0.6, 0.13, 1400, 4, "bandpass"),
  fire: cue("triangle", 120, 38, 0.9, 0.16, 2400, 5),
  portal: cue("sine", 180, 1500, 0.55, 0.025, 2400, 2, "bandpass"),
  metal: cue("square", 580, 210, 0.22, 0.07, 3900, 2, "highpass"),
  earth: cue("triangle", 65, 25, 0.8, 0.14, 700, 5),
  rope: cue("triangle", 260, 75, 0.4, 0.045, 1700, 3, "bandpass"),
};
export function soundCue(
  kind: SoundKind,
  weapon: WeaponId = "shell",
): SoundCue {
  if (kind === "click") return cue("triangle", 650, 300, 0.06, 0, 1000);
  if (kind === "hit")
    return cue("square", 800, 180, 0.14, 0.035, 1800, 1, "bandpass");
  const presentation = weaponPresentation(weapon),
    signature = signatures[presentation.family];
  const pitch = Math.max(0.7, Math.min(1.3, 1.15 - presentation.radius / 250));
  return {
    ...signature,
    frequency: signature.frequency * pitch * (kind === "fire" ? 1.3 : 1),
    endFrequency: signature.endFrequency * pitch,
    duration: signature.duration * (kind === "fire" ? 0.6 : 1),
    noise: signature.noise * (kind === "fire" ? 0.7 : 1),
  };
}
const effectFamilies: Record<EffectKind, WeaponFamily> = {
  beam: "beam",
  electric: "electric",
  rope: "rope",
  drill: "drill",
  wave: "liquid",
  fire: "fire",
  coin: "metal",
  robot: "metal",
  tiles: "earth",
  portal: "portal",
  counterfire: "burst",
  spark: "electric",
  ice: "metal",
  steel: "metal",
  duck: "bounce",
};
export function effectSoundCue(
  event: WeaponEvent,
  weapon: WeaponId,
  elapsed: number,
  stepMs = 25,
): SoundCue | null {
  if (
    event.type !== "effect" ||
    elapsed < event.time ||
    elapsed >= event.time + event.duration
  )
    return null;
  const family =
    event.kind === "wave"
      ? weaponPresentation(weapon).family
      : effectFamilies[event.kind];
  const signature = signatures[family];
  return {
    ...signature,
    duration: Math.min(
      signature.duration,
      Math.max(
        0.001,
        ((event.time + event.duration - elapsed) * stepMs) / 1000,
      ),
    ),
    noise: signature.noise * 0.65,
  };
}
let context: AudioContext | null = null;
let noise: AudioBuffer | null = null;
const voices = new Set<() => void>();
const MAX_VOICES = 16;
export function stopAudio() {
  for (const stop of [...voices]) stop();
}
export function unlockAudio() {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch {
    /* Gameplay works without an audio device. */
  }
}
export function playSoundCue(signature: SoundCue, enabled: boolean) {
  if (!enabled) return;
  unlockAudio();
  if (!context || context.state !== "running") return;
  const nodes: AudioNode[] = [],
    sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const cleanup = () => {
    for (const source of sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* Already stopped. */
      }
    }
    for (const node of nodes) node.disconnect();
    voices.delete(cleanup);
  };
  try {
    if (voices.size >= MAX_VOICES) voices.values().next().value?.();
    voices.add(cleanup);
    const ctx = context,
      now = ctx.currentTime,
      end = now + signature.duration;
    const oscillator = ctx.createOscillator(),
      tone = ctx.createGain();
    nodes.push(oscillator, tone);
    sources.push(oscillator);
    oscillator.type = signature.wave;
    oscillator.frequency.setValueAtTime(signature.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      signature.endFrequency,
      end,
    );
    oscillator.connect(tone);
    tone.connect(ctx.destination);
    const envelope = (gain: AudioParam, peak: number) => {
      gain.setValueAtTime(0.001, now);
      const step = signature.duration / signature.pulses;
      for (let i = 0; i < signature.pulses; i++) {
        const start = now + i * step;
        gain.linearRampToValueAtTime(
          peak * (1 - i / (signature.pulses + 1)),
          start + Math.min(0.005, step * 0.1),
        );
        gain.exponentialRampToValueAtTime(0.001, start + step);
      }
    };
    envelope(tone.gain, 0.035);
    oscillator.onended = cleanup;
    if (signature.noise > 0) {
      if (!noise) {
        noise = ctx.createBuffer(
          1,
          Math.ceil(ctx.sampleRate * 1.2),
          ctx.sampleRate,
        );
        const samples = noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++)
          samples[i] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter(),
        gain = ctx.createGain();
      nodes.push(source, filter, gain);
      sources.push(source);
      source.buffer = noise;
      filter.type = signature.filter;
      filter.frequency.setValueAtTime(signature.cutoff, now);
      filter.frequency.exponentialRampToValueAtTime(signature.endCutoff, end);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      envelope(gain.gain, signature.noise);
      source.start(now);
      source.stop(end);
    }
    oscillator.start(now);
    oscillator.stop(end);
  } catch {
    cleanup();
  }
}
export function sound(
  kind: SoundKind,
  enabled: boolean,
  weapon: WeaponId = "shell",
) {
  if (enabled) playSoundCue(soundCue(kind, weapon), enabled);
}
