"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  label:    string;
  className?: string;
}

interface Pos { top: number; left: number; width: number }

export default function Select({ value, onChange, options, label, className }: Props) {
  const [open, setOpen] = useState(false);
  const [hi,   setHi]   = useState(-1);
  const [pos,  setPos]  = useState<Pos>({ top: 0, left: 0, width: 160 });
  const [mounted, setMounted] = useState(false);

  const btnRef  = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // createPortal requires the DOM — only enable after hydration.
  useEffect(() => { setMounted(true); }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !listRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Close on scroll / resize (position would be stale)
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close, { passive: true });
    return () => {
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function handleToggle() {
    if (!open && btnRef.current) {
      // Calculate position before setting open so both updates land in the
      // same React render — avoids a two-render flash or invisible dropdown.
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 160) });
    }
    setOpen(o => !o);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) handleToggle();
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
        handleToggle();
      }
    }
  }

  const selected = options.find(o => o.value === value);
  const active   = value !== "";

  const dropdown = open && mounted && createPortal(
    <ul
      ref={listRef}
      role="listbox"
      style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
      className="z-[9999] max-h-72 overflow-auto rounded-md border border-border bg-surface-2 py-1 shadow-xl shadow-black/50 pop-in"
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
    </ul>,
    document.body
  );

  return (
    <>
      <div className={clsx("relative", className)}>
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
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
      </div>
      {dropdown}
    </>
  );
}
