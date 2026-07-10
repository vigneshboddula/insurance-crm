# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local-first, AI-powered CRM for a single insurance agent (Vignesh) in India, selling Life/Term + Health. It runs entirely on the user's Windows PC — sensitive client data (Aadhaar/PAN) never leaves the machine. The build is staged; see `PROJECT.md` for the phase plan, locked-in product decisions, and what's done vs. next. The user has minimal dev comfort — give exact, copy-paste commands.

## Commands

```bash
npm run dev          # start the app at http://localhost:3000
npm run build        # production build (also the fastest full typecheck)
npm run db:seed      # wipe + reload demo data (the seed clears all tables itself)
npm run db:studio    # browse the SQLite DB in a GUI
npm run setup        # one-time: prisma generate + db push + seed
```

- After changing `prisma/schema.prisma`, run `npx prisma db push` then `npx prisma generate`.
- **Do not run `npm run db:reset` / `prisma db push --force-reset`** — Prisma blocks it without explicit consent. To reset data just run `npm run db:seed` (it deletes all rows before inserting).
- There is no test suite or linter step beyond `next build`. Use `npm run build` to catch type/compile errors across the whole app.
- Single Windows note: the project path contains spaces — quote it (`cd "...\insurance crm"`).
- **`node_modules` and `.next` are NTFS junctions to `C:\Users\vigne\insurance-crm-build\` (OUTSIDE OneDrive).** OneDrive kept corrupting the Next build (missing `BUILD_ID`/`prerender-manifest.json`) and locking the Prisma DLL; moving both big/transient dirs out via junctions fixes it while keeping the source in OneDrive. They must be **siblings under one external root** or Node can't resolve modules from the relocated `.next` (walk-up finds the sibling `node_modules`). `Fix Build Location.cmd` re-creates the junctions if they ever revert (e.g. fresh `npm install`); it's called by `Start CRM.cmd` and `Update CRM.cmd` automatically. If you delete `.next` to fix a build, delete its *contents* or re-run that script — don't leave a real `.next` folder in OneDrive.

## Architecture

All-in-one **Next.js 15 (App Router) + React 19 + TypeScript** app. One runtime (Node) by design, so the user only installs Node. **SQLite via Prisma** — the live DB, encrypted documents, daily snapshots, the encryption key, and the **WhatsApp linked-session** (`wwebjs_auth/`) all live in **`C:\Users\vigne\insurance-crm-data\`** (OUTSIDE this OneDrive-synced folder; OneDrive twice reverted data kept here, and corrupted the WhatsApp session in the old in-project `.wwebjs_auth` → repeated `auth_failure` — never move them back). Paths centralized in `lib/paths.ts`; `DATABASE_URL`/`CRM_DATA_DIR` in `.env`. **Tailwind** for styling, **lucide-react** icons. AI (Anthropic Claude, Phase 4) and WhatsApp (whatsapp-web.js, Phase 3) are now wired — both run only on the user's own key/number and degrade gracefully when not configured (see `lib/ai.ts` and `lib/whatsapp/client.ts`).

### Data layer
- `prisma/schema.prisma` is the single source of truth. **SQLite has no enums** — status/category fields (e.g. `Policy.status`, `Lead.stage`, `Renewal.status`) are plain `String`s with allowed values documented in schema comments and enforced in app code. Money is `Float` (INR rupees).
- `lib/db.ts` exports a singleton `prisma` client. Server components/modules import from `@/lib/db`.
- `prisma/seed.ts` generates realistic demo data with dates **relative to "today"** (via `addDays`/`addMonths`) so the dashboard always has live overdue/due-soon/future renewals and a recent activity streak. When adding metrics that depend on "today"/"this week", make the seed populate them or they'll read as empty.

### Sensitive data & encryption
- `lib/crypto.ts` does AES-256-GCM; the key lives in `C:\Users\vigne\insurance-crm-data\encryption.key` (file-first, `ENCRYPTION_KEY` env is a legacy fallback — the `.env` value is intentionally blank). `encrypt`/`decrypt` for strings (Aadhaar/PAN), `encryptBuffer`/`decryptBuffer` for uploaded document bytes, `maskId` for on-screen masking. **Aadhaar/PAN must always be stored via `encrypt()`** (see `ClientVault` in the schema and how the seed populates `aadhaarEnc`/`panEnc`) and masked in the UI by default.
- `.env`, `prisma/dev.db`, and `/storage` are git-ignored — they hold secrets/client data.

### The insights engine (most important file: `lib/insights.ts`)
- `getDashboardData(range)` does **one batched fetch**, then computes everything for the dashboard in memory with transparent heuristics: KPIs, Book Health score, money-at-risk, activity rings/streak, smart actions, priority scores, alerts, performance scorecard, pipeline, cross-sell, lapse risk, renewal runway, relationship radar (incl. Indian festivals from `lib/festivals.ts`), goal/momentum, and the morning briefing.
- `range: "today" | "week" | "month"` is the **time filter** — it drives `horizonEnd` (which renewals/actions are in scope) and `perfStart` (the performance window). It flows from the URL `?range=` searchParam in `app/page.tsx` (page is `dynamic = "force-dynamic"`).
- **"AI preview" surfaces** (morning briefing, smart actions, priority accounts, cross-sell, lapse radar) are computed heuristics today, tagged in the UI via the `preview` prop on `Section`. The plan is to swap the heuristic for a real Claude call **behind the same return shape** in Phase 4 — keep these return types stable so the UI doesn't change.

### UI structure
- `app/page.tsx` is a **server component**: it calls `getDashboardData()` and passes plain serializable props down to **client components** in `components/dashboard/*` (all marked `"use client"` because they animate or are interactive). Keep heavy computation server-side; components just render.
- `components/dashboard/primitives.tsx` holds the shared animation primitives: `CountUp`, `Ring`, `Bar` (IntersectionObserver-driven, all respect `prefers-reduced-motion`). `components/dashboard/Section.tsx` is the standard card wrapper (title, icon, optional `preview` tag, optional `href`).
- The **command palette** (`CommandPalette.tsx`) opens on ⌘K or a `window` `"cmdk-open"` event — `QuickActions` and `MobileTopBar` dispatch that event rather than prop-drilling open state.
- Sidebar nav (`components/Sidebar.tsx`) is desktop-only (`md:`); `MobileTopBar.tsx` + `StickyTopActions.tsx` cover mobile. Pages other than the dashboard are `ComingSoon` placeholders by phase.

### Interim integrations (until their phase lands)
- **WhatsApp/Call buttons** use `lib/links.ts` (`waLink` → `wa.me`, `telLink` → `tel:`) so the user sends manually from their own number now. Phase 3 replaces these with true one-click automated sends (whatsapp-web.js, Option A / QR-linked) — preserve the per-client send + auto-log-to-communication-history behavior.

### Design system
- Tokens live as CSS variables in `app/globals.css`: warm "paper" neutrals + indigo/violet accent, **emerald = money**, **amber→red = urgency/risk**. Use the `.card`, `.card-hover`, `.pill-*`, `.btn*`, `.preview-tag` utilities and the `--*` variables rather than hardcoding colors. Numbers that show money/metrics get the `.tnum` (tabular) class. Font is Inter (`--font-inter`, wired in `app/layout.tsx`).
- The user holds a high design bar ("classic, premium, easy" — Linear/Notion/fintech feel). For UI changes, propose visual direction before building; keep motion restrained (load-time count-ups/ring-fills, gentle hover, no constant movement).
