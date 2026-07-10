"use client";

import { useState } from "react";
import { waLink } from "@/lib/links";
import { AlertTriangle, Clock, X, MessageCircle } from "lucide-react";

type Alert = { id: string; severity: "high" | "medium"; title: string; detail: string; phone?: string; clientId?: string };

export function AlertsStrip({ alerts }: { alerts: Alert[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = alerts.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((a) => {
        const high = a.severity === "high";
        const Icon = high ? AlertTriangle : Clock;
        const c = high ? { bg: "var(--red-50)", fg: "var(--red-700)", ic: "var(--red)" } : { bg: "var(--amber-50)", fg: "var(--amber-700)", ic: "var(--amber)" };
        return (
          <div key={a.id} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5" style={{ background: c.bg }}>
            <Icon size={17} style={{ color: c.ic, flexShrink: 0 }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium" style={{ color: c.fg }}>{a.title}</div>
              <div className="truncate text-[11px]" style={{ color: c.fg, opacity: 0.85 }}>{a.detail}</div>
            </div>
            {a.phone && (
              <a href={waLink(a.phone)} target="_blank" rel="noopener" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "var(--emerald)" }} aria-label="Send WhatsApp">
                <MessageCircle size={13} />
              </a>
            )}
            <button onClick={() => setDismissed((d) => [...d, a.id])} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ color: c.fg }} aria-label="Dismiss alert">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
