import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db"; import { bad, csrfOk, userId } from "@/lib/auth"; import { uDto } from "@/lib/svc"; import { User } from "@/models";
export async function GET() {
  const me = await userId(); if (!me) return bad("Unauthorized", 401);
  await db(); const u = await User.findById(me); return u ? NextResponse.json({ user: uDto(u) }) : bad("Unauthorized", 401);
}
export async function PATCH(req: NextRequest) {
  if (!csrfOk(req)) return bad("Forbidden", 403);
  const me = await userId(); if (!me) return bad("Unauthorized", 401);
  const b = await req.json().catch(() => null); const set: any = {};
  if (b?.name !== undefined) { const n = String(b.name).trim(); if (n.length < 2 || n.length > 60) return bad("Invalid name"); set.name = n; }
  if (b?.avatar !== undefined) { const a = String(b.avatar); if (a && (!a.startsWith("data:image/") || a.length > 150000)) return bad("Invalid image"); set.avatar = a; }
  await db(); const u = await User.findByIdAndUpdate(me, set, { new: true }); return NextResponse.json({ user: uDto(u) });
}
