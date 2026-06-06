"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import clsx from "clsx";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value:    string;
  onChange: (v: string) => void;
  options:  SelectOption[];
  /** Shown when value is "" (the unset / "All" state). */
  label:    string;
  className?: string;
}

export default function Select({ value, onChange, options, label, className }: Props) {
  const [open, setOpen] = useState(false);
  const [hi, setHi]     = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = options.find(o => o.value === value);
  const active   = value !== "";

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHi(h => Math.min(options.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi(h => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && hi >= 0) {
        onChange(options[hi].value);
        setOpen(false);
      } else {
        setOpen(true);
      }
    }
  }

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={clsx(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm transition-colors",
          active
            ? "border-accent/40 bg-accent/[0.08] text-text"
            : "border-border bg-surface-2 text-text-dim hover:border-border-strong hover:text-text",
          open && "border-accent/50 ring-1 ring-accent/30"
        )}
      >
        <span className="truncate">{selected ? selected.label : label}</span>
        <ChevronDown
          className={clsx(
            "h-3.5 w-3.5 flex-shrink-0 text-muted transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-72 w-full min-w-[10rem] overflow-auto rounded-md border border-border bg-surface-2 py-1 shadow-xl shadow-black/40"
        >
          {options.map((o, i) => (
            <li
              key={o.value || "__all"}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setHi(i)}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={clsx(
                "flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm",
                i === hi ? "bg-accent/10 text-text" : "text-text-dim",
                o.value === value && "!text-accent"
              )}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
