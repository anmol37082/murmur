import { NextRequest, NextResponse } from "next/server";
import { bad, csrfOk } from "@/lib/auth";
export async function POST(req: NextRequest) {
  if (!csrfOk(req)) return bad("Forbidden", 403);
  const res = NextResponse.json({ ok: true }); res.cookies.set("token", "", { path: "/", maxAge: 0 }); return res;
}
