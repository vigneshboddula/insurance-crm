"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function Dialog({ open, onClose, title, subtitle, children, wide }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(20,19,16,0.4)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 1rem 1rem", overflowY: "auto" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="pop-in"
        style={{ width: wide ? "min(720px,100%)" : "min(520px,100%)", background: "var(--surface)", borderRadius: 18, boxShadow: "var(--shadow-lg)", border: "0.5px solid var(--border-2)" }}
        role="dialog"
        aria-label={title}
      >
        <div className="flex items-start justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-3" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
