import { NextResponse } from "next/server";
import { userId } from "../../../lib/auth";
import { signSocketTicket } from "../../../lib/jwt";

export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ token: signSocketTicket(id) }, { headers: { "Cache-Control": "no-store, private" } });
}
