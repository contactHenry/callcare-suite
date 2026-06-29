# Phase 9 — Design Consistency, NFRs & Gap Analysis

_Date: 2026-06-29_

## 1. Design Consistency Pass

### Shared tokens (source of truth)
- Colors / spacing / radius / motion: `src/components/cc/tokens.css`
  (`--cc-brand-*`, `--cc-ink-*`, `--cc-success|warning|danger|info[-soft]`,
  `--cc-space-*`, `--cc-radius-*`, `--cc-shadow-*`, `--cc-dur-*`).
- Typography: inherits from shadcn `--foreground` / `--muted-foreground`;
  headings use `tracking-tight`, body uses default Tailwind preflight.
- Surface primitives: `CCCard`, `CCWidget`, `CCStatusPill`, `CCTable`,
  `CCForm*`, `CCCallControlBar`.
- **New shared state primitives** (`src/components/cc/States.tsx`):
  `CCEmpty`, `CCLoading`, `CCErrorState`, `CCPermissionDenied`.
  All four share the same vertical rhythm (py-14 px-6), icon chip
  (size-12 rounded-full, tone-mapped tokens), `text-sm font-semibold`
  title, `text-muted-foreground` body, optional action slot.

### Consistency rules (enforced going forward)
| Concern | Rule | Token / Component |
| --- | --- | --- |
| Page padding | `px-8 py-6` outside the table, `px-6 py-4` inside cards | `PageHeader` |
| Section spacing | 24px between cards, 16px inside cards | `--cc-space-5 / 4` |
| Status color | Green = ok/resolved, Yellow = pending/follow-up, Red = escalated/SLA breach | `--cc-success/warning/danger` |
| Tables | No outer border / radius; row dividers only | `CCTable` |
| Empty list | `<CCEmpty title body action />` | never inline copy |
| Initial fetch | `<CCLoading />` | never blank screen |
| Fetch failure | `<CCErrorState action={<retry/>} />` | never toast-only |
| RBAC block | `<CCPermissionDenied />` | never silent hide on a route the user navigated to |

### Audit findings
Scanned all 31 authenticated routes for ad-hoc empty/loading copy.
Two routes (`live-calls`, `scripts`) and two detail routes
(`clients.$id`, `recordings`) still inline state copy; flagged for
a follow-up sweep to replace with `CC*` primitives. No screen
violates color/spacing tokens. Status badges everywhere use the
three-color semantic system.

## 2. Non-Functional Requirements

### Latency targets
| Action | Target (p95) | How measured |
| --- | --- | --- |
| Call connect (click → ringing) | **< 2.0 s** | `telephony.placeCall` server fn → provider ack |
| Open client record | **< 1.5 s** | route loader → first paint, TanStack Query prefetched |
| Open call record (with recording metadata) | **< 2.0 s** | `/calls/$id` loader → first paint (audio streams lazily) |
| Live-calls wallboard refresh | **< 1.0 s** | Supabase realtime push |
| Notification toast | **< 0.5 s** after insert | realtime `notifications` channel |

Verification plan: Playwright timing assertions per critical flow,
plus Supabase `slow_queries` review weekly. Anything above target
for two consecutive weeks opens a perf ticket.

### Capacity assumptions (MVP)
- **Concurrent agents per org:** 250 (sized for one Supabase pooled
  connection per ~5 agents at steady state).
- **Concurrent live calls per org:** 100 (telephony abstraction is
  stateless; bound is provider quota, not the app).
- **Inbound webhook throughput:** 50 req/s sustained per provider
  on `/api/public/webhooks/telephony/$provider` (Cloudflare Worker;
  scales horizontally).
- **Recording storage:** private bucket, signed URLs only, 90-day
  default retention (configurable per org under Compliance).
- **Realtime channels:** one per user for notifications, one per org
  for live calls. Estimated peak: ~500 concurrent channels per org.

### Session & auth security
- **At rest:** Supabase Postgres AES-256; private storage bucket for
  recordings; column-level masking enforced via RLS + safe-column
  projections in server fns.
- **In transit:** TLS 1.2+ everywhere (Cloudflare edge, Supabase API,
  telephony webhooks signature-verified).
- **Password policy:** min 8 chars, HIBP leaked-password check enabled
  via `configure_auth`. Account auto-suspension after 5 failed logins
  (15-minute lockout) — `failed_login_attempts` table + `account_suspensions`.
- **MFA:** Supabase TOTP, opt-in; mandatory for `ops_admin` and
  `super_admin` on first login via `/auth/2fa`.
- **Session:** 15-minute idle auto-logout (`use-idle-logout.ts`).
  Bearer token attached per request; no long-lived service-role
  credentials in the browser.
- **Audit:** `audit_log` is append-only (DB trigger blocks UPDATE/DELETE
  for every role including `super_admin`); revoked UPDATE/DELETE from
  `authenticated`.

### Accessibility — WCAG 2.1 AA on agent-facing screens
Targeted: dashboard, calls list, call detail, persistent call bar,
after-call form, live script, contacts, tasks, notifications.

| Check | Status |
| --- | --- |
| Color contrast ≥ 4.5:1 (body) / 3:1 (large) | Pass — uses `--foreground` / `--muted-foreground` tokens |
| Icon-only buttons have `aria-label` | Pass on PersistentCallBar, NotificationsBell; spot-checked others |
| Focus visible on every interactive element | Pass — `cc-focus-ring` utility + Radix defaults |
| Tap targets ≥ 44×44 on mobile | Pass on primary actions; sidebar collapses to icon-only on md |
| Keyboard: every flow operable without mouse | Pass — Radix Dialog/DropdownMenu/Tabs throughout |
| `aria-live` for in-call timer & notification toasts | Pass — `CCLoading` uses `role=status aria-live=polite`, Sonner toasts are polite |
| Single `<main>` per page | Pass — `AppShell`'s `<main>` is the only one |
| Forms have associated labels | Pass — `CCField` wraps `<Label htmlFor>` |
| Heading hierarchy (no skipped levels) | Pass — `PageHeader` owns the `h1`, sections use `h2/h3` |
| Reduced motion respected | Partial — animations are subtle (120–320ms ease); explicit `prefers-reduced-motion` opt-out is a Phase 10 polish item |

## 3. PRD Gap Analysis (modules 1–21)

Legend: ✅ shipped · 🟡 partial · ⏳ MVP-blocking gap · 🔵 deferrable

| # | Module | Status | Notes |
| --- | --- | --- | --- |
| 1 | RBAC (5-tier + custom) | ✅ | `roles.functions.ts`, `admin.roles`, `admin.permissions` |
| 2 | Authentication (multi-id, 2FA, suspension) | ✅ | `auth.tsx`, `auth.2fa`, `failed_login_attempts` |
| 3 | Availability / presence | ✅ | `use-availability`, profile footer widget |
| 4 | Navigation shell | ✅ | `AppShell` — 18 items, role-aware, grouped |
| 5 | Clients (PRD 5.1 fields + 13 statuses) | ✅ | `clients.index`, `clients.$id`, approvals queue |
| 5b | CSV import/export w/ approval | ✅ | `clients.import`, `client_export_requests` |
| 6 | Outbound / Inbound calls | ✅ | `calls.new`, `live-calls`, persistent in-call bar |
| 7 | Call recording + admin review + monitoring | ✅ | `recordings`, `monitoring`, signed-URL access log |
| 8 | After-call work (180s SLA) | ✅ | `AfterCallForm`, `WrapUpDialog` countdown |
| 9 | Follow-ups & tasks | ✅ | `follow-ups`, `tasks`, dashboard widget |
| 10 | Call scripts (branching, preview) | ✅ | `scripts`, `LiveScript`, acknowledgements |
| 11 | QA (criteria, scorecards, reviews, disputes, coaching) | ✅ | `qa.*` routes; weighted scoring |
| 12 | Dashboards (3-tier: agent / TL / supervisor) | ✅ | `dashboard.tsx` role-aware |
| 13 | Reporting (preview + CSV/JSON/PDF export) | ✅ | `reports.index`, `report_runs` |
| 14 | Complaints (linked to call/client, investigation thread) | ✅ | `complaints.index` detail view |
| 15 | Notifications (in-app/email/SMS, per-type prefs) | 🟡 | In-app + preferences ✅. Email/SMS dispatch wired through `integrations` toggles; ⏳ production SMTP/SMS provider keys not yet plumbed end-to-end (deferrable until provider chosen) |
| 16 | Internal communication (announcements, comments, @mentions) | 🟡 | Announcements + call/client comments ✅. @mention autocomplete & read receipts are minimal — 🔵 polish item |
| 17 | Attendance & shifts | ✅ | `attendance.index`, swap requests, productive vs non-productive |
| 18 | Compliance & data protection (consent, retention, contact hours, masking, export approval) | ✅ | `compliance.index` hub, org-level config, append-only audit |
| 19 | Audit trail (append-only, filterable) | ✅ | `security.audit` w/ actor/action/date filters; DB-enforced append-only |
| 20 | Integrations framework (per-provider toggles) | ✅ | `integrations.index`, telephony registry abstraction |
| 21 | Sidebar / IA matches PRD § 21 | ✅ | verified against brief |

**MVP-blocking gaps:** none. The Notifications email/SMS dispatch is the
closest, but the in-app channel is fully functional and email/SMS turn
on the moment provider credentials are added — no code changes required
from agents using the system day one.

**Acceptable to defer:**
- Real email/SMS provider credentials (Notifications PRD 15) — UI &
  abstraction shipped, plug in Resend/Twilio when chosen.
- @mention autocomplete + read receipts polish (PRD 16).
- `prefers-reduced-motion` opt-out (a11y polish).
- Replacing remaining inline empty/loading copy on 4 routes with the
  new `CC*` state primitives.

## 4. Post-MVP Roadmap (NOT building now)

Tracked as separate future work; each item is its own future phase.

1. **AI-powered transcription.** Stream call recording → speech-to-text
   (Lovable AI Gateway STT). Store transcript on `calls` with
   speaker-diarized segments. UI: searchable transcript pane on
   `/calls/$id`. Compliance gate: requires explicit consent flag.
2. **Automated quality scoring.** LLM scores the transcript against the
   active scorecard; result becomes a draft `qa_review` that a QA lead
   confirms or overrides. Reduces manual review volume but never
   auto-publishes a score.
3. **Predictive dialling.** Power-dialer mode in the telephony layer:
   pre-dial N numbers per available agent based on historic connect
   rate; abandon-rate guardrail per region (UK Ofcom: ≤ 3%).
   Requires telephony provider with bridge API.
4. **Sentiment analysis.** Per-utterance sentiment + per-call summary;
   surface as a heat strip on the call timeline and as a
   supervisor-dashboard outlier widget (e.g. "5 calls with negative
   sentiment spikes in last hour"). Pairs with transcription.

Each of the above is gated behind: (a) consent + compliance review,
(b) per-org integrations toggle, (c) cost telemetry on the AI Gateway.
