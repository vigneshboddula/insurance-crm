"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { SubmitButton } from "@/components/ui/form";
import { PolicyFields, type PolicyDefaults } from "./PolicyFields";
import { PolicyPdfPrefill } from "./PolicyPdfPrefill";
import { createPolicy, updatePolicy } from "@/app/clients/actions";

export function PolicyDialog({ open, onClose, clientId, proposerName, policy }: {
  open: boolean; onClose: () => void; clientId: string; proposerName?: string;
  policy?: { id: string; defaults: PolicyDefaults };
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const editing = !!policy;

  const onSubmitEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => { await updatePolicy(fd); onClose(); router.refresh(); });
  };

  return (
    <Dialog open={open} onClose={onClose} title={editing ? "Edit policy" : "Add policy"} subtitle={proposerName ? `Proposer: ${proposerName}` : undefined} wide>
      <form action={editing ? undefined : createPolicy} onSubmit={editing ? onSubmitEdit : undefined} className="space-y-4">
        <input type="hidden" name="clientId" value={clientId} />
        {editing && <input type="hidden" name="id" value={policy!.id} />}
        {!editing && <PolicyPdfPrefill />}
        <PolicyFields p={policy?.defaults} proposerName={proposerName} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <SubmitButton>{editing ? "Save policy" : "Add policy"}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
