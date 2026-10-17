import type { Metadata } from "next";
import { Geist_Mono, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Hanken Grotesk: an open grotesk close to the look we designed against.
const display = Hanken_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TuneO",
  description: "Open-source, self-hosted AI music studio",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden font-sans text-[16px]">{children}</body>
    </html>
  );
}
