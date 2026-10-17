"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string; hint?: string; image?: string | null };

// Styled dropdown used everywhere instead of the browser's native select.
export default function Select({
  value,
  options,
  onChange,
  label,
  variant = "pill",
  placement = "down",
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  label?: string;
  // pill: compact rounded button; field: full-width form field
  variant?: "pill" | "field";
  placement?: "down" | "up";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc, true);
    };
  }, [open]);

  // Keep the selected option in view when the list opens.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) listRef.current?.querySelector("[aria-selected=true]")?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const button =
    variant === "field"
      ? "flex w-full items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 text-left text-sm hover:bg-hover"
      : "flex h-11 items-center gap-2 rounded-full border border-[#3a3a3f] pl-4 pr-3 text-sm hover:bg-hover";

  return (
    <div ref={ref} className={`relative ${variant === "field" ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={button}
      >
        <span className="flex min-w-0 items-center gap-3">
          {current?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.image} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
          )}
          <span className="truncate">{current?.label ?? "Select"}</span>
        </span>
        <ChevronDown size={15} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className={`scroll-thin absolute z-50 max-h-72 min-w-full overflow-y-auto rounded-2xl border border-line bg-bar py-1.5 shadow-2xl ${
            placement === "up" ? "bottom-full mb-2" : "top-full mt-2"
          } ${variant === "field" ? "left-0 right-0" : "left-0 w-52"}`}
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 px-3.5 py-2 text-left text-sm hover:bg-hover ${selected ? "bg-hover" : ""}`}
              >
                {o.image !== undefined && (
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-raised">
                    {o.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.image} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-xs text-dim">{o.hint}</span>}
                </span>
                {selected && <Check size={15} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
