"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useStudio } from "./StudioContext";
import { modelLabel } from "./types";

type Usage = {
  spent: number;
  pendingCount: number;
  totals: { kind: string; label: string; count: number; credits: number }[];
  activity: {
    id: string;
    kind: string;
    label: string;
    state: string;
    credits: number | null;
    estimated: boolean;
    created_at: number;
    song_id: string | null;
    subject: string | null;
    model: string | null;
  }[];
};

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));

// Where the credits went: totals per action and every task, from KIE's own charge records.
export default function CreditsView() {
  const { setDetailsId } = useStudio();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, c] = await Promise.all([
        fetch("/api/usage", { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : Promise.reject(new Error("Could not load usage")),
        ),
        fetch("/api/credits", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { credits: null })),
      ]);
      setUsage(u);
      setBalance(c.credits);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, []);

  const rows = useMemo(() => usage?.activity.filter((a) => !kind || a.kind === kind) ?? [], [usage, kind]);
  const max = Math.max(1, ...(usage?.totals.map((t) => t.credits) ?? [1]));
  const filtered = usage?.totals.find((t) => t.kind === kind);

  return (
    <div className="scroll-thin flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-8 pb-24 pt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">Credits</p>
            <h1 className="mt-2 text-[32px] font-medium leading-tight">Where your credits went</h1>
            <p className="mt-2 text-sm text-soft">Every action you have run in TuneO, with what KIE charged for it.</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex h-10 items-center gap-2 rounded-full border border-[#3a3a3f] px-4 text-xs font-medium hover:bg-hover disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {error && <p className="mt-8 text-sm text-red-400">{error}</p>}
        {!usage && !error && <Loader2 className="mx-auto mt-24 animate-spin text-muted" />}

        {usage && (
          <>
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat
                label="Balance"
                value={balance === null ? "..." : fmt(Math.round(balance * 10) / 10)}
                hint="Available on KIE"
              />
              <Stat label="Spent here" value={fmt(usage.spent)} hint="Through TuneO" />
              <Stat label="Actions" value={usage.activity.length.toLocaleString()} hint="Jobs run" />
              <Stat
                label="Average"
                value={usage.activity.length ? fmt(Math.round((usage.spent / usage.activity.length) * 10) / 10) : "0"}
                hint="Credits per action"
              />
            </div>

            <div className="mt-10 grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)]">
              <section>
                <h2 className="mb-3 text-sm font-medium">By action</h2>
                <div className="flex flex-col gap-1.5">
                  {usage.totals.map((t) => (
                    <button
                      key={t.kind}
                      onClick={() => setKind((k) => (k === t.kind ? null : t.kind))}
                      className={`relative overflow-hidden rounded-xl px-4 py-3 text-left text-sm transition-colors ${
                        kind === t.kind ? "bg-white/10" : "bg-surface hover:bg-white/[0.06]"
                      }`}
                    >
                      <span
                        className="absolute inset-y-0 left-0 bg-white/5"
                        style={{ width: `${(t.credits / max) * 100}%` }}
                      />
                      <span className="relative flex items-center justify-between">
                        <span>
                          {t.label} <span className="text-dim">× {t.count}</span>
                        </span>
                        <span className="tabular-nums">{fmt(t.credits)}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-dim">
                  Click an action to filter the activity. Charges come from KIE&apos;s record of each task, so failed
                  jobs show what was actually billed. Synced lyrics show KIE&apos;s listed price. Lyric drafts from the
                  Write button are billed by OpenAI and are not included.
                  {usage.pendingCount > 0 && ` ${usage.pendingCount} charge(s) still loading from KIE.`}
                </p>
              </section>

              <section className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-medium">
                    Activity{" "}
                    {filtered && (
                      <span className="text-dim">
                        · {filtered.label} ({fmt(filtered.credits)} credits)
                      </span>
                    )}
                  </h2>
                  {kind && (
                    <button onClick={() => setKind(null)} className="text-xs text-muted hover:text-fg">
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="overflow-hidden rounded-2xl bg-surface">
                  <div className="grid grid-cols-[120px_minmax(0,1fr)_90px_80px] gap-4 border-b border-line px-4 py-2.5 text-[11px] uppercase tracking-wide text-dim">
                    <span>When</span>
                    <span>Action</span>
                    <span>Status</span>
                    <span className="text-right">Credits</span>
                  </div>
                  {rows.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => a.song_id && setDetailsId(a.song_id)}
                      className={`grid w-full grid-cols-[120px_minmax(0,1fr)_90px_80px] items-center gap-4 border-b border-line/60 px-4 py-3 text-left text-sm last:border-0 ${
                        a.song_id ? "hover:bg-white/[0.03]" : "cursor-default"
                      }`}
                    >
                      <span className="text-xs tabular-nums text-muted">
                        {new Date(a.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          {a.label}
                          {a.model && (
                            <span className="font-mono text-[10px] uppercase text-muted">{modelLabel(a.model)}</span>
                          )}
                        </span>
                        {a.subject && <span className="block truncate text-xs text-dim">{a.subject}</span>}
                      </span>
                      <span className="text-xs">
                        {a.state === "success" ? (
                          <span className="text-soft">Done</span>
                        ) : a.state === "fail" ? (
                          <span className="text-red-400">Failed</span>
                        ) : (
                          <span className="text-muted">Running</span>
                        )}
                      </span>
                      <span className="text-right tabular-nums">
                        {a.credits === null ? <span className="text-dim">...</span> : fmt(a.credits)}
                        {a.estimated && <span className="block text-[10px] text-dim">est.</span>}
                      </span>
                    </button>
                  ))}
                  {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No activity yet.</p>}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-surface px-5 py-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-[28px] font-medium tabular-nums leading-tight">{value}</div>
      <div className="mt-0.5 text-[11px] text-dim">{hint}</div>
    </div>
  );
}
