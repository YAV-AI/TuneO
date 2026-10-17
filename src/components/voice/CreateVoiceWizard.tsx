"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AudioWaveform,
  Check,
  Library,
  Loader2,
  Mic,
  MicOff,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Square,
  Upload,
} from "lucide-react";
import Modal from "../Modal";
import Select from "../Select";
import { useStudio } from "../StudioContext";
import { formatTime, type Song } from "../types";
import { LANGUAGES, type Voice } from "./types";
import { clock, useRecorder } from "./useRecorder";

type Source = { kind: "file"; file: Blob; name: string; url: string } | { kind: "song"; song: Song; url: string };
type Step = "source" | "library" | "trim" | "phrase" | "details" | "processing";

const SKILLS = ["beginner", "intermediate", "advanced", "professional"] as const;

// "Create a Voice" flow, mapped onto KIE: sample -> phrase -> sing it back -> verify.
export default function CreateVoiceWizard({
  resume,
  onClose,
  onBack,
  onDone,
}: {
  resume: Voice | null;
  onClose: () => void;
  onBack: () => void;
  onDone: (v: Voice) => void;
}) {
  const [step, setStep] = useState<Step>(resume ? "phrase" : "source");
  const [source, setSource] = useState<Source | null>(null);
  const [voice, setVoice] = useState<Voice | null>(resume);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const verifyRec = useRecorder();

  // Poll the voice while KIE prepares the phrase or verifies the recording.
  const waiting = voice && (voice.status === "phrase" || voice.status === "verifying");
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/voices/${voice!.id}`, { cache: "no-store" });
      if (res.ok) setVoice((await res.json()).voice);
    }, 3000);
    return () => clearInterval(t);
  }, [waiting, voice]);

  const back = () => {
    setError(null);
    if (step === "source" || (step === "phrase" && resume)) return onBack();
    if (step === "library" || step === "trim") return setStep("source");
    if (step === "details") return setStep("phrase");
  };

  const title = step === "processing" ? "Creating your voice" : "Create a Voice";

  return (
    <Modal title={title} badge="Beta" onClose={onClose} xl>
      {step !== "processing" && (
        <button
          onClick={back}
          className="absolute left-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg"
          aria-label="Back"
        >
          <ArrowLeft size={17} />
        </button>
      )}
      {error && <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      {step === "source" && (
        <SourceStep
          onFile={(file, name) => {
            setSource({ kind: "file", file, name, url: URL.createObjectURL(file) });
            setStep("trim");
          }}
          onLibrary={() => setStep("library")}
        />
      )}

      {step === "library" && (
        <LibraryStep
          onPick={(song) => {
            setSource({ kind: "song", song, url: song.audio_url! });
            setStep("trim");
          }}
        />
      )}

      {step === "trim" && source && (
        <TrimStep
          source={source}
          busy={busy}
          onSubmit={async (start, end, language) => {
            setBusy(true);
            setError(null);
            try {
              const form = new FormData();
              form.set("start", String(start));
              form.set("end", String(end));
              form.set("language", language);
              if (source.kind === "song") form.set("songId", source.song.id);
              else form.set("file", source.file, source.name);
              const res = await fetch("/api/voices", { method: "POST", body: form });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? "Could not start the voice");
              const v = await fetch(`/api/voices/${data.id}`).then((r) => r.json());
              setVoice(v.voice);
              setStep("phrase");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {step === "phrase" && voice && (
        <PhraseStep
          voice={voice}
          rec={verifyRec}
          onRegenerate={async () => {
            verifyRec.reset();
            const res = await fetch(`/api/voices/${voice.id}?action=regenerate`, { method: "POST" });
            const data = await res.json();
            if (res.ok) setVoice(data.voice);
            else setError(data.error);
          }}
          onNext={() => setStep("details")}
        />
      )}

      {step === "details" && voice && (
        <DetailsStep
          busy={busy}
          onSubmit={async (d) => {
            if (!verifyRec.blob) return;
            setBusy(true);
            setError(null);
            try {
              const form = new FormData();
              form.set("file", verifyRec.blob, "verify.webm");
              Object.entries(d).forEach(([k, v]) => form.set(k, v));
              const res = await fetch(`/api/voices/${voice.id}?action=verify`, { method: "POST", body: form });
              const data = await res.json();
              if (!res.ok) {
                // The phrase changed or the session expired: reload the voice and go back a step.
                const fresh = await fetch(`/api/voices/${voice.id}`).then((r) => r.json());
                setVoice(fresh.voice);
                verifyRec.reset();
                setStep(fresh.voice?.status === "failed" ? "processing" : "phrase");
                throw new Error(data.error ?? "Could not create the voice");
              }
              setVoice(data.voice);
              setStep("processing");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {step === "processing" && voice && (
        <ProcessingStep
          voice={voice}
          onUse={() => onDone(voice)}
          onRetry={() => {
            verifyRec.reset();
            setVoice(null);
            setSource(null);
            setError(null);
            setStep("source");
          }}
        />
      )}
    </Modal>
  );
}

function SourceStep({ onFile, onLibrary }: { onFile: (f: Blob, name: string) => void; onLibrary: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const rec = useRecorder();
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (rec.blob) onFile(rec.blob, "recording.webm");
  }, [rec.blob, onFile]);

  const tips = [
    { icon: Music2, title: "Sing in the style and language you want", body: "Pop, Rock, Rap or whatever you like." },
    { icon: Mic, title: "A good microphone helps", body: "Your built-in mic works just fine, too." },
    { icon: MicOff, title: "Pick a quiet spot", body: "No roommates, no traffic, no barking dogs." },
    {
      icon: AudioWaveform,
      title: "Record at least 10 seconds",
      body: "Record or upload a recording of at least 10 seconds of your voice.",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f?.type.startsWith("audio/")) onFile(f, f.name);
        }}
        className={`voice-glow voice-glow-strong flex min-h-[380px] flex-col items-center justify-center rounded-2xl px-6 text-center ${
          drag ? "ring-2 ring-accent" : ""
        }`}
      >
        {rec.recording ? (
          <>
            <span className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500/30" />
              <span className="h-5 w-5 rounded-full bg-red-500" />
            </span>
            <p className="mt-4 font-mono text-2xl tabular-nums">{clock(rec.seconds)}</p>
            <p className="mt-1 text-sm text-soft">Sing for at least 10 seconds</p>
            <button
              onClick={rec.stop}
              className="mt-6 flex h-11 items-center gap-2 rounded-full bg-fg px-6 text-sm font-medium text-bg"
            >
              <Square size={14} fill="currentColor" /> Stop
            </button>
          </>
        ) : (
          <>
            <h3 className="text-lg font-medium">Add your voice to the mix.</h3>
            <p className="mt-1 max-w-sm text-sm text-soft">
              Record or upload a sample and we&apos;ll use this content to influence how your generated songs sound.
            </p>
            <p className="mt-6 text-xs text-muted">Drag an audio file here.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              <button
                onClick={rec.start}
                className="flex h-12 items-center gap-2 rounded-xl bg-raised px-6 text-sm hover:bg-hover"
              >
                <span className="h-4 w-4 rounded-full bg-[#ff4b2b]" /> Record
              </button>
              <button
                onClick={() => input.current?.click()}
                className="flex h-12 items-center gap-2 rounded-xl bg-raised px-6 text-sm hover:bg-hover"
              >
                <Upload size={17} /> Upload Audio
              </button>
              <button
                onClick={onLibrary}
                className="flex h-12 items-center gap-2 rounded-xl bg-raised px-6 text-sm hover:bg-hover"
              >
                <Library size={17} /> Select from library
              </button>
            </div>
            {rec.error && <p className="mt-4 text-sm text-red-300">{rec.error}</p>}
          </>
        )}
        <input
          ref={input}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f, f.name);
            e.target.value = "";
          }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {tips.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex items-center gap-4 rounded-2xl border border-line px-5 py-4">
            <Icon size={20} className="shrink-0" />
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-soft">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LibraryStep({ onPick }: { onPick: (s: Song) => void }) {
  const { songs } = useStudio();
  const list = songs.filter((s) => s.audio_url);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-soft">Pick a song with a clear vocal. You will choose the section next.</p>
      <div className="scroll-thin -mx-1 flex max-h-[460px] flex-col overflow-y-auto px-1">
        {list.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            className="flex items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-hover"
          >
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-raised">
              {s.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image_url} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{s.title}</span>
              <span className="block truncate text-xs text-dim">{s.tags}</span>
            </span>
            <span className="font-mono text-xs text-muted">{formatTime(s.duration)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TrimStep({
  source,
  busy,
  onSubmit,
}: {
  source: Source;
  busy: boolean;
  onSubmit: (start: number, end: number, language: string) => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(source.kind === "song" ? (source.song.duration ?? 0) : 0);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(20);
  const [language, setLanguage] = useState("en");
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);

  const maxLen = Math.max(10, Math.min(30, Math.floor(duration)));
  const len = Math.min(length, maxLen);
  const end = Math.min(duration, start + len);
  const tooShort = duration > 0 && duration < 10;

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.currentTime = start;
      el.play();
      setPlaying(true);
    }
  };

  const bars = useMemo(
    () => Array.from({ length: 64 }, (_, i) => 30 + Math.abs(Math.sin(i * 1.7) * 55) + ((i * 37) % 15)),
    [],
  );

  return (
    <div className="flex flex-col gap-5">
      <audio
        ref={audio}
        src={source.url}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (Number.isFinite(el.duration)) setDuration(el.duration);
          // Browser recordings (webm) report an unknown length until the end is seeked; force it.
          else el.currentTime = 1e7;
        }}
        onDurationChange={(e) => {
          const el = e.currentTarget;
          if (Number.isFinite(el.duration) && el.duration > 0) {
            setDuration(el.duration);
            if (el.currentTime > el.duration - 0.1) el.currentTime = 0;
          }
        }}
        onTimeUpdate={(e) => {
          setNow(e.currentTarget.currentTime);
          if (e.currentTarget.currentTime >= end) {
            e.currentTarget.pause();
            setPlaying(false);
          }
        }}
      />
      <div>
        <p className="text-sm font-medium">{source.kind === "song" ? source.song.title : source.name}</p>
        <p className="text-xs text-soft">Choose 10 to 30 seconds where your voice is clear.</p>
      </div>

      <div className="voice-glow relative flex h-28 items-center gap-[3px] overflow-hidden rounded-2xl px-4">
        {bars.map((h, i) => {
          const t = (i / bars.length) * (duration || 1);
          const inside = t >= start && t <= end;
          return (
            <span
              key={i}
              className={`flex-1 rounded-full ${inside ? (t <= now && playing ? "bg-accent" : "bg-fg") : "bg-white/20"}`}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-xs text-muted">
          Start at {clock(start)}
          <input
            type="range"
            min={0}
            max={Math.max(0, Math.floor(duration - len))}
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            className="tick-slider w-full"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs text-muted">
          Length {len}s ({clock(start)} to {clock(end)})
          <input
            type="range"
            min={10}
            max={maxLen}
            value={len}
            onChange={(e) => setLength(Number(e.target.value))}
            className="tick-slider w-full"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="flex h-11 items-center gap-2 rounded-full bg-raised px-5 text-sm hover:bg-hover"
          >
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />} Preview section
          </button>
          <Select
            value={language}
            onChange={setLanguage}
            label="Language of the phrase"
            placement="up"
            options={LANGUAGES.map(([value, label]) => ({ value, label }))}
          />
        </div>
        <button
          onClick={() => onSubmit(start, Math.round(end), language)}
          disabled={busy || tooShort || duration === 0}
          className="flex h-11 items-center gap-2 rounded-full bg-fg px-6 text-sm font-medium text-bg disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Continue
        </button>
      </div>
      {tooShort && <p className="text-sm text-red-300">This sample is shorter than 10 seconds. Record a longer one.</p>}
    </div>
  );
}

function PhraseStep({
  voice,
  rec,
  onRegenerate,
  onNext,
}: {
  voice: Voice;
  rec: ReturnType<typeof useRecorder>;
  onRegenerate: () => void;
  onNext: () => void;
}) {
  if (voice.status === "failed") {
    return (
      <p className="py-16 text-center text-sm text-red-300">{voice.error ?? "We could not analyse that sample."}</p>
    );
  }
  if (!voice.phrase) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Loader2 className="animate-spin text-muted" />
        <p className="mt-4 text-sm text-soft">Listening to your sample and writing a phrase for you to sing...</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div>
        <p className="text-sm text-soft">Sing this phrase in your own voice</p>
        <p className="mt-1 text-xs text-dim">This confirms the voice is yours. Singing works better than speaking.</p>
      </div>
      <blockquote className="voice-glow max-w-xl rounded-2xl px-8 py-8 text-2xl font-medium leading-snug">
        &ldquo;{voice.phrase}&rdquo;
      </blockquote>

      {rec.recording ? (
        <button
          onClick={rec.stop}
          className="flex h-12 items-center gap-3 rounded-full bg-fg px-6 text-sm font-medium text-bg"
        >
          <Square size={14} fill="currentColor" /> Stop · {clock(rec.seconds)}
        </button>
      ) : rec.url ? (
        <div className="flex flex-col items-center gap-3">
          <audio src={rec.url} controls className="h-10" />
          <div className="flex gap-2">
            <button
              onClick={rec.start}
              className="flex h-11 items-center gap-2 rounded-full bg-raised px-5 text-sm hover:bg-hover"
            >
              <RefreshCw size={14} /> Record again
            </button>
            <button
              onClick={onNext}
              className="flex h-11 items-center gap-2 rounded-full bg-fg px-6 text-sm font-medium text-bg"
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={rec.start}
          className="flex h-12 items-center gap-3 rounded-full bg-raised px-6 text-sm hover:bg-hover"
        >
          <span className="h-4 w-4 rounded-full bg-[#ff4b2b]" /> Record phrase
        </button>
      )}
      {rec.error && <p className="text-sm text-red-300">{rec.error}</p>}
      <button onClick={onRegenerate} className="text-xs text-muted hover:text-fg">
        Get a different phrase
      </button>
    </div>
  );
}

function DetailsStep({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (d: { name: string; description: string; style: string; skill: string }) => void;
}) {
  const [name, setName] = useState("My Voice");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("");
  const [skill, setSkill] = useState<string>("beginner");
  const field = "w-full rounded-xl bg-surface px-4 py-3 text-sm outline-none placeholder:text-dim";
  const submit = useCallback(
    () => onSubmit({ name, description, style, skill }),
    [onSubmit, name, description, style, skill],
  );

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-xs text-muted">
        Voice name
        <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-muted">
        Description
        <textarea
          rows={3}
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Warm, breathy tenor with a soulful edge"
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-muted">
        Style
        <input
          value={style}
          maxLength={200}
          onChange={(e) => setStyle(e.target.value)}
          placeholder="R&B, neo soul"
          className={field}
        />
      </label>
      <div className="flex flex-col gap-1.5 text-xs text-muted">
        Singing level
        <div className="grid grid-cols-4 gap-1 rounded-full bg-surface p-1">
          {SKILLS.map((s) => (
            <button
              key={s}
              onClick={() => setSkill(s)}
              className={`rounded-full py-2 text-xs capitalize ${skill === s ? "bg-hover text-fg" : "text-soft hover:text-fg"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={submit}
        disabled={busy || !name.trim()}
        className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-fg text-sm font-medium text-bg disabled:opacity-50"
      >
        {busy && <Loader2 size={15} className="animate-spin" />} Create Voice
      </button>
      <p className="text-center text-xs text-dim">Creating a voice is free.</p>
    </div>
  );
}

function ProcessingStep({ voice, onUse, onRetry }: { voice: Voice; onUse: () => void; onRetry: () => void }) {
  if (voice.status === "ready") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-fg text-bg">
          <Check size={26} />
        </span>
        <p className="text-lg font-medium">{voice.name} is ready</p>
        <button onClick={onUse} className="h-11 rounded-full bg-fg px-6 text-sm font-medium text-bg">
          Use this voice
        </button>
      </div>
    );
  }
  if (voice.status === "failed") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="max-w-md text-sm leading-relaxed text-red-300">
          {voice.error ?? "The recording did not pass verification."}
        </p>
        <button onClick={onRetry} className="h-11 rounded-full bg-fg px-6 text-sm font-medium text-bg">
          Start over
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="voice-glow voice-glow-strong flex h-24 w-24 animate-pulse items-center justify-center rounded-full">
        <AudioWaveform size={30} />
      </div>
      <p className="mt-6 text-sm text-soft">
        Verifying your recording and building your voice. This usually takes about a minute.
      </p>
      <p className="mt-1 text-xs text-dim">You can close this; the voice will show as Processing in your list.</p>
    </div>
  );
}
