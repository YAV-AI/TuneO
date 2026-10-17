"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import Modal from "../Modal";
import Select from "../Select";
import { useStudio } from "../StudioContext";
import { formatTime, type Song } from "../types";
import type { Voice } from "./types";

// "Remix > Voice": turn a song you made into a reusable voice (a persona). Free, once per track.
export default function PersonaDialog({
  song: preset,
  onClose,
  onDone,
}: {
  song?: Song;
  onClose: () => void;
  onDone?: (v: Voice) => void;
}) {
  const { songs, notify } = useStudio();
  const candidates = songs.filter((s) => s.audio_url && s.task_id !== "upload");
  const [songId, setSongId] = useState(preset?.id ?? candidates[0]?.id ?? "");
  const song = candidates.find((s) => s.id === songId) ?? preset;
  const [name, setName] = useState(preset ? `${preset.title} voice` : "");
  const [description, setDescription] = useState(preset?.tags ?? "");
  const [start, setStart] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voice, setVoice] = useState<Voice | null>(null);

  const duration = Math.floor(song?.duration ?? 0);

  // Wait for KIE to finish the persona.
  useEffect(() => {
    if (!voice || voice.status === "ready" || voice.status === "failed") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/voices/${voice.id}`, { cache: "no-store" });
      if (res.ok) setVoice((await res.json()).voice);
    }, 3000);
    return () => clearInterval(t);
  }, [voice]);

  const create = async () => {
    if (!song) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/voices/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: song.id, name, description, start }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the voice");
      const v = await fetch(`/api/voices/${data.id}`).then((r) => r.json());
      setVoice(v.voice);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (voice) {
    const ready = voice.status === "ready";
    const failed = voice.status === "failed";
    return (
      <Modal title="Voice from a song" onClose={onClose} wide>
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          {ready ? (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-fg text-bg">
              <Check size={26} />
            </span>
          ) : failed ? null : (
            <Loader2 className="animate-spin text-muted" size={28} />
          )}
          <p className={failed ? "text-sm text-red-300" : "text-sm text-soft"}>
            {ready
              ? `${voice.name} is ready`
              : failed
                ? (voice.error ?? "Could not create the voice")
                : "Capturing the voice and style..."}
          </p>
          {(ready || failed) && (
            <button
              onClick={() => {
                if (ready) notify(`Voice '${voice.name}' added`);
                if (onDone) onDone(voice);
                else onClose();
              }}
              className="h-11 rounded-full bg-fg px-6 text-sm font-medium text-bg"
            >
              {ready ? "Use this voice" : "Close"}
            </button>
          )}
        </div>
      </Modal>
    );
  }

  const field = "w-full rounded-xl bg-surface px-4 py-3 text-sm outline-none placeholder:text-dim";
  return (
    <Modal title="Voice from a song" subtitle="Reuse the voice and style of a song you made" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        {!preset && (
          <div className="flex flex-col gap-1.5 text-xs text-muted">
            Song
            <Select
              variant="field"
              label="Song"
              value={songId}
              onChange={setSongId}
              options={candidates.map((s) => ({
                value: s.id,
                label: s.title,
                hint: `${formatTime(s.duration)} · ${s.tags ?? ""}`,
                image: s.image_url,
              }))}
            />
          </div>
        )}
        {preset && song && (
          <div className="flex items-center gap-3 rounded-xl bg-surface p-2">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-raised">
              {song.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={song.image_url} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{song.title}</span>
              <span className="block truncate text-xs text-dim">{song.tags}</span>
            </span>
          </div>
        )}
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          Voice name
          <input
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Midnight Tenor"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          Description
          <textarea
            rows={3}
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Genre, mood, instruments and how the vocal sounds"
            className={field}
          />
        </label>
        {duration > 30 && (
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Use the vocal from {formatTime(start)} to {formatTime(start + 30)}
            <input
              type="range"
              min={0}
              max={duration - 30}
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
              className="tick-slider w-full"
            />
          </label>
        )}
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <button
          onClick={create}
          disabled={busy || !song || !name.trim() || !description.trim()}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-fg text-sm font-medium text-bg disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Create Voice
        </button>
        <p className="text-center text-xs text-dim">Free. Each song can become a voice once.</p>
      </div>
    </Modal>
  );
}
