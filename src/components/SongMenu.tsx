"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Download,
  Image as ImageIcon,
  Info,
  ListMusic,
  MoreHorizontal,
  Mic,
  Music4,
  Pencil,
  Redo2,
  RefreshCw,
  Repeat,
  Scissors,
  Settings2,
  SplitSquareHorizontal,
  Trash2,
} from "lucide-react";
import type { Song } from "./types";

export type SongAction =
  | "cover"
  | "reuse"
  | "extend"
  | "replace"
  | "stems"
  | "download"
  | "details"
  | "art"
  | "queue"
  | "voice"
  | "addInstrumental"
  | "trash";

type Item = { action: SongAction; label: string; icon: React.ReactNode };
type Group = { label: string; icon: React.ReactNode; items: Item[] };
type Entry = Item | Group | "divider";

// Song menu, limited to what the KIE API can do.
const MENU: Entry[] = [
  {
    label: "Remix",
    icon: <RefreshCw size={15} />,
    items: [
      { action: "cover", label: "Cover", icon: <Repeat size={15} /> },
      { action: "reuse", label: "Reuse Prompt", icon: <Redo2 size={15} /> },
      { action: "voice", label: "Voice", icon: <Mic size={15} /> },
    ],
  },
  {
    label: "Edit",
    icon: <Pencil size={15} />,
    items: [
      { action: "extend", label: "Extend", icon: <Music4 size={15} /> },
      { action: "replace", label: "Replace Section", icon: <Scissors size={15} /> },
      { action: "stems", label: "Get Stems", icon: <SplitSquareHorizontal size={15} /> },
      { action: "addInstrumental", label: "Add Instrumental", icon: <Music4 size={15} /> },
    ],
  },
  "divider",
  { action: "download", label: "Download", icon: <Download size={15} /> },
  {
    label: "Manage",
    icon: <Settings2 size={15} />,
    items: [
      { action: "details", label: "Song Details", icon: <Info size={15} /> },
      { action: "art", label: "Create Cover Art", icon: <ImageIcon size={15} /> },
    ],
  },
  "divider",
  { action: "queue", label: "Add to Queue", icon: <ListMusic size={15} /> },
  "divider",
  { action: "trash", label: "Move to Trash", icon: <Trash2 size={15} /> },
];

// Uploaded audio has no KIE task, so task-only actions are hidden for it.
const TASK_ONLY = new Set<SongAction>(["art", "voice"]);

function menuFor(song: Song): Entry[] {
  if (song.task_id !== "upload") return MENU;
  return MENU.map((e) =>
    e !== "divider" && "items" in e ? { ...e, items: e.items.filter((i) => !TASK_ONLY.has(i.action)) } : e,
  );
}

export default function SongMenu({ song, onAction }: { song: Song; onAction: (a: SongAction, s: Song) => void }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const choose = (a: SongAction) => {
    setOpen(false);
    setSub(null);
    onAction(a, song);
  };

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="More actions"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-11 w-11 items-center justify-center rounded-full ${open ? "border border-fg" : "bg-raised/40 hover:bg-hover"}`}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-52 rounded-xl border border-line bg-bar py-1 text-sm shadow-2xl">
          {menuFor(song).map((entry, i) =>
            entry === "divider" ? (
              <div key={i} className="my-1 border-t border-line" />
            ) : "items" in entry ? (
              <div
                key={entry.label}
                className="relative"
                onMouseEnter={() => setSub(entry.label)}
                onMouseLeave={() => setSub(null)}
              >
                <button
                  className="flex w-full items-center gap-3 px-3 py-2 hover:bg-hover"
                  onClick={() => setSub(entry.label)}
                >
                  {entry.icon}
                  <span className="flex-1 text-left">{entry.label}</span>
                  <ChevronRight size={14} />
                </button>
                {sub === entry.label && (
                  <div className="absolute right-full top-0 mr-1 w-52 rounded-xl border border-line bg-bar py-1 shadow-2xl">
                    {entry.items.map((item) => (
                      <MenuButton key={item.action} item={item} onClick={choose} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <MenuButton key={entry.action} item={entry} onClick={choose} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function MenuButton({ item, onClick }: { item: Item; onClick: (a: SongAction) => void }) {
  return (
    <button onClick={() => onClick(item.action)} className="flex w-full items-center gap-3 px-3 py-2 hover:bg-hover">
      {item.icon}
      {item.label}
    </button>
  );
}
