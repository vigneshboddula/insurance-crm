import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

// Download all policies as a contacts sheet — one row per policy (policy number
// is the unique key). Fill Phone / Gmail offline (e.g. a Python script) and
// re-upload on the Contacts page to bulk-update every client's contact details.
export async function GET() {
  const policies = await prisma.policy.findMany({
    where: { client: { archivedAt: null } },
    orderBy: [{ client: { name: "asc" } }, { renewalDate: "asc" }],
    include: { client: { select: { name: true, phone: true, email: true } } },
  });

  const rows = policies.map((p, i) => ({
    "S.No": i + 1,
    "Policy Number": p.policyNumber,
    "Name": p.client.name,
    "Phone Number": p.client.phone || "",
    "Gmail ID": p.client.email || "",
    "Company / Type": `${p.carrier || ""}${p.policyType ? ` / ${p.policyType === "floater" ? "Family floater" : "Individual"}` : ""}`,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 6 }, { wch: 24 }, { wch: 24 }, { wch: 16 }, { wch: 26 }, { wch: 28 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contacts");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="contacts.xlsx"`,
    },
  });
}
