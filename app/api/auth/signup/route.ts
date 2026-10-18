import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db"; import { bad, csrfOk, ip, setAuthCookie } from "@/lib/auth";
import { limited } from "@/lib/rate"; import { uDto } from "@/lib/svc"; import { User } from "@/models";
export async function POST(req: NextRequest) {
  if (!csrfOk(req)) return bad("Forbidden", 403);
  if (limited("auth:" + ip(req), 20, 600000)) return bad("Too many attempts, try later", 429);
  const b = await req.json().catch(() => null);
  const name = String(b?.name || "").trim(), username = String(b?.username || "").trim().toLowerCase(), email = String(b?.email || "").trim().toLowerCase(), pw = String(b?.password || "");
  if (name.length < 2 || name.length > 60 || !/^[a-z0-9]{3,20}$/.test(username) || !/^\S+@\S+\.\S+$/.test(email) || email.length > 120 || pw.length < 8 || pw.length > 128)
    return bad("Enter a name, a 3–20 character username using only letters and numbers, a valid email and a password of at least 8 characters");
  await db();
  try {
    if (await User.exists({ username })) return bad("Username already taken", 409);
    const u = await User.create({ name, username, email, passwordHash: await bcrypt.hash(pw, 12) });
    const res = NextResponse.json({ user: uDto(u) }); setAuthCookie(res, String(u._id)); return res;
  } catch (e: any) { return e.code === 11000 ? bad(e.keyPattern?.username ? "Username already taken" : "Email already registered", 409) : bad("Server error", 500); }
}
