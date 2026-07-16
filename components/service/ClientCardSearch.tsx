"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Phone, Search, User, FileText, Clock } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import type { ClientCard } from "@/lib/service";

export function ClientCardSearch() {
  const [phone, setPhone] = useState("");
  const [card, setCard] = useState<ClientCard | null>(null);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    if (phone.replace(/\D/g, "").length < 10) return;
    setSearched(false);
    startTransition(async () => {
      const res = await fetch(`/api/client-card?phone=${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data = await res.json();
        setCard(data);
      } else {
        setCard(null);
      }
      setSearched(true);
    });
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3.5 pb-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <Phone size={15} className="text-ink-3" /> Instant client card
        </h2>
        <span className="text-[11px] text-ink-3">Search by phone — pull up everything in seconds</span>
      </div>

      <div className="px-4 pb-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Enter phone number…"
              className="w-full rounded-lg border py-2 pl-8 pr-3 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            />
          </div>
          <button onClick={handleSearch} disabled={isPending} className="btn btn-sm">{isPending ? "Searching…" : "Look up"}</button>
        </div>
      </div>

      {searched && !card && (
        <div className="border-t px-4 py-4 text-center text-sm text-ink-3" style={{ borderColor: "var(--border)" }}>
          No client found with that phone number.
        </div>
      )}

      {card && (
        <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "var(--border)" }}>
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--accent-50)", color: "var(--accent-700)" }}>
              <User size={18} />
            </div>
            <div className="flex-1">
              <Link href={`/clients/${card.id}`} className="text-base font-semibold text-ink hover:text-indigo-600 transition">{card.name}</Link>
              <div className="text-[11px] text-ink-3">{card.phone} {card.email ? `· ${card.email}` : ""}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tnum text-ink">{inr(card.totalPremium)}</div>
              <div className="text-[10px] text-ink-3">{card.activePolicies.length} active {card.activePolicies.length === 1 ? "policy" : "policies"}</div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            {card.upcomingRenewal && (
              <div className="rounded-lg p-2" style={{ background: card.upcomingRenewal.daysUntil < 0 ? "var(--red-50)" : card.upcomingRenewal.daysUntil <= 14 ? "var(--amber-50)" : "var(--surface-2)" }}>
                <div className="text-[10px] text-ink-3">Next renewal</div>
                <div className="text-xs font-medium tnum" style={{ color: card.upcomingRenewal.daysUntil < 0 ? "var(--red)" : card.upcomingRenewal.daysUntil <= 14 ? "var(--amber-700)" : undefined }}>
                  {card.upcomingRenewal.daysUntil < 0 ? `${Math.abs(card.upcomingRenewal.daysUntil)}d overdue` : `${card.upcomingRenewal.daysUntil}d away`}
                </div>
              </div>
            )}
            <div className="rounded-lg p-2" style={{ background: card.openClaims > 0 ? "var(--amber-50)" : "var(--surface-2)" }}>
              <div className="text-[10px] text-ink-3">Open claims</div>
              <div className="text-xs font-medium tnum">{card.openClaims}</div>
            </div>
            <div className="rounded-lg p-2" style={{ background: card.pendingEndorsements > 0 ? "var(--amber-50)" : "var(--surface-2)" }}>
              <div className="text-[10px] text-ink-3">Pending requests</div>
              <div className="text-xs font-medium tnum">{card.pendingEndorsements}</div>
            </div>
          </div>

          {/* Policy list */}
          <div className="space-y-1">
            {card.activePolicies.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2 transition">
                <FileText size={13} className="text-ink-3 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-ink">{p.carrier} · {p.planName || p.line}</div>
                  <div className="truncate text-[10px] text-ink-3 tnum">{p.policyNumber}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs tnum">{inr(p.premium)}</div>
                </div>
              </div>
            ))}
          </div>

          {card.lastContact && (
            <div className="text-[11px] text-ink-3 flex items-center gap-1">
              <Clock size={11} /> Last contact: {fmtDate(card.lastContact)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
