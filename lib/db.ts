import mongoose from "mongoose";
const g = globalThis as unknown as { _mongo?: Promise<typeof mongoose> };
export async function db() {
  if (!g._mongo) g._mongo = mongoose.connect(process.env.MONGODB_URI!);
  return g._mongo;
}
