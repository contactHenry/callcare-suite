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