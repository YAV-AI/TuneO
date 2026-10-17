export type Voice = {
  id: string;
  kind: "voice" | "persona";
  name: string;
  description: string | null;
  style: string | null;
  status: "phrase" | "ready_to_verify" | "verifying" | "ready" | "failed";
  phrase: string | null;
  language: string | null;
  source_song_id: string | null;
  image_url: string | null;
  error: string | null;
  favorite: number;
  created_at: number;
  // What the thumbnail play button plays (a stored sample or a section of the source song).
  preview?: { src: string; start: number; end: number | null } | null;
};

export const LANGUAGES: [string, string][] = [
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["pt", "Portuguese"],
  ["de", "German"],
  ["zh", "Chinese"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["hi", "Hindi"],
  ["ru", "Russian"],
];

export const STATUS_LABEL: Record<Voice["status"], string> = {
  phrase: "Preparing",
  ready_to_verify: "Needs your recording",
  verifying: "Processing",
  ready: "Ready",
  failed: "Failed",
};
