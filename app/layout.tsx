import type { Metadata } from "next";
import { MotionProvider } from "@/components/motion-provider";
import { themeBootstrap } from "@/lib/theme-bootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "TenderPack — Tender Document Package Builder",
  description: "Prepare and check tender documents privately in your browser.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head><body><MotionProvider>{children}</MotionProvider></body></html>;
}
