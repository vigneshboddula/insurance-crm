"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const OPTIONS: { key: string; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

export function TimeFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("range") ?? "week";
  const [pending, startTransition] = useTransition();

  const set = (key: string) => {
    startTransition(() => router.push(key === "week" ? "/" : `/?range=${key}`, { scroll: false }));
  };

  return (
    <div className="inline-flex items-center rounded-xl p-0.5" style={{ background: "var(--surface-3)", opacity: pending ? 0.7 : 1 }}>
      {OPTIONS.map((o) => {
        const active = current === o.key;
        return (
          <button
            key={o.key}
            onClick={() => set(o.key)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition"
            style={active ? { background: "var(--surface)", color: "var(--ink)", boxShadow: "var(--shadow-sm)" } : { color: "var(--ink-3)" }}
            aria-pressed={active}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
