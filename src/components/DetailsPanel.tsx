"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Loader2, Pencil, X } from "lucide-react";
import { useStudio } from "./StudioContext";
import { useSongDetail } from "./useSongDetail";
import { downloadHref, formatTime, modelLabel, postJson, type AlignedWord, type Song } from "./types";

type Props = {
  songId: string;
  playingId: string | null;
  currentTime: number;
  onClose: () => void;
  onChanged: () => void;
  onOpenSong: (id: string) => void;
};

// Right-hand song detail drawer: cover, metadata, lyrics (synced when available), files.
export default function DetailsPanel({ songId, playingId, currentTime, onClose, onChanged, onOpenSong }: Props) {
  const { detail, reload } = useSongDetail(songId);
  const { artistName } = useStudio();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words = useMemo(() => {
    const ts = detail?.assets.find((a) => a.kind === "timestamps");
    return ts?.data ? ((JSON.parse(ts.data) as { alignedWords: AlignedWord[] }).alignedWords ?? []) : null;
  }, [detail]);

  if (!detail) {
    return (
      <Shell onClose={onClose}>
        <Loader2 className="mx-auto mt-20 animate-spin text-muted" />
      </Shell>
    );
  }
  const { song, parent, assets } = detail;
  const files = assets.filter((a) => a.kind !== "timestamps" && a.href);

  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await postJson(`/api/songs/${song.id}/actions`, { action: "timestamps" });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Shell onClose={onClose}>
      <div className="aspect-square w-full shrink-0 overflow-hidden rounded-2xl bg-raised">
        {song.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={song.image_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div>
        <TitleEditor key={song.id} song={song} onSaved={() => (reload(), onChanged())} />
        <p className="mt-1 text-sm font-medium text-muted">{artistName || "TuneO"}</p>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-muted">
        <span className="rounded bg-raised px-2 py-0.5 font-mono text-[10px] uppercase">{modelLabel(song.model)}</span>
        {song.origin && <span className="rounded bg-raised px-2 py-0.5">{song.origin}</span>}
        <span className="rounded bg-raised px-2 py-0.5">{formatTime(song.duration)}</span>
        <span className="rounded bg-raised px-2 py-0.5">{new Date(song.created_at).toLocaleString()}</span>
      </div>
      {parent && (
        <button onClick={() => onOpenSong(parent.id)} className="text-left text-xs text-muted hover:text-fg">
          {song.origin ?? "Made"} from <span className="underline">{parent.title}</span>
        </button>
      )}
      {song.tags && <p className="text-sm text-muted">{song.tags}</p>}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Lyrics</h3>
          {song.lyrics && !words && (
            <button
              onClick={sync}
              disabled={syncing}
              className="flex items-center gap-1 text-xs text-muted hover:text-fg"
            >
              {syncing && <Loader2 size={12} className="animate-spin" />} Sync to audio
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {words?.length ? (
          <SyncedLyrics words={words} time={playingId === song.id ? currentTime : -1} />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-fg/90">
            {song.lyrics || "Instrumental"}
          </pre>
        )}
      </section>

      {files.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Files</h3>
          {files.map((a) => (
            <a
              key={a.id}
              href={downloadHref(a.href, `${song.title} ${a.label}`)}
              className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-xs capitalize hover:bg-raised"
            >
              {a.kind} · {a.label.replace(/_/g, " ")}
              <Download size={12} />
            </a>
          ))}
        </section>
      )}
    </Shell>
  );
}

function Shell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <aside className="scroll-thin flex w-[380px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-line bg-bg p-5">
      <button
        onClick={onClose}
        aria-label="Close details"
        className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-raised text-muted hover:text-fg"
      >
        <X size={15} />
      </button>
      {children}
    </aside>
  );
}

function TitleEditor({ song, onSaved }: { song: Song; onSaved: () => void }) {
  const { notify } = useStudio();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(song.title);
  const [saving, setSaving] = useState(false);

  const start = () => {
    setTitle(song.title);
    setEditing(true);
  };

  // Saves on Enter, the check button, or clicking away; Escape cancels.
  const save = async () => {
    const next = title.trim();
    if (!next || next === song.title) return setEditing(false);
    setSaving(true);
    try {
      await postJson(`/api/songs/${song.id}`, { title: next }, "PATCH");
      setEditing(false);
      onSaved();
    } catch (err) {
      notify(`Could not rename: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return editing ? (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={title}
        maxLength={100}
        disabled={saving}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            e.stopPropagation();
            setEditing(false);
          }
        }}
        className="flex-1 rounded-lg bg-raised px-3 py-2 text-lg outline-none"
      />
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={save}
        aria-label="Save title"
        className="rounded-full bg-fg p-2 text-bg"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
      </button>
    </div>
  ) : (
    <button onClick={start} className="group flex items-center gap-2 text-left text-xl" title="Rename">
      {song.title}
      <Pencil size={14} className="text-muted opacity-0 group-hover:opacity-100" />
    </button>
  );
}

// Karaoke view: lines split on newlines in the aligned words, the active word highlighted.
function SyncedLyrics({ words, time }: { words: AlignedWord[]; time: number }) {
  const activeRef = useRef<HTMLSpanElement>(null);
  const active = time < 0 ? -1 : words.findIndex((w) => time >= w.startS && time < w.endS);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active]);

  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {words.map((w, i) => (
        <span
          key={i}
          ref={i === active ? activeRef : undefined}
          className={i === active ? "text-accent" : time >= 0 && w.endS <= time ? "text-fg" : "text-muted"}
        >
          {w.word}
        </span>
      ))}
    </p>
  );
}
