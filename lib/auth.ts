import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { sign, verify } from "./jwt";
export const userId = async () => verify((await cookies()).get("token")?.value);
export const setAuthCookie = (res: NextResponse, id: string) =>
  res.cookies.set("token", sign(id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 604800 });
/** State-changing browser APIs require JSON and a verified same-origin source. */
export const csrfOk = (req: NextRequest) => {
  const contentType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return false;
  const expected = process.env.WEB_ORIGIN;
  if (!expected) return false;
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  try {
    const trustedOrigin = new URL(expected).origin;
    const sourceOrigin = origin ? new URL(origin).origin : referer ? new URL(referer).origin : "";
    return sourceOrigin === trustedOrigin && req.headers.get("sec-fetch-site") !== "cross-site";
  } catch { return false; }
};
export const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });
export const ip = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
