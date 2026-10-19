// Client-side mirror of LibraryItem from src/lib/songs.ts.
export type Song = {
  kind: "song";
  id: string;
  task_id: string;
  title: string;
  tags: string | null;
  lyrics: string | null;
  model: string | null;
  audio_url: string | null;
  stream_url: string | null;
  image_url: string | null;
  duration: number | null;
  rating: number;
  created_at: number;
  parent_id: string | null;
  origin: string | null;
  extras?: string[];
  play_count?: number;
  deleted_at?: number | null;
};

export type Asset = {
  id: number;
  task_id: string;
  kind: string;
  label: string;
  href: string | null;
  archived: boolean;
  data: string | null;
  created_at: number;
};

export type SongDetail = {
  song: Song;
  parent: Song | null;
  assets: Asset[];
  running: string[];
  failed: { kind: string; error: string | null }[];
};

export type AlignedWord = { word: string; startS: number; endS: number };

// What "Reuse Prompt" copies into the Create panel.
export type CreatePreset = {
  nonce: number;
  title?: string;
  style?: string;
  lyrics?: string;
};

export async function postJson<T = Record<string, unknown>>(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}

export type Pending = {
  kind: "pending";
  id: string;
  title: string;
  model: string;
  created_at: number;
  error: string | null;
};

export type LibraryItem = Song | Pending;

export const MODEL_OPTIONS = [
  { value: "V6", label: "v6", description: "Powerful and refined, with the most natural vocals." },
  { value: "V6_WILD", label: "v6-wild", description: "Best for experimental ideas." },
  { value: "V6_MINI", label: "v6-mini", description: "Lightweight and fast, great for sketching." },
];

export const modelLabel = (m: string | null) =>
  MODEL_OPTIONS.find((o) => o.value === m)?.label ?? (m ?? "").toLowerCase();

export function formatTime(sec: number | null | undefined) {
  if (!sec || !isFinite(sec)) return "0:00";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Download link for a song or one of its files. Including the title means a rename
// produces a new URL, so the browser can never hand back an old, differently named copy.
export function downloadHref(href: string | null | undefined, title: string) {
  if (!href) return undefined;
  if (!href.startsWith("/api/")) return href;
  return `${href}?download=${encodeURIComponent(title)}`;
}

// Reads the duration in the browser (the server has no audio decoder), then uploads.
export function readDuration(file: File) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? audio.duration : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });
}
