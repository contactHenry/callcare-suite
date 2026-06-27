# Architecture Plan — Call Centre Management Platform

_Companion to `AUDIT.md`. This is a written plan, not feature code. Inferred items are marked._

---

## 1. Target data model

```text
organizations ─┬──< teams ─┬──< team_members ──> profiles
               │           └──< campaigns ─┬──< campaign_dispositions
               │                           ├──< campaign_members ──> profiles
               │                           └──< campaign_scripts
               ├──< client_profiles ─┬──< client_contact_methods (phone/email/etc.)
               │                     ├──< client_consents
               │                     └──< client_tags
               ├──< calls ─┬──< call_events (dial / connect / hold / transfer / end)
               │           ├──< call_recordings (1:N — segments after transfer)
               │           ├──< call_dispositions (FK to campaign_dispositions)
               │           └──< qa_reviews ──< qa_review_scores ──> qa_criteria
               ├──< agent_status_log (presence history)
               ├──< tickets (optional, phase 3)
               └──< audit_log (who / what / when, for every privileged action)
```

### Entity highlights

- **`organizations`** — root tenant. Every other table carries `organization_id` and RLS scopes through it.
- **`teams`** — operational grouping a Team Leader owns. Agents belong to one team.
- **`campaigns`** — the missing core. Owns its own disposition catalog, script, target list, assigned agents, SLAs.
- **`client_profiles`** — replaces today's `contacts`. Separates the person (profile) from contact methods (phone/email rows) and consent (GDPR/TCPA).
- **`calls`** — keeps today's fields, adds `organization_id`, `campaign_id`, `team_id`, `disposition_id` (FK), `wrap_up_seconds`, `parent_call_id` (for transfers).
- **`call_events`** — append-only audit of the call lifecycle. Powers timeline UI and analytics without parsing recordings.
- **`agent_status_log`** — every transition (Available → Busy → ACW → Offline) with timestamps. Drives wallboards and adherence reports.
- **`audit_log`** — `(actor_id, organization_id, action, target_table, target_id, diff_jsonb, at)`. Mandatory for Ops Admin / Super Admin actions.

### Indexes to add up-front

- `calls (organization_id, started_at DESC)`
- `calls (agent_id, started_at DESC)`
- `calls (campaign_id, started_at DESC)`
- `qa_reviews (call_id)` unique
- `agent_status_log (agent_id, at DESC)`
- `client_contact_methods (organization_id, normalized_phone)` for inbound lookup

---

## 2. Role / permission model

### Recommendation: **hybrid — enum role + permission table**, not pure enum, not pure RBAC table.

**Why:** pure enum (today's pattern) is fast and simple but every new capability needs a code change. Pure RBAC tables (role → permissions → users) are flexible but overkill for 5 fixed roles and force every policy through a join. Hybrid keeps the enum (predictable for RLS) and adds a `role_permissions` lookup so the UI can do capability checks without leaking role names.

```sql
-- enum stays, expanded to 5 values
ALTER TYPE app_role ADD VALUE 'team_leader';
ALTER TYPE app_role ADD VALUE 'supervisor';
ALTER TYPE app_role ADD VALUE 'ops_admin';
ALTER TYPE app_role ADD VALUE 'super_admin';

-- scoping
ALTER TABLE user_roles
  ADD COLUMN organization_id uuid REFERENCES organizations(id),
  ADD COLUMN team_id uuid REFERENCES teams(id) NULL;

-- permissions (static, seeded)
CREATE TABLE role_permissions (
  role app_role NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY (role, permission)
);

-- helpers
has_role(uid, role)                  -- exists
has_permission(uid, perm)            -- new
has_org_role(uid, org, role)         -- new, for org-scoped checks
is_team_leader_of(uid, team_id)      -- new
```

### Role responsibilities (inferred)

| Role | Scope | Can |
|---|---|---|
| Agent | self | Log/handle calls, manage own queue, see own QA |
| Team Leader | own team | All of agent + view team calls + score team QA + coach |
| Supervisor | org | All of team leader, across all teams + manage campaigns + view live ops |
| Ops Admin | org | All of supervisor + manage users, teams, dispositions, scorecards, integrations |
| Super Admin | platform | All of ops admin + manage organizations + impersonate (audited) |

### RLS pattern

Every policy uses `has_org_role()` and joins on `organization_id`, never on `auth.uid()` alone. Example:

```sql
CREATE POLICY "agents read own calls, leaders read team, supervisors read org"
ON public.calls FOR SELECT TO authenticated
USING (
  agent_id = auth.uid()
  OR (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()
                  AND has_role(auth.uid(), 'team_leader')))
  OR has_org_role(auth.uid(), organization_id, 'supervisor')
  OR has_org_role(auth.uid(), organization_id, 'ops_admin')
  OR has_role(auth.uid(), 'super_admin')
);
```

---

## 3. Module boundaries — 18-item main menu (inferred)

Reorganise `src/routes/_authenticated/` and `src/features/` into 18 cohesive modules. Each module owns its routes, server functions, components, and types.

```text
src/features/
├── 01-dashboard/          # personal + role-scoped landing
├── 02-inbox/              # my queue: assigned calls, callbacks, tasks
├── 03-contacts/           # client profiles (renamed from contacts)
├── 04-calls/              # call log + detail + manual entry
├── 05-recordings/         # audio library + waveform player
├── 06-campaigns/          # campaign list, builder, scripts, dispositions
├── 07-dialler/            # outbound dialler + preview/progressive modes
├── 08-live-ops/           # wallboards, real-time agent presence
├── 09-qa/                 # scorecards, reviews, calibration sessions
├── 10-coaching/           # 1:1s, training assignments, progress
├── 11-knowledge/          # KB articles + scripts library
├── 12-tickets/            # case management (cross-call follow-ups)
├── 13-reports/            # canned + scheduled reports, exports
├── 14-analytics/          # ad-hoc charts, trend explorer
├── 15-teams/              # team & agent admin (Team Leader / Ops Admin)
├── 16-users-roles/        # user mgmt, role assignment (Ops Admin+)
├── 17-settings/           # org settings, dispositions, business hours, SLAs
└── 18-audit/              # audit log viewer (Ops Admin+)
```

Sidebar nav renders these in order, filtered by `has_permission('module:view')`. Each module exports a single `routes.ts` registering its TanStack routes, keeping `routeTree.gen.ts` automatic.

---

## 4. Migration plan (pre-Phase 2 refactor)

Sequenced so each step is shippable and reversible.

### M1 — Tenancy foundation _(blocker for everything else)_
- Create `organizations`, `teams`, `team_members`.
- Add `organization_id` (NOT NULL after backfill) to every existing table.
- Seed a default org; backfill existing rows to it.
- Rewrite every RLS policy to scope through `organization_id`.

### M2 — Role expansion
- `ALTER TYPE app_role ADD VALUE` for the 3 new roles.
- Add `role_permissions` table + seed.
- Add `has_permission`, `has_org_role`, `is_team_leader_of` SECURITY DEFINER functions.
- Update `handle_new_user` to require an explicit invite (no more silent `agent` assignment for unknown signups).

### M3 — CRM refactor
- Rename `contacts` → `client_profiles`.
- Extract `client_contact_methods`, `client_consents`, `client_tags`.
- Provide a compatibility view `contacts` for the transition window.

### M4 — Calls refactor
- Add `campaign_id`, `team_id`, `disposition_id`, `parent_call_id`, `wrap_up_seconds`.
- Create `campaign_dispositions` and migrate `calls.outcome` text → FK.
- Add `call_events` append-only table.
- Add indexes listed in §1.

### M5 — Hardening
- Wire `zod` `.inputValidator()` on every existing server function.
- Add `audit_log` + trigger on privileged tables.
- Lock down `call-recordings` storage policies per-agent/per-team.
- Add basic rate limiting via TanStack server middleware (token bucket per user).
- Remove `src/lib/dummy-data.ts` from production bundles (gate with `import.meta.env.DEV`).

### M6 — Design system rollout
- Tokens live in `src/styles.css` under `@theme`.
- Hand-rolled primitives under `src/components/cc/` (see proof-of-concept already in repo).
- Migrate page by page off `src/components/ui/*` shadcn copies.
- Keep Radix _packages_ for behaviour where rebuilding is risky (Dialog, Popover, DropdownMenu) but wrap them in our own styled components.

### M7 — Realtime + live ops
- Enable Supabase Realtime on `agent_status_log` and `calls`.
- Add `presence` channel per org.
- Build wallboard module.

### M8 — Reporting
- Materialised views for the heavy aggregates (agent productivity, campaign performance, QA trends).
- Scheduled refresh via `pg_cron`.
- CSV export via server function streaming response.

---

## 5. Out of scope for this plan (call out for later)

- Real telephony integration (Twilio Voice, Genesys, Five9, Amazon Connect).
- Speech-to-text + sentiment on recordings.
- WFM (schedule adherence, forecasting).
- Outbound SMS / WhatsApp.
- Native mobile agent app.

These belong in a Phase 3 roadmap once Phase 2 (Campaigns + Live Ops + Reporting) is live.