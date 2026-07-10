// ──────────────────────────────────────────────────────────────
// Insurer registry — per-company renewal portal link + step-by-step payment
// instructions, used to build WhatsApp renewal messages.
//
// ⚠️ The URLs and steps below are PLACEHOLDERS. Vignesh will supply the real
// renewal-payment links and click-by-click steps per insurer. Update the
// `renewalUrl` and `steps` for each entry — the message builder picks them up
// automatically. To add an insurer, add an entry keyed by a lowercase token
// that appears in the carrier name.
// ──────────────────────────────────────────────────────────────

export type InsurerInfo = {
  name: string;          // display name
  renewalUrl: string | null; // direct renewal/payment page (null = not set yet)
  steps: string[];       // ordered payment steps shown in the WhatsApp message
};

// Keyed by a token that appears (lowercased) in Policy.carrier.
const REGISTRY: Record<string, InsurerInfo> = {
  "hdfc": {
    name: "HDFC ERGO",
    renewalUrl: null, // TODO: real HDFC ERGO renewal link
    steps: [
      "Open the renewal link above",
      "Enter your policy number when asked",
      "Verify the premium and policy details shown",
      "Choose a payment method (UPI / card / net-banking) and pay",
      "Save the payment confirmation you receive",
    ],
  },
  "care": {
    name: "Care Health",
    renewalUrl: null, // TODO: real Care Health renewal link
    steps: [
      "Open the renewal link above",
      "Enter your policy number to fetch the renewal",
      "Check the premium and covered members",
      "Pay via UPI / card / net-banking",
      "Keep the payment receipt safe",
    ],
  },
  "niva": {
    name: "Niva Bupa",
    renewalUrl: null, // TODO: real Niva Bupa renewal link (separate renewals page)
    steps: [
      "Open the Niva Bupa renewal link above",
      "Enter your policy number",
      "Confirm the premium amount",
      "Complete the payment (UPI / card / net-banking)",
      "Save the confirmation message",
    ],
  },
  "star": {
    name: "Star Health",
    renewalUrl: null,
    steps: [
      "Open the renewal link above",
      "Enter your policy number",
      "Verify premium and details",
      "Pay online and save the receipt",
    ],
  },
};

const GENERIC: InsurerInfo = {
  name: "your insurer",
  renewalUrl: null,
  steps: [
    "Open your insurer's app or website",
    "Go to Renewals and enter your policy number",
    "Verify the premium, then pay online",
    "Save the payment confirmation",
  ],
};

/** Look up insurer info by a policy's carrier string (fuzzy token match). */
export function insurerFor(carrier: string | null | undefined): InsurerInfo {
  const c = (carrier ?? "").toLowerCase();
  for (const token of Object.keys(REGISTRY)) {
    if (c.includes(token)) return REGISTRY[token];
  }
  return GENERIC;
}

/** The renewal link to use for a policy: the policy's own override, else the insurer default. */
export function renewalLinkFor(carrier: string | null | undefined, policyRenewalUrl?: string | null): string | null {
  if (policyRenewalUrl && policyRenewalUrl.trim()) return policyRenewalUrl.trim();
  return insurerFor(carrier).renewalUrl;
}
