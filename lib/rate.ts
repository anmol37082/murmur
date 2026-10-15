const hits = new Map<string, number[]>();
/** In-memory sliding window. Swap for Redis if you run multiple instances. */
export function limited(key: string, max: number, ms: number) {
  const n = Date.now(), a = (hits.get(key) || []).filter((t) => n - t < ms);
  a.push(n); hits.set(key, a); return a.length > max;
}
