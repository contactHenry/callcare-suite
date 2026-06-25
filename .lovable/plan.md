
## Goal

A small call centre management app where **agents** log calls (with optional audio upload), **managers** review and score calls against a weighted scorecard, and both manage a **CRM** of contacts with full interaction history.

## Roles

- **agent** — log calls, manage own contacts, view own QA scores.
- **manager** — everything agents can do, plus score any call, manage scorecard criteria, view all agents' dashboards.

Roles stored in a dedicated `user_roles` table with a `has_role()` security-definer function (never on profiles).

## Pages

1. `/auth` — email + password sign in / sign up (Lovable Cloud).
2. `/` (dashboard) — KPIs: my calls today, avg QA score, pending QA, recent contacts.
3. `/contacts` — CRM list, search, filter by status. Create / edit.
4. `/contacts/$id` — contact detail: fields + chronological call history with score badges.
5. `/calls` — calls list, filter by agent (manager only), date, QA status.
6. `/calls/new` — log a call: pick/create contact, direction, duration, outcome, notes, upload audio.
7. `/calls/$id` — call detail: metadata, audio player, QA scorecard panel (managers fill it; agents read-only).
8. `/qa/criteria` — manager-only: manage weighted scorecard criteria.
9. `/qa/dashboard` — agent's own scores over time; managers can switch agent.

## Data model (Lovable Cloud)

- `profiles` — id (= auth user), full_name, created_at.
- `app_role` enum: `agent`, `manager`. `user_roles(user_id, role)`.
- `contacts` — id, owner_id, name, company, phone, email, status (`lead`/`customer`/`churned`), tags[], notes, timestamps.
- `calls` — id, agent_id, contact_id, direction (`inbound`/`outbound`), started_at, duration_seconds, outcome (`resolved`/`follow_up`/`no_answer`/`voicemail`), notes, audio_path (storage), created_at.
- `qa_criteria` — id, label, description, weight, active.
- `qa_reviews` — id, call_id (unique), reviewer_id, overall_score (computed), notes, created_at.
- `qa_review_scores` — id, review_id, criterion_id, score (0–5).
- Storage bucket `call-recordings` (private) with RLS: agent can upload/read own; managers can read all.

### RLS summary

- `contacts`: owner can CRUD own; managers can read all.
- `calls`: agent can CRUD own; managers can read all + update QA-related fields via review tables only.
- `qa_reviews` / `qa_review_scores`: insert/update restricted to managers; agents can SELECT reviews of their own calls.
- `qa_criteria`: SELECT all authenticated; INSERT/UPDATE managers only.
- `user_roles`: SELECT authenticated for self, managed via SQL/admin.

Each table gets explicit `GRANT` statements for `authenticated` and `service_role`.

## QA scoring

- Manager opens a call → fills score 0–5 per active criterion.
- Overall score = Σ(score × weight) / Σ(5 × weight) × 100, stored on `qa_reviews.overall_score` via trigger when scores change.
- Agent dashboard: avg overall score (7d / 30d / all), score trend chart (Recharts), per-criterion averages.

## UI / design

- Clean, dense, ops-tool feel (think Linear / Intercom inbox). Neutral slate palette, single accent for primary actions, semantic tokens only (no hardcoded colors). System font stack — `Inter` via `@fontsource/inter`.
- shadcn components: Card, Table, Dialog, Sheet (call detail side panel), Tabs, Badge for statuses, Slider/RadioGroup for scoring.
- Recharts for QA trend chart.

## Technical notes

- Audio upload from the browser directly to Storage (signed URL playback in the player). Limit 25 MB, accept common audio types.
- All authenticated data fetched via `createServerFn` + TanStack Query in route loaders.
- Public route: only `/auth`. Everything else under `_authenticated/` (integration-managed gate).
- Input validation with Zod on every form and every server function `inputValidator`.
- Seed: a couple of default `qa_criteria` rows (Greeting, Tone, Resolution, Compliance) via the initial migration.

## Out of scope (call out for later)

- Real telephony / softphone integration (Twilio etc.).
- Automatic speech-to-text on uploaded recordings.
- Team / queue routing, SLAs, shift scheduling.
- Email / SMS outreach from CRM.

Happy to add any of these in a follow-up.
