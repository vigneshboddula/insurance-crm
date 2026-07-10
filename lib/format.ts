// Display helpers shared across the UI.

/** Format a number as Indian Rupees, e.g. 125000 -> "₹1,25,000". */
export function inr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Short, friendly date e.g. "23 Jun 2026". */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Whole days from today until `d` (negative = overdue). */
export function daysUntil(d: Date | string): number {
  const date = typeof d === "string" ? new Date(d) : d;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Pick a status pill class for a renewal/due date. */
export function dueTone(days: number): "red" | "amber" | "green" {
  if (days < 0) return "red"; // overdue
  if (days <= 14) return "amber"; // due soon
  return "green";
}
