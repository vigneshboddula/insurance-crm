import { buildExportZip } from "@/lib/backup";

export async function GET() {
  try {
    const buf = await buildExportZip();
    const name = `crm-export-${new Date().toISOString().slice(0, 10)}.zip`;
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Export failed", { status: 500 });
  }
}
