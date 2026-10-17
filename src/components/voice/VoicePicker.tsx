"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Disc3, Loader2, Pause, Play, Plus, Search, Star, Trash2 } from "lucide-react";
import Modal from "../Modal";
import { Avatar } from "../ProfileDialog";
import CreateVoiceWizard from "./CreateVoiceWizard";
import PersonaDialog from "./PersonaDialog";
import { STATUS_LABEL, type Voice } from "./types";

let cachedVoices: Voice[] | null = null;

// Voice picker: My Voices / Favorites, search, Create Voice, then your voices.
export default function VoicePicker({
  selectedId,
  onSelect,
  onClose,
}: {
  selectedId: string | null;
  onSelect: (v: Voice) => void;
  onClose: () => void;
}) {
  const [voices, setVoices] = useState<Voice[] | null>(cachedVoices);
  const [tab, setTab] = useState<"mine" | "favorites">("mine");
  const [query, setQuery] = useState("");
  const [screen, setScreen] = useState<"list" | "create" | "persona">("list");
  const [resume, setResume] = useState<Voice | null>(null);

  // One preview at a time; stops at the end of the voice's section and when the picker closes.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const stopPreview = useCallback(() => {
    audioRef.current?.pause();
    setPlayingId(null);
  }, []);
  useEffect(() => () => audioRef.current?.pause(), []);

  const togglePreview = (v: Voice) => {
    if (!v.preview) return;
    if (playingId === v.id) return stopPreview();
    audioRef.current?.pause();
    const a = new Audio(v.preview.src);
    const { start, end } = v.preview;
    a.addEventListener("loadedmetadata", () => (a.currentTime = start), { once: true });
    a.addEventListener("timeupdate", () => end !== null && a.currentTime >= end && stopPreview());
    a.addEventListener("ended", () => setPlayingId(null));
    a.play().catch(() => setPlayingId(null));
    audioRef.current = a;
    setPlayingId(v.id);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/voices", { cache: "no-store" });
    if (res.ok) {
      const list = (await res.json()).voices as Voice[];
      cachedVoices = list;
      setVoices(list);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Keep preparing voices moving while the picker is open.
  const busy = useMemo(() => voices?.filter((v) => v.status === "phrase" || v.status === "verifying") ?? [], [voices]);
  useEffect(() => {
    if (!busy.length) return;
    const t = setInterval(async () => {
      await Promise.all(busy.map((v) => fetch(`/api/voices/${v.id}`, { cache: "no-store" })));
      load();
    }, 4000);
    return () => clearInterval(t);
  }, [busy, load]);

  if (screen === "create") {
    return (
      <CreateVoiceWizard
        resume={resume}
        onClose={onClose}
        onBack={() => {
          setResume(null);
          setScreen("list");
          load();
        }}
        onDone={(v) => {
          onSelect(v);
          onClose();
        }}
      />
    );
  }
  if (screen === "persona") {
    return (
      <PersonaDialog
        onClose={() => {
          setScreen("list");
          load();
        }}
        onDone={(v) => {
          if (v.status === "ready") {
            onSelect(v);
            onClose();
          } else {
            setScreen("list");
            load();
          }
        }}
      />
    );
  }

  const q = query.trim().toLowerCase();
  const list = (voices ?? [])
    .filter((v) => tab === "mine" || v.favorite)
    .filter((v) => !q || [v.name, v.description, v.style].join(" ").toLowerCase().includes(q));

  const toggleFavorite = async (v: Voice) => {
    await fetch(`/api/voices/${v.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !v.favorite }),
    });
    load();
  };
  const remove = async (v: Voice) => {
    await fetch(`/api/voices/${v.id}`, { method: "DELETE" });
    load();
  };

  return (
    <Modal title="Voice" onClose={onClose} wide align="left">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 rounded-full border border-line p-1 text-sm">
          {(
            [
              ["mine", "My Voices"],
              ["favorites", "Favorites"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`rounded-full py-1.5 ${tab === v ? "bg-hover text-fg" : "text-soft hover:text-fg"}`}
            >
              {l}
            </button>
          ))}
        </div>

        <label className="flex h-11 items-center gap-2.5 rounded-full bg-surface px-4">
          <Search size={16} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>

        <button
          onClick={() => setScreen("create")}
          className="voice-glow flex items-center gap-3 rounded-2xl px-3 py-3 text-left"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/60">
            <Plus size={20} />
          </span>
          <span className="flex-1">
            <span className="flex items-center gap-2 text-sm font-medium">
              Create Voice <span className="rounded bg-accent px-1.5 text-[10px] font-medium">New</span>
            </span>
            <span className="text-xs text-soft">Record or upload your voice</span>
          </span>
          <ChevronRight size={18} />
        </button>

        <button
          onClick={() => setScreen("persona")}
          className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-3 text-left hover:bg-hover"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line">
            <Disc3 size={20} />
          </span>
          <span className="flex-1">
            <span className="text-sm font-medium">From a song</span>
            <span className="block text-xs text-soft">Reuse the voice and style of a song you made</span>
          </span>
          <ChevronRight size={18} />
        </button>

        <div className="min-h-[200px]">
          {!voices ? (
            <Loader2 className="mx-auto mt-16 animate-spin text-muted" />
          ) : list.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-medium">{tab === "favorites" ? "No Favorites" : "No Voices"}</p>
              <p className="mt-1 text-sm text-soft">Voices let you create songs that have a similar style and voice.</p>
            </div>
          ) : (
            <div className="scroll-thin -mx-1 flex max-h-[200px] flex-col overflow-y-auto px-1">
              {list.map((v) => {
                const ready = v.status === "ready";
                return (
                  <div
                    key={v.id}
                    className={`group flex items-center gap-3 rounded-xl px-2 py-2 ${
                      selectedId === v.id ? "bg-white/10" : "hover:bg-hover"
                    }`}
                  >
                    <button
                      onClick={() => togglePreview(v)}
                      disabled={!v.preview}
                      aria-label={playingId === v.id ? `Stop ${v.name} preview` : `Play ${v.name} preview`}
                      title={v.preview ? undefined : "No sample saved for this voice"}
                      className="group/thumb relative h-11 w-11 shrink-0 overflow-hidden rounded-full disabled:cursor-default"
                    >
                      {v.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Avatar name={v.name} size={44} />
                      )}
                      {v.preview && (
                        <span
                          className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity ${
                            playingId === v.id ? "opacity-100" : "opacity-0 group-hover/thumb:opacity-100"
                          }`}
                        >
                          {playingId === v.id ? (
                            <Pause size={16} fill="currentColor" strokeWidth={0} />
                          ) : (
                            <Play size={16} fill="currentColor" strokeWidth={0} />
                          )}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        stopPreview();
                        if (ready) {
                          onSelect(v);
                          onClose();
                        } else if (v.kind === "voice" && v.status === "ready_to_verify") {
                          setResume(v);
                          setScreen("create");
                        } else if (v.status === "failed") {
                          // A failed voice cannot be retried on KIE; start a fresh one.
                          setResume(null);
                          setScreen("create");
                        }
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{v.name}</span>
                        <span className="block truncate text-xs text-soft">
                          {v.kind === "voice" ? "Custom voice" : "From a song"}
                          {v.status !== "ready" && (
                            <span className={v.status === "failed" ? "text-red-400" : "text-accent"}>
                              {" "}
                              · {STATUS_LABEL[v.status]}
                            </span>
                          )}
                          {v.status === "failed" && v.error && <span className="text-dim"> · {v.error}</span>}
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => toggleFavorite(v)}
                      aria-label={v.favorite ? "Unfavorite" : "Favorite"}
                      className={`rounded-full p-2 ${v.favorite ? "text-amber-300" : "text-dim hover:text-fg"}`}
                    >
                      <Star size={15} fill={v.favorite ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => remove(v)}
                      aria-label="Remove voice"
                      className="hidden rounded-full p-2 text-dim hover:text-red-400 group-hover:block"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
