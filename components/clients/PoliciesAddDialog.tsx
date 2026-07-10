"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, SubmitButton } from "@/components/ui/form";
import { PolicyFields } from "./PolicyFields";
import { addPolicyFromList } from "@/app/clients/actions";

export function PoliciesAddDialog({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [newClient, setNewClient] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-accent"><Plus size={15} /> Add policy</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add policy" subtitle="Pick the proposer (client) or create a new one." wide>
        <form action={addPolicyFromList} className="space-y-4">
          <div className="rounded-xl p-3.5" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
            {newClient ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="New client name" required><Input name="newClientName" required placeholder="Full name" /></Field>
                <Field label="Phone"><Input name="newClientPhone" placeholder="+91 …" /></Field>
              </div>
            ) : (
              <Field label="Proposer (client)" required>
                <Select name="clientId" options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select client…" />
              </Field>
            )}
            <button type="button" onClick={() => setNewClient((v) => !v)} className="mt-1 text-[11px] font-medium text-accent-700">{newClient ? "← pick existing client" : "+ create a new client"}</button>
          </div>
          <PolicyFields />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="btn">Cancel</button>
            <SubmitButton>Add policy</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
