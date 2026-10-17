"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw, Search, Trash2 } from "lucide-react";
import Modal from "../Modal";
import { SongRow } from "../Library";
import { useStudio } from "../StudioContext";
import { formatTime, type Song } from "../types";

function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const reload = useCallback(async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [url]);
  useEffect(() => {
    const t = setTimeout(reload, 0);
    return () => clearTimeout(t);
  }, [reload]);
  return { data, reload };
}

function Empty({ text }: { text: string }) {
  return <p className="flex flex-1 items-center justify-center pb-24 text-sm text-muted">{text}</p>;
}

type ArtItem = { id: string; song_id: string; title: string; src: string; kind: "cover" | "art"; created_at: number };

export function ArtTab() {
  const { data } = useFetch<{ covers: ArtItem[]; art: ArtItem[] }>("/api/art");
  const { setDetailsId } = useStudio();
  const [view, setView] = useState<"all" | "covers" | "art">("all");

  if (!data) return <Loader2 className="mx-auto mt-24 animate-spin text-muted" />;
  const list = view === "covers" ? data.covers : view === "art" ? data.art : [...data.art, ...data.covers];
  // A generated image used as a cover appears once.
  const seen = new Set<string>();
  const items = list.filter((i) => (seen.has(i.src) ? false : (seen.add(i.src), true)));

  return (
    <>
      <div className="flex gap-2 px-6 py-4">
        {(
          [
            ["all", "All"],
            ["covers", "Song covers"],
            ["art", "Generated"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`h-9 rounded-full px-4 text-xs font-medium ${view === v ? "bg-fg text-bg" : "bg-surface hover:bg-hover"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <Empty text="What you create will appear here" />
      ) : (
        <div className="scroll-thin grid flex-1 auto-rows-max grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 overflow-y-auto px-6 pb-8">
          {items.map((a) => (
            <button key={a.id} onClick={() => setDetailsId(a.song_id)} className="group text-left">
              <div className="aspect-square overflow-hidden rounded-xl bg-raised">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.src}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                />
              </div>
              <div className="mt-2 truncate text-sm font-medium">{a.title}</div>
              <div className="text-xs text-dim">{a.kind === "art" ? "Generated art" : "Song cover"}</div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function HistoryTab() {
  const { data } = useFetch<{ items: Song[] }>("/api/history");
  const { items } = useStudio();
  if (!data) return <Loader2 className="mx-auto mt-24 animate-spin text-muted" />;
  if (!data.items.length) return <Empty text="Songs you play will appear here" />;
  // Prefer live library rows so likes and play counts stay in sync.
  const live = new Map(items.filter((i): i is Song => i.kind === "song").map((s) => [s.id, s]));
  return (
    <div className="scroll-thin flex-1 overflow-y-auto px-4 py-3">
      {data.items.map((s) => (
        <SongRow key={s.id} song={live.get(s.id) ?? s} showPlays />
      ))}
    </div>
  );
}

export function TrashTab() {
  const { data, reload } = useFetch<{ items: Song[] }>("/api/trash");
  const { load, notify } = useStudio();
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState<Song | null>(null);
  const [busy, setBusy] = useState(false);

  const restore = async (s: Song) => {
    await fetch(`/api/songs/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restore: true }),
    });
    notify(`Restored '${s.title}'`);
    await Promise.all([reload(), load()]);
  };

  const destroy = async (s: Song) => {
    setBusy(true);
    const res = await fetch(`/api/songs/${s.id}?forever=1`, { method: "DELETE" });
    setBusy(false);
    setConfirm(null);
    notify(res.ok ? `Deleted '${s.title}' permanently` : "Could not delete");
    await reload();
  };

  if (!data) return <Loader2 className="mx-auto mt-24 animate-spin text-muted" />;
  const q = query.trim().toLowerCase();
  const rows = data.items.filter((s) => !q || [s.title, s.tags].join(" ").toLowerCase().includes(q));

  return (
    <>
      <div className="px-6 py-4">
        <label className="flex h-10 items-center gap-2.5 rounded-full bg-surface px-4">
          <Search size={17} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>
      </div>
      {rows.length === 0 ? (
        <Empty text="Trash is empty" />
      ) : (
        <div className="scroll-thin flex-1 overflow-y-auto px-4 pb-6">
          {rows.map((s) => (
            <div key={s.id} className="flex items-center gap-4 rounded-xl px-5 py-2.5 hover:bg-surface">
              <div className="relative h-[85px] w-[85px] shrink-0 overflow-hidden rounded-lg bg-raised">
                {s.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image_url} alt="" className="h-full w-full object-cover opacity-80" />
                )}
                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/40 px-1 font-mono text-[10px]">
                  {formatTime(s.duration)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.title}</div>
                <p className="mt-0.5 truncate text-xs text-dim">{s.tags}</p>
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => restore(s)}
                    aria-label="Restore"
                    title="Restore"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-muted hover:bg-hover hover:text-fg"
                  >
                    <RotateCcw size={13} />
                  </button>
                  <button
                    onClick={() => setConfirm(s)}
                    aria-label="Delete forever"
                    title="Delete forever"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-muted hover:bg-hover hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {confirm && (
        <Modal
          title="Delete forever?"
          subtitle={`'${confirm.title}' and its files will be removed from storage.`}
          onClose={() => setConfirm(null)}
        >
          <div className="flex gap-2">
            <button
              onClick={() => setConfirm(null)}
              className="h-11 flex-1 rounded-full bg-surface text-sm hover:bg-hover"
            >
              Cancel
            </button>
            <button
              onClick={() => destroy(confirm)}
              disabled={busy}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-red-500 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Delete
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
