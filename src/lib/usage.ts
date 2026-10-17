import { db } from "./db";

export const ACTION_LABELS: Record<string, string> = {
  generate: "Create",
  cover: "Cover",
  extend: "Extend",
  uploadExtend: "Extend upload",
  addInstrumental: "Add music to vocal",
  replace: "Replace section",
  stems: "Stems",
  video: "Music video",
  wav: "WAV",
  art: "Cover art",
  timestamps: "Synced lyrics",
  boost: "Style boost",
};

type Row = {
  id: string;
  kind: string;
  state: string;
  params: string;
  credits: number | null;
  estimated: number;
  created_at: number;
  song_id: string | null;
  source_title: string | null;
  result_title: string | null;
};

export function usageReport(limit = 200) {
  const rows = db
    .prepare(
      `SELECT t.id, t.kind, t.state, t.params, t.credits, t.estimated, t.created_at, t.song_id,
              src.title AS source_title,
              (SELECT title FROM songs r WHERE r.task_id = t.id LIMIT 1) AS result_title
       FROM tasks t LEFT JOIN songs src ON src.id = t.song_id
       ORDER BY t.created_at DESC`,
    )
    .all() as Row[];

  const totals = new Map<string, { kind: string; label: string; count: number; credits: number }>();
  let spent = 0;
  let unknown = 0;
  for (const r of rows) {
    const t = totals.get(r.kind) ?? { kind: r.kind, label: ACTION_LABELS[r.kind] ?? r.kind, count: 0, credits: 0 };
    t.count++;
    t.credits += r.credits ?? 0;
    totals.set(r.kind, t);
    spent += r.credits ?? 0;
    if (r.credits === null && r.state !== "fail") unknown++;
  }

  const activity = rows.slice(0, limit).map((r) => {
    const p = JSON.parse(r.params) as Record<string, unknown>;
    // Name the song the action produced or acted on; fall back to what was typed.
    const text = (v: unknown) => (typeof v === "string" ? v.slice(0, 60) : "");
    const subject = r.result_title || r.source_title || text(p.title) || text(p.prompt) || text(p.content);
    return {
      id: r.id,
      kind: r.kind,
      label: ACTION_LABELS[r.kind] ?? r.kind,
      state: r.state,
      credits: r.credits,
      estimated: !!r.estimated,
      created_at: r.created_at,
      song_id: r.song_id,
      subject: subject || null,
      model: typeof p.model === "string" ? p.model : null,
    };
  });

  return {
    spent: Math.round(spent * 100) / 100,
    pendingCount: unknown,
    totals: [...totals.values()].sort((a, b) => b.credits - a.credits),
    activity,
  };
}
