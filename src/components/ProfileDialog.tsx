"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "./Modal";
import { useStudio } from "./StudioContext";

// Global artist name: shown in the player, song details and as the music video signature.
export default function ProfileDialog() {
  const { artistName, setArtistName, setProfileOpen, notify } = useStudio();
  const [name, setName] = useState(artistName);
  const [busy, setBusy] = useState(false);
  const close = () => setProfileOpen(false);

  const save = async () => {
    setBusy(true);
    try {
      await setArtistName(name);
      notify(name.trim() ? `Artist name set to ${name.trim()}` : "Artist name cleared");
      close();
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Your artist name" subtitle="Credited on every song you make here" onClose={close}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
          <Avatar name={name} size={44} />
          <input
            autoFocus
            value={name}
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="e.g. Bombay Shadow"
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-dim"
          />
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-full bg-fg py-3 text-sm font-medium text-bg disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          Save
        </button>
      </div>
    </Modal>
  );
}

// Gradient orb avatar, tinted from the name.
export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  let hash = 0;
  for (const ch of name || "tuneo") hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const h1 = hash % 360;
  const h2 = (h1 + 70) % 360;
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, hsl(${h1} 90% 75%), hsl(${h2} 80% 45%) 70%)`,
      }}
    />
  );
}
