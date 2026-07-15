"use client";

import Link from "next/link";
import { Stethoscope } from "lucide-react";
import type { DataHealth } from "@/lib/book-health";

/** Data health — the gaps that silently break automation at scale. Each tile
 *  links to the screen where the gap is fixed. Green = clean. */
export function DataHealthPanel({ h }: { h: DataHealth }) {
  const tiles: { label: string; value: number; href: string; hint: string }[] = [
    { label: "No phone", value: h.noPhone, href: "/contacts?filter=no_phone", hint: "reminders can't reach them" },
    { label: "No email", value: h.noEmail, href: "/contacts?filter=no_email", hint: "fill via Contacts Excel" },
    { label: "Notice missing (due ≤45d)", value: h.dueSoonNoNotice, href: "/renewals", hint: "upload on Renewals" },
    { label: "No policy copy", value: h.noPolicyCopy, href: "/policies", hint: "upload on Policies" },
    { label: "Sum insured = 0", value: h.zeroSumInsured, href: "/policies?view=all", hint: "edit the policy" },
    { label: "Premium = 0", value: h.zeroPremium, href: "/policies?view=all", hint: "edit the policy" },
    { label: "No insured members", value: h.noMembers, href: "/policies?view=all", hint: "re-scan the policy copy" },
    { label: "Type not set", value: h.noPolicyType, href: "/policies?view=all", hint: "individual / floater" },
    { label: "Docs awaiting match", value: h.reviewQueue, href: "/policies", hint: "re-upload to file them" },
  ];

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Stethoscope size={15} className="text-ink-3" /> Data health</h2>
        <span className="text-[11px] text-ink-3">{h.clients} active clients</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => {
          const clean = t.value === 0;
          return (
            <Link key={t.label} href={t.href} className="rounded-xl p-3 transition hover:bg-surface-3" style={{ background: "var(--surface-2)" }} title={t.hint}>
              <div className="text-xl font-semibold tnum" style={{ color: clean ? "var(--emerald-700)" : "var(--amber-700)" }}>{t.value}</div>
              <div className="mt-0.5 text-[11px] leading-tight text-ink-3">{t.label}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
