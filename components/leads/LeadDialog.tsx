"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea, SubmitButton } from "@/components/ui/form";
import { LEAD_STAGES, LEAD_SOURCES, LEAD_INTERESTS } from "@/lib/enums";
import { createLead, updateLead } from "@/app/leads/actions";

export type EditableLead = {
  id: string; name: string; phone: string | null; source: string; stage: string;
  interest: string | null; expectedPremium: number | null; notes: string | null;
} | null;

export function LeadDialog({ open, onClose, lead }: { open: boolean; onClose: () => void; lead?: EditableLead }) {
  const router = useRouter();
  const [, start] = useTransition();
  const editing = !!lead;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      if (editing) await updateLead(fd);
      else await createLead(fd);
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={editing ? "Edit lead" : "Add lead"}>
      <form onSubmit={onSubmit} className="space-y-3">
        {editing && <input type="hidden" name="id" value={lead!.id} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" required><Input name="name" required defaultValue={lead?.name} placeholder="Ravi Kumar" /></Field>
          <Field label="Phone"><Input name="phone" defaultValue={lead?.phone ?? ""} placeholder="9812345678" /></Field>
          <Field label="Stage"><Select name="stage" options={LEAD_STAGES} defaultValue={lead?.stage ?? "new"} /></Field>
          <Field label="Source"><Select name="source" options={LEAD_SOURCES} defaultValue={lead?.source ?? "referral"} /></Field>
          <Field label="Interested in"><Select name="interest" options={LEAD_INTERESTS} placeholder="Not sure yet" defaultValue={lead?.interest ?? ""} /></Field>
          <Field label="Expected premium (₹/yr)"><Input name="expectedPremium" inputMode="numeric" defaultValue={lead?.expectedPremium ?? ""} placeholder="15000" /></Field>
        </div>
        <Field label="Notes"><Textarea name="notes" rows={2} defaultValue={lead?.notes ?? ""} placeholder="Where they came from, what they need…" /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <SubmitButton>{editing ? "Save lead" : "Add lead"}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
