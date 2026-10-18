import { Schema, model, models, Model } from "mongoose";
const get = (n: string, s: Schema): Model<any> => {
  const existing = models[n] as Model<any> | undefined;
  if (existing) {
    // Next.js dev hot reload can keep a compiled model with an older schema.
    existing.schema.add(s.obj);
    return existing;
  }
  return model<any>(n, s);
};
const Id = Schema.Types.ObjectId;
export const User = get("User", new Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  username: { type: String, lowercase: true, trim: true, minlength: 3, maxlength: 20 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  avatar: { type: String, default: "" },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true }).index({ name: 1 }).index({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: "string" } } }));
export const Conversation = get("Conversation", new Schema({
  participants: [{ type: Id, ref: "User" }],
  pairKey: { type: String, required: true, unique: true }, // sorted "idA:idB" => no duplicate DMs
  lastMessage: { text: String, senderId: Id, at: Date },
}, { timestamps: true }).index({ participants: 1, updatedAt: -1 }));
export const Message = get("Message", new Schema({
  conversationId: { type: Id, required: true },
  senderId: { type: Id, required: true },
  clientId: { type: String, required: true },
  text: { type: String, required: true, maxlength: 4000 },
  replyTo: { type: Id, ref: "Message" },
  deliveredTo: [Id], readBy: [Id],
  editedAt: Date, deletedAt: Date,
}, { timestamps: true }).index({ conversationId: 1, _id: -1 }).index({ senderId: 1, clientId: 1 }, { unique: true }));
