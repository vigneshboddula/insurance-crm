"use client";

import { useState } from "react";
import { NotebookPen, Loader2, Copy, Check, Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { generateBrief } from "@/app/clients/brief-actions";

export function PreMeetingBriefButton({ clientId, name }: { clientId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<{ text: string; ai: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setOpen(true);
    setLoading(true);
    setBrief(null);
    try { setBrief(await generateBrief(clientId)); }
    catch { setBrief({ text: "Couldn't generate a brief right now.", ai: false }); }
    finally { setLoading(false); }
  }

  function copy() {
    if (brief) { navigator.clipboard?.writeText(brief.text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  }

  return (
    <>
      <button onClick={run} className="btn"><NotebookPen size={15} /> Pre-meeting brief</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Pre-meeting brief" subtitle={name}>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-ink-3"><Loader2 size={16} className="animate-spin" /> Preparing your brief…</div>
        ) : brief ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-ink-3">
              {brief.ai ? <><Sparkles size={12} style={{ color: "var(--accent)" }} /> AI brief</> : "Quick brief"}
            </div>
            <pre className="whitespace-pre-wrap rounded-xl p-3.5 text-sm leading-relaxed text-ink-2" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", fontFamily: "inherit" }}>{brief.text}</pre>
            <div className="flex justify-end">
              <button onClick={copy} className="btn">{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
