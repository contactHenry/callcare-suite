// Frontend-only dummy data for UI preview. Used as a fallback when the
// backend returns no rows so empty pages don't look broken.

export const DUMMY_CONTACTS = [
  { id: "d-c1", name: "Aarav Mehta", company: "Helios Logistics", phone: "+44 20 7946 0011", email: "aarav.mehta@helios.co.uk", status: "customer", created_at: "2026-06-20T09:12:00Z" },
  { id: "d-c2", name: "Priya Shah", company: "Northwind Telecom", phone: "+44 161 555 0123", email: "priya.shah@northwind.com", status: "lead", created_at: "2026-06-22T14:32:00Z" },
  { id: "d-c3", name: "James O'Connor", company: "Bluepeak Insurance", phone: "+353 1 555 0144", email: "j.oconnor@bluepeak.ie", status: "customer", created_at: "2026-06-23T08:45:00Z" },
  { id: "d-c4", name: "Sofia Ramirez", company: "Vertex Health", phone: "+1 415 555 0190", email: "sofia.r@vertexhealth.io", status: "lead", created_at: "2026-06-24T11:05:00Z" },
  { id: "d-c5", name: "Daniel Kim", company: "OrbitPay", phone: "+82 2 555 0177", email: "daniel.kim@orbitpay.kr", status: "churned", created_at: "2026-06-10T16:22:00Z" },
  { id: "d-c6", name: "Fatima Al-Hassan", company: "Cedar Realty", phone: "+971 4 555 0166", email: "fatima@cedarrealty.ae", status: "customer", created_at: "2026-06-18T07:50:00Z" },
  { id: "d-c7", name: "Ethan Walker", company: "Lumen Energy", phone: "+44 131 555 0102", email: "ethan@lumenenergy.co.uk", status: "lead", created_at: "2026-06-25T10:11:00Z" },
  { id: "d-c8", name: "Mia Johansson", company: "Polaris Travel", phone: "+46 8 555 0143", email: "mia.j@polaristravel.se", status: "customer", created_at: "2026-06-19T13:00:00Z" },
];

const AGENTS = ["Liam Carter", "Noah Patel", "Olivia Brown", "Emma Wilson", "Ava Singh"];

function isoHoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

export const DUMMY_CALLS = [
  { id: "d-call1", started_at: isoHoursAgo(1), contacts: { name: "Aarav Mehta" }, agent_name: "Liam Carter", direction: "inbound", outcome: "resolved", qa_reviews: { overall_score: 92 } },
  { id: "d-call2", started_at: isoHoursAgo(3), contacts: { name: "Priya Shah" }, agent_name: "Noah Patel", direction: "outbound", outcome: "follow_up", qa_reviews: { overall_score: 78 } },
  { id: "d-call3", started_at: isoHoursAgo(5), contacts: { name: "James O'Connor" }, agent_name: "Olivia Brown", direction: "inbound", outcome: "resolved", qa_reviews: null },
  { id: "d-call4", started_at: isoHoursAgo(8), contacts: { name: "Sofia Ramirez" }, agent_name: "Emma Wilson", direction: "outbound", outcome: "no_answer", qa_reviews: { overall_score: 65 } },
  { id: "d-call5", started_at: isoHoursAgo(22), contacts: { name: "Daniel Kim" }, agent_name: "Ava Singh", direction: "inbound", outcome: "escalated", qa_reviews: { overall_score: 71 } },
  { id: "d-call6", started_at: isoHoursAgo(27), contacts: { name: "Fatima Al-Hassan" }, agent_name: "Liam Carter", direction: "outbound", outcome: "resolved", qa_reviews: { overall_score: 88 } },
  { id: "d-call7", started_at: isoHoursAgo(30), contacts: { name: "Ethan Walker" }, agent_name: "Noah Patel", direction: "inbound", outcome: "follow_up", qa_reviews: null },
  { id: "d-call8", started_at: isoHoursAgo(48), contacts: { name: "Mia Johansson" }, agent_name: "Olivia Brown", direction: "outbound", outcome: "resolved", qa_reviews: { overall_score: 95 } },
  { id: "d-call9", started_at: isoHoursAgo(54), contacts: { name: "Aarav Mehta" }, agent_name: "Emma Wilson", direction: "inbound", outcome: "resolved", qa_reviews: { overall_score: 83 } },
  { id: "d-call10", started_at: isoHoursAgo(72), contacts: { name: "Priya Shah" }, agent_name: "Ava Singh", direction: "outbound", outcome: "voicemail", qa_reviews: { overall_score: 60 } },
];

export const DUMMY_DASHBOARD = {
  callsToday: 12,
  contacts: DUMMY_CONTACTS.length,
  avgScore: 84.2,
  pendingQa: 3,
};

export const DUMMY_QA_TREND = [
  { date: "10 Jun", score: 72 },
  { date: "12 Jun", score: 76 },
  { date: "14 Jun", score: 81 },
  { date: "16 Jun", score: 79 },
  { date: "18 Jun", score: 85 },
  { date: "20 Jun", score: 88 },
  { date: "22 Jun", score: 84 },
  { date: "24 Jun", score: 90 },
  { date: "26 Jun", score: 92 },
];

export const DUMMY_QA_SUMMARY = {
  avg: 82.3,
  count: DUMMY_QA_TREND.length,
  trend: DUMMY_QA_TREND,
};

export { AGENTS as DUMMY_AGENTS };

/* =========================================================================
   Extended dummy datasets — used as a frontend-only fallback whenever a
   backend query returns no rows so every navigation section renders a rich,
   product-relevant preview instead of empty space.
   ========================================================================= */

const u = (n: number) => `dummy-${n.toString(36)}`;
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();
const inMin  = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const inHrs  = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

/* ----------------------------- Dashboard ----------------------------- */
export const DUMMY_AGENT_STATS = { callsToday: 24, openTasks: 5, aht: 312 };
export const DUMMY_QA_POINTS = [72, 76, 81, 78, 83, 85, 80, 84, 88, 86, 90, 92, 89, 91];

export const DUMMY_UPCOMING_FOLLOWUPS = [
  { id: u(1), title: "Renewal callback — Helios Logistics", client: { name: "Aarav Mehta" }, priority: "high",   due_at: inMin(25) },
  { id: u(2), title: "Send onboarding pack",                client: { name: "Priya Shah" },  priority: "normal", due_at: inMin(70) },
  { id: u(3), title: "Confirm payment plan",                client: { name: "James O'Connor" }, priority: "urgent", due_at: inHrs(2) },
  { id: u(4), title: "Quote follow-up",                     client: { name: "Sofia Ramirez" }, priority: "low", due_at: inHrs(3) },
];

export const DUMMY_TEAM_VOLUME = Array.from({ length: 12 }, (_, i) => ({
  label: `${i * 2}`,
  value: [2, 1, 0, 0, 1, 6, 14, 22, 28, 31, 24, 12][i],
}));

export const DUMMY_MGMT_TREND = Array.from({ length: 30 }, (_, i) => ({
  day: daysAgo(29 - i).slice(0, 10),
  value: 120 + Math.round(Math.sin(i / 3) * 25 + i * 1.8),
}));

export const DUMMY_MGMT_OVERVIEW = {
  callsToday: 412, complaints: 3, avgQa: 86.4, conversions: 47,
};

/* ------------------------------- Tasks ------------------------------- */
export const DUMMY_TASKS = [
  { id: u(10), title: "Call back after lunch break",  description: "Client requested a 2pm callback to confirm shipping address.", client: { name: "Aarav Mehta" }, priority: "high", status: "open",        due_at: inHrs(1)  },
  { id: u(11), title: "Email proposal draft",          description: "Draft sent for review; expect reply by Friday.",              client: { name: "Priya Shah" },  priority: "normal", status: "in_progress", due_at: inHrs(6)  },
  { id: u(12), title: "Verify direct debit details",   description: "Verify new bank details on file before next billing run.",     client: { name: "James O'Connor" }, priority: "urgent", status: "open",      due_at: minsAgo(45) },
  { id: u(13), title: "Coaching debrief",              description: "Review yesterday's escalated call with team leader.",          client: { name: "Sofia Ramirez" }, priority: "normal", status: "open",       due_at: inHrs(24) },
  { id: u(14), title: "Update consent flag",           description: "Client revoked SMS marketing — update CRM.",                   client: { name: "Daniel Kim" },    priority: "low", status: "completed",      due_at: daysAgo(1) },
  { id: u(15), title: "Schedule satisfaction survey",  description: "Trigger CSAT survey 48h after resolution.",                    client: { name: "Fatima Al-Hassan" }, priority: "low", status: "open",       due_at: inHrs(48) },
];

/* --------------------------- Announcements --------------------------- */
export const DUMMY_ANNOUNCEMENTS = [
  { id: u(20), title: "New compliance script live today", body: "All inbound agents must read the updated disclosure between 9am and noon. The new wording covers GDPR and call-recording consent for EU clients.", urgency: "urgent", require_ack: true, created_at: minsAgo(45), author: { full_name: "Olivia Brown" } },
  { id: u(21), title: "Q3 incentive: top-5 conversions",  body: "Top 5 agents on conversions this quarter will receive £250 and a half-day off. Live leaderboard in the Reports tab.", urgency: "high",  require_ack: false, created_at: daysAgo(1), author: { full_name: "Noah Patel" } },
  { id: u(22), title: "Office Wi-Fi maintenance Sunday",  body: "Network upgrade on Sunday 2am–4am UTC. Remote agents unaffected — soft-phone will reconnect automatically.", urgency: "normal", require_ack: false, created_at: daysAgo(3), author: { full_name: "Liam Carter" } },
  { id: u(23), title: "Welcome to our 3 new agents",      body: "Please welcome Mia, Daniel and Fatima to the inbound team. Their buddies are Emma, Liam and Ava — show them the ropes.", urgency: "normal", require_ack: false, created_at: daysAgo(7), author: { full_name: "Olivia Brown" } },
];

/* ----------------------------- Attendance ---------------------------- */
export const DUMMY_PUNCHES = [
  { id: u(30), kind: "clock_in",   at: minsAgo(330), user_id: "me" },
  { id: u(31), kind: "break_start",at: minsAgo(180), user_id: "me" },
  { id: u(32), kind: "break_end",  at: minsAgo(150), user_id: "me" },
  { id: u(33), kind: "clock_out",  at: daysAgo(1),   user_id: "me" },
  { id: u(34), kind: "clock_in",   at: daysAgo(1.4), user_id: "me" },
];

export const DUMMY_SHIFTS = [
  { id: u(40), starts_at: inHrs(20),  ends_at: inHrs(28),  notes: "Inbound priority queue" },
  { id: u(41), starts_at: inHrs(44),  ends_at: inHrs(52),  notes: "Outbound campaign — renewals" },
  { id: u(42), starts_at: inHrs(68),  ends_at: inHrs(76),  notes: "" },
];

/* ----------------------------- Recordings ---------------------------- */
export const DUMMY_RECORDINGS = [
  { id: u(50), started_at: minsAgo(90),  direction: "inbound",  from_number: "+44 20 7946 0011", to_number: "+44 800 123 4567", duration_seconds: 314, quality_score: 92, contacts: { name: "Aarav Mehta" }, recording_sensitive: false },
  { id: u(51), started_at: minsAgo(220), direction: "outbound", from_number: "+44 800 123 4567", to_number: "+44 161 555 0123", duration_seconds: 612, quality_score: 78, contacts: { name: "Priya Shah" },  recording_sensitive: false },
  { id: u(52), started_at: minsAgo(360), direction: "inbound",  from_number: "+353 1 555 0144",  to_number: "+44 800 123 4567", duration_seconds: 421, quality_score: 71, contacts: { name: "James O'Connor" }, recording_sensitive: true },
  { id: u(53), started_at: daysAgo(1),   direction: "outbound", from_number: "+44 800 123 4567", to_number: "+1 415 555 0190",  duration_seconds: 187, quality_score: 65, contacts: { name: "Sofia Ramirez" }, recording_sensitive: false },
  { id: u(54), started_at: daysAgo(2),   direction: "inbound",  from_number: "+82 2 555 0177",   to_number: "+44 800 123 4567", duration_seconds: 904, quality_score: 88, contacts: { name: "Daniel Kim" },    recording_sensitive: false },
];

/* ----------------------------- Monitoring ---------------------------- */
export const DUMMY_LIVE_CALLS = [
  { id: u(60), direction: "inbound",  status: "in_progress", started_at: minsAgo(3), answered_at: minsAgo(2), from_number: "+44 20 7946 0011", to_number: "+44 800 123 4567", contacts: { name: "Aarav Mehta" }, agent_id: "liam" },
  { id: u(61), direction: "outbound", status: "ringing",     started_at: minsAgo(1), answered_at: null,        from_number: "+44 800 123 4567", to_number: "+44 161 555 0123", contacts: { name: "Priya Shah" },  agent_id: "noah" },
  { id: u(62), direction: "inbound",  status: "on_hold",     started_at: minsAgo(7), answered_at: minsAgo(6), from_number: "+353 1 555 0144",  to_number: "+44 800 123 4567", contacts: { name: "James O'Connor" }, agent_id: "olivia" },
];

export const DUMMY_QUEUE = [
  { id: u(70), contacts: { name: "Sofia Ramirez" },     from_number: "+1 415 555 0190",  priority: 1, queued_at: minsAgo(2), estimated_wait_seconds: 30 },
  { id: u(71), contacts: { name: "Fatima Al-Hassan" },  from_number: "+971 4 555 0166",  priority: 2, queued_at: minsAgo(4), estimated_wait_seconds: 90 },
  { id: u(72), contacts: { name: "Ethan Walker" },      from_number: "+44 131 555 0102", priority: 3, queued_at: minsAgo(6), estimated_wait_seconds: 160 },
];

/* ------------------------------ Scripts ------------------------------ */
export const DUMMY_SCRIPTS = [
  { id: u(80), name: "Inbound — sales discovery",         current_version: { version: 4, status: "approved" } },
  { id: u(81), name: "Outbound — renewal save",           current_version: { version: 2, status: "approved" } },
  { id: u(82), name: "Complaint handling — first contact",current_version: { version: 7, status: "in_review" } },
  { id: u(83), name: "GDPR consent disclosure",           current_version: { version: 3, status: "approved" } },
  { id: u(84), name: "Voicemail script (no-answer)",      current_version: { version: 1, status: "draft" } },
];

/* ------------------------------ Clients ------------------------------ */
const CLIENT_STATUSES = ["new","assigned","contacted","follow_up","interested","converted","unreachable","complaint","do_not_call"];
export const DUMMY_CLIENTS = Array.from({ length: 18 }, (_, i) => {
  const base = DUMMY_CONTACTS[i % DUMMY_CONTACTS.length];
  return {
    id: u(100 + i),
    name: base.name + (i >= DUMMY_CONTACTS.length ? ` (${Math.floor(i / DUMMY_CONTACTS.length) + 1})` : ""),
    company: base.company,
    email: base.email,
    phone: base.phone,
    lifecycle_status: CLIENT_STATUSES[i % CLIENT_STATUSES.length],
    do_not_call: i % 7 === 6,
    last_contacted_at: daysAgo((i * 1.7) % 30),
    next_follow_up_at: inHrs((i * 5) % 96),
  };
});

/* ----------------------------- Complaints ---------------------------- */
export const DUMMY_COMPLAINTS = [
  { id: u(120), subject: "Billed twice for May invoice",         category: "billing",       priority: "high",   status: "investigating", created_at: daysAgo(1), client: { name: "Aarav Mehta" },    owner: { full_name: "Olivia Brown" } },
  { id: u(121), subject: "Agent was rude on the call",           category: "agent_conduct", priority: "urgent", status: "escalated",    created_at: daysAgo(2), client: { name: "Priya Shah" },     owner: { full_name: "Noah Patel" } },
  { id: u(122), subject: "Did not receive promised callback",    category: "service",       priority: "normal", status: "open",          created_at: daysAgo(3), client: { name: "James O'Connor" }, owner: null },
  { id: u(123), subject: "Wants data deleted (GDPR Art. 17)",    category: "data_protection", priority: "high", status: "investigating", created_at: daysAgo(4), client: { name: "Sofia Ramirez" },  owner: { full_name: "Liam Carter" } },
  { id: u(124), subject: "Service was reinstated late",          category: "service",       priority: "low",    status: "resolved",     created_at: daysAgo(10), client: { name: "Daniel Kim" },     owner: { full_name: "Emma Wilson" } },
];

/* ----------------------------- Compliance ---------------------------- */
export const DUMMY_DATA_REQUESTS = [
  { id: u(130), kind: "export",     status: "pending",  created_at: daysAgo(0.5), client: { name: "Aarav Mehta" },    requester: { full_name: "Liam Carter" } },
  { id: u(131), kind: "deletion",   status: "approved", created_at: daysAgo(1.5), client: { name: "Priya Shah" },     requester: { full_name: "Olivia Brown" } },
  { id: u(132), kind: "access",     status: "completed",created_at: daysAgo(7),   client: { name: "Sofia Ramirez" },  requester: { full_name: "Noah Patel" } },
  { id: u(133), kind: "restriction",status: "rejected", created_at: daysAgo(14),  client: { name: "Daniel Kim" },     requester: { full_name: "Emma Wilson" } },
];

/* ------------------------------- QA ---------------------------------- */
export const DUMMY_QA_REVIEWS = [
  { id: u(140), overall_score: 92, created_at: minsAgo(60),  call: { id: "c1", agent_id: "me", contact: { name: "Aarav Mehta" } } },
  { id: u(141), overall_score: 78, created_at: minsAgo(220), call: { id: "c2", agent_id: "me", contact: { name: "Priya Shah" } } },
  { id: u(142), overall_score: 65, created_at: daysAgo(1),   call: { id: "c3", agent_id: "me", contact: { name: "James O'Connor" } } },
  { id: u(143), overall_score: 88, created_at: daysAgo(2),   call: { id: "c4", agent_id: "me", contact: { name: "Sofia Ramirez" } } },
  { id: u(144), overall_score: 71, created_at: daysAgo(3),   call: { id: "c5", agent_id: "me", contact: { name: "Daniel Kim" } } },
];

export const DUMMY_QA_DISPUTES = [
  { id: u(150), reason: "Critical compliance item was met but marked failed", status: "open",     created_at: minsAgo(120) },
  { id: u(151), reason: "Tone score too harsh — client was rude first",        status: "open",     created_at: daysAgo(1) },
  { id: u(152), reason: "Recording skipped first 30 seconds",                  status: "upheld",   created_at: daysAgo(4) },
  { id: u(153), reason: "Wrong scorecard applied",                             status: "rejected", created_at: daysAgo(6) },
];

export const DUMMY_SCORECARDS = [
  {
    id: u(160), name: "Inbound — service quality", pass_threshold: 80, description: "Default scorecard for inbound calls.",
    sections: [
      { id: "s1", name: "Greeting & opening",  items: [{ id: "i1", prompt: "Brand greeting used", weight: 10, max_score: 5, is_critical: false }, { id: "i2", prompt: "Verified caller identity", weight: 15, max_score: 5, is_critical: true }] },
      { id: "s2", name: "Issue resolution",    items: [{ id: "i3", prompt: "Diagnosed correctly", weight: 25, max_score: 5 }, { id: "i4", prompt: "Provided next steps", weight: 20, max_score: 5 }] },
      { id: "s3", name: "Closing & compliance",items: [{ id: "i5", prompt: "GDPR disclosure read", weight: 15, max_score: 5, is_critical: true }, { id: "i6", prompt: "Polite closing", weight: 15, max_score: 5 }] },
    ],
  },
  {
    id: u(161), name: "Outbound — renewal save", pass_threshold: 75, description: "Save attempts for at-risk renewals.",
    sections: [
      { id: "s4", name: "Discovery",    items: [{ id: "i7", prompt: "Identified objection", weight: 30, max_score: 5 }] },
      { id: "s5", name: "Save offer",   items: [{ id: "i8", prompt: "Offered correct discount tier", weight: 40, max_score: 5, is_critical: true }] },
      { id: "s6", name: "Confirmation", items: [{ id: "i9", prompt: "Confirmed payment method", weight: 30, max_score: 5 }] },
    ],
  },
];

export const DUMMY_QA_CRITERIA = [
  { id: u(170), label: "Greeting",           description: "Brand-compliant opening and tone", weight: 1.5, active: true,  created_at: daysAgo(60) },
  { id: u(171), label: "Active listening",   description: "Demonstrated empathy and acknowledged concerns", weight: 2,    active: true,  created_at: daysAgo(60) },
  { id: u(172), label: "Problem resolution", description: "Diagnosed and resolved or escalated correctly", weight: 3,    active: true,  created_at: daysAgo(60) },
  { id: u(173), label: "Compliance",         description: "Read disclosures, recorded consent, no PII leakage", weight: 3, active: true, created_at: daysAgo(60) },
  { id: u(174), label: "Upsell attempt",     description: "Identified a relevant upsell opportunity", weight: 1, active: false, created_at: daysAgo(60) },
  { id: u(175), label: "Closing",            description: "Polite closing and clear next steps", weight: 1.5, active: true,  created_at: daysAgo(60) },
];

/* ------------------------------ Reports ------------------------------ */
export const DUMMY_REPORT_RUNS = [
  { id: u(180), report_key: "calls",             row_count: 412,  created_at: minsAgo(35),  format: "csv" },
  { id: u(181), report_key: "agent_performance", row_count: 22,   created_at: minsAgo(180), format: "csv" },
  { id: u(182), report_key: "qa_scores",         row_count: 138,  created_at: daysAgo(1),   format: "csv" },
  { id: u(183), report_key: "attendance",        row_count: 84,   created_at: daysAgo(3),   format: "csv" },
  { id: u(184), report_key: "complaints",        row_count: 12,   created_at: daysAgo(7),   format: "csv" },
];

/* ------------------------------- Staff ------------------------------- */
export const DUMMY_STAFF = [
  { id: u(190), full_name: "Liam Carter",   staff_id: "EMP-1001", phone: "+44 7700 900100", roles: ["agent"],          availability: { status: "available" }, suspended: false },
  { id: u(191), full_name: "Noah Patel",    staff_id: "EMP-1002", phone: "+44 7700 900101", roles: ["agent"],          availability: { status: "on_call" },   suspended: false },
  { id: u(192), full_name: "Olivia Brown",  staff_id: "EMP-1003", phone: "+44 7700 900102", roles: ["team_leader"],    availability: { status: "available" }, suspended: false },
  { id: u(193), full_name: "Emma Wilson",   staff_id: "EMP-1004", phone: "+44 7700 900103", roles: ["agent"],          availability: { status: "on_break" },  suspended: false },
  { id: u(194), full_name: "Ava Singh",     staff_id: "EMP-1005", phone: "+44 7700 900104", roles: ["supervisor"],     availability: { status: "available" }, suspended: false },
  { id: u(195), full_name: "Marcus Lee",    staff_id: "EMP-1006", phone: "+44 7700 900105", roles: ["agent"],          availability: { status: "offline" },   suspended: true  },
  { id: u(196), full_name: "Zara Ahmed",    staff_id: "EMP-1007", phone: "+44 7700 900106", roles: ["ops_admin"],      availability: { status: "available" }, suspended: false },
];

/* ----------------------------- Audit log ----------------------------- */
export const DUMMY_AUDIT = [
  { id: u(200), at: minsAgo(15),  actor_id: "olivia-brown-uuid",  action: "role.assign",     target_type: "user", target_id: "liam-carter-uuid",   diff: { role: "team_leader" }, ip: "10.0.4.21" },
  { id: u(201), at: minsAgo(60),  actor_id: "ava-singh-uuid",     action: "permission.toggle", target_type: "role", target_id: "agent",            diff: { permission: "calls:export", granted: true }, ip: "10.0.4.7" },
  { id: u(202), at: minsAgo(180), actor_id: "zara-ahmed-uuid",    action: "staff.invite",    target_type: "user", target_id: "fatima-uuid",        diff: { email: "fatima@example.com" }, ip: "10.0.4.3" },
  { id: u(203), at: daysAgo(1),   actor_id: "olivia-brown-uuid",  action: "staff.suspend",   target_type: "user", target_id: "marcus-lee-uuid",    diff: { reason: "Policy violation" }, ip: "10.0.4.21" },
  { id: u(204), at: daysAgo(2),   actor_id: "zara-ahmed-uuid",    action: "staff.lift_suspension", target_type: "user", target_id: "noah-patel-uuid", diff: {}, ip: "10.0.4.3" },
];

/* --------------------------- Permissions matrix --------------------- */
export const DUMMY_PERMISSIONS_ROWS = (() => {
  const grants: Record<string, string[]> = {
    agent: ["calls:create","calls:read.own","clients:read.assigned","tasks:read.own","tasks:update.own","scripts:read","qa:read.own"],
    team_leader: ["calls:read.team","clients:read.team","tasks:read.team","tasks:assign","qa:review","monitoring:listen","monitoring:whisper"],
    supervisor: ["clients:write.team","qa:moderate","monitoring:barge","scripts:approve","complaints:assign","approvals:review"],
    ops_admin: ["staff:invite","staff:suspend","roles:assign","integrations:manage","telephony:manage","compliance:review","reports:export"],
    super_admin: ["permissions:manage","org:configure","audit:export","billing:manage"],
  };
  const rows: { role: string; permission: string }[] = [];
  const order = ["agent","team_leader","supervisor","ops_admin","super_admin"];
  order.forEach((role, i) => {
    // additive inheritance
    for (let j = 0; j <= i; j++) for (const p of grants[order[j]]) rows.push({ role, permission: p });
  });
  return rows;
})();

/* ---------------------------- Custom roles --------------------------- */
export const DUMMY_CUSTOM_ROLES = {
  roles: [
    { id: "cr-1", name: "Workforce Planner",  description: "Schedules shifts and manages attendance exceptions." },
    { id: "cr-2", name: "QA Calibrator",      description: "Runs calibration sessions; cannot publish scorecards." },
    { id: "cr-3", name: "Complaints Officer", description: "Owns escalated complaints across all teams." },
  ],
  permissions: [
    { role_id: "cr-1", permission: "attendance:manage" },
    { role_id: "cr-1", permission: "tasks:assign" },
    { role_id: "cr-2", permission: "qa:review" },
    { role_id: "cr-2", permission: "qa:moderate" },
    { role_id: "cr-3", permission: "complaints:assign" },
    { role_id: "cr-3", permission: "complaints:resolve" },
    { role_id: "cr-3", permission: "monitoring:listen" },
  ],
  assignments: [
    { role_id: "cr-1", user_id: "u-olivia" },
    { role_id: "cr-2", user_id: "u-ava" },
    { role_id: "cr-3", user_id: "u-zara" },
  ],
};

export const DUMMY_PERMISSION_CATALOG = [
  "calls:create","calls:read.own","calls:read.team","calls:export",
  "clients:read.assigned","clients:read.team","clients:write.team","clients:export",
  "tasks:read.own","tasks:read.team","tasks:assign","tasks:update.own",
  "scripts:read","scripts:edit","scripts:approve",
  "qa:read.own","qa:review","qa:moderate",
  "monitoring:listen","monitoring:whisper","monitoring:barge","monitoring:takeover",
  "complaints:assign","complaints:resolve",
  "approvals:review",
  "staff:invite","staff:suspend","staff:read",
  "roles:assign","permissions:manage",
  "integrations:manage","telephony:manage",
  "compliance:review","reports:export","audit:export","org:configure","billing:manage",
  "attendance:manage",
];

export const DUMMY_ORG_MEMBERS = [
  { id: "u-liam",   full_name: "Liam Carter",  username: "liam" },
  { id: "u-noah",   full_name: "Noah Patel",   username: "noah" },
  { id: "u-olivia", full_name: "Olivia Brown", username: "olivia" },
  { id: "u-emma",   full_name: "Emma Wilson",  username: "emma" },
  { id: "u-ava",    full_name: "Ava Singh",    username: "ava" },
  { id: "u-zara",   full_name: "Zara Ahmed",   username: "zara" },
];

/* --------------------------- Notifications --------------------------- */
export const DUMMY_NOTIFICATIONS = [
  { id: u(220), kind: "task_assigned",   severity: "info",    title: "New follow-up assigned",       body: "Renewal callback — Helios Logistics is due in 25 minutes.", created_at: minsAgo(5),  read_at: null },
  { id: u(221), kind: "complaint",       severity: "warning", title: "Complaint escalated to you",   body: "Priya Shah — agent conduct, urgent priority.",               created_at: minsAgo(40), read_at: null },
  { id: u(222), kind: "qa_review",       severity: "success", title: "New QA score: 92%",            body: "Inbound call with Aarav Mehta scored 92%. Nice work.",       created_at: minsAgo(120),read_at: null },
  { id: u(223), kind: "compliance",      severity: "danger",  title: "DSAR pending review",          body: "Aarav Mehta requested an export of all personal data.",      created_at: daysAgo(1),  read_at: daysAgo(0.5) },
  { id: u(224), kind: "announcement",    severity: "info",    title: "New compliance script live",   body: "Acknowledge the updated disclosure before your next call.",  created_at: daysAgo(1),  read_at: daysAgo(0.5) },
];