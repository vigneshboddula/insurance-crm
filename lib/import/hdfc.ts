import "server-only";
import * as XLSX from "xlsx";

// Parses the HDFC ERGO agent renewal export. Designed so other insurer shapes
// can be added later (each gets a detect() + map()). AI fuzzy-mapping is Phase 4.

export type ImportRow = {
  policyNumber: string;
  customerName: string;
  variant: string | null; // Product
  line: string; // from LOB
  startDate: string | null; // iso
  renewalDueDate: string | null; // iso
  premium: number | null;
  sumInsured: number | null;
  ncbValue: number | null;
  previousPolicyNumber: string | null;
  kycId: string | null;
  members: { name: string; relation: string | null }[];
};

const REQUIRED = ["Policy Number", "Customer Name", "Renewal Due Date", "Insured Members Details"];

export function detectHdfc(headers: string[]): boolean {
  const set = new Set(headers.map((h) => h.trim()));
  return REQUIRED.every((n) => set.has(n));
}

function toIso(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return isNaN(n) ? null : n;
}
function mapLine(lob: unknown): string {
  const s = String(lob ?? "").toLowerCase();
  if (s.includes("health")) return "health";
  if (s.includes("motor")) return "motor";
  if (s.includes("term")) return "term";
  if (s.includes("life")) return "life";
  if (s.includes("accident") || s === "pa") return "personal_accident";
  return "health";
}

/** Parse "name (Relation); name (Relation)" → members. `(Self)` = proposer. */
export function parseMembers(raw: unknown): { name: string; relation: string | null }[] {
  if (!raw) return [];
  return String(raw)
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      return m ? { name: m[1].trim(), relation: m[2].trim() || null } : { name: s, relation: null };
    });
}

export function parseWorkbook(buf: Buffer): { detected: boolean; headers: string[]; insurer: string; rows: ImportRow[] } {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const headers = json.length ? Object.keys(json[0]) : [];
  const detected = detectHdfc(headers);
  const rows: ImportRow[] = !detected
    ? []
    : json
        .filter((r) => String(r["Policy Number"] ?? "").trim())
        .map((r) => ({
          policyNumber: String(r["Policy Number"]).trim(),
          customerName: String(r["Customer Name"] ?? "").trim(),
          variant: r["Product"] ? String(r["Product"]).trim() : null,
          line: mapLine(r["LOB"]),
          startDate: toIso(r["Policy Start Date"]),
          renewalDueDate: toIso(r["Renewal Due Date"]),
          premium: toNum(r["Renewal Premium"]),
          sumInsured: toNum(r["Sum Insured"]),
          ncbValue: toNum(r["NCB Value"]),
          previousPolicyNumber: r["Previous Policy Number"] ? String(r["Previous Policy Number"]).trim() : null,
          kycId: r["KYC ID"] ? String(r["KYC ID"]).trim() : null,
          members: parseMembers(r["Insured Members Details"]),
        }));
  return { detected, headers, insurer: "HDFC ERGO", rows };
}
