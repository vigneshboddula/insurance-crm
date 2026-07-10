"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PolicyDialog } from "./PolicyDialog";

export function AddPolicyDialog({ clientId, clientName, proposerName, variant = "small", autoOpen = false }: { clientId: string; clientName?: string; proposerName?: string; variant?: "small" | "primary"; autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button onClick={() => setOpen(true)} className={variant === "primary" ? "btn btn-accent" : "inline-flex items-center gap-1 text-xs font-medium text-accent-700"}>
        <Plus size={variant === "primary" ? 15 : 13} /> Add policy
      </button>
      <PolicyDialog open={open} onClose={() => setOpen(false)} clientId={clientId} proposerName={proposerName ?? clientName} />
    </>
  );
}
