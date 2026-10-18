import jwt from "jsonwebtoken";
const secret = () => {
  const value = process.env.JWT_SECRET || "";
  if (value.length < 32 || value === "change-me-to-a-long-random-string") throw new Error("JWT_SECRET must be a unique secret of at least 32 characters");
  return value;
};
export const sign = (id: string) => jwt.sign({ id }, secret(), { expiresIn: "7d", algorithm: "HS256" });
export const verify = (t?: string): string | null => {
  try {
    const payload = jwt.verify(t || "", secret(), { algorithms: ["HS256"] }) as { id?: unknown };
    return typeof payload.id === "string" ? payload.id : null;
  } catch { return null; }
};

export const signSocketTicket = (id: string) =>
  jwt.sign({ id, purpose: "socket" }, secret(), { expiresIn: "1m", algorithm: "HS256" });

export const verifySocketTicket = (token?: string): string | null => {
  try {
    const payload = jwt.verify(token || "", secret(), { algorithms: ["HS256"] }) as { id?: string; purpose?: string };
    return payload.purpose === "socket" && typeof payload.id === "string" ? payload.id : null;
  } catch { return null; }
};
