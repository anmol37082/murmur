import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Murmur", description: "Quiet, fast private messaging", manifest: "/manifest.json", icons: { apple: "/murmur-192.png" } };
export const viewport: Viewport = { themeColor: "#4f46e5", width: "device-width", initialScale: 1 };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body suppressHydrationWarning>{children}</body></html>;
}
