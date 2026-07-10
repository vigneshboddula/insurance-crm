# Insurance CRM — Roadmap

North star: **the one tool a solo insurance agent opens every morning and trusts with their livelihood.**
Strategy: Path A — best-in-class local, single-agent, privacy-first tool. Enterprise/multi-tenant is parked.

Working rules: trust before features · every phase verified live before the next · each release removes clicks, not just adds capability.

---

## ▶ RESUME HERE (for a fresh session)
**Status: Phase 1 & 2 COMPLETE. Phase 3 (automation engine, items 12–18) all built; build green + live-render verified. Next = Phase 4 (voice & the wow layer) OR live functional testing of the Phase-3 automations with real data/WhatsApp (they ship OFF/approve).**

⚠️ **Build gotcha learned the hard way:** `npm install <anything>` replaces the `node_modules` **junction** with a real folder inside the project, splitting it from the sibling external `.next` → Node then can't resolve `react/jsx-runtime` (or throws `useContext` null while prerendering `/_error`). Fix: move `node_modules` back out to `insurance-crm-build\` and re-junction (or run `Fix Build Location.cmd`), then `npx prisma generate` + rebuild. After ANY `npm install`, verify both dirs are still junctions.

To continue in a new session, read: this file + `PROJECT.md` + `CLAUDE.md`. Key facts a new session MUST know:
- **Data lives OUTSIDE OneDrive** at `C:\Users\vigne\insurance-crm-data\` (`dev.db`, `storage/`, `snapshots/`, `encryption.key`). `.env` `DATABASE_URL`/`CRM_DATA_DIR` point there. **Never** move data back into the project folder.
- **Only ONE server may touch the DB at a time.** Stale concurrent `next` processes resurrected old data via the WAL. Before any DB clear/mutation: stop all servers, then `PRAGMA wal_checkpoint(TRUNCATE)`. The user launches via `Start CRM.cmd` (single-server guard) so their real use is safe.
- **The user's book is currently EMPTY on purpose** — they're about to enter real clients. Do NOT clear/seed data. Building features is additive and never deletes rows.
- Run model: build with **Opus 4.8** (Fable 5 only for hard/ambiguous work). Verify each item live in **production** (`npm run build` then start ONE server), not dev preview.
- User's 3 standing to-dos: copy `encryption.key` to USB · set app passcode in Settings · then add real clients.

---

## Phase 1 — Trust & Polish  ← IN PROGRESS (5/6 done)
- [x] 1. Move database + documents out of OneDrive → `C:\Users\vigne\insurance-crm-data\` (`lib/paths.ts`, `DATABASE_URL`/`CRM_DATA_DIR` in .env, storage/backup/restore repointed) + SQLite WAL. Verified: app + prisma push run on the new DB; old copies removed (pointer note left in `prisma/`). *Note: OneDrive reverted the old DB a second time during migration — confirming the move was essential.*
- [x] 2. Daily automatic DB snapshots (`lib/snapshots.ts` via `instrumentation.ts`): consistent VACUUM-INTO copy on server start, once/day, keeps 14, in `DATA_DIR/snapshots`. Verified (dev-2026-07-02.db created). Weekly auto-email → Phase 3 engine.
- [x] 3. Key hardening: fresh key **rotated** (old one had synced to OneDrive history; DB was empty so zero re-encryption) → now lives in `DATA_DIR/encryption.key`; `lib/crypto.ts` reads file-first with env fallback; `.env` key blanked. Verified: encrypt+decrypt round-trip on the new key. DPAPI wrap → later.
- [x] 4. App lock: passcode (encrypted) + 30-min idle auto-lock (`lib/lock.ts`, cookie HMAC-signed with the app key), lock screen gate in the root layout, Settings "App lock" card (set/change/remove), **AuditLog** model recording unlock / failed unlock / passcode changes / vault reveals. Verified: fresh sessions locked on every page, unlock + audit entries work. *No passcode is set — Vignesh sets his own in Settings.*
- [x] 5. Undo toasts + recoverable deletes: `components/ui/Toast.tsx` (ToastProvider in root layout, 6-s undo window). **Undoable deletes** — tasks, leads, communications (delete actions return snapshots; `restore*` recreates with same id), and client archive now undoes via `restoreClient`. **Two-step armed confirms** (styled, replaces `window.confirm`) — policy delete, document delete, lead→holder convert. Plus: route-level skeletons (`loading.tsx` on 7 routes via `components/ui/Skeleton.tsx`) and a **first-run dashboard** (`FirstRun.tsx` — shown when the book is empty: Add holder / Import / WhatsApp CTAs). Verified live in production: create→delete→toast-with-Undo on tasks; first-run screen renders. *(Note: dev-mode preview showed a stuck-skeleton streaming artifact; production is unaffected — verified.)*
- [x] 6. Quick-win UI pass: AA-contrast ink tones, styled selects (custom chevron, hover accent), ≥44px touch targets on touch devices, focus rings (already present) kept.

**PHASE 1 COMPLETE — verified live. Next: Phase 2 (one-sheet Add Holder, inline editing, ⌘K actions, reminders on dashboard, birthday trigger).**

## Phase 2 — Effortless daily use  ← COMPLETE (verified)
- [x] 7. **One-sheet Add Holder flow**: `createClient` → redirects to the new profile with `?welcome=1` → a welcome banner + the Add-Policy dialog **auto-opens** (HolderTabs opens on the Policies tab, `AddPolicyDialog autoOpen`). Add a holder and their first policy in one continuous flow. **Verified live** (banner + policy dialog auto-open).
- [x] 8. **Smart defaults** in `PolicyFields`: entering first-inception/start date auto-fills the start and the **renewal date = start + 1 year** (only if empty). **Verified live** (2026-08-15 → 2027-08-15).
- [x] 9. **⌘K everywhere**: CommandPalette moved from the dashboard into the **root layout** (mounts on every page); added Action items (Add holder / Import / Draft with AI / Send reminders / Log call). Compile-verified.
- [x] 10. **Reminders-due panel on the dashboard**: `getDueReminders()` + `<RemindersDue>` rendered on the dashboard (auto-hides when none due). Reuses the proven Renewals panel + Send-all.
- [x] 11. **Family-birthday trigger**: `lib/insights.ts` now feeds `PolicyInsured.dob` family birthdays into the relationship radar (deduped), so they surface in the AI briefing (and the Phase-3 engine will auto-send). Insured-members added to the batched fetch.

### ⚠️ Data-integrity root cause found & handled (during Phase 2 verification)
The demo/import data "reappearing" was **NOT** OneDrive (the DB is safely outside it now). It was **concurrent stale `next` server processes** writing back an old SQLite WAL view after a clear. Fix/rule: **only one server may touch the DB at a time**; before any DB clear/mutation, stop all servers and `PRAGMA wal_checkpoint(TRUNCATE)`. The user's real usage is safe — the launcher (`Start CRM.cmd`) has an "already-running" guard, so only one server ever runs. DB re-cleared cleanly (0 clients) with no server running; verified persisted by a second process + after a fresh prod boot.

**Next: Phase 3 — the automation engine (background worker + daily digest, auto-send cadence, two-way WhatsApp, client self-service).**

## Phase 3 — The Automation Engine (keystone)  ← IN PROGRESS (item 12 done)
- [x] 12. **Background engine** (`lib/engine.ts`, started from `instrumentation.ts`): an in-process ticker (every 15 min) that keeps taking the daily DB snapshot and, once per day at a configured hour, sends a **daily digest to the agent's OWN WhatsApp** — never to clients. Runs in-process by design (the "only ONE server may touch the DB" rule rules out a second background process); "always-on" = the launcher's login auto-start. `buildDigest()` is deterministic (works with/without an AI key): overdue renewals + ₹ at risk, renewals due this week, reminders ready to send, tasks due today, with a "clear runway" message when nothing's pressing. New **Settings → Automation engine** card (`components/settings/EngineCard.tsx`): master on/off, digest target number (defaults to the connected WhatsApp number), digest time, last-run status, and a **Send test digest** button. AppSettings gained `engineEnabled`/`agentWhatsApp`/`digestHour`/`lastDigestOn`/`lastEngineTickAt`. **Verified live in production:** build green, `[engine] started`, tick executed (lastEngineTickAt written + shown in the card), `buildDigest()` returns a well-formed digest on the empty book, and the Settings card renders. *Engine is OFF by default — Vignesh turns it on in Settings.*
- [x] 13. **Auto-send cadence** (`lib/autosend.ts`): the safety layer over every client-facing automated message. Per-category dial — **"approve"** (default; nothing sends, the message waits in the `/renewals` approve queue for a one-tap send) vs **"auto"** (the engine sends it). Auto-mode is fenced by three guards: master engine switch on · **quiet hours** (wrap-around window, default 9pm–9am) · a **daily cap** across all categories (default 40) plus a per-tick cap (6) so sends trickle out human-like. `runAutoSends()` runs in the engine tick and (for the renewal category) reuses the proven `recordReminderSent()` path so an auto-send dedupes/logs exactly like a manual one and never double-fires. New `AutoSend` model = daily-cap counter + audit; AppSettings gained `renewalSendMode`/`autoSendDailyCap`/`quietStart`/`quietEnd`/`lastAutoSendAt`. New **Settings → Auto-send cadence** card (`components/settings/AutoSendCard.tsx`): the Approve/Auto segmented dial, quiet-hours pickers, daily cap, "auto-sent today X/cap". Digest now reports what was auto-sent. **Verified live in prod:** build green · quiet-hours truth table correct (incl. midnight wrap + disabled window) · `runAutoSends()` returns `skipped:"engine off"` on defaults (nothing sends until engine on AND category=auto) · card renders with safe defaults. *Ships in Approve mode — Vignesh opts into Auto per category.*
- [x] 14. **Two-way WhatsApp** (`lib/inbound.ts` + a `message` listener in `lib/whatsapp/client.ts`): every inbound message from a KNOWN client (phone-matched; unknown numbers ignored) is logged to the comms history, then — in "triage" mode — classified (Claude `MODEL_FAST`, heuristic fallback) into renewed → "verify & mark" task · needs-time → follow-up task (+3d) · question → high-priority reply task. Setting `inboundMode` = off | log | triage (OFF default).
- [x] 15. **Client self-service** (in `lib/inbound.ts`, `selfServiceMode` off|approve|auto): for KNOWN numbers only, answers *claim-status* asks (reads the open claim's status — never vault data) and *flags* policy-copy requests as a task (never auto-blasts a document). Approve → queued to the Approvals panel; auto → replies immediately.
- [x] 16. **Document auto-intake** (`lib/intake.ts` watched folder + `lib/imap.ts` mailbox): the engine tick scans an inbox folder and runs every PDF through the SAME extract→match→auto-file pipeline as the manual import (shared `lib/ingest-core.ts`), moving sources to `processed/`. IMAP (optional `imapflow`, runtime-loaded) deposits mailbox PDF attachments into that folder. Both OFF by default; settings `watchedFolderEnabled`/`watchedFolderPath`/`imap*` (password encrypted).
- [x] 17. **Money automations** (`lib/automations.ts`): quote follow-up autopilot (day 2/5/10 nudges for `quoted` leads, `quotedAt` stamped on stage change) · lapsed win-back (policies past grace, with rupee NCB-loss wording) · **NCB-loss wording** added to renewal reminders (`lib/reminders.ts`, health/motor). Modes `quoteSendMode`/`winbackMode`.
- [x] 18. **Client-delight automations** (`lib/automations.ts`): claim hand-holding (stage-appropriate supportive messages) · post-renewal thank-you + referral ask · policy-anniversary value recap. Modes `claimSeqMode`/`delightMode`.

**Delivery model for 14–18:** every category runs through one **Auto-send governance** path (`lib/autosend.ts`) — approve = queued to a new **Outbox** and shown in the dashboard **Approvals panel** (`components/dashboard/ApprovalsPanel.tsx`, one-tap Send / Send-all / Dismiss via `app/outbox/actions.ts`); auto = the engine sends within the item-13 quiet-hours + daily-cap limits, deduped by `Outbox.dedupeRef`. New **Settings → Automations** card (`components/settings/AutomationsCard.tsx`). Everything ships **OFF**. **Verified:** full `next build` green; `/` + `/settings` render 200 with all sections; engine ticks with no errors. Live functional exercise of each automation still needs real clients/leads/claims + a linked WhatsApp (book is intentionally empty).

## Phase 4 — Voice & the wow layer
- [ ] 19. Voice clone → WhatsApp voice notes (renewals, birthdays, policy explainers) — ⚠ needs user OK: voice + message text go to a cloud voice provider
- [ ] 20. Missed-call auto-triage (missed call → instant WhatsApp follow-up)
- [ ] 21. Voice commands to the CRM (local transcription → tasks/notes)
- [ ] 22. AI phone calls Level 1→2 (after voice notes prove out; needs TRAI/DLT registration)

## Phase 5 — Reach & depth
- [x] 23. **PDF autofill for Add-Policy** (`app/clients/extract-actions.ts` + `components/clients/PolicyPdfPrefill.tsx`): "Upload policy PDF to auto-fill" in the Add-Policy dialog reads the PDF locally (reuses `lib/extract`), maps insurer/plan/policy#/SI/premium/dates/members into the form for the agent to review + save. Verified live (build green, dialog wired).
- [ ] 24. Commission reconciliation · richer reports · renewal heatmap year-view — *deferred (user: later)*
- [x] 25. **Client lifetime-value ranking + pre-meeting briefs** (`lib/ltv.ts`, `app/clients/brief-actions.ts`): transparent LTV heuristic (annualized in-force premium × 5-yr horizon × loyalty) → **tier** (Platinum/Gold/Silver/Bronze) shown on the profile + a **"Top clients by value"** ranking on `/clients`; **Pre-meeting brief** button (`PreMeetingBriefButton`) generates a 20-second brief (Claude `MODEL_FAST` with a deterministic fallback, never vault data). **Verified live:** ranking + tier badge + LTV stat + brief button all render.
- [ ] 26. Phone companion via E2E-encrypted sync — *deferred (user: later)*

### Parked items requested
- [x] **Endorsement Tracker** (`Endorsement` model, `app/clients/endorsement-actions.ts`, `components/clients/Endorsements.tsx`): a new **Endorsements tab** on the policy-holder profile logs mid-term changes (address/nominee/sum-insured/member add-remove/vehicle transfer/other) with a status flow (requested→submitted→approved/rejected) + insurer reference. **Verified live** (tab renders).
- [x] **Collection module** (`Collection` model, `/collections` page + `components/collections/CollectionsView.tsx`): premium-collection ledger — Expected/Collected/Outstanding KPIs + a table of every in-force policy's due premium with a **Record payment** dialog (full or partial, payment mode), keyed by policy+cycle so it's idempotent. Sidebar entry added. **Verified live** (28 policies → 28 ledger rows on the real book).
- [x] **Leads redesign — pipeline-focused** (`components/leads/LeadsBoard.tsx`): added **weighted pipeline value** (expected premium × per-stage win-probability), **stale/aging flags** (idle-days per stage, red "nudge them" badge + per-column count), and **quote-age** on quoted cards tied to the day-2/5/10 autopilot. **Verified live** (weighted value renders). Lead query now returns `updatedAt`/`quotedAt`.
- [ ] **Gmail / Zapier / LinkedIn** — BLOCKED: need the user's external accounts/API credentials and break the local-first/privacy stance; wire only when the user opts in + provides credentials.

## Parked (deliberately)
Endorsement Tracker & Collection modules (need definition) · Leads redesign · full conversational AI calls · Gmail/Zapier/LinkedIn · enterprise multi-user/RBAC.

## Open decisions
- Phase 4 voice trade-off (cloud voice provider) — decide before item 19.
