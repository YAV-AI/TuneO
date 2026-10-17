"use client";

import { useMemo, useState } from "react";
import { AudioLines, Loader2, Play, RefreshCw, Search, ThumbsDown, ThumbsUp, X } from "lucide-react";
import SongMenu from "./SongMenu";
import { useStudio } from "./StudioContext";
import { formatTime, modelLabel, type LibraryItem, type Song } from "./types";

function dayLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

type Filter = "all" | "liked" | "covers" | "extras";

export default function Library({ title = "My Workspace" }: { title?: string }) {
  const { items } = useStudio();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((i) => {
      if (filter !== "all") {
        if (i.kind !== "song") return false;
        if (filter === "liked" && i.rating !== 1) return false;
        if (filter === "covers" && !i.origin) return false;
        if (filter === "extras" && !i.extras?.length) return false;
      }
      if (!q) return true;
      return [i.title, i.kind === "song" ? i.tags : ""].join(" ").toLowerCase().includes(q);
    });
    const map = new Map<string, LibraryItem[]>();
    for (const i of filtered) {
      const k = dayLabel(i.created_at);
      map.set(k, [...(map.get(k) ?? []), i]);
    }
    return [...map.entries()];
  }, [items, query, filter]);

  const chip = (f: Filter, label: string) => (
    <button
      key={f}
      onClick={() => setFilter((cur) => (cur === f ? "all" : f))}
      className={`h-10 shrink-0 rounded-full border px-4 text-xs font-medium transition-colors ${
        filter === f ? "border-fg bg-fg text-bg" : "border-[#3a3a3f] text-fg hover:bg-hover"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-col gap-4 px-6 pb-3 pt-5">
        <div className="flex items-center gap-2 text-base font-medium">
          Workspaces <span className="text-muted">›</span> <span>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface px-4">
            <Search size={17} className="shrink-0 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </label>
          {chip("liked", "Liked")}
          {chip("covers", "Remixes")}
          {chip("extras", "Stems & files")}
        </div>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto px-4 pb-6">
        {groups.length === 0 && (
          <p className="pt-24 text-center text-sm text-muted">
            {items.length ? "Nothing matches." : "No songs yet. Describe one and press Create."}
          </p>
        )}
        {groups.map(([day, rows]) => (
          <section key={day} className="mb-2">
            <h3 className="px-2 py-2 text-sm font-bold text-soft">{day}</h3>
            {rows.map((i) =>
              i.kind === "song" ? (
                <SongRow key={i.id} song={i} />
              ) : (
                <PendingRow key={i.id} id={i.id} title={i.title} model={i.model} error={i.error} />
              ),
            )}
          </section>
        ))}
      </div>
    </section>
  );
}

export function SongRow({ song, showPlays }: { song: Song; showPlays?: boolean }) {
  const { current, playing: isPlaying, play, rate, act, setDetailsId } = useStudio();
  const active = current?.id === song.id;
  const playing = active && isPlaying;
  const ready = !!(song.audio_url || song.stream_url);

  return (
    <div
      className={`group flex items-center gap-4 rounded-xl px-5 py-2.5 hover:bg-surface ${active ? "bg-surface" : ""}`}
    >
      <button
        onClick={() => ready && play(song)}
        aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
        className="relative h-[85px] w-[85px] shrink-0 overflow-hidden rounded-lg bg-raised"
      >
        {song.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={song.image_url} alt="" className="h-full w-full object-cover" />
        )}
        <span
          className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity ${
            playing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {playing && <AudioLines size={24} className="group-hover:hidden" />}
          {playing ? (
            <span className="hidden group-hover:block">
              <PauseGlyph />
            </span>
          ) : (
            <Play size={22} fill="currentColor" strokeWidth={0} />
          )}
        </span>
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/40 px-1 font-mono text-[10px] tracking-tight">
          {song.audio_url ? formatTime(song.duration) : <Loader2 size={10} className="my-0.5 animate-spin" />}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <button
            onClick={() => setDetailsId(song.id)}
            className={`min-w-[5rem] truncate text-sm font-medium hover:underline ${active ? "text-accent" : ""}`}
          >
            {song.title}
          </button>
          <Tag>{modelLabel(song.model)}</Tag>
          {song.origin && <Tag boxed>{song.origin}</Tag>}
          {["stems", "video", "wav"]
            .filter((k) => song.extras?.includes(k))
            .map((k) => (
              <button key={k} onClick={() => act("download", song)} title="Open downloads">
                <Tag boxed>{k}</Tag>
              </button>
            ))}
        </div>
        <p className="mt-0.5 truncate text-xs text-dim">{song.tags}</p>
        <div className="mt-2 flex items-center gap-1.5">
          {showPlays && (
            <button
              onClick={() => ready && play(song)}
              aria-label={`Played ${song.play_count ?? 0} times`}
              className="flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-xs text-muted hover:bg-hover hover:text-fg"
            >
              <Play size={11} fill="currentColor" strokeWidth={0} />
              {song.play_count ?? 0}
            </button>
          )}
          <RoundButton on={song.rating === 1} onClick={() => rate(song, 1)} label="Like">
            <ThumbsUp size={13} fill={song.rating === 1 ? "currentColor" : "none"} />
          </RoundButton>
          <RoundButton on={song.rating === -1} onClick={() => rate(song, -1)} label="Dislike">
            <ThumbsDown size={13} fill={song.rating === -1 ? "currentColor" : "none"} />
          </RoundButton>
        </div>
      </div>

      {song.audio_url && (
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => act("cover", song)}
            className="hidden h-10 items-center gap-2 rounded-full bg-surface px-4 text-xs font-medium hover:bg-hover group-hover:flex"
          >
            <RefreshCw size={14} /> Remix
          </button>
          <SongMenu song={song} onAction={act} />
        </div>
      )}
    </div>
  );
}

function PauseGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

export function PendingRow({
  id,
  title,
  model,
  error,
}: {
  id: string;
  title: string;
  model: string;
  error: string | null;
}) {
  const { load } = useStudio();
  // Pending row ids are "<taskId>:<n>"; removing dismisses the whole failed job.
  const dismiss = async () => {
    await fetch(`/api/tasks/${id.split(":")[0]}`, { method: "DELETE" });
    load();
  };
  return (
    <div className="group flex items-center gap-4 rounded-xl px-5 py-2.5 hover:bg-surface">
      <div className="flex h-[85px] w-[85px] shrink-0 items-center justify-center rounded-lg bg-surface">
        {error ? (
          <span className="text-xs text-red-400">Failed</span>
        ) : (
          <Loader2 className="animate-spin text-dim" size={20} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-muted">{title}</span>
          <Tag>{modelLabel(model)}</Tag>
        </div>
        <p className="mt-0.5 truncate text-xs text-dim">{error ?? "Generating..."}</p>
      </div>
      {error && (
        <button
          onClick={dismiss}
          aria-label="Remove failed song"
          title="Remove"
          className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function Tag({ children, boxed }: { children: React.ReactNode; boxed?: boolean }) {
  return (
    <span
      className={`shrink-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.02em] ${
        boxed ? "rounded bg-raised px-1.5 py-px text-soft hover:text-fg" : "text-muted"
      }`}
    >
      {children}
    </span>
  );
}

function RoundButton({
  on,
  onClick,
  label,
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
        on ? "bg-fg text-bg" : "bg-surface text-muted hover:bg-hover hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
