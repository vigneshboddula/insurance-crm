"use client";

import { useState, useTransition, type ReactNode } from "react";
import { MessageSquare, Banknote, HeartHandshake, FolderInput, Bot } from "lucide-react";
import { updateAutomationsSettings } from "@/app/settings/actions";

type Props = {
  inboundMode: string; selfServiceMode: string;
  quoteSendMode: string; winbackMode: string;
  claimSeqMode: string; delightMode: string;
  watchedFolderEnabled: boolean; watchedFolderPath: string | null; watchedFolderDefault: string;
  imapEnabled: boolean; imapHost: string | null; imapPort: number; imapUser: string | null; imapConfigured: boolean;
  engineEnabled: boolean;
};

function ModeSelect({ name, value, options }: { name: string; value: string; options: [string, string][] }) {
  return (
    <select name={name} defaultValue={value} className="rounded-lg border bg-surface px-2.5 py-1.5 text-xs" style={{ borderColor: "var(--border-2)" }}>
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}

const AA: [string, string][] = [["off", "Off"], ["approve", "Approve"], ["auto", "Auto"]];

function Row({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="text-[11px] text-ink-3">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function AutomationsCard(p: Props) {
  const [saving, startSave] = useTransition();
  const [imapOn, setImapOn] = useState(p.imapEnabled);
  const [folderOn, setFolderOn] = useState(p.watchedFolderEnabled);

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Bot size={15} style={{ color: "var(--accent)" }} /> Automations
      </h2>
      <p className="mt-1 text-xs text-ink-3">
        The rest of the engine's helpers. Each is <strong>Off</strong> by default. <strong>Approve</strong> queues a message
        to the dashboard Approvals panel for a one-tap send; <strong>Auto</strong> lets the engine send it within your quiet
        hours + daily cap. All need the automation engine on{!p.engineEnabled && " (currently off above)"}.
      </p>

      <form action={(fd) => startSave(() => updateAutomationsSettings(fd))} className="mt-3 divide-y" style={{ borderColor: "var(--border)" }}>
        {/* Two-way WhatsApp */}
        <div className="py-2">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-2"><MessageSquare size={13} /> Two-way WhatsApp</div>
          <Row title="Inbound triage" desc="Read client replies, log them, and auto-create the right task">
            <ModeSelect name="inboundMode" value={p.inboundMode} options={[["off", "Off"], ["log", "Log only"], ["triage", "Triage"]]} />
          </Row>
          <Row title="Client self-service" desc="Answer claim-status asks; flag policy-copy requests (known numbers only)">
            <ModeSelect name="selfServiceMode" value={p.selfServiceMode} options={AA} />
          </Row>
        </div>

        {/* Money */}
        <div className="py-2">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-2"><Banknote size={13} /> Money automations</div>
          <Row title="Quote follow-up autopilot" desc="Nudge quoted leads on day 2, 5 and 10">
            <ModeSelect name="quoteSendMode" value={p.quoteSendMode} options={AA} />
          </Row>
          <Row title="Lapsed win-back" desc="Reach clients whose policy lapsed (with NCB-loss wording)">
            <ModeSelect name="winbackMode" value={p.winbackMode} options={AA} />
          </Row>
        </div>

        {/* Delight */}
        <div className="py-2">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-2"><HeartHandshake size={13} /> Client delight</div>
          <Row title="Claim hand-holding" desc="Supportive updates as a claim moves through its stages">
            <ModeSelect name="claimSeqMode" value={p.claimSeqMode} options={AA} />
          </Row>
          <Row title="Thank-you + anniversary" desc="Post-renewal thank-you & referral ask, and policy anniversary recaps">
            <ModeSelect name="delightMode" value={p.delightMode} options={AA} />
          </Row>
        </div>

        {/* Document intake */}
        <div className="py-2">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-2"><FolderInput size={13} /> Document auto-intake</div>
          <Row title="Watched folder" desc="Drop PDFs in a folder; they're extracted, matched and filed automatically">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input type="checkbox" name="watchedFolderEnabled" checked={folderOn} onChange={(e) => setFolderOn(e.target.checked)} /> Enabled
            </label>
          </Row>
          {folderOn && (
            <input name="watchedFolderPath" defaultValue={p.watchedFolderPath ?? ""} placeholder={p.watchedFolderDefault} className="mt-1 w-full rounded-lg border bg-surface px-2.5 py-1.5 text-xs" style={{ borderColor: "var(--border-2)" }} />
          )}
          <Row title="Mailbox (IMAP)" desc="Pull PDF attachments from your own mailbox into the intake pipeline">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input type="checkbox" name="imapEnabled" checked={imapOn} onChange={(e) => setImapOn(e.target.checked)} /> Enabled
            </label>
          </Row>
          {imapOn && (
            <div className="mt-1 grid grid-cols-2 gap-2 rounded-lg p-2.5" style={{ background: "var(--surface-2)" }}>
              <input name="imapHost" defaultValue={p.imapHost ?? ""} placeholder="imap.gmail.com" className="rounded-lg border bg-surface px-2.5 py-1.5 text-xs" style={{ borderColor: "var(--border-2)" }} />
              <input name="imapPort" type="number" defaultValue={p.imapPort} placeholder="993" className="rounded-lg border bg-surface px-2.5 py-1.5 text-xs" style={{ borderColor: "var(--border-2)" }} />
              <input name="imapUser" defaultValue={p.imapUser ?? ""} placeholder="you@gmail.com" className="rounded-lg border bg-surface px-2.5 py-1.5 text-xs" style={{ borderColor: "var(--border-2)" }} />
              <input name="imapPass" type="password" placeholder={p.imapConfigured ? "•••••• (unchanged)" : "app password"} className="rounded-lg border bg-surface px-2.5 py-1.5 text-xs" style={{ borderColor: "var(--border-2)" }} />
              <p className="col-span-2 text-[11px] text-ink-3">Use an app-specific password (e.g. Gmail App Password), not your main password. Stored encrypted, never sent anywhere but your mailbox. <strong>One-time setup:</strong> run <code>npm install imapflow</code> once to enable mailbox polling.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3">
          <button type="submit" disabled={saving} className="btn btn-accent">{saving ? "Saving…" : "Save automations"}</button>
        </div>
      </form>
    </section>
  );
}
