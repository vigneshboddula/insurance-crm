"use client";

import { clearAllDemoData, restoreDemoData } from "@/app/settings/actions";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

export function DemoClearCard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const handleClear = async () => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    setLoading(true);
    try {
      const res = await clearAllDemoData();
      alert(res.note);
      setConfirmed(false);
      router.refresh();
    } catch (e) {
      alert("Error: " + (e instanceof Error ? e.message : "Failed to clear"));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoreLoading(true);
    try {
      const res = await restoreDemoData();
      alert(res.note);
      router.refresh();
    } catch (e) {
      alert("Error: " + (e instanceof Error ? e.message : "Failed to restore"));
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <RotateCcw size={15} style={{ color: "var(--amber)" }} /> Demo &amp; testing — full reset
      </h2>
      <p className="mt-1 text-xs text-ink-3">Wipes <span className="font-medium text-ink-2">everything</span> — clients, policies, documents, renewals, tasks, leads, claims, communications — so every screen reads empty, like a fresh install. A backup is saved first; <span className="font-medium text-ink-2">Restore</span> brings it all back. Your settings &amp; templates are kept.</p>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          onClick={handleClear}
          disabled={loading}
          className="btn w-full"
          style={{
            background: confirmed ? "var(--red)" : "var(--surface-2)",
            color: confirmed ? "white" : "var(--ink)",
            borderColor: "var(--border)",
          }}
        >
          {loading ? "Clearing..." : confirmed ? "⚠️ Click again to confirm" : "🗑️ Clear all data"}
        </button>

        <button
          onClick={handleRestore}
          disabled={restoreLoading}
          className="btn w-full"
          style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
        >
          {restoreLoading ? "Restoring..." : "♻️ Restore"}
        </button>
      </div>
    </section>
  );
}
