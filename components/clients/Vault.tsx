"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, Pencil, ShieldCheck } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, SubmitButton } from "@/components/ui/form";
import { revealVaultField, updateVault } from "@/app/clients/actions";
import { RELATIONSHIPS } from "@/lib/enums";

type V = {
  clientId: string; aadhaarMasked: string; panMasked: string; hasAadhaar: boolean; hasPan: boolean;
  whatsappNumber: string; postalAddress: string; nomineeName: string; nomineeRelation: string; dob: string;
  pehchaanKycId: string; insurerClientId: string;
};

function SecretRow({ label, masked, has, onReveal }: { label: string; masked: string; has: boolean; onReveal: () => Promise<string | null> }) {
  const [full, setFull] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (!has) return;
    if (shown) return setShown(false);
    if (full === null) {
      setLoading(true);
      const v = await onReveal();
      setFull(v);
      setLoading(false);
    }
    setShown(true);
  };

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-ink-3">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-ink tnum">{!has ? "—" : shown ? full : masked}</span>
        {has && (
          <button onClick={toggle} className="text-ink-3 hover:text-accent" aria-label={shown ? "Hide" : "Reveal"} disabled={loading}>
            {shown ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

export function Vault({ vault }: { vault: V }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      await updateVault(fd);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <section className="card">
      <div className="flex items-center justify-between px-5 pt-4 pb-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Lock size={14} style={{ color: "var(--accent)" }} /> Client vault</h2>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-medium text-accent-700"><Pencil size={12} /> Edit</button>
      </div>
      <div className="divide-y px-5 pb-3" style={{ borderColor: "var(--border)" }}>
        <SecretRow label="Aadhaar" masked={vault.aadhaarMasked} has={vault.hasAadhaar} onReveal={() => revealVaultField(vault.clientId, "aadhaar")} />
        <SecretRow label="PAN" masked={vault.panMasked} has={vault.hasPan} onReveal={() => revealVaultField(vault.clientId, "pan")} />
        <div className="flex items-center justify-between py-1.5"><span className="text-xs text-ink-3">WhatsApp</span><span className="text-sm text-ink tnum">{vault.whatsappNumber || "—"}</span></div>
        <div className="flex items-center justify-between py-1.5"><span className="text-xs text-ink-3">Nominee</span><span className="text-sm text-ink">{vault.nomineeName ? `${vault.nomineeName}${vault.nomineeRelation ? ` (${vault.nomineeRelation})` : ""}` : "—"}</span></div>
        <div className="flex items-center justify-between py-1.5"><span className="text-xs text-ink-3">Date of birth</span><span className="text-sm text-ink tnum">{vault.dob || "—"}</span></div>
        {vault.pehchaanKycId && <div className="flex items-center justify-between py-1.5"><span className="text-xs text-ink-3">Pehchaan KYC ID</span><span className="text-sm text-ink tnum">{vault.pehchaanKycId}</span></div>}
        {vault.insurerClientId && <div className="flex items-center justify-between py-1.5"><span className="text-xs text-ink-3">Insurer Client ID</span><span className="text-sm text-ink tnum">{vault.insurerClientId}</span></div>}
      </div>
      <div className="flex items-center gap-1.5 px-5 pb-3 text-[10px] text-ink-4"><ShieldCheck size={12} style={{ color: "var(--emerald)" }} /> Encrypted at rest · masked by default · click the eye to reveal</div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Edit client vault" subtitle="Leave an ID blank to keep the existing encrypted value.">
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="hidden" name="clientId" value={vault.clientId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Aadhaar number" hint="Re-encrypted on save"><Input name="aadhaar" placeholder="leave blank to keep" /></Field>
            <Field label="PAN number" hint="Re-encrypted on save"><Input name="pan" placeholder="leave blank to keep" /></Field>
            <Field label="WhatsApp number"><Input name="whatsappNumber" defaultValue={vault.whatsappNumber} /></Field>
            <Field label="Date of birth"><Input name="dob" type="date" defaultValue={vault.dob} /></Field>
            <Field label="Nominee name"><Input name="nomineeName" defaultValue={vault.nomineeName} /></Field>
            <Field label="Nominee relation"><Select name="nomineeRelation" options={RELATIONSHIPS} placeholder="Select…" defaultValue={vault.nomineeRelation} /></Field>
            <Field label="HDFC ERGO Pehchaan KYC ID"><Input name="pehchaanKycId" defaultValue={vault.pehchaanKycId} placeholder="EPFYC1GJMF" /></Field>
            <Field label="Other insurer Client ID"><Input name="insurerClientId" defaultValue={vault.insurerClientId} placeholder="F1967866" /></Field>
          </div>
          <Field label="Postal address"><Input name="postalAddress" defaultValue={vault.postalAddress} /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn">Cancel</button>
            <SubmitButton>Save vault</SubmitButton>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
