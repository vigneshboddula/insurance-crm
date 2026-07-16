import { NextRequest } from "next/server";
import { getClientCard } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone") ?? "";
  if (phone.replace(/\D/g, "").length < 10) {
    return Response.json({ error: "Phone must have at least 10 digits" }, { status: 400 });
  }

  const card = await getClientCard(phone);
  if (!card) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(card);
}
