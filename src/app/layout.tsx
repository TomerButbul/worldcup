import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Anton } from "next/font/google";
import "./globals.css";
import AnimatedBackground from "@/components/AnimatedBackground";
import FlagGarland from "@/components/FlagGarland";
import { PlayerCardHost } from "@/components/PlayerCard";
import { TeamCardHost } from "@/components/TeamCard";
import { GlobalNav } from "@/components/BottomNav";
import LiveScoresWidget from "@/components/LiveScoresWidget";
import { getCachedMatchdayFlags } from "@/lib/tournamentData";
import { createClient } from "@/lib/supabase/server";

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
    default: "World Cup — 2026 Bracket & Prediction Game",
    template: "%s · World Cup",
  },
  description: "Predict the 2026 World Cup bracket and match results. Compete with friends.",
  applicationName: "World Cup",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    // iOS ignores SVG apple-touch-icons — must be a PNG, or it falls back to a cached/old icon.
    apple: "/apple-icon.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "World Cup" },
  openGraph: {
    title: "World Cup 2026 — Bracket & Prediction Game",
    description: "Predict the bracket, call every match, and battle your friends across three leaderboards.",
    type: "website",
  },
  twitter: { card: "summary", title: "World Cup 2026", description: "Predict the World Cup. Compete with friends." },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e1545",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const [matchdayFlags, { data: { user } }] = await Promise.all([
    getCachedMatchdayFlags(),
    supabase.auth.getUser(),
  ]);
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col overflow-x-hidden">
        <AnimatedBackground />
        {/* Festive bunting on mobile/tablet; desktop gets the clean top nav instead. */}
        <div className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-30 lg:hidden">
          <FlagGarland flags={matchdayFlags} />
        </div>
        <div
          className={`relative z-10 flex min-h-screen flex-col pt-[calc(env(safe-area-inset-top)+2.25rem)] ${
            user
              ? "pb-[calc(env(safe-area-inset-bottom)+3.75rem)] lg:pb-10 lg:pt-[calc(env(safe-area-inset-top)+4.5rem)]"
              : ""
          }`}
        >
          {children}
        </div>
        {/* GlobalNav self-hides on auth/landing/league routes; LeagueNav (in the
            league layout) takes over inside a league. */}
        {user && <GlobalNav />}
        {user && <LiveScoresWidget />}
        <PlayerCardHost />
        <TeamCardHost />
      </body>
    </html>
  );
}
