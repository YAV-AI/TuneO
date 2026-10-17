"use client";

import { useMemo, useState } from "react";
import { Filter, ListFilter, Search } from "lucide-react";
import Dropdown from "./Dropdown";
import { PendingRow, SongRow } from "../Library";
import { useStudio } from "../StudioContext";
import type { LibraryItem, Song } from "../types";

// Library filters, limited to what we track.
const FILTERS: Record<string, { label: string; test: (s: Song) => boolean }> = {
  liked: { label: "Liked", test: (s) => s.rating === 1 },
  disliked: { label: "Disliked", test: (s) => s.rating === -1 },
  uploads: { label: "Uploads", test: (s) => s.origin === "Upload" },
  full: { label: "Full song", test: (s) => !s.origin },
  cover: { label: "Cover", test: (s) => s.origin === "Cover" },
  edits: { label: "Extend & replace", test: (s) => s.origin === "Extend" || s.origin === "Replace" },
  downloads: { label: "Downloads", test: (s) => !!s.extras?.length },
};
const HIDE_DISLIKED = "hide-disliked";

const SORTS = [
  { value: "newest", label: "Newest", short: "New" },
  { value: "oldest", label: "Oldest", short: "Old" },
  { value: "liked", label: "Most liked", short: "Liked" },
  { value: "unliked", label: "Least liked", short: "Least liked" },
  { value: "played", label: "Most played", short: "Played" },
];

export default function SongsTab() {
  const { items } = useStudio();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<string[]>([HIDE_DISLIKED]);
  const [sort, setSort] = useState("newest");

  const toggle = (f: string) => setFilters((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = filters.filter((f) => f in FILTERS);
    const list = items.filter((i): boolean => {
      if (i.kind === "pending") return !q && active.length === 0;
      if (filters.includes(HIDE_DISLIKED) && i.rating === -1 && !filters.includes("disliked")) return false;
      if (active.some((f) => !FILTERS[f].test(i))) return false;
      return !q || [i.title, i.tags, i.lyrics].join(" ").toLowerCase().includes(q);
    });
    const by: Record<string, (a: LibraryItem, b: LibraryItem) => number> = {
      newest: (a, b) => b.created_at - a.created_at,
      oldest: (a, b) => a.created_at - b.created_at,
      liked: (a, b) => rating(b) - rating(a) || b.created_at - a.created_at,
      unliked: (a, b) => rating(a) - rating(b) || b.created_at - a.created_at,
      played: (a, b) => plays(b) - plays(a) || b.created_at - a.created_at,
    };
    return [...list].sort(by[sort]);
  }, [items, query, filters, sort]);

  const count = filters.length;
  const chip = (f: string) => (
    <button
      key={f}
      onClick={() => toggle(f)}
      className={`h-10 shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors ${
        filters.includes(f) ? "border-fg bg-fg text-bg" : "border-[#3a3a3f] hover:bg-hover"
      }`}
    >
      {FILTERS[f].label}
    </button>
  );

  return (
    <>
      <div className="flex items-center gap-2 px-6 py-4">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-surface px-4">
          <Search size={17} className="shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>
        <Dropdown
          icon={<Filter size={14} fill="currentColor" />}
          label={count ? `Filters (${count})` : "Filters"}
          highlight={count > 0}
          multi
          options={[
            ...Object.entries(FILTERS).map(([value, f]) => ({ value, label: f.label })),
            "divider",
            { value: HIDE_DISLIKED, label: "Hide Disliked" },
          ]}
          selected={filters}
          onSelect={toggle}
        />
        <Dropdown
          icon={<ListFilter size={15} />}
          label={SORTS.find((s) => s.value === sort)!.short}
          options={SORTS}
          selected={[sort]}
          onSelect={setSort}
        />
        {chip("liked")}
        {chip("uploads")}
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-4 pb-6">
        {rows.length === 0 && (
          <p className="pt-24 text-center text-sm text-muted">
            {items.length ? "Nothing matches these filters." : "No songs yet."}
          </p>
        )}
        {rows.map((i) =>
          i.kind === "song" ? (
            <SongRow key={i.id} song={i} showPlays />
          ) : (
            <PendingRow key={i.id} id={i.id} title={i.title} model={i.model} error={i.error} />
          ),
        )}
      </div>
    </>
  );
}

const rating = (i: LibraryItem) => (i.kind === "song" ? i.rating : 0);
const plays = (i: LibraryItem) => (i.kind === "song" ? (i.play_count ?? 0) : 0);
