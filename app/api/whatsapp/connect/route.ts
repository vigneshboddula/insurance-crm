import { waConnect } from "@/lib/whatsapp/client";

export async function POST() {
  const state = await waConnect();
  return Response.json(state);
}
