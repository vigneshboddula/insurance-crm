"use client";

import Link from "next/link";
import { inr } from "@/lib/format";

type Chip = { key: string; label: string; count: number | null; money?: number; href: string };

export function QuickFilters({ chips }: { chips: Chip[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <Link key={c.key} href={c.href} className="group flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 transition hover:border-accent hover:bg-surface-2" style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }}>
          <span className="text-sm font-semibold tnum text-ink">{c.money != null ? inr(c.money) : c.count}</span>
          <span className="text-[12px] text-ink-3 group-hover:text-ink-2">{c.label}</span>
        </Link>
      ))}
    </div>
  );
}
