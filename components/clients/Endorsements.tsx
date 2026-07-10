"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileEdit, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea, SubmitButton } from "@/components/ui/form";
import { fmtDate } from "@/lib/format";
import { labelOf, ENDORSEMENT_TYPES, ENDORSEMENT_STATUS } from "@/lib/enums";
import { createEndorsement, setEndorsementStatus, deleteEndorsement } from "@/app/clients/endorsement-actions";

type PolicyOpt = { id: string; label: string };
type Endo = { id: string; policyId: string; type: string; description: string | null; status: string; referenceNo: string | null; requestedAt: string; resolvedAt: string | null };

const STATUS_TONE: Record<string, string> = { requested: "gray", submitted: "accent", approved: "green", rejected: "red" };

export function Endorsements({ clientId, policies, endorsements }: { clientId: string; policies: PolicyOpt[]; endorsements: Endo[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();
  const polLabel = (id: string) => policies.find((p) => p.id === id)?.label ?? "—";

  return (
    <section className="card">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><FileEdit size={15} className="text-ink-3" /> Endorsements <span className="text-ink-3">({endorsements.length})</span></h2>
        <button onClick={() => setAdding(true)} disabled={policies.length === 0} className="inline-flex items-center gap-1 text-xs font-medium text-accent-700 disabled:opacity-40"><Plus size={13} /> Add endorsement</button>
      </div>
      <div className="px-3 pb-3">
        {endorsements.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-3">{policies.length === 0 ? "Add a policy first." : "No endorsements yet. Log a mid-term change (address, nominee, sum insured…)."}</p>
        ) : (
          <ul className="space-y-1">
            {endorsements.map((e) => (
              <li key={e.id} className="rounded-xl px-2 py-2.5 hover:bg-surface-2">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{labelOf(ENDORSEMENT_TYPES, e.type)}{e.description ? <span className="font-normal text-ink-2"> — {e.description}</span> : null}</div>
                    <div className="truncate text-[11px] text-ink-3">{polLabel(e.policyId)} · requested {fmtDate(e.requestedAt)}{e.referenceNo ? ` · ref ${e.referenceNo}` : ""}</div>
                  </div>
                  <select
                    value={e.status}
                    onChange={(ev) => start(() => setEndorsementStatus(e.id, ev.target.value, clientId).then(() => router.refresh()))}
                    className={`pill pill-${STATUS_TONE[e.status] ?? "gray"} cursor-pointer border-0`}
                    style={{ appearance: "none" }}
                  >
                    {ENDORSEMENT_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <button onClick={() => start(() => deleteEndorsement(e.id, clientId).then(() => router.refresh()))} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-3" aria-label="Delete"><Trash2 size={13} style={{ color: "var(--red)" }} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={adding} onClose={() => setAdding(false)} title="Add endorsement">
        <form action={createEndorsement} onSubmit={() => setTimeout(() => { setAdding(false); router.refresh(); }, 50)} className="space-y-4">
          <input type="hidden" name="clientId" value={clientId} />
          <Field label="Policy" required><Select name="policyId" options={policies.map((p) => ({ value: p.id, label: p.label }))} placeholder="Select policy…" /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Type" required><Select name="type" options={ENDORSEMENT_TYPES} placeholder="Select…" /></Field>
            <Field label="Status"><Select name="status" options={ENDORSEMENT_STATUS} defaultValue="requested" /></Field>
          </div>
          <Field label="What's changing?"><Input name="description" placeholder="e.g. New address, add spouse, SI ₹5L→₹10L" /></Field>
          <Field label="Insurer reference no."><Input name="referenceNo" placeholder="optional" /></Field>
          <Field label="Notes"><Textarea name="notes" rows={2} /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setAdding(false)} className="btn">Cancel</button>
            <SubmitButton>Add endorsement</SubmitButton>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
