"use client";

import { useEffect, useRef, useCallback } from "react";

type SoundType = "white" | "pink" | "brown" | "rain" | null;

interface SoundPlayerProps {
  soundType: SoundType;
  volume: number;
  timerMinutes: number;
  onTimerEnd: () => void;
}

function createNoiseBuffer(ctx: AudioContext, type: "white" | "pink" | "brown"): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === "white") {
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else if (type === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else {
    // Brown noise
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function createRainSound(ctx: AudioContext): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    // Add occasional "drops" (random spikes)
    const drop = Math.random() > 0.998 ? (Math.random() * 0.3) : 0;
    data[i] = lastOut * 2.5 + drop;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

export function SoundPlayer({ soundType, volume, timerMinutes, onTimerEnd }: SoundPlayerProps) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopSound = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* ignore */ }
      sourceRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!soundType) {
      stopSound();
      return;
    }

    if (!ctxRef.current) {
      try {
        ctxRef.current = new AudioContext();
      } catch {
        // iOS PWA may block AudioContext without user gesture
        return;
      }
    }
    const ctx = ctxRef.current;

    stopSound();

    const gainNode = ctx.createGain();
    gainNode.gain.value = volume;
    gainRef.current = gainNode;

    let source: AudioBufferSourceNode;

    if (soundType === "rain") {
      source = createRainSound(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 4000;
      filterRef.current = filter;
      source.connect(filter);
      filter.connect(gainNode);
    } else {
      source = createNoiseBuffer(ctx, soundType);
      if (soundType === "brown") {
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 500;
        filterRef.current = filter;
        source.connect(filter);
        filter.connect(gainNode);
      } else {
        source.connect(gainNode);
      }
    }

    gainNode.connect(ctx.destination);
    source.start();
    sourceRef.current = source;

    if (timerMinutes > 0) {
      const fadeStart = timerMinutes * 60 * 1000 - 10000; // Start fade 10s before end
      timerRef.current = setTimeout(() => {
        // Fade out
        if (gainRef.current && ctxRef.current) {
          gainRef.current.gain.linearRampToValueAtTime(0, ctxRef.current.currentTime + 10);
        }
        setTimeout(() => {
          stopSound();
          onTimerEnd();
        }, 10000);
      }, Math.max(0, fadeStart));
    }

    return () => {
      stopSound();
    };
    // volume is handled by a separate effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundType, timerMinutes, stopSound, onTimerEnd]);

  // Update volume in real-time without restarting sound
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume;
    }
  }, [volume]);

  return null; // This component produces no visual output
}
