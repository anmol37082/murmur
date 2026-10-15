import jwt from "jsonwebtoken";
export const sign = (id: string) => jwt.sign({ id }, process.env.JWT_SECRET!, { expiresIn: "7d" });
export const verify = (t?: string): string | null => {
  try { return (jwt.verify(t || "", process.env.JWT_SECRET!) as { id: string }).id; } catch { return null; }
};

export const signSocketTicket = (id: string) =>
  jwt.sign({ id, purpose: "socket" }, process.env.JWT_SECRET!, { expiresIn: "1m" });

export const verifySocketTicket = (token?: string): string | null => {
  try {
    const payload = jwt.verify(token || "", process.env.JWT_SECRET!) as { id?: string; purpose?: string };
    return payload.purpose === "socket" && typeof payload.id === "string" ? payload.id : null;
  } catch { return null; }
};
