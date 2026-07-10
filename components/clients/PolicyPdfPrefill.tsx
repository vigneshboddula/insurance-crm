"use client";

import { useRef, useState } from "react";
import { FileUp, CheckCircle2, Loader2 } from "lucide-react";
import { extractPolicyDraft, type PolicyDraft } from "@/app/clients/extract-actions";

// Item 23 — "Upload PDF to auto-fill". Extracts fields locally and writes them
// into the (uncontrolled) Add-Policy form inputs by name, so the agent just
// reviews + saves. Shown only when adding a new policy.
export function PolicyPdfPrefill() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function setField(name: string, value: string | undefined) {
    if (value == null || value === "") return;
    const form = wrapRef.current?.closest("form");
    const el = form?.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (!el) return;
    // for a <select>, only set if the option exists (else leave for manual pick)
    if (el.tagName === "SELECT" && !Array.from((el as HTMLSelectElement).options).some((o) => o.value === value)) return;
    el.value = value;
  }

  function apply(draft: PolicyDraft) {
    setField("carrier", draft.carrier);
    setField("line", draft.line);
    setField("planName", draft.planName);
    setField("variant", draft.variant);
    setField("policyNumber", draft.policyNumber);
    setField("sumAssured", draft.sumAssured != null ? String(draft.sumAssured) : undefined);
    setField("premium", draft.premium != null ? String(draft.premium) : undefined);
    setField("firstInception", draft.firstInception);
    setField("startDate", draft.startDate);
    setField("renewalDate", draft.renewalDate);
    setField("insuredMembers", draft.insuredMembersText);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await extractPolicyDraft(fd);
      if (res.ok && res.draft) { apply(res.draft); setMsg({ ok: true, text: `Filled ${res.draft.found.length} field(s) — please review, then Add policy.` }); }
      else setMsg({ ok: false, text: res.error ?? "Couldn't read that PDF." });
    } catch {
      setMsg({ ok: false, text: "Something went wrong reading the PDF." });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div ref={wrapRef} className="rounded-xl border border-dashed p-3" style={{ borderColor: "var(--border-2)", background: "var(--surface-2)" }}>
      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-accent-700">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
        <span>{busy ? "Reading PDF…" : "Upload policy PDF to auto-fill (optional)"}</span>
        <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFile} disabled={busy} />
      </label>
      {msg && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px]" style={{ color: msg.ok ? "var(--emerald-700)" : "var(--amber-700)" }}>
          {msg.ok && <CheckCircle2 size={12} />} {msg.text}
        </div>
      )}
    </div>
  );
}
