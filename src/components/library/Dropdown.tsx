"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type Option = { value: string; label: string };

// Pill dropdown. `multi` keeps the menu open and toggles values.
export default function Dropdown({
  icon,
  label,
  options,
  selected,
  onSelect,
  multi,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  options: (Option | "divider")[];
  selected: string[];
  onSelect: (value: string) => void;
  multi?: boolean;
  highlight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
          highlight ? "bg-fg text-bg" : "bg-surface text-fg hover:bg-hover"
        }`}
      >
        {icon}
        {label}
        <ChevronDown size={15} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-30 w-48 rounded-xl border border-line bg-bar py-1 text-sm shadow-2xl">
          {options.map((o, i) =>
            o === "divider" ? (
              <div key={i} className="my-1 border-t border-line" />
            ) : (
              <button
                key={o.value}
                onClick={() => {
                  onSelect(o.value);
                  if (!multi) setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-hover"
              >
                {o.label}
                {selected.includes(o.value) && <Check size={14} />}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
