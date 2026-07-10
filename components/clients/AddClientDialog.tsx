"use client";

import { useState } from "react";
import { Lock, ChevronDown } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea, SubmitButton } from "@/components/ui/form";
import { createClient } from "@/app/clients/actions";
import { INCOME_BANDS, RELATIONSHIPS, GENDERS } from "@/lib/enums";

export function AddClientDialog({ open, onClose }: { open: boolean; onClose: () => void; households?: { id: string; name: string }[] }) {
  const [waSame, setWaSame] = useState(true);
  const [showOptional, setShowOptional] = useState(false);

  return (
    <Dialog open={open} onClose={onClose} title="Add client" subtitle="Only the name is required — save now, complete the rest later. ★ = important." wide>
      <form action={createClient} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name" required><Input name="name" required placeholder="Ramesh Sharma" /></Field>
          <Field label="Phone" required><Input name="phone" placeholder="+91 98xxxxxxx" /></Field>
          <Field label="Email" required><Input name="email" type="email" placeholder="name@example.com" /></Field>
          <Field label="Date of birth" required><Input name="dob" type="date" /></Field>
          <Field label="Alternative phone" required><Input name="altPhone" placeholder="+91 …" /></Field>
          <Field label="WhatsApp number">
            <label className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-2">
              <input type="checkbox" name="waSameAsPhone" checked={waSame} onChange={(e) => setWaSame(e.target.checked)} /> Same as phone
            </label>
            {!waSame && <Input name="whatsappNumber" placeholder="+91 …" />}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Relationship in family" hint="optional — e.g. self, spouse, son"><Select name="relationship" options={RELATIONSHIPS} placeholder="Select…" /></Field>
        </div>

        {/* optional, collapsed */}
        <div className="rounded-xl" style={{ border: "0.5px solid var(--border)" }}>
          <button type="button" onClick={() => setShowOptional((v) => !v)} className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-medium text-ink-2">
            Optional details (occupation, income, gender, tags, address)
            <ChevronDown size={14} style={{ transform: showOptional ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </button>
          {showOptional && (
            <div className="space-y-3 px-3.5 pb-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Occupation"><Input name="occupation" placeholder="Software architect" /></Field>
                <Field label="Income band"><Select name="incomeBand" options={INCOME_BANDS} placeholder="Select…" /></Field>
                <Field label="Gender"><Select name="gender" options={GENDERS} placeholder="Select…" /></Field>
                <Field label="Tags" hint="Comma-separated"><Input name="tags" placeholder="high-value" /></Field>
              </div>
              <Field label="Address"><Textarea name="address" rows={2} placeholder="Plot 22, Madhapur, Hyderabad 500081" /></Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Instagram"><Input name="instagram" placeholder="@handle or URL" /></Field>
                <Field label="LinkedIn"><Input name="linkedin" placeholder="profile URL" /></Field>
                <Field label="Facebook"><Input name="facebook" placeholder="profile URL" /></Field>
              </div>
            </div>
          )}
        </div>

        {/* vault */}
        <div className="rounded-xl p-3.5" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
          <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Lock size={13} style={{ color: "var(--accent)" }} /> Client vault — secure KYC (encrypted, masked)
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Aadhaar number"><Input name="aadhaar" placeholder="XXXX XXXX XXXX" /></Field>
            <Field label="PAN number"><Input name="pan" placeholder="ABCDE1234F" /></Field>
            <Field label="Nominee name"><Input name="nomineeName" placeholder="Sunita Sharma" /></Field>
            <Field label="Nominee relation"><Select name="nomineeRelation" options={RELATIONSHIPS} placeholder="Select…" /></Field>
            <Field label="HDFC ERGO Pehchaan KYC ID" hint="e.g. EPFYC1GJMF — HDFC ERGO clients only"><Input name="pehchaanKycId" placeholder="EPFYC1GJMF" /></Field>
            <Field label="Other insurer Client ID" hint="e.g. Care Health F1967866"><Input name="insurerClientId" placeholder="F1967866" /></Field>
          </div>
          <p className="mt-2 text-[10px] text-ink-4">Nominee ID proof &amp; birth certificate can be uploaded as documents on the profile after saving.</p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <SubmitButton>Add client</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
