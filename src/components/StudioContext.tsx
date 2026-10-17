"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { SongAction } from "./SongMenu";
import { postJson, type CreatePreset, type LibraryItem, type Song } from "./types";

type Dialog = { type: "extend" | "cover" | "replace" | "download" | "persona" | "addInstrumental"; song: Song } | null;

type Studio = {
  items: LibraryItem[];
  songs: Song[];
  load: () => Promise<void>;
  artistName: string;
  setArtistName: (name: string) => Promise<void>;
  // player
  current: Song | null;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  time: number;
  setTime: (t: number) => void;
  queue: Song[];
  upNext: Song[];
  queueOpen: boolean;
  setQueueOpen: (o: boolean) => void;
  playFromQueue: (index: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  shuffle: boolean;
  repeat: boolean;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  play: (s: Song) => void;
  step: (dir: 1 | -1) => void;
  rate: (s: Song, rating: number) => Promise<void>;
  // song actions and overlays
  act: (a: SongAction, s: Song) => Promise<void>;
  dialog: Dialog;
  closeDialog: () => void;
  detailsId: string | null;
  setDetailsId: (id: string | null) => void;
  preset: CreatePreset | null;
  toast: string | null;
  notify: (msg: string) => void;
  profileOpen: boolean;
  setProfileOpen: (o: boolean) => void;
};

const Ctx = createContext<Studio | null>(null);

export function useStudio() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStudio must be used inside StudioProvider");
  return s;
}

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [artistName, setArtist] = useState("");
  const [current, setCurrent] = useState<Song | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [queue, setQueue] = useState<Song[]>([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [preset, setPreset] = useState<CreatePreset | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/songs", { cache: "no-store" });
    if (res.ok) setItems((await res.json()).items);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      load();
      fetch("/api/settings")
        .then((r) => r.json())
        .then((s) => setArtist(s.artistName ?? ""))
        .catch(() => {});
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Poll while anything is still generating; the worker advances jobs server side.
  const hasPending =
    items.some((i) => i.kind === "pending" && !i.error) || items.some((i) => i.kind === "song" && !i.audio_url);
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [hasPending, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const songs = useMemo(
    () => items.filter((i): i is Song => i.kind === "song" && !!(i.audio_url || i.stream_url)),
    [items],
  );

  const start = useCallback((song: Song) => {
    setCurrent(song);
    setPlaying(true);
    // Count the play (Library play counts and History tab); bump locally so the row updates at once.
    setItems((prev) =>
      prev.map((i) => (i.id === song.id && i.kind === "song" ? { ...i, play_count: (i.play_count ?? 0) + 1 } : i)),
    );
    fetch(`/api/songs/${song.id}/play`, { method: "POST" }).catch(() => {});
  }, []);

  const play = useCallback(
    (song: Song) => {
      if (current?.id === song.id) setPlaying((p) => !p);
      else start(song);
    },
    [current, start],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      if (dir === 1 && queue.length) {
        const [next, ...rest] = queue;
        setQueue(rest);
        return start(next);
      }
      if (dir === 1 && shuffle && songs.length > 1) {
        const others = songs.filter((s) => s.id !== current?.id);
        return start(others[Math.floor(Math.random() * others.length)]);
      }
      const idx = songs.findIndex((s) => s.id === current?.id);
      const next = songs[idx + dir];
      if (next) start(next);
      else setPlaying(false);
    },
    [queue, shuffle, songs, current, start],
  );

  // What plays after the manual queue runs out: the rest of the library after the current song.
  const upNext = useMemo(() => {
    const idx = songs.findIndex((s) => s.id === current?.id);
    return idx === -1 ? songs.slice(0, 20) : songs.slice(idx + 1, idx + 21);
  }, [songs, current]);

  const playFromQueue = useCallback(
    (index: number) => {
      const song = queue[index];
      if (!song) return;
      setQueue((q) => q.filter((_, i) => i !== index));
      start(song);
    },
    [queue, start],
  );

  const rate = useCallback(async (song: Song, rating: number) => {
    const value = song.rating === rating ? 0 : rating;
    setItems((prev) => prev.map((i) => (i.id === song.id ? { ...i, rating: value } : i)));
    setCurrent((c) => (c?.id === song.id ? { ...c, rating: value } : c));
    await postJson(`/api/songs/${song.id}`, { rating: value }, "PATCH");
  }, []);

  const setArtistName = useCallback(async (name: string) => {
    const s = await postJson<{ artistName: string }>("/api/settings", { artistName: name }, "PUT");
    setArtist(s.artistName);
  }, []);

  const act = useCallback(
    async (action: SongAction, song: Song) => {
      try {
        switch (action) {
          case "extend":
          case "cover":
          case "replace":
          case "download":
          case "addInstrumental":
            return setDialog({ type: action, song });
          case "voice":
            return setDialog({ type: "persona", song });
          case "stems":
            await postJson(`/api/songs/${song.id}/actions`, { action: "stems" });
            setToast("Separating stems. They will appear in Download.");
            return setDialog({ type: "download", song });
          case "reuse":
            return setPreset({
              nonce: Date.now(),
              title: song.title,
              style: song.tags ?? "",
              lyrics: song.lyrics ?? "",
            });
          case "details":
            return setDetailsId(song.id);
          case "art":
            await postJson(`/api/songs/${song.id}/actions`, { action: "art" });
            setToast("Creating cover art...");
            setTimeout(load, 15000);
            return;
          case "queue":
            setQueue((q) => [...q, song]);
            setQueueOpen(true);
            return setToast(`Added '${song.title}' to queue`);
          case "trash":
            await fetch(`/api/songs/${song.id}`, { method: "DELETE" });
            if (current?.id === song.id) setPlaying(false);
            setDetailsId((id) => (id === song.id ? null : id));
            setToast(`Moved '${song.title}' to trash`);
            return load();
        }
      } catch (err) {
        setToast((err as Error).message);
      }
    },
    [current, load],
  );

  const value: Studio = {
    items,
    songs,
    load,
    artistName,
    setArtistName,
    current,
    playing,
    setPlaying,
    time,
    setTime,
    queue,
    upNext,
    queueOpen,
    setQueueOpen,
    playFromQueue,
    removeFromQueue: (index: number) => setQueue((q) => q.filter((_, i) => i !== index)),
    clearQueue: () => setQueue([]),
    shuffle,
    repeat,
    toggleShuffle: () => setShuffle((v) => !v),
    toggleRepeat: () => setRepeat((v) => !v),
    play,
    step,
    rate,
    act,
    dialog,
    closeDialog: () => setDialog(null),
    detailsId,
    setDetailsId,
    preset,
    toast,
    notify: setToast,
    profileOpen,
    setProfileOpen,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
