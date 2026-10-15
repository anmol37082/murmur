import { Message } from "../models";
export const uDto = (u: any) => ({ id: String(u._id), name: u.name, email: u.email, avatar: u.avatar || "", lastSeenAt: u.lastSeenAt });
export const mDto = (m: any) => ({
  id: String(m._id), conversationId: String(m.conversationId), senderId: String(m.senderId), clientId: m.clientId,
  text: m.deletedAt ? "" : m.text, deleted: !!m.deletedAt, editedAt: m.editedAt, createdAt: m.createdAt,
  deliveredTo: (m.deliveredTo || []).map(String), readBy: (m.readBy || []).map(String),
  replyTo: m.replyTo?._id ? { id: String(m.replyTo._id), text: m.replyTo.deletedAt ? "" : m.replyTo.text, senderId: String(m.replyTo.senderId), deleted: !!m.replyTo.deletedAt } : null,
});
export const loadMsg = (id: any) => Message.findById(id).populate("replyTo", "text senderId deletedAt").lean();
export const convDto = (c: any, me: string, unread: number) => {
  const o = c.participants.find((p: any) => String(p._id) !== me) || c.participants[0];
  return { id: String(c._id), other: uDto(o), lastMessage: c.lastMessage?.at ? { text: c.lastMessage.text, senderId: String(c.lastMessage.senderId), at: c.lastMessage.at } : null, unread, updatedAt: c.updatedAt };
};
