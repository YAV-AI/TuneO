"use client";

import { useState } from "react";
import { Check, Download, Loader2 } from "lucide-react";
import Modal from "./Modal";
import { useSongDetail } from "./useSongDetail";
import { downloadHref, formatTime, MODEL_OPTIONS, postJson, type Asset, type Song } from "./types";

type DialogProps = { song: Song; onClose: () => void; onStarted: () => void };

function useSubmit(song: Song, onStarted: () => void, onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/songs/${song.id}/actions`, body);
      onStarted();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

const input = "w-full rounded-xl bg-raised px-3 py-2 text-sm outline-none placeholder:text-dim";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}

function ModelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 rounded-full bg-raised p-1 text-xs">
      {MODEL_OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-full py-1.5 ${value === o.value ? "bg-hover text-fg" : "text-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Submit({
  busy,
  error,
  label,
  onClick,
}: {
  busy: boolean;
  error: string | null;
  label: string;
  onClick: () => void;
}) {
  return (
    <>
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      <button
        onClick={onClick}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-fg py-3 font-medium text-bg disabled:opacity-50"
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        {label}
      </button>
    </>
  );
}

export function ExtendDialog({ song, onClose, onStarted }: DialogProps) {
  const { busy, error, submit } = useSubmit(song, onStarted, onClose);
  const total = song.duration ?? 0;
  const [at, setAt] = useState(Math.max(1, Math.floor(total)));
  const [style, setStyle] = useState(song.tags ?? "");
  const [lyrics, setLyrics] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [model, setModel] = useState(song.model ?? "V6");

  return (
    <Modal title={`Extend '${song.title}'`} subtitle="Continue the song from a point you choose" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        {total > 0 && (
          <Field label={`Extend from ${formatTime(at)} of ${formatTime(total)}`}>
            <input
              type="range"
              min={1}
              max={Math.max(1, Math.floor(total) - 1)}
              value={at}
              onChange={(e) => setAt(Number(e.target.value))}
              className="tick-slider w-full"
            />
          </Field>
        )}
        <Field label="Lyrics for the new part">
          <textarea
            rows={5}
            value={instrumental ? "" : lyrics}
            disabled={instrumental}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder={instrumental ? "Instrumental" : "[Verse 3]\n..."}
            className={input}
          />
        </Field>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} />
          Instrumental
        </label>
        <Field label="Styles">
          <textarea rows={2} value={style} onChange={(e) => setStyle(e.target.value)} className={input} />
        </Field>
        <ModelPicker value={model} onChange={setModel} />
        <Submit
          busy={busy}
          error={error}
          label="Extend"
          onClick={() =>
            submit({
              action: "extend",
              model,
              style,
              lyrics,
              instrumental,
              ...(total > 0 && at < total - 1 ? { continueAt: at } : {}),
            })
          }
        />
      </div>
    </Modal>
  );
}

export function CoverDialog({ song, onClose, onStarted }: DialogProps) {
  const { busy, error, submit } = useSubmit(song, onStarted, onClose);
  const [style, setStyle] = useState("");
  const [lyrics, setLyrics] = useState(song.lyrics ?? "");
  const [instrumental, setInstrumental] = useState(false);
  const [model, setModel] = useState(song.model ?? "V6");

  return (
    <Modal title={`Cover '${song.title}'`} subtitle="Reimagine this song in a new style" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <Field label="New styles">
          <textarea
            rows={2}
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="acoustic folk, female vocals, warm"
            className={input}
          />
        </Field>
        <Field label="Lyrics (prefilled from the original)">
          <textarea
            rows={6}
            value={instrumental ? "" : lyrics}
            disabled={instrumental}
            onChange={(e) => setLyrics(e.target.value)}
            className={input}
          />
        </Field>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} />
          Instrumental
        </label>
        <ModelPicker value={model} onChange={setModel} />
        <Submit
          busy={busy}
          error={error}
          label="Create Cover"
          onClick={() => submit({ action: "cover", model, style, lyrics, instrumental })}
        />
      </div>
    </Modal>
  );
}

// Keeps this song's audio as the vocal, exactly as recorded, and builds music around it.
export function AddInstrumentalDialog({ song, onClose, onStarted }: DialogProps) {
  const { busy, error, submit } = useSubmit(song, onStarted, onClose);
  const [style, setStyle] = useState("");
  const [negative, setNegative] = useState("");
  const [title, setTitle] = useState(song.title);
  const [model, setModel] = useState(song.model ?? "V6");

  return (
    <Modal
      title="Add Instrumental"
      subtitle="Your vocal stays exactly as recorded; music is built around it"
      onClose={onClose}
      wide
    >
      <div className="flex flex-col gap-4">
        <Field label="Music style">
          <textarea
            rows={3}
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="warm acoustic guitar, soft piano, brushed drums, 90 BPM"
            className={input}
          />
        </Field>
        <Field label="Avoid (optional)">
          <input
            value={negative}
            onChange={(e) => setNegative(e.target.value)}
            placeholder="heavy distortion"
            className={input}
          />
        </Field>
        <Field label="Title">
          <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={input} />
        </Field>
        <ModelPicker value={model} onChange={setModel} />
        <Submit
          busy={busy}
          error={error}
          label="Add Music"
          onClick={() => submit({ action: "addInstrumental", style, negativeTags: negative, title, model })}
        />
        <p className="text-center text-xs text-dim">12 credits. Works best with a clean, dry vocal.</p>
      </div>
    </Modal>
  );
}

export function ReplaceDialog({ song, onClose, onStarted }: DialogProps) {
  const { busy, error, submit } = useSubmit(song, onStarted, onClose);
  const total = Math.floor(song.duration ?? 0);
  const [start, setStart] = useState(Math.min(30, Math.max(0, total - 20)));
  const [length, setLength] = useState(15);
  const [section, setSection] = useState("");
  const [full, setFull] = useState(song.lyrics ?? "");
  const maxLen = Math.max(10, Math.floor(total / 2));
  const end = Math.min(total, start + length);

  return (
    <Modal title="Replace Section" subtitle={`Regenerate part of '${song.title}'`} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <Field label={`Start at ${formatTime(start)}`}>
          <input
            type="range"
            min={0}
            max={Math.max(0, total - 10)}
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            className="tick-slider w-full"
          />
        </Field>
        <Field label={`Length ${length}s (${formatTime(start)} to ${formatTime(end)})`}>
          <input
            type="range"
            min={10}
            max={maxLen}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="tick-slider w-full"
          />
        </Field>
        <Field label="New lyrics for this section">
          <textarea rows={4} value={section} onChange={(e) => setSection(e.target.value)} className={input} />
        </Field>
        <Field label="Full lyrics after the change">
          <textarea rows={6} value={full} onChange={(e) => setFull(e.target.value)} className={input} />
        </Field>
        <Submit
          busy={busy}
          error={error}
          label="Replace"
          onClick={() => submit({ action: "replace", start, end, sectionLyrics: section, lyrics: full })}
        />
      </div>
    </Modal>
  );
}

const STEM_ORDER = [
  "vocal",
  "instrumental",
  "backing_vocals",
  "drums",
  "bass",
  "guitar",
  "keyboard",
  "synth",
  "strings",
  "brass",
  "woodwinds",
  "percussion",
  "fx",
];

export function DownloadDialog({ song, onClose }: { song: Song; onClose: () => void }) {
  const { detail, reload } = useSongDetail(song.id);
  const [error, setError] = useState<string | null>(null);
  const assets = detail?.assets ?? [];
  const running = new Set(detail?.running ?? []);
  const latest = (kind: string) => {
    const list = assets.filter((a) => a.kind === kind);
    const task = list.at(-1)?.task_id;
    return list.filter((a) => a.task_id === task);
  };

  const start = async (action: string) => {
    setError(null);
    try {
      await postJson(`/api/songs/${song.id}/actions`, { action });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const mp3 = downloadHref(song.audio_url, song.title) ?? null;
  const wav = latest("wav")[0];
  const video =
    latest("video").find((a) => /video|mp4/i.test(a.label) || a.href?.includes(".mp4")) ?? latest("video")[0];
  const stems = latest("stems").sort((a, b) => rank(a.label) - rank(b.label));

  return (
    <Modal title="Download" subtitle={`'${song.title}'`} onClose={onClose}>
      <div className="flex flex-col gap-2">
        <Option label="MP3" href={mp3} />
        {song.task_id !== "upload" && (
          <>
            <Option
              title={song.title}
              label="WAV"
              note="0.4 credits"
              asset={wav}
              running={running.has("wav")}
              onCreate={() => start("wav")}
            />
            <Option
              title={song.title}
              label="MP4 video"
              note="2 credits"
              asset={video}
              running={running.has("video")}
              onCreate={() => start("video")}
            />
          </>
        )}
        <Option
          label="Stems"
          note="10 credits"
          asset={stems[0]}
          hideLink
          running={running.has("stems")}
          onCreate={() => start("stems")}
        />
        {stems.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pl-2">
            {stems.map((s) => (
              <a
                key={s.id}
                href={dl(s, song.title)}
                className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-xs capitalize hover:bg-raised"
              >
                {s.label.replace(/_/g, " ")}
                <Download size={12} />
              </a>
            ))}
          </div>
        )}
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      </div>
    </Modal>
  );
}

function rank(label: string) {
  const i = STEM_ORDER.indexOf(label);
  return i === -1 ? 99 : i;
}

const dl = (a: Asset, title = "") => downloadHref(a.href, `${title} ${a.label}`) ?? "#";

function Option({
  label,
  note,
  href,
  asset,
  running,
  hideLink,
  onCreate,
  title,
}: {
  title?: string;
  label: string;
  note?: string;
  href?: string | null;
  asset?: Asset;
  running?: boolean;
  hideLink?: boolean;
  onCreate?: () => void;
}) {
  const link = href ?? (asset && !hideLink ? dl(asset, title) : null);
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-sm">
      <span>{label}</span>
      {link ? (
        <a href={link} className="flex items-center gap-1.5 rounded-full bg-fg px-3 py-1 text-xs text-bg">
          <Download size={12} /> Download
        </a>
      ) : asset ? (
        <Check size={16} className="text-muted" />
      ) : running ? (
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Loader2 size={13} className="animate-spin" /> Preparing
        </span>
      ) : onCreate ? (
        <button onClick={onCreate} className="rounded-full bg-raised px-3 py-1 text-xs hover:bg-hover">
          Create {note && <span className="text-muted">· {note}</span>}
        </button>
      ) : (
        <span className="text-xs text-muted">Not ready</span>
      )}
    </div>
  );
}
