"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// When one dialog replaces another (e.g. Voice picker -> Create a Voice), keep the backdrop
// steady instead of fading it out and in again, which reads as a flash.
// React renders the new dialog before the old one unmounts, so a dialog still open at
// render time means "swap"; the timestamp covers swaps that close first.
let openDialogs = 0;
let lastClosedAt = 0;
const SWAP_WINDOW_MS = 250;

export default function Modal({
  title,
  subtitle,
  badge,
  onClose,
  children,
  wide,
  xl,
  align = "center",
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  xl?: boolean;
  align?: "center" | "left";
}) {
  const [swapped] = useState(() => openDialogs > 0 || Date.now() - lastClosedAt < SWAP_WINDOW_MS);
  useEffect(() => {
    openDialogs++;
    return () => {
      openDialogs--;
      lastClosedAt = Date.now();
    };
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const width = xl ? "max-w-[800px]" : wide ? "max-w-[460px]" : "max-w-sm";

  return (
    <div
      className={`${swapped ? "" : "backdrop-in "}fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4`}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={`${swapped ? "swap-in" : "modal-in"} scroll-thin relative max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-bar p-6 shadow-2xl ${width}`}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-raised text-muted hover:text-fg"
        >
          <X size={15} />
        </button>
        <h2 className={`flex items-center gap-2 pr-10 text-xl ${align === "center" ? "justify-center pl-10" : ""}`}>
          {title}
          {badge && (
            <span className="rounded-md border border-accent/70 px-1.5 text-[11px] font-medium text-accent">
              {badge}
            </span>
          )}
        </h2>
        {subtitle && <p className={`mt-1 text-sm text-muted ${align === "center" ? "text-center" : ""}`}>{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
