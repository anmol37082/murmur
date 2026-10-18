"use client";
import { useState } from "react";
export default function Login() {
  const [signup, setSignup] = useState(false); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr("");
    const f = Object.fromEntries(new FormData(e.currentTarget) as any);
    if (signup) f.username = String(f.username || "").trim().toLowerCase();
    try {
      const r = await fetch(`/api/auth/${signup ? "signup" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error); location.href = "/";
    } catch (x: any) { setErr(x.message || "Network error"); setBusy(false); }
  }
  return (
    <main className="auth"><form onSubmit={submit} className="card">
      <div className="logo" aria-hidden><i /><i /><i /></div>
      <h1>Murmur</h1><p className="muted">{signup ? "Create your account" : "Welcome back"}</p>
      {signup && <>
        <label>Name<input name="name" required minLength={2} maxLength={60} autoComplete="name" /></label>
        <label>Username<input name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9]+" title="Use 3–20 letters and numbers only, with no spaces or symbols." autoComplete="username" autoCapitalize="none" /></label>
      </>}
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      <label>Password<input name="password" type="password" required minLength={8} autoComplete={signup ? "new-password" : "current-password"} /></label>
      {err && <p role="alert" className="err">{err}</p>}
      <button className="primary" disabled={busy}>{busy ? "Please wait…" : signup ? "Sign up" : "Log in"}</button>
      <button type="button" className="link" onClick={() => setSignup(!signup)}>{signup ? "Have an account? Log in" : "New here? Create account"}</button>
    </form></main>
  );
}
