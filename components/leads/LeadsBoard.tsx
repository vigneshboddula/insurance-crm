"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search, Target, MessageCircle, ChevronRight, UserPlus, Clock } from "lucide-react";
import { inr } from "@/lib/format";
import { labelOf, LEAD_STAGES, LEAD_SOURCES, LEAD_INTERESTS } from "@/lib/enums";
import { waLink } from "@/lib/links";
import { LeadDialog, type EditableLead } from "./LeadDialog";
import { setLeadStage, deleteLead, restoreLead, convertLead } from "@/app/leads/actions";
import { useToast } from "@/components/ui/Toast";

type Lead = { id: string; name: string; phone: string | null; source: string; stage: string; interest: string | null; expectedPremium: number | null; notes: string | null; clientId: string | null; updatedAt: string; quotedAt: string | null };

const FLOW = ["new", "contacted", "quoted", "won"]; // forward pipeline order
const TONE: Record<string, string> = { new: "var(--ink-3)", contacted: "var(--accent-700)", quoted: "var(--amber-700)", won: "var(--emerald-700)", lost: "var(--red-700)" };
// weighted-pipeline probabilities + how many days idle before a lead is "stale"
const PROB: Record<string, number> = { new: 0.1, contacted: 0.3, quoted: 0.6 };
const STALE_DAYS: Record<string, number> = { new: 7, contacted: 5, quoted: 4 };
const QUOTE_TOUCHPOINTS = [2, 5, 10];
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export function LeadsBoard({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EditableLead>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return leads;
    return leads.filter((l) => [l.name, l.phone ?? "", l.interest ?? "", l.source].some((f) => f.toLowerCase().includes(t)));
  }, [q, leads]);

  const open = leads.filter((l) => !["won", "lost"].includes(l.stage));
  const pipelineValue = open.reduce((s, l) => s + (l.expectedPremium ?? 0), 0);
  const weightedValue = open.reduce((s, l) => s + (l.expectedPremium ?? 0) * (PROB[l.stage] ?? 0), 0);

  const { toast } = useToast();
  const move = (id: string, stage: string) => start(async () => { await setLeadStage(id, stage); router.refresh(); });
  const advance = (l: Lead) => { const i = FLOW.indexOf(l.stage); if (i >= 0 && i < FLOW.length - 1) move(l.id, FLOW[i + 1]); };
  const remove = (l: Lead) =>
    start(async () => {
      const snap = await deleteLead(l.id);
      router.refresh();
      if (snap) toast(`Deleted lead "${l.name}"`, { undo: async () => { await restoreLead(snap); router.refresh(); } });
    });
  const [armWin, setArmWin] = useState<string | null>(null);
  const win = (l: Lead) => {
    if (armWin !== l.id) { setArmWin(l.id); setTimeout(() => setArmWin((v) => (v === l.id ? null : v)), 3500); return; }
    setArmWin(null);
    start(async () => { await convertLead(l.id); });
  };

  const Card = ({ l }: { l: Lead }) => {
    const canAdvance = FLOW.indexOf(l.stage) >= 0 && FLOW.indexOf(l.stage) < FLOW.length - 1;
    return (
      <div className="group rounded-xl border bg-surface p-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-ink">{l.name}</div>
            {l.phone && <div className="truncate text-[11px] text-ink-3 tnum">{l.phone}</div>}
          </div>
          {l.expectedPremium ? <span className="shrink-0 text-xs font-semibold tnum" style={{ color: "var(--emerald-700)" }}>{inr(l.expectedPremium)}</span> : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {l.interest && <span className="pill-gray pill">{labelOf(LEAD_INTERESTS, l.interest)}</span>}
          <span className="pill-gray pill">{labelOf(LEAD_SOURCES, l.source)}</span>
        </div>
        {(() => {
          if (l.stage === "quoted" && l.quotedAt) {
            const qd = daysSince(l.quotedAt);
            const next = QUOTE_TOUCHPOINTS.find((t) => t > qd);
            return <div className="mt-1.5 text-[10px] font-medium" style={{ color: "var(--amber-700)" }}>Quoted {qd}d ago{next ? ` · day-${next} nudge next` : " · follow-ups done"}</div>;
          }
          const idle = daysSince(l.updatedAt);
          if (idle >= (STALE_DAYS[l.stage] ?? 99)) return <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--red-700)" }}><Clock size={10} /> {idle}d idle — nudge them</div>;
          return null;
        })()}
        <div className="mt-2 flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          {l.phone && <a href={waLink(l.phone, `Hi ${l.name}, this is Vignesh — following up on the insurance cover you were interested in. Happy to share a quick quote.`)} target="_blank" rel="noopener" className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-2" aria-label="WhatsApp"><MessageCircle size={13} style={{ color: "var(--emerald)" }} /></a>}
          {canAdvance && <button onClick={() => advance(l)} className="flex h-7 items-center gap-0.5 rounded-lg px-1.5 text-[11px] hover:bg-surface-2" title="Move to next stage"><ChevronRight size={13} className="text-ink-2" /> {labelOf(LEAD_STAGES, FLOW[FLOW.indexOf(l.stage) + 1])}</button>}
          {(l.stage === "quoted" || l.stage === "won") && !l.clientId && (
            armWin === l.id ? (
              <button onClick={() => win(l)} className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-white" style={{ background: "var(--accent)" }}><UserPlus size={12} /> Make holder?</button>
            ) : (
              <button onClick={() => win(l)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-2" title="Convert to policy holder"><UserPlus size={13} style={{ color: "var(--accent-700)" }} /></button>
            )
          )}
          <button onClick={() => setEditing(l)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-2" aria-label="Edit"><Pencil size={13} className="text-ink-2" /></button>
          <button onClick={() => remove(l)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-2" aria-label="Delete"><Trash2 size={13} style={{ color: "var(--red)" }} /></button>
          {l.stage !== "lost" && l.stage !== "won" && <button onClick={() => move(l.id, "lost")} className="ml-auto text-[11px] text-ink-4 hover:text-ink-2" title="Mark lost">Lost</button>}
        </div>
      </div>
    );
  };

  const Column = ({ stage }: { stage: { value: string; label: string } }) => {
    const items = filtered.filter((l) => l.stage === stage.value);
    const val = items.reduce((s, l) => s + (l.expectedPremium ?? 0), 0);
    const stale = items.filter((l) => l.stage !== "quoted" && daysSince(l.updatedAt) >= (STALE_DAYS[l.stage] ?? 99)).length;
    return (
      <section className="flex min-w-[220px] flex-1 flex-col gap-2 rounded-2xl p-2.5" style={{ background: "var(--surface-2)" }}>
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[13px] font-semibold" style={{ color: TONE[stage.value] }}>{stage.label} <span className="text-ink-4">({items.length})</span>{stale > 0 && <span className="ml-1 text-[10px]" style={{ color: "var(--red-700)" }} title={`${stale} idle`}>· {stale}⏱</span>}</h2>
          {val > 0 && <span className="text-[11px] text-ink-3 tnum">{inr(val)}</span>}
        </div>
        <div className="space-y-2">
          {items.length === 0 ? <p className="px-1 py-3 text-center text-[11px] text-ink-4">—</p> : items.map((l) => <Card key={l.id} l={l} />)}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Leads</h1>
          <p className="text-xs text-ink-3">{open.length} open · {inr(pipelineValue)} pipeline · <span title="Expected premium weighted by stage win-probability">{inr(weightedValue)} weighted</span></p>
        </div>
        <button onClick={() => setAdding(true)} className="btn btn-accent"><Plus size={15} /> Add lead</button>
      </div>

      {leads.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Target size={28} className="text-ink-4" />
          <p className="mt-2 text-sm font-medium text-ink">No leads yet.</p>
          <button onClick={() => setAdding(true)} className="btn btn-accent mt-3"><Plus size={15} /> Add your first lead</button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search leads by name, phone, interest…" className="w-full rounded-xl border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }} />
          </div>
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:overflow-x-auto">
            {LEAD_STAGES.map((s) => <Column key={s.value} stage={s} />)}
          </div>
        </>
      )}

      <LeadDialog open={adding} onClose={() => setAdding(false)} />
      <LeadDialog open={!!editing} onClose={() => setEditing(null)} lead={editing} />
    </div>
  );
}
