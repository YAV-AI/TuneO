"use client";

import { useEffect, useRef } from "react";
import { AudioLines, X } from "lucide-react";
import { useStudio } from "./StudioContext";
import { modelLabel, type Song } from "./types";

// Queue popover: now playing, songs you queued, then what plays next.
export default function QueuePanel() {
  const s = useStudio();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!s.queueOpen) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && s.setQueueOpen(false);
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t) && !t.closest("[data-queue-toggle]")) s.setQueueOpen(false);
    };
    document.addEventListener("keydown", esc);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("keydown", esc);
      document.removeEventListener("mousedown", close);
    };
  }, [s]);

  if (!s.queueOpen) return null;

  return (
    <div
      ref={ref}
      className="scroll-thin fixed bottom-[76px] right-4 z-40 flex max-h-[min(640px,calc(100vh-110px))] w-[420px] flex-col overflow-y-auto rounded-3xl border border-line bg-bar p-5 shadow-2xl"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium">Queue</h2>
        <button
          onClick={() => s.setQueueOpen(false)}
          aria-label="Close queue"
          className="flex h-8 w-8 items-center justify-center rounded-full text-soft hover:bg-hover hover:text-fg"
        >
          <X size={17} />
        </button>
      </div>

      <h3 className="mb-3 mt-5 text-base font-medium">Now playing</h3>
      {s.current ? (
        <Row
          song={s.current}
          artist={s.artistName}
          active
          playing={s.playing}
          onClick={() => s.setPlaying(!s.playing)}
        />
      ) : (
        <p className="text-sm text-muted">Nothing playing yet.</p>
      )}

      {s.queue.length > 0 && (
        <>
          <div className="mb-3 mt-6 flex items-center justify-between">
            <h3 className="text-base font-medium">Next in queue</h3>
            <button onClick={s.clearQueue} className="text-sm text-soft hover:text-fg">
              Clear
            </button>
          </div>
          {s.queue.map((song, i) => (
            <Row
              key={`${song.id}-${i}`}
              song={song}
              artist={s.artistName}
              onClick={() => s.playFromQueue(i)}
              onRemove={() => s.removeFromQueue(i)}
            />
          ))}
        </>
      )}

      {s.upNext.length > 0 && (
        <>
          <h3 className="mb-3 mt-6 text-base font-medium">Next up</h3>
          {s.upNext.map((song) => (
            <Row key={song.id} song={song} artist={s.artistName} onClick={() => s.play(song)} />
          ))}
        </>
      )}
    </div>
  );
}

function Row({
  song,
  artist,
  active,
  playing,
  onClick,
  onRemove,
}: {
  song: Song;
  artist: string;
  active?: boolean;
  playing?: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  // Rows read "Artist · Genre": the first style tag stands in for the genre.
  const genre = song.tags?.split(",")[0]?.trim();
  return (
    <div className="group -mx-2 flex items-center gap-4 rounded-xl px-2 py-2 hover:bg-hover">
      <button
        onClick={onClick}
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-raised"
        aria-label={`Play ${song.title}`}
      >
        {song.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={song.image_url} alt="" className="h-full w-full object-cover" />
        )}
        {active && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/35">
            <AudioLines size={20} className={playing ? "animate-pulse" : ""} />
          </span>
        )}
      </button>
      <button onClick={onClick} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className={`truncate text-[15px] ${active ? "text-accent" : ""}`}>{song.title}</span>
          {song.model && (
            <span className="shrink-0 font-mono text-[10px] uppercase text-muted">{modelLabel(song.model)}</span>
          )}
        </span>
        <span className="block truncate text-sm text-soft">
          {artist || "TuneO"}
          {genre && ` · ${genre.charAt(0).toUpperCase()}${genre.slice(1)}`}
        </span>
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${song.title} from queue`}
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-soft hover:text-fg group-hover:flex"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
