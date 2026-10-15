import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { db } from "@/lib/db"; import { bad, userId } from "@/lib/auth"; import { mDto } from "@/lib/svc"; import { Conversation, Message } from "@/models";
export async function GET(req: NextRequest) {
  const me = await userId(); if (!me) return bad("Unauthorized", 401);
  const sp = req.nextUrl.searchParams, cid = sp.get("conversationId") || "", before = sp.get("before") || "";
  await db();
  if (!Types.ObjectId.isValid(cid) || !(await Conversation.exists({ _id: cid, participants: me }))) return bad("Forbidden", 403);
  const f: any = { conversationId: cid }; if (Types.ObjectId.isValid(before)) f._id = { $lt: before };
  const l = await Message.find(f).sort({ _id: -1 }).limit(30).populate("replyTo", "text senderId deletedAt").lean();
  return NextResponse.json({ messages: l.reverse().map(mDto) });
}
