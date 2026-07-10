"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { PolicyDialog } from "./PolicyDialog";
import { type PolicyDefaults } from "./PolicyFields";
import { deletePolicy } from "@/app/clients/actions";

export function PolicyRowActions({ clientId, proposerName, policyId, defaults, policyNumber }: {
  clientId: string; proposerName?: string; policyId: string; defaults: PolicyDefaults; policyNumber: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [, start] = useTransition();
  const remove = () => {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3500); return; }
    setArmed(false);
    start(async () => { await deletePolicy(policyId, clientId); router.refresh(); });
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-0.5">
        <button onClick={() => setOpen(true)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-3" aria-label="Edit policy"><Pencil size={13} className="text-ink-2" /></button>
        {armed ? (
          <button onClick={remove} className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-white" style={{ background: "var(--red)" }}><Trash2 size={12} /> Delete forever?</button>
        ) : (
          <button onClick={remove} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-3" aria-label="Delete policy" title={`Delete policy ${policyNumber}`}><Trash2 size={13} style={{ color: "var(--red)" }} /></button>
        )}
      </div>
      <PolicyDialog open={open} onClose={() => setOpen(false)} clientId={clientId} proposerName={proposerName} policy={{ id: policyId, defaults }} />
    </>
  );
}
