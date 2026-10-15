import { createServer } from "http";
import { Server } from "socket.io";
import mongoose, { Types } from "mongoose";
import { Conversation, Message, User } from "../models";
import { verifySocketTicket } from "../lib/jwt"; import { limited } from "../lib/rate"; import { loadMsg, mDto } from "../lib/svc";

const origin = process.env.WEB_ORIGIN!;
const http = createServer((_, r) => r.end("ok"));
const io = new Server(http, { cors: { origin, credentials: false }, maxHttpBufferSize: 20_000 });
const online = new Map<string, number>();
const room = (id: string) => "u:" + id;
const emitTo = (ids: string[], ev: string, p: unknown) => ids.forEach((i) => io.to(room(i)).emit(ev, p));
const member = (cid: unknown, uid: string) => (Types.ObjectId.isValid(String(cid)) ? Conversation.findOne({ _id: String(cid), participants: uid }) : null);
async function contacts(uid: string) {
  const cs = await Conversation.find({ participants: uid }, "participants").lean();
  return [...new Set(cs.flatMap((c: any) => c.participants.map(String)))].filter((x) => x !== uid) as string[];
}

io.use((s, next) => {
  if (s.handshake.headers.origin !== origin) return next(new Error("bad origin"));
  const id = verifySocketTicket(s.handshake.auth?.token);
  if (!id) return next(new Error("unauthorized"));
  s.data.uid = id; next();
});

io.on("connection", async (s) => {
  const uid = s.data.uid as string;
  s.join(room(uid));
  online.set(uid, (online.get(uid) || 0) + 1);
  const cs = await contacts(uid);
  if (online.get(uid) === 1) emitTo(cs, "presence:update", { userId: uid, online: true });
  s.emit("presence:snapshot", cs.filter((c) => online.has(c)));

  // offline sync: mark everything sent to me while away as delivered
  const convs = await Conversation.find({ participants: uid }, "_id");
  const pend = await Message.find({ conversationId: { $in: convs.map((c) => c._id) }, senderId: { $ne: uid }, deliveredTo: { $ne: uid } }, "_id conversationId senderId").lean();
  if (pend.length) {
    await Message.updateMany({ _id: { $in: pend.map((m: any) => m._id) } }, { $addToSet: { deliveredTo: uid } });
    for (const m of pend as any[]) emitTo([String(m.senderId)], "message:delivered", { messageId: String(m._id), conversationId: String(m.conversationId), userId: uid });
  }

  s.on("message:send", async (d: any, ack: (r: unknown) => void = () => {}) => {
    try {
      if (limited("msg:" + uid, 30, 10000)) return ack({ error: "Slow down" });
      const text = String(d?.text || "").trim(), clientId = String(d?.clientId || "");
      if (!text || text.length > 4000 || !/^[\w-]{8,64}$/.test(clientId)) return ack({ error: "Invalid message" });
      const c = await member(d?.conversationId, uid); if (!c) return ack({ error: "Forbidden" });
      let m: any = await Message.findOne({ senderId: uid, clientId }), fresh = false;
      if (!m) {
        const rt = Types.ObjectId.isValid(String(d.replyTo)) && (await Message.exists({ _id: d.replyTo, conversationId: c._id })) ? d.replyTo : undefined;
        const others = c.participants.map(String).filter((p: string) => p !== uid);
        try {
          m = await Message.create({ conversationId: c._id, senderId: uid, clientId, text, replyTo: rt, deliveredTo: others.filter((o: string) => online.has(o)), readBy: [] });
          fresh = true;
        } catch (e: any) { if (e.code !== 11000) throw e; m = await Message.findOne({ senderId: uid, clientId }); }
        if (fresh) await Conversation.updateOne({ _id: c._id }, { lastMessage: { text: text.slice(0, 200), senderId: uid, at: m.createdAt } });
      }
      const dto = mDto(await loadMsg(m._id));
      if (fresh) emitTo(c.participants.map(String), "message:new", dto);
      ack({ message: dto });
    } catch { ack({ error: "Server error" }); }
  });

  s.on("message:read", async (d: any) => {
    const c = await member(d?.conversationId, uid); if (!c) return;
    await Message.updateMany({ conversationId: c._id, senderId: { $ne: uid }, readBy: { $ne: uid } }, { $addToSet: { readBy: uid, deliveredTo: uid } });
    emitTo(c.participants.map(String), "message:read", { conversationId: String(c._id), userId: uid });
  });

  for (const ev of ["typing:start", "typing:stop"]) s.on(ev, async (d: any) => {
    if (limited("ty:" + uid, 100, 10000)) return;
    const c = await member(d?.conversationId, uid); if (!c) return;
    emitTo(c.participants.map(String).filter((p: string) => p !== uid), ev, { conversationId: String(c._id), userId: uid });
  });

  const change = (kind: "edit" | "delete") => async (d: any, ack: (r: unknown) => void = () => {}) => {
    const m: any = Types.ObjectId.isValid(String(d?.id)) ? await Message.findOne({ _id: d.id, senderId: uid, deletedAt: { $exists: false } }) : null;
    if (!m) return ack({ error: "Not allowed" });
    if (kind === "edit") { const t = String(d.text || "").trim(); if (!t || t.length > 4000) return ack({ error: "Invalid text" }); m.text = t; m.editedAt = new Date(); }
    else m.deletedAt = new Date();
    await m.save();
    const c: any = await Conversation.findById(m.conversationId);
    emitTo(c.participants.map(String), "message:updated", mDto(await loadMsg(m._id))); ack({ ok: true });
  };
  s.on("message:edit", change("edit")); s.on("message:delete", change("delete"));

  s.on("disconnect", async () => {
    const n = (online.get(uid) || 1) - 1;
    if (n > 0) return void online.set(uid, n);
    online.delete(uid);
    const lastSeenAt = new Date(); await User.updateOne({ _id: uid }, { lastSeenAt });
    emitTo(await contacts(uid), "presence:update", { userId: uid, online: false, lastSeenAt });
  });
});

mongoose.connect(process.env.MONGODB_URI!).then(() => http.listen(Number(process.env.PORT || process.env.SOCKET_PORT || 4000), () => console.log("socket ready")));
