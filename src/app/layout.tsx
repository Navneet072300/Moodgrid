export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { MotionProvider } from "@/components/motion-provider";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "MoodGrid — A little space for your feelings", template: "%s · MoodGrid" },
  description: "A private emoji mood journal. Check in with yourself, see your year in color, and discover the little patterns in your days.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body><MotionProvider>{children}</MotionProvider></body></html>;
}
