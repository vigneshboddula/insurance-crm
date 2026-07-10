import { waAutoConnect } from "@/lib/whatsapp/client";

export const dynamic = "force-dynamic";

export async function GET() {
  // Auto-reconnect from the saved session if we're disconnected (no-op otherwise),
  // so the agent doesn't have to click "Connect" after each app restart.
  const state = await waAutoConnect();
  return Response.json(state);
}
