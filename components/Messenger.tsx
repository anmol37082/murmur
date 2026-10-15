"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type U = { id: string; name: string; email: string; avatar: string; lastSeenAt?: string };
type R = { id: string; text: string; senderId: string; deleted: boolean };
type M = { id: string; conversationId: string; senderId: string; clientId: string; text: string; deleted: boolean; editedAt?: string; createdAt: string; replyTo?: R | null; deliveredTo: string[]; readBy: string[]; status?: "sending" | "failed" };
type C = { id: string; other: U; lastMessage?: { text: string; senderId: string; at: string } | null; unread: number; updatedAt: string };

async function api(url: string, opt?: RequestInit) {
  const r = await fetch(url, { ...opt, headers: { "Content-Type": "application/json" } });
  if (r.status === 401) { location.href = "/login"; throw new Error("Session expired"); }
  const j = await r.json(); if (!r.ok) throw new Error(j.error || "Request failed"); return j;
}
const hm = (d: string) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const Av = ({ u }: { u: { name: string; avatar?: string } }) => u.avatar ? <img className="av" src={u.avatar} alt="" /> : <span className="av">{u.name[0]?.toUpperCase()}</span>;
const EMOJI = ["😀", "😂", "😍", "👍", "🙏", "🎉", "😢", "🔥"];

export default function Messenger({ socketUrl }: { socketUrl: string }) {
  const [me, setMe] = useState<U | null>(null);
  const [convs, setConvs] = useState<C[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, M[]>>({});
  const [more, setMore] = useState<Record<string, boolean>>({});
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [conn, setConn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(""); const [found, setFound] = useState<U[]>([]);
  const [text, setText] = useState(""); const [reply, setReply] = useState<M | null>(null); const [edit, setEdit] = useState<M | null>(null);
  const [emoji, setEmoji] = useState(false); const [err, setErr] = useState("");
  const [settings, setSettings] = useState(false); const [name, setName] = useState(""); const [av, setAv] = useState("");
  const sock = useRef<Socket | null>(null), activeRef = useRef<string | null>(null), meRef = useRef<U | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({}), myTyping = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottom = useRef<HTMLDivElement>(null), skipScroll = useRef(false);

  const upsert = useCallback((m: M) => setMsgs((p) => {
    const l = p[m.conversationId] || [];
    const i = l.findIndex((x) => x.id === m.id || (x.clientId === m.clientId && x.senderId === m.senderId));
    const n = i >= 0 ? l.map((x, j) => (j === i ? m : x)) : [...l, m];
    return { ...p, [m.conversationId]: n.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)) };
  }), []);
  const loadConvs = useCallback(() => api("/api/conversations").then((j) => setConvs(j.conversations)).catch((e) => setErr(e.message)), []);
  const loadMsgs = useCallback(async (cid: string, before?: string) => {
    const j = await api(`/api/messages?conversationId=${cid}${before ? `&before=${before}` : ""}`);
    skipScroll.current = !!before; (j.messages as M[]).forEach(upsert);
    if (before || !(cid in more)) setMore((p) => ({ ...p, [cid]: j.messages.length === 30 }));
  }, [upsert, more]);
  const markRead = (cid: string) => { sock.current?.emit("message:read", { conversationId: cid }); setConvs((p) => p.map((c) => (c.id === cid ? { ...c, unread: 0 } : c))); };

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    api("/api/auth/me").then((j) => { setMe(j.user); meRef.current = j.user; setName(j.user.name); setAv(j.user.avatar); });
    loadConvs().finally(() => setLoading(false));
    const s = io(socketUrl, {
      withCredentials: false,
      auth: (cb) => {
        fetch("/api/socket-token", { cache: "no-store" })
          .then((r) => r.ok ? r.json() : Promise.reject(new Error("Session expired")))
          .then(({ token }) => cb({ token }))
          .catch(() => cb({ token: "" }));
      },
    }); sock.current = s;
    s.on("connect", () => { setConn(true); loadConvs(); if (activeRef.current) { loadMsgs(activeRef.current).catch(() => {}); markRead(activeRef.current); } });
    s.on("disconnect", () => setConn(false));
    s.on("presence:snapshot", (ids: string[]) => setOnline(new Set(ids)));
    s.on("presence:update", (p: { userId: string; online: boolean; lastSeenAt?: string }) => {
      setOnline((o) => { const n = new Set(o); p.online ? n.add(p.userId) : n.delete(p.userId); return n; });
      if (p.lastSeenAt) setConvs((cs) => cs.map((c) => (c.other.id === p.userId ? { ...c, other: { ...c.other, lastSeenAt: p.lastSeenAt } } : c)));
    });
    s.on("message:new", (m: M) => {
      upsert(m);
      const mine = m.senderId === meRef.current?.id, isActive = activeRef.current === m.conversationId && !document.hidden;
      setConvs((cs) => {
        if (!cs.some((c) => c.id === m.conversationId)) { loadConvs(); return cs; }
        return cs.map((c) => (c.id === m.conversationId ? { ...c, lastMessage: { text: m.text, senderId: m.senderId, at: m.createdAt }, updatedAt: m.createdAt, unread: mine || isActive ? c.unread : c.unread + 1 } : c))
          .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      });
      if (!mine) {
        if (isActive) markRead(m.conversationId);
        else if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("New message", { body: m.text.slice(0, 80) });
      }
    });
    s.on("message:updated", upsert);
    s.on("message:delivered", (p: { messageId: string; conversationId: string; userId: string }) =>
      setMsgs((x) => ({ ...x, [p.conversationId]: (x[p.conversationId] || []).map((m) => (m.id === p.messageId ? { ...m, deliveredTo: [...m.deliveredTo, p.userId] } : m)) })));
    s.on("message:read", (p: { conversationId: string; userId: string }) =>
      setMsgs((x) => ({ ...x, [p.conversationId]: (x[p.conversationId] || []).map((m) => (m.readBy.includes(p.userId) ? m : { ...m, readBy: [...m.readBy, p.userId] })) })));
    s.on("typing:start", (p: { conversationId: string }) => {
      setTyping((t) => ({ ...t, [p.conversationId]: true }));
      clearTimeout(timers.current[p.conversationId]);
      timers.current[p.conversationId] = setTimeout(() => setTyping((t) => ({ ...t, [p.conversationId]: false })), 5000);
    });
    s.on("typing:stop", (p: { conversationId: string }) => setTyping((t) => ({ ...t, [p.conversationId]: false })));
    return () => { s.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const t = setTimeout(() => api(`/api/users/search?q=${encodeURIComponent(q)}`).then((j) => setFound(j.users)).catch((e) => setErr(e.message)), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { if (!skipScroll.current) bottom.current?.scrollIntoView({ block: "end" }); skipScroll.current = false; }, [msgs, active, typing]);

  async function open(id: string) {
    setActive(id); activeRef.current = id; setReply(null); setEdit(null); setText("");
    await loadMsgs(id).catch((e) => setErr(e.message)); markRead(id);
  }
  async function startWith(u: U) {
    try { const j = await api("/api/conversations", { method: "POST", body: JSON.stringify({ userId: u.id }) });
      setConvs((p) => (p.some((c) => c.id === j.conversation.id) ? p : [j.conversation, ...p])); setQ(""); open(j.conversation.id);
    } catch (e: any) { setErr(e.message); }
  }
  function dispatch(m: M) {
    sock.current?.timeout(8000).emit("message:send", { conversationId: m.conversationId, clientId: m.clientId, text: m.text, replyTo: m.replyTo?.id },
      (e: unknown, r: any) => (e || r?.error ? upsert({ ...m, status: "failed" }) : upsert(r.message)));
  }
  function send() {
    const t = text.trim(); if (!t || !active || !me) return;
    if (edit) { sock.current?.emit("message:edit", { id: edit.id, text: t }, (r: any) => r?.error && setErr(r.error)); setEdit(null); setText(""); return; }
    const clientId = crypto.randomUUID();
    const m: M = { id: clientId, clientId, conversationId: active, senderId: me.id, text: t, deleted: false, createdAt: new Date().toISOString(), replyTo: reply && { id: reply.id, text: reply.text, senderId: reply.senderId, deleted: reply.deleted }, deliveredTo: [], readBy: [], status: "sending" };
    upsert(m); setText(""); setReply(null); setEmoji(false); sock.current?.emit("typing:stop", { conversationId: active }); dispatch(m);
  }
  function onType(v: string) {
    setText(v); if (!active) return;
    if (!myTyping.current) sock.current?.emit("typing:start", { conversationId: active });
    if (myTyping.current) clearTimeout(myTyping.current);
    myTyping.current = setTimeout(() => { sock.current?.emit("typing:stop", { conversationId: active }); myTyping.current = null; }, 2000);
  }
  function pick(f: File) {
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 128; const s = Math.min(img.width, img.height);
      c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128); setAv(c.toDataURL("image/jpeg", 0.8)); };
    img.src = URL.createObjectURL(f);
  }
  async function saveProfile() {
    try { const j = await api("/api/auth/me", { method: "PATCH", body: JSON.stringify({ name, avatar: av }) }); setMe(j.user); meRef.current = j.user; setSettings(false); } catch (e: any) { setErr(e.message); }
  }
  async function logout() { await api("/api/auth/logout", { method: "POST" }).catch(() => {}); location.href = "/login"; }

  const ac = convs.find((c) => c.id === active), list = (active && msgs[active]) || [];
  const tick = (m: M, oid: string) => m.status === "sending" ? "…" : m.status === "failed"
    ? <button className="link" onClick={() => { upsert({ ...m, status: "sending" }); dispatch(m); }}>Failed · retry</button>
    : m.readBy.includes(oid) ? <b className="read" aria-label="Read">✓✓</b> : m.deliveredTo.includes(oid) ? <span aria-label="Delivered">✓✓</span> : <span aria-label="Sent">✓</span>;

  return (
    <div className={"app" + (active ? " chat-open" : "")}>
      <aside className="side">
        <header className="bar">
          <button className="ghost me" onClick={() => setSettings(true)} aria-label="Profile and settings">{me && <Av u={me} />}<b>{me?.name || "…"}</b></button>
          <span className={"dot " + (conn ? "on" : "")} title={conn ? "Connected" : "Reconnecting…"} />
        </header>
        <input className="search" placeholder="Search people by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        <div className="list">
          {q.trim().length >= 2 ? (found.length ? found.map((u) => (
            <button key={u.id} className="item" onClick={() => startWith(u)}><Av u={u} /><div><b>{u.name}</b><small>{u.email}</small></div></button>
          )) : <p className="empty">No users found</p>)
          : loading ? [1, 2, 3, 4].map((i) => <div key={i} className="item skel" />)
          : convs.length ? convs.map((c) => (
            <button key={c.id} className={"item" + (c.id === active ? " sel" : "")} onClick={() => open(c.id)}>
              <span className="avw"><Av u={c.other} />{online.has(c.other.id) && <i className="pres" />}</span>
              <div className="grow"><b>{c.other.name}</b><small>{typing[c.id] ? "typing…" : c.lastMessage ? (c.lastMessage.senderId === me?.id ? "You: " : "") + (c.lastMessage.text || "Deleted") : "Say hello 👋"}</small></div>
              <div className="end"><small>{c.lastMessage && hm(c.lastMessage.at)}</small>{c.unread > 0 && <span className="badge">{c.unread}</span>}</div>
            </button>))
          : <p className="empty">No conversations yet.<br />Search for someone to start chatting.</p>}
        </div>
      </aside>
      <main className="main">
        {!ac || !me ? <div className="blank"><div className="logo big" aria-hidden><i /><i /><i /></div><h2>Murmur</h2><p className="muted">Select a conversation or search for a person.</p></div> : <>
          <header className="bar">
            <button className="ghost back" onClick={() => { setActive(null); activeRef.current = null; }} aria-label="Back to chats">←</button>
            <Av u={ac.other} /><div className="grow"><b>{ac.other.name}</b>
              <small>{typing[ac.id] ? <span className="typing">typing<i /><i /><i /></span> : online.has(ac.other.id) ? "online" : ac.other.lastSeenAt ? "last seen " + new Date(ac.other.lastSeenAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "offline"}</small></div>
          </header>
          {!conn && <div className="banner">Reconnecting… messages will be sent when you're back online.</div>}
          <div className="msgs">
            {more[ac.id] && <button className="link center" onClick={() => loadMsgs(ac.id, list[0]?.id)}>Load older messages</button>}
            {!list.length && <p className="empty">No messages yet. Say hi!</p>}
            {list.map((m) => { const mine = m.senderId === me.id; return (
              <div key={m.clientId || m.id} className={"row" + (mine ? " mine" : "")}>
                <div className="bubble">
                  {m.replyTo && <div className="quote">{m.replyTo.deleted ? "Deleted message" : m.replyTo.text}</div>}
                  <span className={m.deleted ? "del" : ""}>{m.deleted ? "This message was deleted" : m.text}</span>
                  <small>{m.editedAt && "edited · "}{hm(m.createdAt)} {mine && tick(m, ac.other.id)}</small>
                  {!m.deleted && !m.status && <div className="acts">
                    <button onClick={() => setReply(m)} aria-label="Reply">↩</button>
                    <button onClick={() => navigator.clipboard.writeText(m.text)} aria-label="Copy text">⧉</button>
                    {mine && <><button onClick={() => { setEdit(m); setText(m.text); }} aria-label="Edit">✎</button>
                    <button onClick={() => sock.current?.emit("message:delete", { id: m.id })} aria-label="Delete">🗑</button></>}
                  </div>}
                </div>
              </div>); })}
            <div ref={bottom} />
          </div>
          {(reply || edit) && <div className="ctx"><span>{edit ? "Editing: " : "Replying: "}{(edit || reply)!.text.slice(0, 80)}</span><button className="ghost" onClick={() => { setReply(null); setEdit(null); setText(""); }} aria-label="Cancel">✕</button></div>}
          {emoji && <div className="emojis">{EMOJI.map((e) => <button key={e} className="ghost" onClick={() => onType(text + e)}>{e}</button>)}</div>}
          <div className="composer">
            <button className="ghost" onClick={() => setEmoji(!emoji)} aria-label="Emoji">😊</button>
            <textarea rows={1} value={text} maxLength={4000} placeholder="Type a message" aria-label="Message" onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className="primary round" onClick={send} disabled={!text.trim()} aria-label="Send">➤</button>
          </div></>}
      </main>
      {settings && <div className="modal" onClick={() => setSettings(false)}><div className="card" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <h2>Profile</h2>
        <label className="pic">{av ? <img className="av big" src={av} alt="" /> : <span className="av big">{name[0]}</span>}<input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} /></label>
        <label>Name<input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></label>
        <p className="muted">{me?.email}</p>
        <button className="link" onClick={() => typeof Notification !== "undefined" && Notification.requestPermission()}>Enable browser notifications</button>
        <div className="actions"><button className="primary" onClick={saveProfile}>Save</button><button className="link" onClick={logout}>Log out</button></div>
      </div></div>}
      {err && <div className="toast" role="alert" onClick={() => setErr("")}>{err}</div>}
    </div>
  );
}
