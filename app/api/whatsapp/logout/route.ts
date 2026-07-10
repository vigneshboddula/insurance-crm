import { waLogout } from "@/lib/whatsapp/client";

export async function POST() {
  await waLogout();
  return Response.json({ ok: true });
}
