"use client";

import { useState } from "react";
import { CountUp, Bar } from "./primitives";
import { inr } from "@/lib/format";
import { waLink } from "@/lib/links";
import { ShieldAlert, ChevronDown, MessageCircle } from "lucide-react";

type Item = { id: string; clientId: string; name: string; phone: string; line: string; carrier: string; premium: number; days: number };

export function MoneyAtRisk({ premiumAtRisk, commissionAtRisk, count, overdueCount, level, items }: {
  premiumAtRisk: number; commissionAtRisk: number; count: number; overdueCount: number;
  level: "calm" | "warn" | "urgent"; items: Item[];
}) {
  const [open, setOpen] = useState(false);
  const tone = level === "urgent" ? { c: "var(--red)", bg: "var(--red-50)", t: "var(--red-700)", label: "Act now" } : level === "warn" ? { c: "var(--amber)", bg: "var(--amber-50)", t: "var(--amber-700)", label: "Watch" } : { c: "var(--emerald)", bg: "var(--emerald-50)", t: "var(--emerald-700)", label: "Under control" };
  const meterPct = Math.min(100, (premiumAtRisk / 100000) * 100);

  return (
    <section className="card card-hover h-full" style={{ background: tone.bg, borderColor: "transparent" }}>
      <div className="flex items-center justify-between px-5 pb-1 pt-3.5">
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} style={{ color: tone.c }} />
          <h2 className="text-[13px] font-semibold" style={{ color: tone.t }}>Money at risk</h2>
        </div>
        <span className="pill" style={{ background: tone.c, color: "#fff" }}>{tone.label}</span>
      </div>
      <div className="px-5 pb-4">
        <div className="flex items-end gap-5 pt-1">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: tone.t }}>Premium</div>
            <div className="text-[30px] font-semibold leading-tight" style={{ color: tone.c }}>
              <CountUp value={premiumAtRisk} format={inr} />
            </div>
          </div>
          <div className="pb-1">
            <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: tone.t }}>Commission</div>
            <div className="text-lg font-semibold" style={{ color: tone.c }}><CountUp value={commissionAtRisk} format={inr} /></div>
          </div>
        </div>
        <div className="mt-3"><Bar pct={meterPct} color={tone.c} height={9} /></div>
        <div className="mt-1.5 text-xs" style={{ color: tone.t }}>
          {count} renewal{count !== 1 ? "s" : ""} exposed · {overdueCount} already overdue
        </div>

        <button onClick={() => setOpen((o) => !o)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium" style={{ color: tone.t }}>
          {open ? "Hide" : "Show"} the list <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>

        {open && (
          <div className="mt-2 space-y-1.5 pop-in">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{it.name}</div>
                  <div className="truncate text-[11px] text-ink-3">{it.carrier} · {it.line.toUpperCase()} · {inr(it.premium)}</div>
                </div>
                <div className="flex items-center gap-2 pl-2">
                  <span className="pill" style={{ background: it.days < 0 ? "var(--red-50)" : "var(--amber-50)", color: it.days < 0 ? "var(--red-700)" : "var(--amber-700)" }}>
                    {it.days < 0 ? `${Math.abs(it.days)}d over` : `in ${it.days}d`}
                  </span>
                  <a href={waLink(it.phone, `Hi ${it.name}, a quick reminder that your ${it.carrier} policy renewal is due. Shall I help you renew it?`)} target="_blank" rel="noopener" className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: "var(--emerald)" }} aria-label={`WhatsApp ${it.name}`}>
                    <MessageCircle size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
