import { db } from "./db";

export type Settings = { artistName: string };

const DEFAULTS: Settings = { artistName: "" };

export function getSettings(): Settings {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULTS, ...stored };
}

export function saveSettings(patch: Partial<Settings>) {
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  for (const [k, v] of Object.entries(patch)) {
    if (k in DEFAULTS && typeof v === "string") upsert.run(k, v);
  }
  return getSettings();
}
