"use client";

import { useState } from "react";

export type TabDef = { id: string; label: string; icon?: React.ReactNode; badge?: number; content: React.ReactNode };

export function HolderTabs({ tabs, initial }: { tabs: TabDef[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0].id);
  const cur = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div className="flex flex-nowrap gap-1 overflow-x-auto rounded-xl p-1" style={{ background: "var(--surface-3)" }}>
        {tabs.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              aria-selected={on}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition"
              style={on ? { background: "var(--surface)", color: "var(--ink)", boxShadow: "var(--shadow-sm)" } : { color: "var(--ink-3)" }}
            >
              {t.icon}
              {t.label}
              {t.badge ? <span className="rounded-full px-1.5 text-[10px] font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>{t.badge}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-4">{cur.content}</div>
    </div>
  );
}
