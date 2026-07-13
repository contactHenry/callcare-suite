# Call Centre Operations Platform

A full‑stack contact‑centre operations app for managing clients, calls, agents, quality assurance, compliance and staff — built on **TanStack Start**, **React 19**, **Tailwind v4**, and **Lovable Cloud (Supabase)**.

---

## Table of Contents

1. [Overview](#overview)
2. [Feature Modules](#feature-modules)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Project Structure](#project-structure)
6. [Roles & Permissions](#roles--permissions)
7. [Data Model](#data-model)
8. [Local Development](#local-development)
9. [Environment Variables](#environment-variables)
10. [Deployment](#deployment)
11. [Conventions](#conventions)

---

## Overview

This app is an internal tool for a call centre with agents, team leaders, supervisors, ops admins and super admins. It handles the full client lifecycle — from intake and assignment, through outbound/inbound calling with a soft‑phone dialer, to QA scoring, complaints, escalations, reporting and workforce management.

All server logic runs as **TanStack `createServerFn`** RPCs (with a `requireSupabaseAuth` middleware) or as **file‑based server routes** for webhooks. The database, auth and storage are backed by Lovable Cloud (Supabase) with Row‑Level Security on every table.

---

## Feature Modules

### Clients
- List, filter (search, status, consent, DNC), sort and paginate contacts.
- Row‑click details modal with full profile, tags, address, consent state.
- Add new client CTA, bulk assign to agents, CSV import and export.
- Change approvals workflow for sensitive edits, export requests, duplicate merging.
- Integrated soft‑phone dialer with hold / mute / warm & cold transfer.

### Calls
- Live calls board, monitoring & whisper, call queue, outbound call composer.
- Call detail view with recording access log, notes, review tags, disposition.
- Telephony settings (caller IDs, recording consent, voicemail drop).

### Complaints & Escalations
- Lodge complaints, assign to an agent, track status (open → escalated → resolved).
- Table shows assigned vs unassigned complaints; per‑complaint updates thread.

### Quality Assurance
- Scorecards, sections and weighted criteria.
- Review assignment, scoring, auto‑computed overall score, disputes and coaching notes.
- QA dashboard and acknowledgements.

### Campaigns, Scripts & Follow‑ups
- Campaign management with disposition definitions.
- Versioned call scripts with acknowledgements and AI‑assisted authoring.
- Follow‑up queue tied to client `next_follow_up_at`.

### Staff, Teams & Attendance
- Staff directory, team membership, shift schedules, punches, swap requests.
- Agent availability with status log.

### Admin — Roles, Permissions & Access
- Streamlined role management: view role hierarchy (agent → super_admin), create custom roles, toggle permissions per role.
- Only `super_admin` can mutate role permissions.

### Security & Compliance
- MFA (TOTP), IP allowlist, SSO providers, failed login tracking, account suspensions.
- Append‑only audit log, DSR (data request) workflow, consent records.

### Notifications & Announcements
- In‑app notifications bell with mark‑as‑read (individual + bulk) and popover.
- Announcements with read receipts and preferences per user.

### Reports & Integrations
- Report runs, ad‑hoc exports, third‑party integrations catalogue.

### Support & Tickets
- Ticketed help desk tailored to the organization: raise a new ticket (category, priority, subject, description, screenshot attach) via the **New ticket** dialog.
- Table view lists all tickets with status pills (open / in progress / pending / resolved / closed) and priority.
- Click any row to open the ticket detail modal with a status progression timeline (submitted → assigned → in progress → resolved) plus a threaded chat between the requester and the product owner for clarifications and resolution notes.
- Seeded with realistic dummy tickets — raised, assigned, pending and resolved — so the module demos end‑to‑end without a backend seed.

---

## Recent Updates

- **Support & Tickets module** — new dummy‑seeded ticket list, `NewTicketDialog`, detail modal with progression timeline and chat thread (`src/routes/_authenticated/support.index.tsx`).
- **Table styling consistency** — every table across the app now follows the same **bottom‑line‑only** pattern (no border lines, no corner radius, no card chrome), matching the Campaigns and Tasks/Follow‑ups tables. Wrappers that added rounded/bordered containers were removed from Support, Admin → Permissions, Attendance, Compliance and Reports.
- **Fixed sidebar with independent scroll** — the primary side navigation in `AppShell` is now sticky with a fixed viewport height. It no longer scrolls with the page; overflowing nav items scroll inside the sidebar itself.
- **Live Calls metrics parity** — the metrics cards on the Live Calls page now match the height of the Dashboard metrics cards for a consistent header rhythm.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start v1 (SSR + server functions) |
| UI | React 19, Tailwind CSS v4, shadcn/ui, Radix primitives, lucide-react |
| Data | TanStack Query 5, Zod validators |
| Backend | Lovable Cloud (Supabase) — Postgres, Auth, Storage, RLS |
| Server logic | `createServerFn` + `requireSupabaseAuth` middleware |
| Build | Vite 7, targeting Cloudflare Workers runtime |
| Forms | react-hook-form + @hookform/resolvers |
| Charts | recharts (in reports/QA dashboards) |
| Notifications | sonner toasts |

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                    Browser (React 19 SPA)                    │
│  Routes  →  TanStack Router (file-based, code-split)         │
│  State   →  TanStack Query cache                             │
│  Auth    →  Supabase JS client (session in localStorage)     │
└──────────────────────────┬───────────────────────────────────┘
                           │ RPC (typed) via useServerFn
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              TanStack Start server (Cloudflare Worker)       │
│  createServerFn handlers  +  requireSupabaseAuth middleware  │
│  Server routes  (src/routes/api/…)  for webhooks             │
└──────────────────────────┬───────────────────────────────────┘
                           │ Postgres wire (as signed-in user)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                 Lovable Cloud (Supabase)                     │
│  Postgres + RLS   Auth   Storage (call-recordings,           │
│                                    client-documents)         │
└──────────────────────────────────────────────────────────────┘
```

**Key rules baked into the app**
- Auth‑gated routes live under `src/routes/_authenticated/*`, whose managed layout runs `ssr: false` and redirects unauthenticated users to `/auth`.
- Every server function that touches user data uses `requireSupabaseAuth`; the bearer token is attached automatically by client middleware in `src/start.ts`.
- Privileged operations use `supabaseAdmin` (service role), loaded inside the handler with a dynamic `import()` so the module never leaks into the client bundle.
- Every `public` table has explicit `GRANT`s plus RLS policies scoped to `auth.uid()` or a `has_role(...)` / `has_permission(...)` check.

---

## Project Structure

```text
src/
├── routes/
│   ├── __root.tsx                # Global shell, head metadata, providers
│   ├── index.tsx                 # Landing / sign-in redirect
│   ├── auth.tsx                  # Sign-in / OAuth entry
│   ├── _authenticated/
│   │   ├── route.tsx             # Auth gate (ssr: false, managed)
│   │   ├── dashboard.tsx
│   │   ├── clients.index.tsx     # Clients list + add/details modals
│   │   ├── clients.$id.tsx       # Full client profile
│   │   ├── clients.approvals.tsx # Change approvals + export requests
│   │   ├── clients.import.tsx
│   │   ├── calls.*               # Live / queue / detail / new
│   │   ├── qa.*                  # Scorecards, criteria, reviews, dashboard
│   │   ├── complaints.index.tsx
│   │   ├── staff.index.tsx
│   │   ├── admin.roles.tsx       # Role & access management
│   │   ├── admin.permissions.tsx # Permission matrix
│   │   └── …
│   └── api/                      # Server routes (webhooks/public API)
├── lib/
│   ├── *.functions.ts            # createServerFn RPCs (client-safe)
│   ├── *.server.ts               # Server-only helpers (blocked from client)
│   ├── auth.tsx                  # useAuth() hook, role helpers
│   ├── permissions.functions.ts  # requirePermission middleware
│   └── dummy-data.ts             # Demo fallback rows
├── components/
│   ├── AppShell.tsx              # Sidebar, header, notifications, profile menu
│   ├── CallControlBar.tsx        # Persistent in-call bar
│   ├── cc/                       # Design-system primitives (CCButton, CCTable, …)
│   └── ui/                       # shadcn/ui components
├── integrations/supabase/        # Auto-generated clients & middleware
├── styles.css                    # Tailwind v4 tokens & @theme
└── start.ts                      # Server entry, middleware registration
```

> Do not edit `src/routeTree.gen.ts` or files under `src/integrations/supabase/` — they are auto-generated.

---

## Roles & Permissions

Roles are stored in `public.user_roles` and ranked as:

| Level | Role |
|---:|---|
| 5 | `super_admin` |
| 4 | `ops_admin` |
| 3 | `supervisor` |
| 2 | `team_leader` |
| 1 | `agent` |

Permissions come from two sources, combined by `has_permission(user, permission)`:

1. **Built‑in `role_permissions`** — inherited by rank (a supervisor gets every team_leader permission).
2. **Custom roles** (`custom_roles` + `custom_role_permissions`) assignable per user.

The **Admin → Roles** page lets `ops_admin`+ create custom roles and assign users; **Admin → Permissions** lets `super_admin` toggle role permissions.

---

## Data Model (highlights)

| Domain | Key tables |
|---|---|
| Clients | `contacts`, `client_consents`, `client_contact_methods`, `client_documents`, `client_change_approvals`, `client_export_requests`, `client_merges`, `client_status_transitions` |
| Calls | `calls`, `call_notes`, `call_queue`, `call_recording_access_log`, `call_review_tags`, `call_transfers`, `call_monitoring_sessions`, `call_outcome_definitions`, `call_scripts`, `call_script_versions` |
| QA | `qa_scorecards`, `qa_scorecard_sections`, `qa_scorecard_items`, `qa_criteria`, `qa_reviews`, `qa_review_scores`, `qa_review_assignments`, `qa_disputes`, `qa_coaching_notes`, `qa_acknowledgements` |
| Workforce | `profiles`, `user_roles`, `custom_roles`, `custom_role_permissions`, `user_custom_role_assignments`, `teams`, `team_members`, `agent_availability`, `attendance_shifts`, `attendance_punches`, `shift_swap_requests` |
| Communication | `notifications`, `notification_preferences`, `announcements`, `announcement_reads`, `complaints`, `complaint_updates`, `tasks`, `task_comments`, `task_attachments` |
| Security | `audit_log`, `login_history`, `failed_login_attempts`, `two_factor_secrets`, `sso_providers`, `ip_allowlist`, `account_suspensions`, `data_requests` |

Notable DB behaviours:
- `enforce_client_status_transition` trigger validates lifecycle changes and writes `client_status_transitions`.
- `recompute_review_score` recalculates weighted QA scores on any score change.
- `notify(...)` is a helper used by triggers (task assigned, complaint escalated) to write to `notifications`.
- `audit_log` is append‑only (enforced by `audit_log_append_only` trigger).
- `handle_new_user` provisions a `profiles` row, default role and availability record on sign‑up. The first user in the `default` org becomes `ops_admin`.

---

## Local Development

```bash
bun install          # or pnpm / npm
bun run dev          # start Vite dev server on http://localhost:8080
bun run build        # production build
bun run build:dev    # dev-mode build (prerender against dev)
bun run test         # vitest
bun run lint         # eslint
```

The Vite plugin auto‑generates `src/routeTree.gen.ts` — never edit it. Add a file under `src/routes/` and the tree regenerates.

---

## Environment Variables

Client (exposed in the browser):

| Var | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable / anon key |
| `VITE_SUPABASE_PROJECT_ID` | Project ref (used by generated helpers) |

Server‑only (never expose to the client):

| Var | Purpose |
|---|---|
| `SUPABASE_URL` | Same URL, used by server helpers |
| `SUPABASE_PUBLISHABLE_KEY` | For `requireSupabaseAuth` + public reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client (`supabaseAdmin`) — privileged ops only |
| `LOVABLE_API_KEY` | Lovable AI Gateway + connectors (auto‑provisioned) |

Lovable Cloud manages these automatically. Add additional secrets through the Lovable Secrets UI, not via a committed `.env`.

---

## Deployment

The app is designed for the Cloudflare Workers runtime that ships with Lovable. Publish from the Lovable editor:

- **Preview:** `project--<id>-dev.lovable.app` — always the latest preview build.
- **Production:** `project--<id>.lovable.app` — served after **Publish**.

Server routes under `src/routes/api/public/*` bypass auth (for webhooks and cron); every other route requires an authenticated session gated by the `_authenticated` layout.

---

## Conventions

- **Server logic:** put app‑internal work in `*.functions.ts` with `createServerFn`. Reserve `supabase/functions/*` edge functions for external webhooks that must land inside Supabase's network.
- **Design tokens:** all colours, radii, and shadows live in `src/styles.css` as CSS variables (`--cc-*`) and are consumed via `bg-[color:var(--cc-brand)]` etc. Avoid hardcoded Tailwind colour utilities like `bg-white` in feature components.
- **Modals over navigation** for quick lookups (client details, complaint details, notification popover). Full profile routes remain available for deep work.
- **Fallback demo data:** if a query returns empty (e.g. no seeded rows yet), UI falls back to `src/lib/dummy-data.ts` so screens are never blank in demos.
- **Error handling:** server fns return `{ rows, error }` where possible; throwing `Response` across the RPC boundary produces `Error: [object Response]` on the client and is avoided.
- **Confirmation dialogs** for destructive actions (sign‑out, merges, approvals).

---

Built with Lovable — https://lovable.dev.