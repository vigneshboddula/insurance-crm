"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { LINES, INSURERS, FREQUENCY, PAYMENT_MODE, POLICY_STATUS, RELATIONSHIPS } from "@/lib/enums";

export type PolicyDefaults = {
  line?: string; carrier?: string; planName?: string; variant?: string;
  policyNumber?: string; previousPolicyNumber?: string; sumAssured?: number; premium?: number;
  deductible?: number | null; tenureYears?: number | null; frequency?: string; paymentMode?: string;
  firstInception?: string | null; startDate?: string | null; renewalDate?: string | null; maturityDate?: string | null;
  status?: string; nomineeName?: string; nomineeRelation?: string; insuredMembersText?: string;
  renewalUrl?: string;
};

const d = (v?: string | null) => (v ? v.slice(0, 10) : "");

function plusOneYear(dateStr: string): string {
  const dt = new Date(dateStr);
  if (isNaN(+dt)) return "";
  dt.setFullYear(dt.getFullYear() + 1);
  return dt.toISOString().slice(0, 10);
}

export function PolicyFields({ p, proposerName }: { p?: PolicyDefaults; proposerName?: string }) {
  const knownInsurer = !p?.carrier || INSURERS.some((i) => i.value === p.carrier);
  const [otherInsurer, setOtherInsurer] = useState(!knownInsurer);

  // Smart default: when a start / inception date is entered, auto-fill the
  // renewal date one year later (unless the user already set it). Uncontrolled
  // inputs, so we set the value directly via the DOM.
  const onDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const form = e.target.closest("form");
    if (!form) return;
    const start = form.querySelector('input[name="startDate"]') as HTMLInputElement | null;
    const renewal = form.querySelector('input[name="renewalDate"]') as HTMLInputElement | null;
    // if only "first inception" is filled, seed the start date from it
    if (e.target.name === "firstInception" && start && !start.value) start.value = val;
    if (renewal && !renewal.value) renewal.value = plusOneYear((start && start.value) || val);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-3.5" style={{ background: "var(--accent-50)" }}>
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--accent-700)" }}>
          <Building2 size={13} /> Insurer &amp; plan
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Insurer / company" required>
            {otherInsurer ? (
              <Input name="carrier" defaultValue={p?.carrier} placeholder="Type insurer name" autoFocus />
            ) : (
              <Select name="carrier" options={INSURERS} placeholder="Select insurer…" defaultValue={p?.carrier} />
            )}
            <button type="button" onClick={() => setOtherInsurer((v) => !v)} className="mt-1 text-[11px] font-medium text-accent-700">{otherInsurer ? "← pick from list" : "+ other insurer"}</button>
          </Field>
          <Field label="Line" required><Select name="line" options={LINES} placeholder="Select…" defaultValue={p?.line} /></Field>
          <Field label="Plan / product"><Input name="planName" defaultValue={p?.planName} placeholder="Optima Restore" /></Field>
          <Field label="Policy variant" required><Input name="variant" defaultValue={p?.variant} placeholder="e.g. Family Floater" /></Field>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Policy number" required><Input name="policyNumber" required defaultValue={p?.policyNumber} placeholder="2805203565769705" /></Field>
        <Field label="Previous policy number"><Input name="previousPolicyNumber" defaultValue={p?.previousPolicyNumber} placeholder="optional" /></Field>
        <Field label="Renewal / payment link" hint="sent with renewal reminders"><Input name="renewalUrl" defaultValue={p?.renewalUrl} placeholder="https://… (optional)" /></Field>
        <Field label="Sum insured (₹)" required><Input name="sumAssured" inputMode="numeric" defaultValue={p?.sumAssured} placeholder="1000000" /></Field>
        <Field label="Premium (₹)" required><Input name="premium" inputMode="numeric" defaultValue={p?.premium} placeholder="30912" /></Field>
        <Field label="Deductible (₹)" required hint="Enter 0 if none"><Input name="deductible" inputMode="numeric" defaultValue={p?.deductible ?? undefined} placeholder="0" /></Field>
        <Field label="Tenure (years)" required><Input name="tenureYears" inputMode="numeric" defaultValue={p?.tenureYears ?? undefined} placeholder="1" /></Field>
        <Field label="Frequency"><Select name="frequency" options={FREQUENCY} defaultValue={p?.frequency ?? "annual"} /></Field>
        <Field label="Payment mode"><Select name="paymentMode" options={PAYMENT_MODE} defaultValue={p?.paymentMode ?? "online"} /></Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="First policy inception date" required hint="Original start"><Input name="firstInception" type="date" defaultValue={d(p?.firstInception)} onChange={onDateChange} /></Field>
        <Field label="Current start date"><Input name="startDate" type="date" defaultValue={d(p?.startDate)} onChange={onDateChange} /></Field>
        <Field label="Renewal / due date" required hint="auto-fills 1 year after start"><Input name="renewalDate" type="date" required defaultValue={d(p?.renewalDate)} /></Field>
      </div>

      <Field label="Insured members & birthdays" hint="One per line: Name (Relation) DOB — e.g. Aarav (Son) 2012-05-18. (Self) = proposer. Birthday is optional; reminders fire 2 days before.">
        <Textarea name="insuredMembers" rows={3} defaultValue={p?.insuredMembersText} placeholder={`${proposerName ?? "Proposer name"} (Self)\nSpouse name (Wife) 1988-03-22\nChild name (Son) 2012-05-18`} />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Status"><Select name="status" options={POLICY_STATUS} defaultValue={p?.status ?? "active"} /></Field>
        <Field label="Nominee name"><Input name="nomineeName" defaultValue={p?.nomineeName} placeholder="Sunita Sharma" /></Field>
        <Field label="Nominee relation"><Select name="nomineeRelation" options={RELATIONSHIPS} placeholder="Select…" defaultValue={p?.nomineeRelation} /></Field>
      </div>
    </div>
  );
}
