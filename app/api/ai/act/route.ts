import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { aiAvailable } from "@/lib/ai";
import { runAction, type PendingAction } from "@/lib/ai-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  if (!aiAvailable()) return Response.json({ ok: false, message: "AI not configured." }, { status: 503 });

  const action = (await req.json()) as PendingAction;
  if (!action || !action.type) return Response.json({ ok: false, message: "No action." }, { status: 400 });

  try {
    const result = await runAction(action);
    if (result.ok) {
      revalidatePath("/");
      revalidatePath("/tasks");
      if (action.type === "send_whatsapp") revalidatePath("/communications");
    }
    return Response.json(result);
  } catch (err) {
    return Response.json({ ok: false, message: err instanceof Error ? err.message : "Action failed." }, { status: 500 });
  }
}
