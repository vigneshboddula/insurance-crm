"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, RotateCcw, Trash2 } from "lucide-react";
import { restoreClient, deleteClientPermanently } from "@/app/clients/actions";

export function RestoreClientBanner({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);

  const del = () => {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 4000); return; }
    setArmed(false);
    start(async () => { await deleteClientPermanently(clientId); });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: "var(--amber-50)" }}>
      <UserMinus size={16} style={{ color: "var(--amber-700)" }} />
      <span className="flex-1 text-sm" style={{ color: "var(--amber-700)" }}>This client has left — hidden from your lists. Restore them, or delete permanently.</span>
      <button onClick={() => start(async () => { await restoreClient(clientId); router.refresh(); })} disabled={pending} className="btn">
        <RotateCcw size={14} /> {pending ? "Restoring…" : "Restore"}
      </button>
      <button onClick={del} disabled={pending} className="btn text-white" style={{ background: "var(--red)" }}>
        <Trash2 size={14} /> {armed ? "Click again — this is permanent" : "Delete permanently"}
      </button>
    </div>
  );
}
