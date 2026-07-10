"use client";

import { Printer, Download, TrendingUp, IndianRupee, RefreshCw, UserPlus } from "lucide-react";
import { inr } from "@/lib/format";

type Row = { label: string; newPolicies: number; renewalsSaved: number; premiumSecured: number; estCommission: number; quotes: number; comms: number };

export function ReportsView({ rows, generatedAt }: { rows: Row[]; generatedAt: string }) {
  const current = rows[rows.length - 1];
  const totalPremium = rows.reduce((s, r) => s + r.premiumSecured, 0);
  const totalCommission = rows.reduce((s, r) => s + r.estCommission, 0);
  const max = Math.max(1, ...rows.map((r) => r.premiumSecured));

  const downloadCsv = () => {
    const header = ["Month", "New policies", "Renewals saved", "Premium secured", "Est. commission", "Quotes sent", "Communications"];
    const lines = rows.map((r) => [r.label, r.newPolicies, r.renewalsSaved, r.premiumSecured, r.estCommission, r.quotes, r.comms].join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `crm-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const Stat = ({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone?: string }) => (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-ink-3"><Icon size={13} style={{ color: tone }} /> {label}</div>
      <div className="mt-1 text-2xl font-semibold tnum text-ink">{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Reports</h1>
          <p className="text-xs text-ink-3">Last 6 months · generated {new Date(generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button onClick={downloadCsv} className="btn"><Download size={14} /> CSV</button>
          <button onClick={() => window.print()} className="btn btn-accent"><Printer size={14} /> Print / PDF</button>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-[13px] font-semibold text-ink">This month · {current?.label}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={IndianRupee} label="Premium secured" value={inr(current?.premiumSecured ?? 0)} tone="var(--emerald)" />
          <Stat icon={TrendingUp} label="Est. commission" value={inr(current?.estCommission ?? 0)} tone="var(--emerald)" />
          <Stat icon={RefreshCw} label="Renewals saved" value={String(current?.renewalsSaved ?? 0)} tone="var(--accent)" />
          <Stat icon={UserPlus} label="New policies" value={String(current?.newPolicies ?? 0)} tone="var(--accent)" />
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
          <h2 className="text-[13px] font-semibold text-ink">Month by month</h2>
          <span className="text-[11px] text-ink-3">6-mo premium {inr(totalPremium)} · est. commission {inr(totalCommission)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-ink-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-4 py-2 text-left font-semibold">Month</th>
                <th className="px-3 py-2 text-right font-semibold">New</th>
                <th className="px-3 py-2 text-right font-semibold">Renewed</th>
                <th className="px-3 py-2 text-right font-semibold">Quotes</th>
                <th className="px-3 py-2 text-right font-semibold">Msgs</th>
                <th className="px-4 py-2 text-right font-semibold">Premium secured</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-2 text-ink">{r.label}</td>
                  <td className="px-3 py-2 text-right tnum text-ink-2">{r.newPolicies}</td>
                  <td className="px-3 py-2 text-right tnum text-ink-2">{r.renewalsSaved}</td>
                  <td className="px-3 py-2 text-right tnum text-ink-2">{r.quotes}</td>
                  <td className="px-3 py-2 text-right tnum text-ink-2">{r.comms}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="hidden h-1.5 rounded-full sm:block" style={{ width: `${Math.round((r.premiumSecured / max) * 80)}px`, minWidth: r.premiumSecured ? 4 : 0, background: "var(--emerald)" }} />
                      <span className="tnum font-medium text-ink">{inr(r.premiumSecured)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-ink-4">Commission is estimated from premium by line (term 30%, life 8%, health 15%) — adjust against your actual statements.</p>
    </div>
  );
}
