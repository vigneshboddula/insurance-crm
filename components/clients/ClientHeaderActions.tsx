"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, UserMinus } from "lucide-react";
import { EditClientDialog, type ClientDefaults } from "./EditClientDialog";
import { archiveClient, restoreClient } from "@/app/clients/actions";
import { useToast } from "@/components/ui/Toast";

export function ClientHeaderActions({ client, households, policyCount }: { client: ClientDefaults; households: { id: string; name: string }[]; policyCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [, start] = useTransition();
  const { toast } = useToast();

  const archive = () => {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3500);
      return;
    }
    setArmed(false);
    start(async () => {
      await archiveClient(client.id);
      toast(`${client.name} marked as left`, {
        undo: async () => { await restoreClient(client.id); router.refresh(); },
      });
    });
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn"><Pencil size={14} /> Edit</button>
      {armed ? (
        <button onClick={archive} className="btn text-white" style={{ background: "var(--red)" }}>
          <UserMinus size={14} /> Mark as left{policyCount > 0 ? ` (${policyCount} ${policyCount === 1 ? "policy" : "policies"})` : ""}?
        </button>
      ) : (
        <button onClick={archive} className="btn" style={{ color: "var(--red-700)" }} aria-label="Mark client as left"><UserMinus size={14} /> Mark as left</button>
      )}
      <EditClientDialog open={open} onClose={() => setOpen(false)} client={client} households={households} />
    </>
  );
}
