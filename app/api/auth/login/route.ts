import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db"; import { bad, csrfOk, ip, setAuthCookie } from "@/lib/auth";
import { limited } from "@/lib/rate"; import { uDto } from "@/lib/svc"; import { User } from "@/models";
export async function POST(req: NextRequest) {
  if (!csrfOk(req)) return bad("Forbidden", 403);
  if (limited("auth:" + ip(req), 20, 600000)) return bad("Too many attempts, try later", 429);
  const b = await req.json().catch(() => null);
  const email = String(b?.email || "").trim().toLowerCase(), pw = String(b?.password || "");
  await db();
  const u = await User.findOne({ email });
  if (!u || !(await bcrypt.compare(pw.slice(0, 128), u.passwordHash))) return bad("Wrong email or password", 401);
  const res = NextResponse.json({ user: uDto(u) }); setAuthCookie(res, String(u._id)); return res;
}
