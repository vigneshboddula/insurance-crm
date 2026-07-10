"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowUpRight } from "lucide-react";

type Item = { text: string; href?: string; tone: "red" | "amber" | "accent" | "green" | "neutral" };
const dot: Record<string, string> = { red: "var(--red)", amber: "var(--amber)", accent: "var(--accent)", green: "var(--emerald)", neutral: "var(--ink-4)" };

export function MorningBriefing({ greeting, items, generatedAt, range = "week" }: { greeting: string; items: Item[]; generatedAt: string; range?: string }) {
  const time = new Date(generatedAt).toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const [shown, setShown] = useState<Item[]>(items);
  const [ai, setAi] = useState(false);

  // Progressive enhancement: if a Claude key is configured, replace the
  // heuristic briefing with an AI-written one. Falls back silently otherwise.
  useEffect(() => {
    let alive = true;
    fetch(`/api/ai/briefing?range=${range}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (alive && Array.isArray(d.items) && d.items.length) { setShown(d.items); setAi(true); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [range]);

  return (
    <section className="card card-hover h-full overflow-hidden" style={{ background: "var(--accent-50)", borderColor: "transparent" }}>
      <div className="flex items-start gap-3 p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent)" }}>
          <Sparkles size={18} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">{greeting}, Vignesh</h2>
            <span className="preview-tag"><Sparkles size={11} /> {ai ? "AI" : "AI preview"}</span>
          </div>
          <p className="text-xs text-ink-3">{time} · here&apos;s what matters today</p>

          <ul className="mt-3 space-y-2">
            {shown.map((it, i) => (
              <li key={i} className="pop-in flex items-start gap-2.5" style={{ animationDelay: `${i * 110}ms` }}>
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot[it.tone] }} />
                {it.href ? (
                  <Link href={it.href} className="group text-sm leading-relaxed text-ink-2 hover:text-ink">
                    {it.text}
                    <ArrowUpRight size={13} className="ml-0.5 inline -translate-y-px text-accent opacity-0 transition group-hover:opacity-100" />
                  </Link>
                ) : (
                  <span className="text-sm leading-relaxed text-ink-2">{it.text}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
