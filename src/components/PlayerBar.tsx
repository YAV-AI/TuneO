"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Info,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useStudio } from "./StudioContext";
import { downloadHref, formatTime } from "./types";

export default function PlayerBar() {
  const s = useStudio();
  const { current: song, playing, setPlaying, step, rate } = s;
  const audio = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  // Prefer the final MP3; fall back to the stream URL while it is still rendering.
  const src = song?.audio_url || song?.stream_url || undefined;

  useEffect(() => {
    const el = audio.current;
    if (!el || !src) return;
    if (playing) el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [playing, src, setPlaying]);

  useEffect(() => {
    if (audio.current) audio.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  // Space toggles playback (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code !== "Space" || !song || t.closest("input, textarea, select, button, a")) return;
      e.preventDefault();
      setPlaying(!playing);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [song, playing, setPlaying]);

  const total = duration || song?.duration || 0;
  const pct = total ? Math.min(100, (time / total) * 100) : 0;
  const ctrl = "text-fg disabled:text-dim";
  const side = "flex h-8 w-8 items-center justify-center rounded-full text-soft hover:text-fg";
  const download = song ? downloadHref(song.audio_url, song.title) : undefined;

  return (
    <footer className="grid h-16 shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-6 border-t border-line bg-bar px-5">
      <audio
        ref={audio}
        src={src}
        onTimeUpdate={(e) => {
          setTime(e.currentTarget.currentTime);
          s.setTime(e.currentTarget.currentTime);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={(e) => {
          if (s.repeat) {
            e.currentTarget.currentTime = 0;
            e.currentTarget.play();
          } else step(1);
        }}
      />

      <div className="flex min-w-0 items-center gap-3">
        {song && (
          <>
            <button
              onClick={() => s.setDetailsId(song.id)}
              className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-raised"
              aria-label="Open song details"
            >
              {song.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={song.image_url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
            <div className="min-w-0 leading-tight">
              <button
                onClick={() => s.setDetailsId(song.id)}
                className="block max-w-full truncate text-sm font-medium hover:underline"
              >
                {song.title}
              </button>
              <div className="truncate text-xs font-medium text-muted">{s.artistName || "TuneO"}</div>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-6">
          <button
            onClick={s.toggleShuffle}
            aria-label="Shuffle"
            className={s.shuffle ? "text-accent" : "text-soft hover:text-fg"}
          >
            <Shuffle size={16} />
          </button>
          <button onClick={() => step(-1)} disabled={!song} aria-label="Previous" className={ctrl}>
            <SkipBack size={17} fill="currentColor" />
          </button>
          <button
            onClick={() => song && setPlaying(!playing)}
            disabled={!song}
            aria-label={playing ? "Pause" : "Play"}
            className={ctrl}
          >
            {playing ? (
              <Pause size={20} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={20} fill="currentColor" strokeWidth={0} />
            )}
          </button>
          <button onClick={() => step(1)} disabled={!song} aria-label="Next" className={ctrl}>
            <SkipForward size={17} fill="currentColor" />
          </button>
          <button
            onClick={s.toggleRepeat}
            aria-label="Repeat"
            className={s.repeat ? "text-accent" : "text-soft hover:text-fg"}
          >
            <Repeat size={16} />
          </button>
        </div>
        <div className="flex w-full max-w-[640px] items-center gap-3 text-xs text-muted">
          <span className="w-9 text-right tabular-nums">{song ? formatTime(time) : ""}</span>
          <input
            type="range"
            min={0}
            max={total || 1}
            step={0.1}
            value={Math.min(time, total || 1)}
            disabled={!song}
            style={{ "--pct": `${pct}%` } as React.CSSProperties}
            onChange={(e) => {
              if (audio.current) audio.current.currentTime = Number(e.target.value);
            }}
            className="bar-range flex-1"
            aria-label="Seek"
          />
          <span className="w-9 tabular-nums">{song ? formatTime(total) : ""}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        <button
          data-queue-toggle
          onClick={() => s.setQueueOpen(!s.queueOpen)}
          aria-label={s.queueOpen ? "Hide queue" : "Show queue"}
          aria-pressed={s.queueOpen}
          className={`${side} relative ${s.queueOpen ? "bg-accent/20 text-accent hover:text-accent" : ""}`}
        >
          <ListMusic size={16} />
          {s.queue.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-white">
              {s.queue.length}
            </span>
          )}
        </button>
        {song && (
          <>
            <button
              onClick={() => rate(song, 1)}
              aria-label="Like"
              className={`${side} ${song.rating === 1 ? "text-fg" : ""}`}
            >
              <ThumbsUp size={16} fill={song.rating === 1 ? "currentColor" : "none"} />
            </button>
            <button
              onClick={() => rate(song, -1)}
              aria-label="Dislike"
              className={`${side} ${song.rating === -1 ? "text-fg" : ""}`}
            >
              <ThumbsDown size={16} fill={song.rating === -1 ? "currentColor" : "none"} />
            </button>
            <a href={download} aria-label="Download MP3" className={side}>
              <Download size={16} />
            </a>
          </>
        )}
        <button onClick={() => setMuted((m) => !m)} aria-label="Mute" className={side}>
          {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          style={{ "--pct": `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
          onChange={(e) => {
            setMuted(false);
            setVolume(Number(e.target.value));
          }}
          className="bar-range w-20"
          aria-label="Volume"
        />
        {song && (
          <button
            onClick={() => s.setDetailsId(s.detailsId === song.id ? null : song.id)}
            aria-label={s.detailsId === song.id ? "Hide song details" : "Show song details"}
            aria-pressed={s.detailsId === song.id}
            className={`${side} ${s.detailsId === song.id ? "bg-hover text-fg" : ""}`}
          >
            <Info size={16} />
          </button>
        )}
      </div>
    </footer>
  );
}
