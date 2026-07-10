// Allowed values + display labels for the string-typed status/category fields
// (SQLite has no enums). Single source of truth for forms and badges.

export const LINES = [
  { value: "health", label: "Health" },
  { value: "term", label: "Term" },
  { value: "life", label: "Life" },
  { value: "personal_accident", label: "Personal Accident" },
  { value: "motor", label: "Motor" },
  { value: "mutual_fund", label: "Mutual Fund" },
];

// Insurers the agent works with (high-priority field — shown first on the form).
// Free text is still allowed via the "Other" path in the UI.
export const INSURERS = [
  { value: "HDFC ERGO", label: "HDFC ERGO" },
  { value: "Care Health", label: "Care Health" },
  { value: "Star Health", label: "Star Health" },
  { value: "Niva Bupa", label: "Niva Bupa" },
  { value: "ICICI Lombard", label: "ICICI Lombard" },
  { value: "ICICI Pru", label: "ICICI Prudential" },
  { value: "HDFC Life", label: "HDFC Life" },
  { value: "LIC", label: "LIC" },
  { value: "Bajaj Allianz", label: "Bajaj Allianz" },
  { value: "Tata AIG", label: "Tata AIG" },
  { value: "SBI Life", label: "SBI Life" },
  { value: "Max Life", label: "Max Life" },
];

// Relation of an insured member to the proposer.
export const INSURED_RELATIONS = [
  { value: "Self", label: "Self (proposer)" },
  { value: "Spouse", label: "Spouse" },
  { value: "Wife", label: "Wife" },
  { value: "Husband", label: "Husband" },
  { value: "Son", label: "Son" },
  { value: "Daughter", label: "Daughter" },
  { value: "Father", label: "Father" },
  { value: "Mother", label: "Mother" },
  { value: "Other", label: "Other" },
];

export const POLICY_STATUS = [
  { value: "active", label: "Active" },
  { value: "lapsed", label: "Lapsed" },
  { value: "matured", label: "Matured" },
  { value: "surrendered", label: "Surrendered" },
];

export const FREQUENCY = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-yearly" },
  { value: "annual", label: "Annual" },
];

export const PAYMENT_MODE = [
  { value: "none", label: "None" },
  { value: "auto_debit", label: "Auto-debit" },
  { value: "online", label: "Online" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "agent", label: "Through agent" },
];

// Health policy structure: one life vs a shared family floater sum insured.
export const POLICY_TYPE = [
  { value: "individual", label: "Individual" },
  { value: "floater", label: "Family floater" },
];

export const INCOME_BANDS = [
  { value: "<5L", label: "Below ₹5L" },
  { value: "5-10L", label: "₹5L – ₹10L" },
  { value: "10-25L", label: "₹10L – ₹25L" },
  { value: "25L+", label: "₹25L+" },
];

export const RELATIONSHIPS = [
  { value: "self", label: "Self (head)" },
  { value: "spouse", label: "Spouse" },
  { value: "son", label: "Son" },
  { value: "daughter", label: "Daughter" },
  { value: "parent", label: "Parent" },
  { value: "other", label: "Other" },
];

export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export const DOC_TYPES = [
  { value: "aadhaar", label: "Aadhaar card" },
  { value: "pan", label: "PAN card" },
  { value: "address_proof", label: "Address proof" },
  { value: "photo", label: "Client photo" },
  { value: "proposal", label: "Signed proposal" },
  { value: "policy_copy", label: "Policy copy (PDF)" },
  { value: "renewal_notice", label: "Renewal notice" },
  { value: "kyc_pehchaan", label: "KYC / Pehchaan (HDFC ERGO)" },
  { value: "marksheet", label: "Marksheet (10th/12th)" },
  { value: "claim", label: "Claim document" },
  { value: "nominee_id_proof", label: "Nominee ID proof (Aadhaar)" },
  { value: "birth_certificate", label: "Birth certificate" },
  { value: "other", label: "Other" },
];

export const LEAD_STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "quoted", label: "Quoted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export const LEAD_SOURCES = [
  { value: "referral", label: "Referral" },
  { value: "social", label: "Social media" },
  { value: "walk_in", label: "Walk-in" },
  { value: "website", label: "Website" },
  { value: "other", label: "Other" },
];

export const LEAD_INTERESTS = [
  { value: "health", label: "Health" },
  { value: "term", label: "Term" },
  { value: "life", label: "Life" },
];

export const TASK_STATUSES = [
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
  { value: "needs_review", label: "Needs review" },
  { value: "call", label: "Call" },
  { value: "other", label: "Other" },
];

export const COMM_CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
];

export const COMM_DIRECTIONS = [
  { value: "outbound", label: "Sent / outgoing" },
  { value: "inbound", label: "Received / incoming" },
];

export const ENDORSEMENT_TYPES = [
  { value: "address_change", label: "Address change" },
  { value: "nominee_change", label: "Nominee change" },
  { value: "sum_insured", label: "Sum insured change" },
  { value: "member_add", label: "Add member" },
  { value: "member_remove", label: "Remove member" },
  { value: "vehicle_transfer", label: "Vehicle transfer" },
  { value: "other", label: "Other" },
];

export const ENDORSEMENT_STATUS = [
  { value: "requested", label: "Requested" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export const COLLECTION_STATUS = [
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "collected", label: "Collected" },
];

export function labelOf(list: { value: string; label: string }[], value?: string | null) {
  return list.find((x) => x.value === value)?.label ?? value ?? "—";
}
