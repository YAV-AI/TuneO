"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  CircleCheck,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Mic,
  Music2,
  Plus,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { useStudio } from "./StudioContext";
import VoicePicker from "./voice/VoicePicker";
import type { Voice } from "./voice/types";
import { clock, useRecorder } from "./voice/useRecorder";
import { Avatar } from "./ProfileDialog";
import { MODEL_OPTIONS, postJson } from "./types";

type Mode = "simple" | "advanced";
type Attachment = { url: string; kind: "audio" | "image"; name: string };

const STYLE_IDEAS = [
  "amapiano",
  "log drums",
  "deep house",
  "afro house",
  "dub",
  "reggae",
  "lo-fi",
  "boom bap",
  "trap",
  "drill",
  "synthwave",
  "city pop",
  "jazz",
  "neo soul",
  "r&b",
  "gospel choir",
  "indie folk",
  "acoustic guitar",
  "piano ballad",
  "cinematic",
  "orchestral",
  "epic melody",
  "dreamy",
  "melancholy",
  "uplifting",
  "dark",
  "warm analog",
  "808 bass",
  "female vocals",
  "male vocals",
  "whispered",
  "anthemic chorus",
  "organ",
  "soft saxophone",
  "kwaito",
  "gqom",
  "bossa nova",
  "punk",
  "shoegaze",
];
const VARIETY = ["Off", "Normal", "High", "Extra", "Max"];

function pickIdeas(n: number) {
  return [...STYLE_IDEAS].sort(() => Math.random() - 0.5).slice(0, n);
}

export default function CreatePanel() {
  const { load: onCreated, preset } = useStudio();
  const [mode, setMode] = useState<Mode>("simple");
  const [model, setModel] = useState("V6");
  const [instrumental, setInstrumental] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [style, setStyle] = useState("");
  const [title, setTitle] = useState("");
  const [negativeTags, setNegativeTags] = useState("");
  const [vocalGender, setVocalGender] = useState<"" | "m" | "f">("");
  const [durationMode, setDurationMode] = useState<"auto" | "custom">("auto");
  const [duration, setDuration] = useState(180);
  const [weirdness, setWeirdness] = useState(0.5);
  const [styleInfluence, setStyleInfluence] = useState(0.5);
  const [variety, setVariety] = useState(1);
  const [touched, setTouched] = useState(false);
  // How strongly a selected voice shapes the vocals (sent as audio_weight).
  const [voiceInfluence, setVoiceInfluence] = useState(0.85);
  const [ideas, setIdeas] = useState<string[]>(() => STYLE_IDEAS.slice(0, 6));
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [voice, setVoice] = useState<Voice | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [open, setOpen] = useState({ lyrics: true, styles: true, more: false });

  const [busy, setBusy] = useState<"" | "create" | "lyrics" | "boost" | "upload" | "rewrite">("");
  // The prompt before the last wand rewrite, so it can be undone.
  const [promptBefore, setPromptBefore] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // "Reuse Prompt" from a song menu fills the Advanced form.
  useEffect(() => {
    if (!preset) return;
    const t = setTimeout(() => {
      setMode("advanced");
      setTitle(preset.title ?? "");
      setStyle(preset.style ?? "");
      setLyrics(preset.lyrics ?? "");
      setInstrumental(!preset.lyrics);
    }, 0);
    return () => clearTimeout(t);
  }, [preset]);

  const audio = attachments.find((a) => a.kind === "audio");
  // An attached recording can be re-sung (cover) or kept as the vocal with music added.
  const [audioMode, setAudioMode] = useState<"cover" | "vocal">("cover");
  const keepVocal = !!audio && mode === "advanced" && audioMode === "vocal";
  const canCreate =
    mode === "simple"
      ? !!(prompt.trim() || attachments.length)
      : !!(style.trim() || lyrics.trim() || negativeTags.trim() || audio);

  async function run<T>(kind: typeof busy, fn: () => Promise<T>) {
    setBusy(kind);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  const create = () =>
    run("create", async () => {
      await postJson("/api/generate", {
        mode,
        model,
        instrumental,
        prompt,
        lyrics,
        style,
        title,
        negativeTags,
        vocalGender,
        // Only send knobs the user changed, so KIE keeps its own defaults otherwise.
        ...(touched ? { weirdness, styleInfluence, variety } : {}),
        ...(durationMode === "custom" ? { duration } : {}),
        audioUrls: attachments.filter((a) => a.kind === "audio").map((a) => a.url),
        audioMode,
        ...(voice && mode === "advanced" ? { voiceId: voice.id, audioWeight: voiceInfluence } : {}),
        imageUrls: mode === "simple" ? attachments.filter((a) => a.kind === "image").map((a) => a.url) : [],
      });
      onCreated();
    });

  const writeLyrics = () =>
    run("lyrics", async () => {
      const body = { idea: prompt, title, style, lyrics };
      type Out = { lyrics: string; title: string; style: string };
      let data: Out;
      try {
        data = await postJson<Out>("/api/lyrics", body);
      } catch (err) {
        // A dropped connection (e.g. the app restarting) shows up as a TypeError: retry once.
        if (!(err instanceof TypeError)) throw err;
        await new Promise((r) => setTimeout(r, 3000));
        try {
          data = await postJson<Out>("/api/lyrics", body);
        } catch (again) {
          if (again instanceof TypeError)
            throw new Error("Lost connection to the app (it may have been restarting). Try again.");
          throw again;
        }
      }
      setLyrics(data.lyrics);
      // Only fill fields you left empty; never overwrite what you typed.
      if (!title.trim() && data.title) setTitle(data.title);
      if (!style.trim() && data.style) setStyle(data.style);
      setInstrumental(false);
    });

  const rewritePrompt = () =>
    run("rewrite", async () => {
      const before = prompt;
      const data = await postJson<{ prompt: string }>("/api/prompt-rewrite", { prompt });
      setPrompt(data.prompt);
      setPromptBefore(before);
    });

  const boost = () =>
    run("boost", async () => {
      const data = await postJson<{ style: string }>("/api/boost-style", { content: style });
      setStyle(data.style);
    });

  const upload = (file: File) =>
    run("upload", async () => {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setAttachments((prev) => [
        // One audio source at a time; up to 5 images.
        ...prev.filter((a) => (data.kind === "audio" ? a.kind !== "audio" : true)).slice(-4),
        { url: data.url, kind: data.kind, name: data.name },
      ]);
    });

  const addTag = (tag: string) => {
    setStyle((s) => (s.trim() ? `${s.trim().replace(/,$/, "")}, ${tag}` : tag));
    setIdeas((list) => list.filter((t) => t !== tag));
  };

  const reset = () => {
    setPrompt("");
    setLyrics("");
    setStyle("");
    setTitle("");
    setNegativeTags("");
    setVocalGender("");
    setDurationMode("auto");
    setWeirdness(0.5);
    setStyleInfluence(0.5);
    setVariety(1);
    setTouched(false);
    setAttachments([]);
    setInstrumental(false);
    setError(null);
  };

  return (
    <section className="flex w-[396px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex px-4">
        <div className="flex-1 border-b-2 border-fg py-3 text-center text-base">Songs</div>
        <div
          aria-disabled
          title="Speech is not available through the API yet"
          className="flex flex-1 cursor-not-allowed items-center justify-center gap-2 border-b border-line py-3 text-base text-dim"
        >
          Speech
          <span className="rounded-full border border-line px-1.5 py-px text-[10px] uppercase tracking-wide">Soon</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex rounded-full bg-surface p-1">
          {(["simple", "advanced"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                if (m === "simple") setVoice(null);
              }}
              className={`h-[30px] rounded-full px-2.5 text-[13px] capitalize ${mode === m ? "bg-hover text-fg" : "text-fg/80 hover:text-fg"}`}
            >
              {m}
            </button>
          ))}
        </div>
        <ModelMenu value={model} onChange={setModel} />
      </div>

      <div className="scroll-thin flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
        <Attachments
          attachments={attachments}
          uploading={busy === "upload"}
          imagesAllowed={mode === "simple"}
          onUpload={upload}
          onRemove={(url) => setAttachments((prev) => prev.filter((a) => a.url !== url))}
          voice={voice}
          onVoice={() => setPickerOpen(true)}
          onClearVoice={() => setVoice(null)}
        />
        {audio && mode === "advanced" && (
          <div className="rounded-2xl bg-surface p-1">
            <div className="grid grid-cols-2 gap-1 text-xs">
              {(
                [
                  ["cover", "Cover it", "Re-sing in a new style"],
                  ["vocal", "Keep my vocal", "Add music around it"],
                ] as const
              ).map(([v, l, hint]) => (
                <button
                  key={v}
                  onClick={() => setAudioMode(v)}
                  className={`rounded-xl px-3 py-2 text-left ${audioMode === v ? "bg-hover text-fg" : "text-soft hover:text-fg"}`}
                >
                  <span className="block text-sm">{l}</span>
                  <span className="block text-dim">{hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {pickerOpen && (
          <VoicePicker
            selectedId={voice?.id ?? null}
            onClose={() => setPickerOpen(false)}
            onSelect={(v) => {
              setVoice(v);
              // Voices apply to custom (Advanced) generations only.
              setMode("advanced");
              setInstrumental(false);
            }}
          />
        )}

        {mode === "simple" ? (
          <div className="rounded-2xl bg-surface p-4">
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setPromptBefore(null);
              }}
              maxLength={3000}
              rows={7}
              placeholder="Whimsical dub song about one-sided love"
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-dim"
            />
            <div className="flex items-center justify-between gap-2">
              <Toggle label="Instrumental" value={instrumental} onChange={setInstrumental} />
              <div className="flex items-center gap-2">
                {promptBefore !== null && busy !== "rewrite" && (
                  <button
                    onClick={() => {
                      setPrompt(promptBefore);
                      setPromptBefore(null);
                    }}
                    className="text-xs text-muted hover:text-fg"
                  >
                    Undo
                  </button>
                )}
                <button
                  onClick={rewritePrompt}
                  disabled={!prompt.trim() || !!busy}
                  title={prompt.trim() ? "Rewrite my prompt with AI" : "Type an idea, then rewrite it with AI"}
                  aria-label="Rewrite my prompt with AI"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2f80ed] text-white transition hover:brightness-110 disabled:cursor-default disabled:opacity-50"
                >
                  {busy === "rewrite" ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {voice && !instrumental && (
              <div className="rounded-2xl bg-surface px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">Voice influence</span>
                  <div className="flex items-center gap-2">
                    <TickSlider value={voiceInfluence} onChange={setVoiceInfluence} />
                    <span className="w-10 text-right text-xs tabular-nums">{Math.round(voiceInfluence * 100)}%</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-dim">
                  Higher sounds more like {voice.name}; lower follows your styles more.
                </p>
              </div>
            )}
            <Card
              title="Lyrics"
              open={open.lyrics}
              onToggle={() => setOpen((o) => ({ ...o, lyrics: !o.lyrics }))}
              actions={
                <IconAction label="Clear lyrics" onClick={() => setLyrics("")} disabled={!lyrics}>
                  <Trash2 size={15} />
                </IconAction>
              }
            >
              <textarea
                value={instrumental ? "" : lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                disabled={instrumental}
                maxLength={5000}
                rows={9}
                placeholder={
                  instrumental
                    ? "Instrumental, no lyrics"
                    : "Start writing lyrics, or leave this empty for instrumental"
                }
                className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-dim"
              />
              <div className="flex items-center justify-between">
                <Toggle label="Instrumental" value={instrumental} onChange={setInstrumental} />
                <button
                  onClick={writeLyrics}
                  disabled={!!busy || instrumental}
                  title="Write lyrics with AI"
                  className="flex h-9 items-center gap-1.5 rounded-full bg-raised px-3 text-xs disabled:opacity-40"
                >
                  {busy === "lyrics" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {lyrics ? "Rewrite" : "Write"}
                </button>
              </div>
            </Card>

            <Card title="Styles" open={open.styles} onToggle={() => setOpen((o) => ({ ...o, styles: !o.styles }))}>
              <textarea
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="subtle, organo, epic melody, soft saxophone, teclado"
                className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-dim"
              />
              <div className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                <button
                  onClick={boost}
                  disabled={!style.trim() || !!busy}
                  title="Enhance styles"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2f80ed] disabled:bg-raised disabled:text-muted"
                >
                  {busy === "boost" ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                </button>
                <button
                  onClick={() => setIdeas(pickIdeas(8))}
                  title="More ideas"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised"
                >
                  <Shuffle size={15} />
                </button>
                {ideas.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => addTag(tag)}
                    className="h-9 shrink-0 rounded-full bg-raised px-4 text-xs hover:bg-hover"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </Card>

            <Card
              title="More Options"
              open={open.more}
              onToggle={() => setOpen((o) => ({ ...o, more: !o.more }))}
              actions={
                open.more && (
                  <IconAction
                    label="Reset options"
                    onClick={() => {
                      setVocalGender("");
                      setDurationMode("auto");
                      setWeirdness(0.5);
                      setStyleInfluence(0.5);
                      setVariety(1);
                      setNegativeTags("");
                      setTouched(false);
                    }}
                  >
                    <Trash2 size={15} />
                  </IconAction>
                )
              }
            >
              <div className="flex flex-col gap-2">
                <Row label="Vocal Gender">
                  <Segmented
                    value={vocalGender}
                    disabled={instrumental}
                    options={[
                      ["m", "Male"],
                      ["f", "Female"],
                    ]}
                    onChange={(v) => setVocalGender((cur) => (cur === v ? "" : (v as "m" | "f")))}
                  />
                </Row>
                <Row label="Duration">
                  <Segmented
                    value={durationMode}
                    options={[
                      ["custom", "Custom"],
                      ["auto", "Auto"],
                    ]}
                    onChange={(v) => setDurationMode(v as "auto" | "custom")}
                  />
                </Row>
                {durationMode === "custom" && (
                  <Row label={formatDuration(duration)}>
                    <TickSlider min={10} max={360} step={5} value={duration} onChange={setDuration} />
                  </Row>
                )}
                <Row label="Weirdness">
                  <TickSlider
                    value={weirdness}
                    onChange={(v) => {
                      setWeirdness(v);
                      setTouched(true);
                    }}
                  />
                  <span className="w-12 text-right text-xs">{Math.round(weirdness * 100)}%</span>
                </Row>
                <Row label="Style Influence">
                  <TickSlider
                    value={styleInfluence}
                    onChange={(v) => {
                      setStyleInfluence(v);
                      setTouched(true);
                    }}
                  />
                  <span className="w-12 text-right text-xs">{Math.round(styleInfluence * 100)}%</span>
                </Row>
                <Row label="Variety">
                  <TickSlider
                    min={0}
                    max={4}
                    step={1}
                    value={variety}
                    onChange={(v) => {
                      setVariety(v);
                      setTouched(true);
                    }}
                  />
                  <span className="w-12 text-right text-xs">{VARIETY[variety]}</span>
                </Row>
                <Row label="Exclude">
                  <input
                    value={negativeTags}
                    onChange={(e) => setNegativeTags(e.target.value)}
                    maxLength={200}
                    placeholder="styles to avoid"
                    className="w-40 bg-transparent text-right text-xs outline-none placeholder:text-dim"
                  />
                </Row>
              </div>
            </Card>

            <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
              <Music2 size={15} className="text-muted" />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="Song Title (Optional)"
                className="w-full bg-transparent text-sm outline-none placeholder:text-dim"
              />
            </div>
          </>
        )}

        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      </div>

      <div className="flex gap-3 px-4 py-4">
        <button
          onClick={reset}
          title="Clear form"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-muted hover:text-fg"
        >
          <Trash2 size={16} />
        </button>
        <button
          onClick={create}
          disabled={!canCreate || !!busy}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-fg text-[15px] font-medium text-bg transition disabled:bg-surface disabled:text-dim"
        >
          {busy === "create" ? <Loader2 size={18} className="animate-spin" /> : <Music2 size={18} />}
          {keepVocal ? "Add Music" : audio && mode === "advanced" ? "Create Cover" : "Create"}
        </button>
      </div>
    </section>
  );
}

function formatDuration(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Attachments({
  attachments,
  uploading,
  imagesAllowed,
  onUpload,
  onRemove,
  voice,
  onVoice,
  onClearVoice,
}: {
  attachments: Attachment[];
  uploading: boolean;
  imagesAllowed: boolean;
  onUpload: (f: File) => void;
  onRemove: (url: string) => void;
  voice: Voice | null;
  onVoice: () => void;
  onClearVoice: () => void;
}) {
  const rec = useRecorder();
  useEffect(() => {
    if (!rec.blob) return;
    onUpload(new File([rec.blob], "recording.webm", { type: rec.blob.type || "audio/webm" }));
    rec.reset();
  }, [rec, onUpload]);
  const audioInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the Audio menu on Escape or a click elsewhere.
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const pick = (input: HTMLInputElement | null) => {
    setMenu(false);
    input?.click();
  };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  };

  return (
    <div ref={menuRef} className="relative flex flex-col gap-2">
      <div className="relative grid grid-cols-3 overflow-hidden rounded-2xl bg-surface text-sm">
        <button
          onClick={() => setMenu((m) => !m)}
          className="flex items-center justify-center gap-1.5 py-3 hover:bg-raised"
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Audio
        </button>
        <button
          onClick={onVoice}
          className="flex items-center justify-center gap-1.5 border-x border-line py-3 hover:bg-raised"
        >
          <Plus size={15} /> Voice
        </button>
        <button
          onClick={() => pick(imageInput.current)}
          disabled={!imagesAllowed}
          title={imagesAllowed ? "Image inspiration" : "Image inspiration works in Simple mode"}
          className="flex items-center justify-center gap-1.5 py-3 hover:bg-raised disabled:text-muted disabled:hover:bg-transparent"
        >
          <Plus size={15} /> Inspo
        </button>
      </div>
      {menu && (
        <div className="absolute left-0 top-[52px] z-30 w-36 rounded-xl border border-line bg-raised p-1 text-sm shadow-xl">
          <button
            onClick={() => pick(audioInput.current)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-hover"
          >
            <Upload size={14} /> Upload
          </button>
          <button
            onClick={() => {
              setMenu(false);
              rec.start();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-hover"
          >
            <Mic size={14} /> Record
          </button>
        </div>
      )}
      <input ref={audioInput} type="file" accept="audio/*" hidden onChange={onChange} />
      <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onChange} />
      {rec.recording && (
        <button
          onClick={rec.stop}
          className="flex w-fit items-center gap-2 rounded-full bg-red-500/15 px-3 py-1.5 text-xs text-red-300"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Recording {clock(rec.seconds)} · Stop
        </button>
      )}
      {rec.error && <p className="text-xs text-red-300">{rec.error}</p>}
      {voice && (
        <span className="flex w-fit items-center gap-2 rounded-full bg-raised py-1 pl-1 pr-1 text-xs">
          {voice.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={voice.image_url} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <Avatar name={voice.name} size={24} />
          )}
          <span className="max-w-48 truncate">Voice: {voice.name}</span>
          <button onClick={onClearVoice} className="rounded-full p-1 hover:bg-hover" aria-label="Remove voice">
            <X size={12} />
          </button>
        </span>
      )}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <span key={a.url} className="flex items-center gap-1.5 rounded-full bg-raised py-1 pl-3 pr-1 text-xs">
              {a.kind === "audio" ? <Music2 size={12} /> : <ImageIcon size={12} />}
              <span className="max-w-40 truncate">{a.name}</span>
              <button onClick={() => onRemove(a.url)} className="rounded-full p-1 hover:bg-hover" aria-label="Remove">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  open,
  onToggle,
  actions,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onToggle} className="flex items-center gap-2 text-sm">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          {title}
        </button>
        {actions}
      </div>
      {open && <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-full p-1.5 text-muted hover:text-fg disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-black/25 px-4 py-2">
      <span className="shrink-0 text-xs">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex gap-1 text-xs ${disabled ? "opacity-40" : ""}`}>
      {options.map(([v, l]) => (
        <button
          key={v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={`rounded-lg px-3 py-1.5 ${value === v ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function TickSlider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="tick-slider w-36"
    />
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-5 w-9 rounded-full bg-raised transition peer-checked:bg-accent after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-muted after:transition peer-checked:after:translate-x-4 peer-checked:after:bg-fg" />
      {label}
    </label>
  );
}

// Model picker: names with a one-line description and a check on the selected one.
function ModelMenu({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = MODEL_OPTIONS.find((o) => o.value === value) ?? MODEL_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-full border border-[#3a3a3f] pl-4 pr-3 text-[13px] font-medium hover:bg-hover"
      >
        {current.label}
        <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-72 overflow-hidden rounded-2xl border border-line bg-bar py-2 shadow-2xl">
          <p className="px-4 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">All models</p>
          {MODEL_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2.5 text-left hover:bg-hover ${o.value === value ? "bg-hover" : ""}`}
            >
              <span className="flex items-center gap-2 text-[15px]">
                {o.label}
                {o.value === value && <CircleCheck size={15} className="fill-fg text-bar" />}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-dim">{o.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
