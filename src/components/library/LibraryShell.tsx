"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { useStudio } from "../StudioContext";

const TABS = [
  { href: "/library", label: "Songs" },
  { href: "/library/art", label: "Cover Art" },
  { href: "/library/history", label: "History" },
];

// Library frame: big title, + Audio and Trash on the right, tab row underneath.
export default function LibraryShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const trash = pathname === "/library/trash";

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 px-6 pt-4">
        <div className="flex items-center gap-3">
          {trash && (
            <Link
              href="/library"
              aria-label="Back to Library"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-fg"
            >
              <ArrowLeft size={18} />
            </Link>
          )}
          <h1 className="text-[28px] font-bold leading-[48px]">{trash ? "Trash" : "Library"}</h1>
        </div>
        {!trash && (
          <div className="flex items-center gap-2">
            <UploadButton />
            <Link
              href="/library/trash"
              aria-label="Trash"
              title="Trash"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#3a3a3f] text-soft hover:bg-hover hover:text-fg"
            >
              <Trash2 size={15} />
            </Link>
          </div>
        )}
      </header>

      {!trash && (
        <nav className="mx-6 mt-3 flex gap-1 border-b border-line">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`-mb-px border-b-2 px-2.5 pb-3 pt-1 text-sm font-medium transition-colors ${
                  active ? "border-fg text-fg" : "border-transparent text-soft hover:text-fg"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}

      {children}
    </div>
  );
}

// Reads the duration in the browser (the server has no audio decoder), then uploads.
function readDuration(file: File) {
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

function UploadButton() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { load, notify } = useStudio();
  const router = useRouter();

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const duration = await readDuration(file);
      if (duration) form.set("duration", String(duration));
      const res = await fetch("/api/songs/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      await load();
      notify(`Uploaded '${file.name}'. Cover, extend or split it from its menu.`);
      router.push("/library");
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => input.current?.click()}
        disabled={busy}
        className="flex h-10 items-center gap-2 rounded-full border border-[#3a3a3f] px-4 text-xs font-medium hover:bg-hover disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Audio
      </button>
      <input
        ref={input}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
