import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { db } from "@/lib/db"; import { bad, csrfOk, userId } from "@/lib/auth"; import { convDto } from "@/lib/svc";
import { Conversation, Message, User } from "@/models";
const unread = (c: any, me: string) => Message.countDocuments({ conversationId: c._id, senderId: { $ne: me }, readBy: { $ne: me } });
export async function GET() {
  const me = await userId(); if (!me) return bad("Unauthorized", 401);
  await db();
  const cs = await Conversation.find({ participants: me }).sort({ updatedAt: -1 }).populate("participants", "name username email avatar lastSeenAt").lean();
  return NextResponse.json({ conversations: await Promise.all(cs.map(async (c) => convDto(c, me, await unread(c, me)))) }, { headers: { "Cache-Control": "no-store, private" } });
}
export async function POST(req: NextRequest) {
  if (!csrfOk(req)) return bad("Forbidden", 403);
  const me = await userId(); if (!me) return bad("Unauthorized", 401);
  const other = String((await req.json().catch(() => null))?.userId || "");
  if (!Types.ObjectId.isValid(other) || other === me) return bad("Invalid user");
  await db();
  if (!(await User.exists({ _id: other }))) return bad("User not found", 404);
  const pairKey = [me, other].sort().join(":");
  let c: any;
  try { c = await Conversation.findOneAndUpdate({ pairKey }, { $setOnInsert: { pairKey, participants: [me, other] } }, { upsert: true, new: true }); }
  catch (e: any) { if (e.code !== 11000) throw e; c = await Conversation.findOne({ pairKey }); }
  c = await Conversation.findById(c._id).populate("participants", "name username email avatar lastSeenAt").lean();
  return NextResponse.json({ conversation: convDto(c, me, await unread(c, me)) });
}
