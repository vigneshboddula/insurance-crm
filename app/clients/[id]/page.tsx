import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { decrypt, maskId } from "@/lib/crypto";
import { inr, fmtDate, daysUntil } from "@/lib/format";
import { labelOf, LINES, POLICY_STATUS, DOC_TYPES } from "@/lib/enums";
import { clientMissing, policyMissing } from "@/lib/completeness";
import { waLink, telLink } from "@/lib/links";
import { Vault } from "@/components/clients/Vault";
import { DocumentManager } from "@/components/clients/DocumentManager";
import { PolicyRowActions } from "@/components/clients/PolicyRowActions";
import { ClientHeaderActions } from "@/components/clients/ClientHeaderActions";
import { RestoreClientBanner } from "@/components/clients/RestoreClientBanner";
import { HolderTabs } from "@/components/clients/HolderTabs";
import { AiDraftButton } from "@/components/ai/AiDraftButton";
import { PreMeetingBriefButton } from "@/components/clients/PreMeetingBriefButton";
import { Endorsements } from "@/components/clients/Endorsements";
import { ltvOf, tierOf } from "@/lib/ltv";
import { FileEdit } from "lucide-react";
import { ArrowLeft, MessageCircle, Phone, FileText, Mail, MapPin, Users, Camera, Briefcase, Globe, Sparkles, Lock, Clock, LayoutDashboard } from "lucide-react";

export const dynamic = "force-dynamic";

const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
function socialUrl(kind: "instagram" | "linkedin" | "facebook", v: string) {
  if (/^https?:\/\//i.test(v)) return v;
  const h = v.replace(/^@/, "");
  return kind === "instagram" ? `https://instagram.com/${h}` : kind === "linkedin" ? `https://linkedin.com/in/${h}` : `https://facebook.com/${h}`;
}

export default async function PolicyHolderProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const { id } = await params;
  const welcome = (await searchParams)?.welcome === "1";
  const c = await prisma.client.findUnique({
    where: { id },
    include: {
      vault: true,
      household: { include: { clients: { select: { id: true, name: true, relationship: true } } } },
      documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "desc" } },
      policies: { where: { deletedAt: null }, orderBy: { renewalDate: "asc" }, include: { insuredMembers: true, versions: { select: { id: true } } } },
      communications: { orderBy: { occurredAt: "desc" }, take: 50 },
      tasks: { where: { done: false }, orderBy: { dueDate: "asc" } },
    },
  });
  if (!c) notFound();

  const [households, coveredOn, endorsements] = await Promise.all([
    prisma.household.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.policyInsured.findMany({ where: { clientId: id, policy: { clientId: { not: id } } }, include: { policy: { include: { client: { select: { id: true, name: true } } } } } }),
    prisma.endorsement.findMany({ where: { clientId: id }, orderBy: { requestedAt: "desc" } }),
  ]);
  const policyOpts = c.policies.map((p) => ({ id: p.id, label: `${p.carrier}${p.planName ? ` · ${p.planName}` : ""} · ${p.policyNumber}` }));

  const cd = {
    id: c.id, name: c.name, phone: c.phone, altPhone: c.altPhone ?? "", email: c.email ?? "",
    dob: c.dob ? c.dob.toISOString().slice(0, 10) : "", occupation: c.occupation ?? "", incomeBand: c.incomeBand ?? "", gender: c.gender ?? "",
    relationship: c.relationship ?? "", tags: c.tags ?? "", address: c.address ?? "", householdId: c.householdId ?? "",
    instagram: c.instagram ?? "", linkedin: c.linkedin ?? "", facebook: c.facebook ?? "",
  };
  const vault = {
    clientId: c.id, aadhaarMasked: maskId(decrypt(c.vault?.aadhaarEnc)), panMasked: maskId(decrypt(c.vault?.panEnc)),
    hasAadhaar: !!c.vault?.aadhaarEnc, hasPan: !!c.vault?.panEnc, whatsappNumber: c.vault?.whatsappNumber ?? c.phone,
    postalAddress: c.vault?.postalAddress ?? c.address ?? "", nomineeName: c.vault?.nomineeName ?? "", nomineeRelation: c.vault?.nomineeRelation ?? "",
    pehchaanKycId: c.vault?.pehchaanKycId ?? "", insurerClientId: c.vault?.insurerClientId ?? "",
    dob: c.vault?.dob ? c.vault.dob.toISOString().slice(0, 10) : c.dob ? c.dob.toISOString().slice(0, 10) : "",
  };
  const missing = clientMissing(c);

  // ── derived stats + AI summary ──
  const activePolicies = c.policies.filter((p) => p.status === "active");
  const premiumYr = activePolicies.reduce((s, p) => s + p.premium, 0);
  const ltv = ltvOf(c.policies);
  const tier = tierOf(ltv.annual);
  const nextRen = [...activePolicies].sort((a, b) => a.renewalDate.getTime() - b.renewalDate.getTime())[0];
  const familyCount = new Set(c.policies.flatMap((p) => p.insuredMembers.map((m) => m.name.toLowerCase()))).size;
  // unique insured family members across this holder's policies (with birthday if captured)
  const famMap = new Map<string, { name: string; relation: string | null; dob: Date | null }>();
  for (const p of c.policies) for (const m of p.insuredMembers) {
    const k = m.name.toLowerCase();
    if (!famMap.has(k)) famMap.set(k, { name: m.name, relation: m.relation, dob: m.dob });
    else if (m.dob && !famMap.get(k)!.dob) famMap.get(k)!.dob = m.dob;
  }
  const familyMembers = [...famMap.values()];
  const sinceYear = c.policies.length ? Math.min(...c.policies.map((p) => (p.firstInception ?? p.startDate).getFullYear())) : null;
  const hasNotice = c.documents.some((d) => d.type === "renewal_notice");
  const hasCopy = c.documents.some((d) => d.type === "policy_copy" || d.type === "policy");
  const renStatus = nextRen ? (daysUntil(nextRen.renewalDate) < 0 ? "Overdue" : "Pending") : "—";

  const summaryLines: string[] = [];
  if (sinceYear) summaryLines.push(`Customer since ${sinceYear}.`);
  activePolicies.slice(0, 3).forEach((p) => summaryLines.push(`${labelOf(LINES, p.line)}: ${p.carrier}${p.planName ? ` ${p.planName}` : ""} — ${inr(p.premium)}, renews ${fmtDate(p.renewalDate)}.`));
  if (familyCount) summaryLines.push(`Family covered: ${familyCount} member${familyCount !== 1 ? "s" : ""}.`);
  if (nextRen) summaryLines.push(`Renewal status: ${renStatus} (next ${fmtDate(nextRen.renewalDate)}).`);
  summaryLines.push(`Latest renewal notice: ${hasNotice ? "uploaded" : "missing"} · Latest policy copy: ${hasCopy ? "uploaded" : "missing"}.`);

  // ── timeline (every communication channel: WhatsApp, call, Gmail, SMS…) ──
  type Ev = { date: Date; kind: "comm" | "doc" | "task"; text: string };
  const chLabel = (ch: string) => {
    const c = ch.toLowerCase();
    if (c.includes("whatsapp")) return "WhatsApp";
    if (c.includes("call") || c.includes("phone")) return "Call";
    if (c.includes("mail")) return "Gmail / Email";
    if (c.includes("sms")) return "SMS";
    if (c.includes("meet")) return "Meeting";
    return ch;
  };
  const events: Ev[] = [
    ...c.communications.map((m) => ({ date: m.occurredAt, kind: "comm" as const, text: `${chLabel(m.channel)} ${m.direction === "inbound" ? "received" : "sent"}${m.subject ? ` · ${m.subject}` : ""}` })),
    ...c.documents.map((d) => ({ date: d.uploadedAt, kind: "doc" as const, text: `Uploaded ${labelOf(DOC_TYPES, d.type)} — ${d.fileName}` })),
    ...c.tasks.map((t) => ({ date: t.createdAt, kind: "task" as const, text: `Task: ${t.title}` })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const Stat = ({ label, value, tone = "ink" }: { label: string; value: string; tone?: string }) => (
    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
      <div className="text-[11px] uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-0.5 text-base font-semibold" style={{ color: tone === "red" ? "var(--red)" : tone === "amber" ? "var(--amber-700)" : "var(--ink)" }}>{value}</div>
    </div>
  );

  // ── policies list (reused) ──
  const policiesPanel = (
    <section className="card">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><FileText size={15} className="text-ink-3" /> Policies <span className="text-ink-3">({c.policies.length})</span></h2>
      </div>
      <div className="px-3 pb-3">
        {c.policies.length === 0 ? <p className="px-2 py-6 text-center text-sm text-ink-3">No policies yet. Add policies under the <a href="/policies" className="font-medium text-accent-700">Policies</a> page.</p> : (
          <ul className="space-y-1">
            {c.policies.map((p) => {
              const d = daysUntil(p.renewalDate);
              const tone = p.status !== "active" ? "gray" : d < 0 ? "red" : d <= 14 ? "amber" : "green";
              const pMissing = policyMissing(p);
              return (
                <li key={p.id} className="rounded-xl px-2 py-2.5 hover:bg-surface-2">
                  <div className="flex items-center gap-3">
                    <span className="pill pill-accent w-20 justify-center">{labelOf(LINES, p.line)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                        <span className="truncate">{p.carrier || "—"}{p.planName ? ` · ${p.planName}` : ""}</span>
                        {p.policyType && <span className="pill pill-gray shrink-0 text-[10px]">{p.policyType === "floater" ? "Family floater" : "Individual"}</span>}
                        {p.versions.length > 1 ? <span className="shrink-0 text-[10px] text-ink-4">· {p.versions.length} years</span> : null}
                      </div>
                      <div className="truncate text-[11px] text-ink-3 tnum">{p.policyNumber} · SI {inr(p.sumAssured)}{p.variant ? ` · ${p.variant}` : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-ink tnum">{inr(p.premium)}</div>
                      <span className={`pill pill-${tone}`}>{p.status === "active" ? (d < 0 ? `Overdue ${Math.abs(d)}d` : d === 0 ? "Due today" : `${d}d to renew`) : labelOf(POLICY_STATUS, p.status)}</span>
                    </div>
                    <PolicyRowActions clientId={c.id} proposerName={c.name} policyId={p.id} policyNumber={p.policyNumber}
                      defaults={{ line: p.line, carrier: p.carrier, planName: p.planName ?? undefined, variant: p.variant ?? undefined, policyNumber: p.policyNumber, previousPolicyNumber: p.previousPolicyNumber ?? undefined, sumAssured: p.sumAssured, premium: p.premium, deductible: p.deductible, tenureYears: p.tenureYears, frequency: p.frequency, paymentMode: p.paymentMode, firstInception: p.firstInception?.toISOString() ?? null, startDate: p.startDate.toISOString(), renewalDate: p.renewalDate.toISOString(), maturityDate: p.maturityDate?.toISOString() ?? null, status: p.status, nomineeName: p.nomineeName ?? undefined, nomineeRelation: p.nomineeRelation ?? undefined, insuredMembersText: p.insuredMembers.map((m) => `${m.name}${m.relation ? ` (${m.relation})` : ""}`).join("\n") }} />
                  </div>
                  {p.insuredMembers.length > 0 && <div className="mt-1.5 flex flex-wrap items-center gap-1 sm:pl-[88px]">{p.insuredMembers.map((mm) => <span key={mm.id} className="pill-gray pill">{mm.name}{mm.relation ? ` · ${mm.relation}` : ""}</span>)}</div>}
                  {pMissing.length > 0 && <div className="mt-1.5 text-[10px] sm:pl-[88px]" style={{ color: "var(--amber-700)" }}>Needs: {pMissing.join(", ")}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );

  return (
    <div className="space-y-4">
      <Link href="/clients" className="inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink"><ArrowLeft size={14} /> Policy Holders</Link>
      {c.archivedAt && <RestoreClientBanner clientId={c.id} />}
      {welcome && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm" style={{ background: "var(--emerald-50)", color: "var(--emerald-700)" }}>
          <Sparkles size={15} /> <b>{c.name}</b> added. {c.policies.length === 0 ? "Add their first policy to start tracking renewals — the form is open below." : "You can add more policies or documents anytime."}
        </div>
      )}

      {/* header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold" style={{ background: "var(--accent-50)", color: "var(--accent-700)" }}>{initials(c.name)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-ink">{c.name}</h1>
              {activePolicies.length > 0 && <span className="pill" style={{ background: "var(--surface-3)", color: tier.tone }} title={`${inr(ltv.annual)}/yr · ~${inr(ltv.value)} lifetime value`}>★ {tier.label}</span>}
              {missing.length > 0 && <span className="pill pill-amber" title={`Missing: ${missing.join(", ")}`}>Needs review · {missing.length}</span>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
              <span className="inline-flex items-center gap-1 tnum"><Phone size={12} /> {c.phone || "no phone"}</span>
              {c.altPhone && <span className="inline-flex items-center gap-1 tnum">{c.altPhone} (alt)</span>}
              {c.email && <span className="inline-flex items-center gap-1"><Mail size={12} /> {c.email}</span>}
            </div>
            {c.tags && <div className="mt-2 flex flex-wrap gap-1">{c.tags.split(",").map((t) => <span key={t} className="pill-gray pill">{t.trim()}</span>)}</div>}
            {(c.instagram || c.linkedin || c.facebook) && (
              <div className="mt-2 flex items-center gap-2">
                {c.instagram && <a href={socialUrl("instagram", c.instagram)} target="_blank" rel="noopener" className="text-ink-3 hover:text-accent" aria-label="Instagram"><Camera size={16} /></a>}
                {c.linkedin && <a href={socialUrl("linkedin", c.linkedin)} target="_blank" rel="noopener" className="text-ink-3 hover:text-accent" aria-label="LinkedIn"><Briefcase size={16} /></a>}
                {c.facebook && <a href={socialUrl("facebook", c.facebook)} target="_blank" rel="noopener" className="text-ink-3 hover:text-accent" aria-label="Facebook"><Globe size={16} /></a>}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AiDraftButton
              clientId={c.id}
              name={c.name}
              phone={c.phone}
              subject={renStatus === "Overdue" ? "Renewal reminder" : "Message"}
              purpose={nextRen ? `a warm, polite renewal reminder for their ${nextRen.carrier} ${labelOf(LINES, nextRen.line)} policy that is ${renStatus === "Overdue" ? "overdue" : "coming up for renewal"}; keep it short` : "a friendly check-in message"}
            />
            <PreMeetingBriefButton clientId={c.id} name={c.name} />
            <a href={waLink(c.phone, `Hi ${c.name},`)} target="_blank" rel="noopener" className="btn" style={{ color: "var(--emerald-700)" }}><MessageCircle size={15} /> WhatsApp</a>
            <a href={telLink(c.phone)} className="btn"><Phone size={15} /> Call</a>
            <ClientHeaderActions client={cd} households={households} policyCount={c.policies.length} />
          </div>
        </div>
      </div>

      <HolderTabs
        initial={welcome && c.policies.length === 0 ? "policies" : undefined}
        tabs={[
          {
            id: "overview", label: "Overview", icon: <LayoutDashboard size={14} />,
            content: (
              <div className="space-y-4">
                <section className="card p-5">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles size={15} style={{ color: "var(--accent)" }} /> AI summary <span className="preview-tag">AI preview</span></h2>
                  <ul className="mt-2 space-y-1">
                    {summaryLines.map((l, i) => <li key={i} className="flex items-start gap-2 text-sm text-ink-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />{l}</li>)}
                  </ul>
                </section>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Active policies" value={String(activePolicies.length)} />
                  <Stat label="Premium / yr" value={inr(premiumYr)} />
                  <Stat label="Next renewal" value={nextRen ? fmtDate(nextRen.renewalDate) : "—"} tone={nextRen && daysUntil(nextRen.renewalDate) < 0 ? "red" : nextRen && daysUntil(nextRen.renewalDate) <= 14 ? "amber" : "ink"} />
                  <Stat label="Family covered" value={String(familyCount)} />
                </div>
                <section className="card p-5">
                  <h2 className="pb-2 text-sm font-semibold text-ink">Personal information</h2>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                    {[["DOB", cd.dob || "—"], ["Gender", c.gender ?? "—"], ["Occupation", c.occupation ?? "—"], ["Income band", c.incomeBand ?? "—"], ["Alt phone", c.altPhone ?? "—"], ["Email", c.email ?? "—"]].map(([k, v]) => (
                      <div key={k}><dt className="text-[11px] text-ink-3">{k}</dt><dd className="truncate text-ink">{v}</dd></div>
                    ))}
                  </dl>
                  {(c.address || vault.postalAddress) && <div className="mt-3 flex items-start gap-2 border-t pt-3 text-sm text-ink-2" style={{ borderColor: "var(--border)" }}><MapPin size={14} className="mt-0.5 shrink-0 text-ink-3" /> {c.address || vault.postalAddress}</div>}
                </section>
                {c.tasks.length > 0 && (
                  <section className="card p-5">
                    <h2 className="pb-2 text-sm font-semibold text-ink">Open tasks ({c.tasks.length})</h2>
                    <ul className="space-y-1.5">
                      {c.tasks.map((t) => { const d = daysUntil(t.dueDate); return (
                        <li key={t.id} className="flex items-center gap-2 text-sm"><span className="h-3.5 w-3.5 shrink-0 rounded border" style={{ borderColor: "var(--border-2)" }} /><span className="min-w-0 flex-1 truncate text-ink-2">{t.title}</span><span className={`pill pill-${d < 0 ? "red" : d <= 1 ? "amber" : "gray"}`}>{d < 0 ? `${Math.abs(d)}d over` : d === 0 ? "today" : `${d}d`}</span></li>
                      ); })}
                    </ul>
                  </section>
                )}
              </div>
            ),
          },
          { id: "policies", label: "Policies", icon: <FileText size={14} />, badge: c.policies.length, content: policiesPanel },
          { id: "documents", label: "Documents", icon: <FileText size={14} />, badge: c.documents.length, content: <DocumentManager clientId={c.id} documents={c.documents.map((d) => ({ id: d.id, type: d.type, label: d.label, fileName: d.fileName, mimeType: d.mimeType, sizeBytes: d.sizeBytes, uploadedAt: d.uploadedAt.toISOString() }))} clientPhone={c.phone} /> },
          {
            id: "endorsements", label: "Endorsements", icon: <FileEdit size={14} />, badge: endorsements.length || undefined,
            content: <Endorsements clientId={c.id} policies={policyOpts} endorsements={endorsements.map((e) => ({ id: e.id, policyId: e.policyId, type: e.type, description: e.description, status: e.status, referenceNo: e.referenceNo, requestedAt: e.requestedAt.toISOString(), resolvedAt: e.resolvedAt?.toISOString() ?? null }))} />,
          },
          { id: "vault", label: "Vault", icon: <Lock size={14} />, content: <Vault vault={vault} /> },
          {
            id: "family", label: "Family", icon: <Users size={14} />, badge: familyMembers.length || undefined,
            content: (
              <div className="space-y-4">
                {familyMembers.length ? (
                  <section className="card">
                    <h2 className="flex items-center gap-2 px-5 pt-4 pb-2 text-sm font-semibold text-ink"><Users size={15} className="text-ink-3" /> Family members covered</h2>
                    <ul className="px-3 pb-3">
                      {familyMembers.map((m) => (
                        <li key={m.name} className="flex items-center justify-between rounded-xl px-2 py-2 text-sm hover:bg-surface-2">
                          <span className="text-ink-2">{m.name}</span>
                          <span className="flex items-center gap-2">
                            {m.dob && <span className="text-[11px] text-ink-3 tnum">🎂 {fmtDate(m.dob)}</span>}
                            <span className="pill-gray pill capitalize">{m.relation ?? "member"}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : <div className="card p-6 text-center text-sm text-ink-3">No family members captured yet. Add insured members when you add or edit a policy.</div>}
                {coveredOn.length > 0 && (
                  <section className="card">
                    <h2 className="flex items-center gap-2 px-5 pt-4 pb-2 text-sm font-semibold text-ink"><Users size={15} className="text-ink-3" /> Also covered on <span className="text-ink-3">(family policies)</span></h2>
                    <ul className="px-3 pb-3">
                      {coveredOn.map((ci) => (
                        <li key={ci.id}><Link href={`/clients/${ci.policy.client.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2"><span className="pill pill-accent w-20 justify-center">{labelOf(LINES, ci.policy.line)}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-ink">{ci.policy.carrier}{ci.policy.planName ? ` · ${ci.policy.planName}` : ""}</div><div className="truncate text-[11px] text-ink-3">as {ci.relation ?? "member"} · proposer: {ci.policy.client.name}</div></div><span className="text-sm text-ink-2 tnum">{inr(ci.policy.premium)}</span></Link></li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            ),
          },
          {
            id: "timeline", label: "Timeline", icon: <Clock size={14} />,
            content: (
              <section className="card p-5">
                <h2 className="flex items-center gap-2 pb-3 text-sm font-semibold text-ink"><Clock size={15} className="text-ink-3" /> Timeline</h2>
                {events.length === 0 ? <p className="py-4 text-center text-sm text-ink-3">Nothing logged yet.</p> : (
                  <ul className="space-y-3">
                    {events.map((e, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: e.kind === "doc" ? "var(--emerald)" : e.kind === "task" ? "var(--amber)" : "var(--accent)" }} />
                        <div className="min-w-0 flex-1"><div className="truncate text-ink-2"><span className="capitalize">{e.text}</span></div><div className="text-[11px] text-ink-4">{fmtDate(e.date)}</div></div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ),
          },
        ]}
      />
    </div>
  );
}
