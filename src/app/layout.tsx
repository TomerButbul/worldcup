import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Anton } from "next/font/google";
import "./globals.css";
import AnimatedBackground from "@/components/AnimatedBackground";
import FlagGarland from "@/components/FlagGarland";
import { PlayerCardHost } from "@/components/PlayerCard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "WorldCuP — 2026 Bracket & Prediction Game",
    template: "%s · WorldCuP",
  },
  description: "Predict the 2026 World Cup bracket and match results. Compete with friends.",
  applicationName: "WorldCuP",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "WorldCuP" },
  openGraph: {
    title: "WorldCuP 2026 — Bracket & Prediction Game",
    description: "Predict the bracket, call every match, and battle your friends across three leaderboards.",
    type: "website",
  },
  twitter: { card: "summary", title: "WorldCuP 2026", description: "Predict the World Cup. Compete with friends." },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e1545",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col overflow-x-hidden">
        <AnimatedBackground />
        <div className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-30">
          <FlagGarland />
        </div>
        <div className="relative z-10 flex min-h-screen flex-col pt-[calc(env(safe-area-inset-top)+1.75rem)]">
          {children}
        </div>
        <PlayerCardHost />
      </body>
    </html>
  );
}
