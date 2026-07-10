import { getSettings } from "@/lib/settings";
import { updateSettings } from "./actions";
import { fmtDate } from "@/lib/format";
import { prisma } from "@/lib/db";
import { AppLockCard } from "@/components/settings/AppLockCard";
import { EngineCard } from "@/components/settings/EngineCard";
import { AutoSendCard } from "@/components/settings/AutoSendCard";
import { AutomationsCard } from "@/components/settings/AutomationsCard";
import { DemoClearCard } from "@/components/settings/DemoClearCard";
import { waState } from "@/lib/whatsapp/client";
import { autoSentToday } from "@/lib/autosend";
import { DATA_DIR } from "@/lib/paths";
import path from "path";
import { Field, Input, SubmitButton } from "@/components/ui/form";
import { ShieldCheck, Download, Upload, RotateCcw, Cloud, Cake, Link2, CheckCircle2, AlertTriangle, Briefcase, Camera, Video, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ restored?: string; restore_error?: string }> }) {
  const sp = await searchParams;
  const s = await getSettings();
  const raw = await prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { appPasscode: true } });
  const lockEnabled = !!raw?.appPasscode;
  const sentToday = await autoSentToday();

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold text-ink">Settings</h1>

      {sp.restored !== undefined && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm" style={{ background: "var(--emerald-50)", color: "var(--emerald-700)" }}>
          <CheckCircle2 size={16} /> Backup decrypted to <code>insurance-crm-data\restore\</code> ({sp.restored} documents). Stop the app and copy <code>restore\dev.db</code> over <code>insurance-crm-data\dev.db</code> to apply it.
        </div>
      )}
      {sp.restore_error && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm" style={{ background: "var(--red-50)", color: "var(--red-700)" }}>
          <AlertTriangle size={16} /> {sp.restore_error}
        </div>
      )}

      <AppLockCard enabled={lockEnabled} />

      <EngineCard
        enabled={s.engineEnabled}
        agentWhatsApp={s.agentWhatsApp}
        digestHour={s.digestHour}
        connectedNumber={waState().me}
        lastTickAt={s.lastEngineTickAt ? s.lastEngineTickAt.toISOString() : null}
        lastDigestOn={s.lastDigestOn}
      />

      <AutoSendCard
        renewalSendMode={s.renewalSendMode}
        autoSendDailyCap={s.autoSendDailyCap}
        quietStart={s.quietStart}
        quietEnd={s.quietEnd}
        engineEnabled={s.engineEnabled}
        autoSentToday={sentToday}
        lastAutoSendAt={s.lastAutoSendAt ? s.lastAutoSendAt.toISOString() : null}
      />

      <AutomationsCard
        inboundMode={s.inboundMode}
        selfServiceMode={s.selfServiceMode}
        quoteSendMode={s.quoteSendMode}
        winbackMode={s.winbackMode}
        claimSeqMode={s.claimSeqMode}
        delightMode={s.delightMode}
        watchedFolderEnabled={s.watchedFolderEnabled}
        watchedFolderPath={s.watchedFolderPath}
        watchedFolderDefault={path.join(DATA_DIR, "inbox")}
        imapEnabled={s.imapEnabled}
        imapHost={s.imapHost}
        imapPort={s.imapPort}
        imapUser={s.imapUser}
        imapConfigured={!!s.imapPassEnc}
        engineEnabled={s.engineEnabled}
      />

      {/* Backup & export */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldCheck size={15} style={{ color: "var(--emerald)" }} /> Backup &amp; export</h2>
        <p className="mt-1 text-xs text-ink-3">Last backup: <span className="font-medium text-ink-2">{s.lastBackupAt ? fmtDate(s.lastBackupAt) : "never"}</span></p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form action="/api/backup" method="post" className="rounded-xl p-3.5" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
            <div className="mb-1 text-xs font-medium text-ink"><Download size={13} className="mr-1 inline" /> Encrypted backup</div>
            <p className="mb-2 text-[11px] text-ink-3">DB + all documents, encrypted with a passphrase only you know. Safe to store in Google Drive / share — useless without your passphrase.</p>
            <input name="passphrase" type="password" required minLength={6} placeholder="Backup passphrase (min 6)" className="mb-2 w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border-2)" }} />
            <button type="submit" className="btn btn-accent w-full"><Download size={14} /> Download backup</button>
          </form>

          <div className="rounded-xl p-3.5" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
            <div className="mb-1 text-xs font-medium text-ink"><Download size={13} className="mr-1 inline" /> Data export (ZIP)</div>
            <p className="mb-2 text-[11px] text-ink-3">Clients &amp; policies as Excel + all documents, for your own use. (Not encrypted — keep it private.)</p>
            <a href="/api/export" className="btn w-full"><Download size={14} /> Download export</a>
          </div>
        </div>

        <form action="/api/restore" method="post" encType="multipart/form-data" className="mt-3 rounded-xl p-3.5" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
          <div className="mb-1 text-xs font-medium text-ink"><Upload size={13} className="mr-1 inline" /> Restore from a backup</div>
          <p className="mb-2 text-[11px] text-ink-3">Decrypts into a <code>restore/</code> folder (never overwrites your live data). You then copy it into place.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input name="file" type="file" accept=".crmbackup" required className="text-xs text-ink-2 file:mr-2 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:text-white" />
            <input name="passphrase" type="password" required placeholder="Passphrase" className="rounded-lg border bg-surface px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border-2)" }} />
            <button type="submit" className="btn"><RotateCcw size={14} /> Restore</button>
          </div>
        </form>

        <div className="mt-3 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[11px]" style={{ background: "var(--accent-50)", color: "var(--accent-700)" }}>
          <Cloud size={14} className="mt-0.5 shrink-0" />
          <span><strong>Google Drive auto-sync:</strong> the encrypted backup above is ready to drop into your Drive today. Fully automatic upload needs a one-time Google sign-in setup (your own Google Cloud credentials) — tell me when you want to wire it and I&apos;ll walk you through it.</span>
        </div>
      </section>

      {/* Preferences */}
      <form action={updateSettings} className="card space-y-4 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Cake size={15} className="text-ink-3" /> Reminders &amp; profile</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Greet family members this many days early" hint="Proposers are greeted on the day"><Input name="birthdayMemberOffsetDays" type="number" min={0} max={7} defaultValue={s.birthdayMemberOffsetDays} /></Field>
          <Field label="Surface renewals this many days ahead"><Input name="renewalLeadDays" type="number" min={1} max={90} defaultValue={s.renewalLeadDays} /></Field>
        </div>
        <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-2"><Link2 size={13} /> My social links (shown in the app)</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="LinkedIn"><Input name="myLinkedin" defaultValue={s.myLinkedin ?? ""} placeholder="https://linkedin.com/in/…" /></Field>
            <Field label="Instagram"><Input name="myInstagram" defaultValue={s.myInstagram ?? ""} placeholder="https://instagram.com/…" /></Field>
            <Field label="YouTube"><Input name="myYoutube" defaultValue={s.myYoutube ?? ""} placeholder="https://youtube.com/@…" /></Field>
          </div>
        </div>
        <div className="flex justify-end"><SubmitButton>Save settings</SubmitButton></div>
      </form>

      {/* Shareable profile / signature */}
      {(s.myLinkedin || s.myInstagram || s.myYoutube) && (
        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Link2 size={15} className="text-ink-3" /> Your shareable profile</h2>
          <div className="mt-3 flex items-center gap-3 rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "var(--accent)" }}><Shield size={20} className="text-white" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink">Vignesh</div>
              <div className="text-xs text-ink-3">Insurance Advisor · Life, Term &amp; Health</div>
            </div>
            <div className="flex items-center gap-2">
              {s.myLinkedin && <a href={s.myLinkedin} target="_blank" rel="noopener" className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--surface-3)" }} aria-label="LinkedIn"><Briefcase size={16} className="text-ink-2" /></a>}
              {s.myInstagram && <a href={s.myInstagram} target="_blank" rel="noopener" className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--surface-3)" }} aria-label="Instagram"><Camera size={16} className="text-ink-2" /></a>}
              {s.myYoutube && <a href={s.myYoutube} target="_blank" rel="noopener" className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--surface-3)" }} aria-label="YouTube"><Video size={16} className="text-ink-2" /></a>}
            </div>
          </div>
        </section>
      )}

      <DemoClearCard />
    </div>
  );
}
