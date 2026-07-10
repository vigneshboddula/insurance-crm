# Insurance CRM — Complete Documentation

_A local-first, AI-powered CRM for a solo insurance agent (Life/Term + Health) in India._
_Last updated: 2026-07-03. This is the single, complete reference for the whole system — what it is, how it's built, every screen, every model, the automation engine, security, operations, and the roadmap._

---

## Table of contents

1. [What this is (and the philosophy)](#1-what-this-is)
2. [Technology stack](#2-technology-stack)
3. [Where everything lives (data & build locations)](#3-where-everything-lives)
4. [The data model — all 25 tables](#4-the-data-model)
5. [Security & privacy](#5-security--privacy)
6. [Every screen, in detail](#6-every-screen-in-detail)
7. [The automation engine (Phase 3)](#7-the-automation-engine)
8. [The AI layer](#8-the-ai-layer)
9. [The insights engine](#9-the-insights-engine)
10. [Document extraction & auto-intake](#10-document-extraction)
11. [WhatsApp integration](#11-whatsapp-integration)
12. [Backup, restore, snapshots & export](#12-backup-restore-snapshots)
13. [Codebase map (file-by-file)](#13-codebase-map)
14. [How to run & operate it](#14-how-to-run)
15. [Roadmap — done & remaining](#15-roadmap)
16. [Glossary](#16-glossary)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. What this is

This is a **customer-relationship manager built for one insurance agent** (Vignesh) who sells **Life/Term and Health** policies in India. It is the one tool he opens every morning to run his book of business: track policy holders, chase renewals, collect premiums, follow up on leads, send WhatsApp messages, and let AI help draft and prioritise.

**Core principles:**

- **Local-first & private.** The whole app runs on the agent's own Windows PC. Sensitive client data (Aadhaar, PAN, uploaded documents) **never leaves the machine**. The only things that go out are (a) AI text calls to Anthropic on the agent's own key — with Aadhaar/PAN scrubbed first — and (b) WhatsApp messages sent from the agent's own number.
- **One install.** Everything is a single Next.js app on one runtime (Node.js), so the agent only installs Node — no database server, no Docker, no cloud account.
- **Trust before features.** Every phase is verified live before the next. Money is shown in ₹ (Indian formatting), emerald = money, amber→red = urgency/risk.
- **Remove clicks.** Each release should remove work, not just add capability — hence the automation engine, one-tap sends, PDF autofill, and AI drafting.

**Who uses it:** a single agent today, but the schema is kept "team-ready" (an `Agent` table exists) so multi-user could be added later without reshaping data.

---

## 2. Technology stack

| Layer | Choice | Why |
|---|---|---|
| **App framework** | Next.js 15 (App Router) + React 19 + TypeScript | One process serves both UI and API; server components keep heavy work server-side |
| **Database** | SQLite (a single local file) via **Prisma ORM** | Zero-install, private, single-agent. No enums (SQLite limitation) → status fields are strings, allowed values enforced in `lib/enums.ts` |
| **Styling** | Tailwind CSS + CSS variables | Warm "paper" neutrals + indigo/violet accent; design tokens in `app/globals.css` |
| **Icons** | lucide-react | |
| **Encryption** | AES-256-GCM (Node `crypto`) | Aadhaar/PAN + document bytes encrypted at rest |
| **AI** | Anthropic Claude (`@anthropic-ai/sdk`) | `claude-opus-4-8` for the assistant, `claude-haiku-4-5` (MODEL_FAST) for cheap structured tasks. Degrades gracefully with no key |
| **WhatsApp** | whatsapp-web.js 1.34 + puppeteer (bundled Chromium) | QR-linked to the agent's own number, no middleman |
| **PDF text** | pdf-parse | Local, free extraction from insurer PDFs |
| **Excel** | xlsx (SheetJS) | HDFC-ERGO renewal-file import + data export |
| **Zip/backup** | jszip | Encrypted backups + plaintext export bundles |
| **Optional (runtime)** | imapflow | Mailbox auto-intake (item 16) — installed only if IMAP is enabled |

**Runtime model:** one Node process. A background **engine** ticks inside it (see §7). WhatsApp and puppeteer are marked as `serverExternalPackages` in `next.config.mjs` so webpack doesn't bundle them.

---

## 3. Where everything lives

There are **two external folders outside the project**, both deliberate:

### 3a. Live data — `C:\Users\vigne\insurance-crm-data\`
OneDrive twice reverted/corrupted data kept inside the project folder, so all **live, sensitive, and changing data lives outside OneDrive**:
- `dev.db` — the live SQLite database (WAL mode on)
- `storage/` — encrypted document blobs
- `snapshots/` — daily automatic DB snapshots (keeps 14)
- `encryption.key` — the AES master key (file-first; env is a legacy fallback)
- `wwebjs_auth/` — the WhatsApp linked-session (moved here 2026-07-03 after OneDrive corrupted the old in-project copy → repeated `auth_failure`)
- `inbox/` — the watched-folder for document auto-intake (default location)

Paths are centralised in `lib/paths.ts`; `DATABASE_URL` and `CRM_DATA_DIR` in `.env` point here.

### 3b. Build artifacts — `C:\Users\vigne\insurance-crm-build\`
`node_modules` and `.next` are **NTFS junctions** pointing here (outside OneDrive). OneDrive kept corrupting the Next build (missing `BUILD_ID`/`prerender-manifest.json`) and locking the Prisma DLL. They must be **siblings under one external root**, or Node can't resolve `react/jsx-runtime` from the relocated `.next`. `Fix Build Location.cmd` re-creates the junctions if a `npm install` ever reverts them (it's called automatically by the launchers).

**Golden rule:** only **one** server may touch the DB at a time. Stale concurrent `next` processes once resurrected old data through the WAL. The launcher (`Start CRM.cmd`) has an "already-running" guard, so real use is safe.

---

## 4. The data model

The single source of truth is `prisma/schema.prisma`. SQLite has no enums — status/category fields are plain strings with allowed values in comments + `lib/enums.ts`. Money is `Float` (INR rupees). **25 tables:**

### People & households
- **Agent** — the agent using the CRM (single row; kept as a table for future team support).
- **Household** — a family unit (name, address). Note: the *UI* for households was removed; the model is kept for existing data, and the Family tab now shows insured members instead.
- **Client** — a **policy holder** (master entity). Name, phone, alt phone, email, address, DOB, occupation, income band, gender, relationship, tags, notes, social handles (Instagram/LinkedIn/Facebook), `archivedAt` (soft-delete). Relations: vault, documents, policies (as proposer), `insuredOn` (policies covering them), leads, tasks, communications, claims.
- **ClientVault** — the **encrypted KYC store** (one per client). `aadhaarEnc`, `panEnc` (AES-256-GCM), WhatsApp number, postal address, DOB, nominee (name/relation/DOB), `pehchaanKycId` (HDFC ERGO), `insurerClientId` (e.g. Care Health). Masked on screen; revealed only on explicit click (audit-logged).

### Policies & coverage
- **Policy** — an in-force policy. `clientId` = the **proposer** (owner/payer). Line, carrier, `policyNumber` (unique), plan/variant, sum assured, premium, deductible, `ncbValue` (no-claim bonus), frequency, payment mode, tenure, `firstInception` (original start), `startDate`, `renewalDate`, maturity, `previousPolicyNumber`, status, `renewalUrl` (payment link), nominee, source. Relations: renewals, claims, commission, insured members, versions.
- **PolicyVersion** — one yearly version of a policy (2024 copy, 2025 copy…). HDFC changes the policy number each renewal, linked via `previousPolicyNumber`. Each version can carry its own policy copy + renewal notice document (`policyCopyDocId`, `renewalNoticeDocId`).
- **PolicyInsured** — people covered by a policy (a floater may cover several). Keeps the raw name so import never blocks; optionally links to a Client. Has `dob` for family-birthday reminders.
- **Renewal** — a renewal cycle (dueDate, amount, status: pending/reminded/renewed/lapsed, `renewedAt`).
- **RenewalReminder** — the **sent-log** for the reminder cadence. A row is inserted only when a reminder for a given policy + cycle + step is actually sent, so nothing resends and it auto-stops on renewal. `channel`: `whatsapp` / `whatsapp-auto` / `skipped`.

### Documents & import
- **Document** — an uploaded file (Aadhaar/PAN card, policy PDF, claim doc…). Bytes are **encrypted at rest**; `storagePath` points to the blob. Typed + optionally linked to a policy/version.
- **IngestDoc** — the bulk-import review queue. Every uploaded PDF lands here with extracted fields + best match + confidence, then is auto-attached or sent to review.
- **ImportMatch** — remembers a manual import match (`key` → clientId) so the same row auto-matches next time.

### Claims, endorsements, collections
- **Claim** — an insurance claim (claimNumber, reason, amount, status: intimated/documents/processing/settled/rejected, notes).
- **Endorsement** _(Phase 5)_ — a mid-term policy change. Type (address/nominee/sum-insured/member add-remove/vehicle transfer/other), description, status (requested→submitted→approved/rejected), insurer reference, timestamps.
- **Collection** _(Phase 5)_ — a premium-collection ledger row, one per policy premium cycle (`@@unique([policyId, cycleDate])`). Expected vs collected amount, status (pending/partial/collected), mode, `collectedAt`.

### Work & communication
- **Lead** — a sales lead. Name, phone, source, stage (new/contacted/quoted/won/lost), interest, expected premium, AI score, notes, `quotedAt` (drives the day-2/5/10 quote autopilot).
- **Task** — a to-do (title, type, priority, dueDate, done, status, notes, optional client/policy link).
- **Communication** — the central interaction log (channel, direction inbound/outbound, subject, body, outcome, status). WhatsApp sends + inbound replies auto-log here.
- **Commission** — expected vs received commission per policy (status pending/partial/received, payout date).
- **MessageTemplate** — reusable WhatsApp templates (category, language en/te).

### Automation & system
- **AppSettings** — a single-row settings table (`id = "singleton"`). Holds reminder offsets, grace period, app passcode, social links, last-backup time, **and all automation-engine settings** (see §7).
- **Outbox** _(Phase 3)_ — the unified approve-queue + audit for items 14–18 automations. Category, client/lead, phone, title, message, `dedupeRef` (unique, idempotency), status (pending/sent/dismissed/failed).
- **AutoSend** _(Phase 3)_ — audit + daily-cap counter for messages the engine sent automatically (category, clientId, status, detail).
- **AuditLog** — security trail: vault reveals, unlocks, failed unlocks, passcode changes, restores (event + detail, never the value itself).
- **AIInsight** — reserved for stored AI insights (present in schema).

---

## 5. Security & privacy

- **Encryption at rest** (`lib/crypto.ts`): AES-256-GCM. `encrypt`/`decrypt` for strings (Aadhaar/PAN), `encryptBuffer`/`decryptBuffer` for document bytes, `maskId` for on-screen masking (shows last 4). The key lives in `insurance-crm-data\encryption.key` (file-first; `.env` `ENCRYPTION_KEY` is a blank legacy fallback). The key was rotated during Phase 1 (the DB was empty, so zero re-encryption).
- **Aadhaar/PAN** are **always** stored via `encrypt()` and **masked by default** in the UI; revealing is one click and writes an `AuditLog` `vault_reveal` entry.
- **App lock** (`lib/lock.ts`): an optional passcode (encrypted) + 30-minute idle auto-lock. A cookie is HMAC-signed with the app key; the lock screen gates the root layout. Set/change/remove in Settings → App lock. Unlocks, failed unlocks and passcode changes are audit-logged. _(No passcode is set by default — the agent sets his own.)_
- **AI privacy contract** (`lib/ai.ts`): a `redact()` function scrubs anything Aadhaar-shaped (12 digits) or PAN-shaped (ABCDE1234F) from **every** outbound string, as defence-in-depth. **Vault data is never included in any AI context.** AI runs only on the agent's own key; nothing is sent when the key is blank.
- **Git-ignored secrets:** `.env`, `dev.db`, `/storage` — they hold secrets/client data.

---

## 6. Every screen, in detail

Navigation is a desktop sidebar (`components/Sidebar.tsx`, `md:` only) + a mobile top bar. A **command palette** (`CommandPalette.tsx`) opens on ⌘K or a `cmdk-open` event. Global search sits on the dashboard + sidebar.

### Dashboard (`/`, `app/page.tsx`)
The server component calls `getDashboardData(range)` and passes plain props to client components. If the book is empty it shows a **first-run** screen (Add holder / Import / WhatsApp). Otherwise, in order:
- **Headline row** — Total Premium with Day/Month/YTD toggle + under-management, and KPI tiles (New Leads / Lead Actions / Renewals Due / Open Claims).
- **Quick-filter chips** — clickable (Clients · Active Policies · Premium Under Mgmt · Open Leads · Lapsed · Due This Month · Overdue · Due This Week).
- **Import card** — prominent, moved off the sidebar.
- **Reminders due** — renewal reminders ready to send (auto-hides when none); Send / Send all.
- **Approvals panel** — engine-prepared automation messages awaiting one-tap Send / Send-all / Dismiss (auto-hides when empty).
- **Alerts strip** + **Next-best-action** hero.
- **AI Morning Briefing** (left) + **Operations tiles** & **Tasks due** (right).
- **Cross-sell** spotlights, **renewals strip**, and **Business Pulse** (health score — the "Business Dashboard" anchor).
- A **time filter** (`?range=today|week|month`) drives which renewals/actions are in scope.

### Policy Holders (`/clients`)
Searchable list of clients + **Top clients by value** ranking (Phase 5 LTV). Add-client dialog. Each row → the holder profile.

**Holder profile (`/clients/[id]`)** — a header (avatar, contact, **LTV tier badge**, needs-review flag, social links, **Pre-meeting brief** button, AI draft, WhatsApp, Call, edit) plus a tabbed folder (`HolderTabs`):
- **Overview** — AI summary + stat tiles (active policies, premium/yr, **lifetime value**, next renewal, family) + personal info + open tasks.
- **Policies** — list with renewal status; add policy (with **PDF autofill**); edit/delete.
- **Documents** — bucketed (Policy Copies / Renewal Notices / KYC / Claims / Other), never mixed; upload & scan.
- **Endorsements** _(Phase 5)_ — log mid-term changes with a status flow.
- **Vault** — encrypted KYC, masked with reveal-on-click.
- **Family** — insured members (with 🎂 birthdays) + "also covered on" (family policies).
- **Timeline** — comms + document uploads + tasks, merged chronologically.

### Policies (`/policies`)
Defaults to **Recently Issued** (last 30 days by start date) with a Recently-issued / All toggle. Add policy with a client picker (existing or quick-create).

### Renewals (`/renewals`)
HDFC-style hub: a summary banner (next-7-days + premium), four category cards (**Immediate** 0–7d · **Recommended** high-value 8–30d · **Lapsed** · **Recently Renewed** last 90d), a filter bar (search, line-of-business, sort), and the reference table. Actions per row: **Send Payment Link** (opens the AI renewal draft → WhatsApp), **View**, **Mark renewed** (rolls the due date forward a year). A **Reminders due** panel drives the 6-step cadence.

### Collections (`/collections`) _(Phase 5)_
Premium-collection ledger: KPI cards (Expected / Collected / Outstanding) + a table of every in-force policy's due premium with a **Record payment** dialog (full or partial + mode). Keyed by policy+cycle so it's idempotent. Outstanding rows sort first.

### Leads (`/leads`)
Pipeline-focused Kanban (New / Contacted / Quoted / Won / Lost). Per-column count + ₹ value; header shows **pipeline value + weighted value** (expected premium × per-stage win-probability). Cards show **stale/aging flags** (idle-days → red "nudge them") and **quote-age** (tied to the day-2/5/10 autopilot). Full CRUD, advance stage, mark lost, per-lead WhatsApp, and **Convert to policy holder**.

### Claims (`/claims`)
Currently a `ComingSoon` placeholder (the Claim model + claim hand-holding automation exist; the full claims board is a future build).

### Tasks (`/tasks`)
Grouped Overdue / Today / Upcoming / Done, reusable dialog, a status dropdown (Open / Completed / Needs review / Call / Other), priority/policy/notes. Dashboard "Tasks due" widget + ⚡ quick-add.

### WhatsApp (`/whatsapp`)
Connect (QR) + compose + templates. Shows connection status (disconnected → initializing → qr → ready). Auto-reconnects from the saved session on boot. Send a message (optionally with a document attached; sends auto-log to Communications).

### Communications (`/communications`)
Central searchable history of every interaction, grouped by day, filterable by channel. A **Log communication** dialog for calls/notes that happen off-app. WhatsApp sends + inbound replies appear here automatically.

### Reports (`/reports`)
Last-6-months business report: this-month stat cards (premium secured, est. commission, renewals saved, new policies) + a month-by-month table with mini-bars. CSV download + Print/PDF.

### AI Assistant (`/assistant`)
Streaming chat over the live book — answers NL questions ("who has no health cover?"), does NL search, drafts messages, and can propose **actions** (create task / send WhatsApp) behind a confirm-before-send gate. Shows a setup card when no AI key is present.

### Import (`/import`)
Tabbed: **Excel** (HDFC-ERGO renewal file), **Policy Copies**, **Renewal Notices**, **Review Queue**. Bulk PDF upload with progress; auto-attaches ≥90%-confidence matches, else queues for review.

### Settings (`/settings`)
App lock · **Automation engine** (daily digest) · **Auto-send cadence** (approve/auto dial) · **Automations** (inbound/self-service/quote/win-back/claim/delight + watched folder + IMAP) · Encrypted backup / export / restore · reminder offsets · social links · shareable profile card.

---

## 7. The automation engine

_Phase 3 — the keystone. Everything ships **OFF** by default._

### The engine (`lib/engine.ts`)
An **in-process ticker** started from `instrumentation.ts` on server boot. It runs every **15 minutes** while the CRM is open (kept always-on via the launcher's login auto-start). It runs in-process by design — the "only one server may touch the DB" rule forbids a second background writer. Each tick:
1. Takes the daily DB snapshot (idempotent).
2. Pulls mailbox attachments (IMAP) + scans the watched folder → document auto-intake.
3. Runs client-facing auto-sends for any category set to "auto".
4. Once/day at a configured hour, sends a **digest to the agent's OWN WhatsApp** — never to clients. The digest (`buildDigest`) is deterministic: overdue renewals + ₹ at risk, renewals this week, reminders ready, tasks due today, plus "auto-sent X today".

### Auto-send cadence (`lib/autosend.ts`) — item 13
The safety layer over every client-facing automated message. Per-category dial:
- **Approve** (default) — the engine queues the message to the **Approvals panel** for a one-tap send.
- **Auto** — the engine sends it, fenced by **three guards**: master engine switch on · **quiet hours** (default 9pm–9am, wrap-around handled) · a **daily cap** (default 40) plus a per-tick cap (6) so sends trickle out.

Renewal reminders keep their own dedupe/log path (`RenewalReminder`); the newer categories flow through the **Outbox** (queue pending → auto-dispatch the ones in auto mode, deduped by `dedupeRef`).

### The reminder cadence (`lib/reminders.ts`)
Per policy: **1 month → 1 week → 5 days → 3 days → 2 days → renewal day → grace warnings** until lapse. The 1-month touch carries the payment link. Grace/near-due messages include **NCB-loss wording** for health/motor. `getDueReminders()` computes what's due now; a step is skipped once its `RenewalReminder` row exists (so it auto-stops on renewal).

### Two-way WhatsApp (`lib/inbound.ts`) — item 14
A `message` listener in the WhatsApp client routes inbound messages (1:1 only, known clients only) to triage. `inboundMode`: off / log / **triage**. In triage mode it classifies intent (Claude fast model, keyword fallback) and creates the right task: **renewed → verify & mark**, **needs time → follow-up (+3d)**, **question → high-priority reply**. Every inbound message logs to Communications. Unknown numbers are ignored.

### Client self-service (`lib/inbound.ts`) — item 15
For **known numbers only**, `selfServiceMode` off/approve/auto: answers **claim-status** questions (reads the open claim's status — never vault data) and **flags policy-copy requests** as a task (never auto-blasts a document). Approve = queued to Approvals; Auto = replies immediately.

### Document auto-intake (`lib/intake.ts` + `lib/imap.ts`) — item 16
- **Watched folder:** drop PDFs into the inbox folder; each tick extracts + matches + files them through the same pipeline as the manual import (shared `lib/ingest-core.ts`), moving sources to `processed/`. Unmatched ones land in the review queue.
- **IMAP (optional):** pulls PDF attachments from the agent's own mailbox into that folder. Password stored encrypted. `imapflow` is a **runtime-optional** dependency (install only to enable IMAP).

### Money automations (`lib/automations.ts`) — item 17
- **Quote follow-up autopilot** — day 2 / 5 / 10 nudges for `quoted` leads (`quotedAt` stamped on stage change).
- **Lapsed win-back** — reaches clients whose policy lapsed past grace (within ~120 days), with rupee NCB-loss wording.
- **NCB-loss wording** — added to renewal reminders (health/motor).

### Client-delight automations (`lib/automations.ts`) — item 18
- **Claim hand-holding** — stage-appropriate supportive messages as a claim moves through intimated → documents → processing.
- **Post-renewal thank-you + referral ask** — fires for renewals marked renewed in the last 3 days.
- **Policy-anniversary value recap** — on a policy's start-date anniversary.

All items 17–18 produce **touches** that the auto-send layer either queues (approve) or sends (auto), deduped by `Outbox.dedupeRef`.

---

## 8. The AI layer

`lib/ai.ts` is the single Claude wrapper: the API-key check (`aiAvailable()`), the models (`MODEL` = `claude-opus-4-8` for the assistant, `MODEL_FAST` = `claude-haiku-4-5` for cheap tasks), the shared `PERSONA`, `extractJson()`, and the `redact()` privacy scrubber. Two call shapes: `complete()` (one-shot) and `streamText()` (SSE for chat). `messageWithTools()` powers the confirm-before-send action layer.

- **`lib/ai-context.ts`** — `buildBookContext()` (non-sensitive snapshot for the assistant) + `clientFacts()` for message drafting. Never includes ClientVault.
- **`lib/ai-tools.ts`** — action tools (`send_whatsapp`, `create_task`) + `runAction` executor with name→client resolution.
- **AI surfaces:** morning briefing (`/api/ai/briefing`, cached 3h/day), message drafting EN/Telugu (`/api/ai/draft`), the streaming assistant (`/api/ai/assistant`), action execution only after confirm (`/api/ai/act`), pre-meeting briefs (`app/clients/brief-actions.ts`), inbound triage classification.
- **Cost guards:** briefing/drafting run on the cheaper fast model; briefing caches per (range, day). Everything degrades to heuristics or a setup card when no key is present.

---

## 9. The insights engine

`lib/insights.ts` — the most important computation file. `getDashboardData(range)` does **one batched fetch**, then computes everything in memory with transparent heuristics: KPIs, Book-Health score, money-at-risk, activity, smart actions, priority scores, alerts, performance scorecard, pipeline, cross-sell, lapse risk, renewal runway, relationship radar (incl. Indian festivals from `lib/festivals.ts`), goal/momentum, the morning briefing, headline figures, quick filters, and the ops tiles. `range` (`today`/`week`/`month`) drives the scope. `lib/ltv.ts` (Phase 5) adds lifetime-value ranking + tiers.

---

## 10. Document extraction

`lib/extract/` is a hybrid, **local, private** pipeline:
- `pdf.ts` — pdf-parse text extraction.
- `parse.ts` — insurer + doc-type detection + tolerant HDFC/Care field regexes → an `ExtractedDoc`.
- `match.ts` — matches a document to a policy: policy# → ClientID → mobile → name → member, including HDFC year-over-year number changes (`numberMatchKind`).
- `ingest.ts` — decides auto-attach vs review.
- `ingest-core.ts` — the shared attach/match logic used by both the manual `/import` flow and the automated watched-folder/IMAP intake.

**Aadhaar/PAN decision (2026-06-24):** real cards are camera scans with no text layer, and accurate reading needs cloud vision (which would send Aadhaar off-machine). Since the app is local-first, the agent chose **store the card (encrypted) + type the number once into the vault** — fully private, 100% accurate. OCR deps were removed; `parseAadhaar`/`parsePan` are kept in case cloud vision is ever opted in.

---

## 11. WhatsApp integration

`lib/whatsapp/client.ts` — a singleton client on `globalThis` (survives hot-reload). `LocalAuth` persists the session in `insurance-crm-data\wwebjs_auth`. Functions: `waConnect` / `waState` / `waSend` / `waLogout` / `waAutoConnect` (silent reconnect on boot). `waSend` throttles + adds a randomized human-like delay, normalises numbers to India (+91), and can attach a document. A `message` listener feeds inbound triage (§7). Routes: `/api/whatsapp/{status,connect,logout,send}`. Sends auto-log a Communication.

---

## 12. Backup, restore, snapshots

- **Daily snapshots** (`lib/snapshots.ts`) — a consistent `VACUUM INTO` copy of the DB into `snapshots/`, at most once/day, keeps the newest 14. Taken on boot + by the engine tick.
- **Encrypted backup** (`lib/backup.ts`, `/api/backup`) — DB + all documents, AES-256-GCM with a user passphrase → a `.crmbackup` file safe to store in Drive (useless without the passphrase). Round-trip verified incl. wrong-passphrase rejection.
- **Restore** (`/api/restore`) — decrypts into a `restore/` folder (never overwrites live data); the agent copies it into place.
- **Data export** (`/api/export`) — plaintext ZIP (clients & policies as Excel + all documents) for the agent's own use.

---

## 13. Codebase map

```
app/
  page.tsx                  Dashboard (server component)
  layout.tsx                Root layout: lock gate, providers, sidebar
  instrumentation.ts        Boots the snapshot + automation engine
  clients/                  Policy Holders: list, [id] profile, actions,
                            extract-actions (PDF autofill), brief-actions (LTV brief),
                            endorsement-actions
  policies/ renewals/ collections/ leads/ claims/ tasks/
  whatsapp/ communications/ reports/ assistant/ import/ settings/
  outbox/actions.ts         Approvals panel actions
  api/                      ai/*, whatsapp/*, backup, restore, export,
                            documents/[id], clients/[id]/docs, search
lib/
  db, paths, crypto, storage, lock, settings, enums, format, links, festivals
  insights.ts               Dashboard computation
  ltv.ts                    Lifetime-value ranking (Phase 5)
  reminders.ts              Renewal reminder cadence
  engine.ts                 Background engine tick + daily digest
  autosend.ts               Auto-send cadence + Outbox dispatch
  automations.ts            Quote/win-back/claim/delight touch generators
  outbox.ts inbound.ts      Approvals + two-way WhatsApp triage
  intake.ts imap.ts         Document auto-intake (folder + mailbox)
  ingest-core.ts extract/*  Extraction + matching pipeline
  ai.ts ai-context.ts ai-tools.ts   AI layer
  whatsapp/client.ts        WhatsApp client + inbound listener
  backup.ts snapshots.ts    Backup + daily snapshots
components/
  dashboard/*  clients/*  renewals/*  leads/*  collections/*
  settings/*  assistant/*  communications/*  tasks/*  import/*  ui/*
  Sidebar, GlobalSearch, LockScreen, MobileTopBar, ...
prisma/schema.prisma        The 25-table data model (source of truth)
```

**Windows launchers (project root):** `Start CRM.cmd` (single-server guard, builds on first run, opens browser), `Update CRM.cmd` (install + rebuild after changes), `Create Desktop Shortcut.cmd` (Desktop icon + optional login auto-start), `Fix Build Location.cmd` (re-junction node_modules/.next), `START HERE.txt`.

---

## 14. How to run

**For the agent (no terminal):** double-click **`Start CRM.cmd`** → it builds on first run, starts the production server, opens http://localhost:3000. Keep the window open while using the app; close it to quit. After code changes, run **`Update CRM.cmd`**.

**For development:**
```bash
npm install          # one-time
npm run setup        # one-time: prisma generate + db push + seed (demo data)
npm run dev          # dev server (slower; clobbers the prod build)
npm run build        # production build (also the fastest full typecheck)
npm run start        # production server (what the launcher uses)
npm run db:studio    # browse the DB in a GUI
npm run db:seed      # wipe + reload demo data (the seed clears all tables itself)
```
- After editing `prisma/schema.prisma`: `npx prisma db push` then `npx prisma generate`.
- **Never** run `db:reset` / `--force-reset` (Prisma blocks it anyway). To reset demo data just re-seed.
- There is no test/lint step beyond `next build`.
- Quote the path (it has spaces): `cd "...\insurance crm"`.

**Three standing to-dos for the agent:** copy `encryption.key` to a USB stick · set an app passcode in Settings · then add real clients.

---

## 15. Roadmap

**Done & verified:**
- **Phase 1 — Trust & polish:** data moved out of OneDrive + WAL; daily snapshots; key hardening; app lock + AuditLog; undo toasts + recoverable deletes; contrast/touch pass.
- **Phase 2 — Effortless daily use:** one-sheet Add Holder, smart date defaults, ⌘K everywhere, reminders-due panel, family-birthday trigger.
- **Phase 3 — Automation engine (all 7 items):** background engine + daily digest · auto-send cadence (approve→auto) · two-way WhatsApp + AI triage · client self-service · document auto-intake (folder + IMAP) · money automations (quote autopilot, win-back, NCB wording) · delight automations (claim hand-holding, thank-you+referral, anniversary).
- **Phase 4 — AI layer:** real Claude wired (assistant, briefing, EN/Telugu drafting, action layer) behind a graceful no-key fallback.
- **Phase 5 — partial:** item 23 (PDF autofill for Add-Policy) · item 25 (lifetime-value ranking + tiers + pre-meeting briefs).
- **Parked modules delivered:** Endorsement Tracker · Collection module · Leads redesign (pipeline-focused).

**Remaining / deferred:**
- **Phase 4 voice layer (items 19–22):** voice-clone WhatsApp notes · missed-call auto-triage · voice commands (local Whisper) · AI phone calls (needs TRAI/DLT). Deferred; item 19 needs a decision on a cloud voice provider.
- **Phase 5 items 24 & 26:** commission reconciliation + richer reports + renewal heatmap · phone companion via encrypted sync. Deferred ("later").
- **Blocked:** Gmail / Zapier / LinkedIn integrations — need the agent's external accounts/credentials and break local-first; only wired on opt-in.

_See `docs/ROADMAP.md` and `PROJECT.md` for the item-by-item log._

---

## 16. Glossary

- **Proposer** — the policy owner/payer (the `Client` on a `Policy`). Distinct from insured members.
- **Insured member** — a person covered by a policy (a floater may cover several).
- **NCB (No-Claim Bonus)** — a benefit that grows each claim-free year (health/motor); lost on lapse.
- **Grace period** — days after the due date a policy can still renew before it lapses (default 15).
- **Pehchaan KYC ID** — HDFC ERGO's KYC identifier.
- **Cycle / cycleDate** — the renewal/due date a reminder or collection record belongs to; used for idempotency.
- **Approve mode / Auto mode** — whether an automation queues for a one-tap send or sends itself within limits.
- **Quiet hours / daily cap** — the safety fence on automated sends.
- **Outbox** — the unified queue for engine-prepared messages (the Approvals panel).

---

## 17. Troubleshooting

- **Build fails with `Could not find a production build` / missing `BUILD_ID`** → an incomplete `.next`. Free port 3000, delete `.next` contents (or re-run `Fix Build Location.cmd`), `npm run build`.
- **Build fails with `Cannot find module 'react/jsx-runtime'` or `useContext` null on `/_error`** → the `node_modules`/`.next` junctions got split (usually after `npm install`). Move `node_modules` back out to `insurance-crm-build\`, re-junction (or run `Fix Build Location.cmd`), `npx prisma generate`, rebuild.
- **`prisma generate` fails with EPERM (locked DLL)** → a server is running and holding the Prisma DLL. Stop all Node processes, then generate.
- **WhatsApp stuck on `auth_failure`** → the linked session is corrupted. Log out on the WhatsApp page, Connect, scan a fresh QR. (The session now lives outside OneDrive, so this should be rare.)
- **Data "reappears" after a clear** → a stale second `next` process wrote back an old WAL view. Only one server may touch the DB; the launcher's guard prevents this in normal use.
- **AI features show a setup card** → no `ANTHROPIC_API_KEY` in `.env`. Paste the agent's key and restart.

---

_This document is a living reference. When you add a feature, update the relevant section here, plus `docs/ROADMAP.md` and `PROJECT.md`._
