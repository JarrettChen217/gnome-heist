// AI-use disclosure: Codex synthesized short, offline game cues under Hao's direction.
import * as Phaser from 'phaser';
import type { ActionKind } from '@gnome-heist/core';

export function playFeedback(sound: Phaser.Sound.BaseSoundManager, action: ActionKind | 'bush' | 'bank'): void {
  if (!(sound instanceof Phaser.Sound.WebAudioSoundManager) || sound.context.state !== 'running' || !sound.volume) return;
  const ctx = sound.context;
  const now = ctx.currentTime;
  function tone(start: number, end: number, duration: number, wave: OscillatorType, delay = 0): void {
    const t = now + delay;
    const source = ctx.createOscillator();
    const envelope = ctx.createGain();
    source.type = wave;
    source.frequency.setValueAtTime(start, t);
    source.frequency.exponentialRampToValueAtTime(end, t + duration);
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(0.12, t + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(envelope).connect(soundDestination);
    source.start(t);
    source.stop(t + duration);
    source.onended = () => { source.disconnect(); envelope.disconnect(); };
  }
  const soundDestination = sound.destination;
  switch (action) {
    case 'bush': {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.14), ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        const fade = Math.sin(Math.PI * i / samples.length);
        samples[i] = (Math.random() * 2 - 1) * 0.05 * fade * fade;
      }
      const leaves = ctx.createBufferSource();
      leaves.buffer = buffer;
      leaves.connect(soundDestination);
      leaves.onended = () => leaves.disconnect();
      leaves.start();
      break;
    }
    case 'bank':
      tone(392, 440, 0.14, 'sine');
      tone(587, 660, 0.22, 'sine', 0.09);
      break;
    case 'pickLock':
    case 'relock':
      tone(1450, 820, 0.055, 'triangle');
      tone(1960, 1380, 0.09, 'sine', 0.025);
      break;
    case 'kickFence':
      tone(138, 44, 0.15, 'sawtooth');
      break;
    case 'dig':
      tone(300, 510, 0.13, 'triangle');
      break;
    case 'openGate':
    case 'closeGate':
      tone(235, 86, 0.115, 'triangle');
      break;
    case 'endNight':
      tone(247, 196, 0.12, 'sine');
      break;
  }
}
