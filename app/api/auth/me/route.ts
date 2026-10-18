import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { db } from "@/lib/db"; import { bad, csrfOk, userId } from "@/lib/auth"; import { uDto } from "@/lib/svc"; import { User } from "@/models";
export async function GET() {
  const me = await userId(); if (!me) return bad("Unauthorized", 401);
  await db(); const u = await User.collection.findOne({ _id: new Types.ObjectId(me) }); return u ? NextResponse.json({ user: uDto(u) }, { headers: { "Cache-Control": "no-store, private" } }) : bad("Unauthorized", 401);
}
export async function PATCH(req: NextRequest) {
  if (!csrfOk(req)) return bad("Forbidden", 403);
  const me = await userId(); if (!me) return bad("Unauthorized", 401);
  const b = await req.json().catch(() => null); const set: any = {};
  if (b?.name !== undefined) { const n = String(b.name).trim(); if (n.length < 2 || n.length > 60) return bad("Invalid name"); set.name = n; }
  if (b?.username !== undefined) { const username = String(b.username).trim().toLowerCase(); if (!/^[a-z0-9]{3,20}$/.test(username)) return bad("Username must be 3–20 letters and numbers only"); set.username = username; }
  if (b?.avatar !== undefined) { const a = String(b.avatar); if (a && (!a.startsWith("data:image/") || a.length > 150000)) return bad("Invalid image"); set.avatar = a; }
  await db();
  try {
    const id = new Types.ObjectId(me);
    if (set.username && await User.collection.findOne({ username: set.username, _id: { $ne: id } }, { projection: { _id: 1 } })) return bad("Username already taken", 409);
    await User.collection.updateOne({ _id: id }, { $set: set });
    const u = await User.collection.findOne({ _id: id });
    if (!u) return bad("Unauthorized", 401);
    return NextResponse.json({ user: uDto(u) }, { headers: { "Cache-Control": "no-store, private" } });
  }
  catch (e: any) { return e.code === 11000 ? bad("Username already taken", 409) : bad("Server error", 500); }
}
