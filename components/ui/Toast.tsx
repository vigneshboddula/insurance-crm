"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Undo2, X, CheckCircle2 } from "lucide-react";

// Lightweight toast system with optional Undo. Deletes across the app are
// "optimistic + undoable": the row is removed immediately and a 6-second
// toast offers to bring it back (restore actions recreate the record).

type ToastItem = {
  id: number;
  text: string;
  tone: "default" | "success" | "danger";
  undo?: () => void | Promise<void>;
};

type PushOpts = { undo?: () => void | Promise<void>; tone?: ToastItem["tone"]; duration?: number };
const ToastCtx = createContext<{ toast: (text: string, opts?: PushOpts) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("ToastProvider is missing");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((list) => list.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((text: string, opts: PushOpts = {}) => {
    const id = nextId.current++;
    setItems((list) => [...list.slice(-2), { id, text, tone: opts.tone ?? "default", undo: opts.undo }]);
    timers.current.set(id, setTimeout(() => dismiss(id), opts.duration ?? (opts.undo ? 6000 : 3500)));
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className="pop-in pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-2.5 text-sm text-white shadow-lg"
            style={{ background: t.tone === "danger" ? "var(--red)" : "#26241f" }}
          >
            {t.tone === "success" && <CheckCircle2 size={15} className="shrink-0" style={{ color: "var(--emerald)" }} />}
            <span className="min-w-0 flex-1">{t.text}</span>
            {t.undo && (
              <button
                onClick={async () => { dismiss(t.id); await t.undo!(); }}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-white/10"
                style={{ color: "#a5b4fc" }}
              >
                <Undo2 size={13} /> Undo
              </button>
            )}
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 rounded p-1 opacity-60 transition hover:opacity-100"><X size={13} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
