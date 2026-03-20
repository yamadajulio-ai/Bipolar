"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface AudioTrack {
  id: string;
  title: string;
  description: string;
  duration: string;
  src: string;
  category: "respiracao" | "meditacao" | "relaxamento";
}

export const AUDIO_TRACKS: AudioTrack[] = [
  // Tracks will be added here when audio files are generated via ElevenLabs
  // Audio files go in /public/audio/
  // Example:
  // { id: "resp-478", title: "Respiração 4-7-8 guiada", description: "5 minutos de respiração guiada", duration: "5:00", src: "/audio/respiracao-478.mp3", category: "respiracao" },
];

export function AudioPlayer({ track }: { track: AudioTrack }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {/* user interaction required */});
    }
    setPlaying(!playing);
  }, [playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
        const mins = Math.floor(audio.currentTime / 60);
        const secs = Math.floor(audio.currentTime % 60);
        setCurrentTime(`${mins}:${String(secs).padStart(2, "0")}`);
      }
    };

    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime("0:00");
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <audio ref={audioRef} src={track.src} preload="none" />
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-dark"
          aria-label={playing ? "Pausar" : "Reproduzir"}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="1" width="4" height="12" rx="1" />
              <rect x="8" y="1" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <polygon points="2,0 14,7 2,14" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{track.title}</p>
          <p className="text-[11px] text-muted">{track.description}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 bg-border/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-muted w-8">
              {playing ? currentTime : track.duration}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AudioLibrary() {
  if (AUDIO_TRACKS.length === 0) {
    return null; // Don't render section if no tracks available
  }

  const categories = {
    respiracao: AUDIO_TRACKS.filter((t) => t.category === "respiracao"),
    meditacao: AUDIO_TRACKS.filter((t) => t.category === "meditacao"),
    relaxamento: AUDIO_TRACKS.filter((t) => t.category === "relaxamento"),
  };

  const categoryLabels = {
    respiracao: "Respiração guiada",
    meditacao: "Meditação",
    relaxamento: "Relaxamento",
  };

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Áudio guiado</h2>
      <p className="mb-4 text-sm text-muted">
        Exercícios com narração para praticar sem olhar a tela. Funciona offline após o primeiro uso.
      </p>
      {Object.entries(categories).map(([cat, tracks]) => {
        if (tracks.length === 0) return null;
        return (
          <div key={cat} className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-foreground/70">
              {categoryLabels[cat as keyof typeof categoryLabels]}
            </h3>
            <div className="space-y-2">
              {tracks.map((track) => (
                <AudioPlayer key={track.id} track={track} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
