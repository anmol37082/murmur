import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { sign, verify } from "./jwt";
export const userId = async () => verify((await cookies()).get("token")?.value);
export const setAuthCookie = (res: NextResponse, id: string) =>
  res.cookies.set("token", sign(id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 604800 });
/** CSRF defence: SameSite=Lax cookie + exact Origin match on state-changing requests. */
export const csrfOk = (req: NextRequest) => { const o = req.headers.get("origin"); return !o || o === process.env.WEB_ORIGIN; };
export const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });
export const ip = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
