import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db"; import { bad, userId } from "@/lib/auth"; import { limited } from "@/lib/rate"; import { uDto } from "@/lib/svc"; import { User } from "@/models";
export async function GET(req: NextRequest) {
  const me = await userId(); if (!me) return bad("Unauthorized", 401);
  if (limited("search:" + me, 30, 60000)) return bad("Too many searches", 429);
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ users: [] });
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  await db();
  const us = await User.find({ _id: { $ne: me }, $or: [{ email: re }, { name: re }] }).limit(10);
  return NextResponse.json({ users: us.map(uDto) });
}
