import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Anton } from "next/font/google";
import "./globals.css";
import AnimatedBackground from "@/components/AnimatedBackground";
import FlagGarland from "@/components/FlagGarland";
import { PlayerCardHost } from "@/components/PlayerCard";
import { TeamCardHost } from "@/components/TeamCard";
import { VenueCardHost } from "@/components/VenueCard";
import { GlobalNav } from "@/components/BottomNav";
import GuestBanner from "@/components/GuestBanner";
import LiveScoresWidget from "@/components/LiveScoresWidget";
import SwipeNav from "@/components/SwipeNav";
import PageTransition from "@/components/PageTransition";
import { MyTeamsProvider } from "@/components/MyTeams";
import { getCachedMatchdayFlags } from "@/lib/tournamentData";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL, SITE_DESCRIPTION } from "@/lib/site";

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
  // Resolves OG/Twitter image + canonical URLs to absolute — required for social
  // cards and clean canonicals. Change SITE_URL (lib/site) to move domains.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "World Cup 2026 Predictions — Bracket & Pick'em Game",
    template: "%s · World Cup",
  },
  description: SITE_DESCRIPTION,
  applicationName: "World Cup",
  keywords: [
    "World Cup 2026",
    "World Cup predictions",
    "World Cup bracket",
    "World Cup prediction game",
    "World Cup pick em",
    "World Cup bracket challenge",
    "World Cup pool",
    "predict the World Cup",
    "soccer predictions",
    "football predictions",
  ],
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
    description: SITE_DESCRIPTION,
    type: "website",
    siteName: "World Cup",
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "World Cup 2026 — Bracket & Prediction Game",
    description: "Predict the 2026 World Cup — bracket, scores & goal scorers. Compete with friends.",
  },
  // Google Search Console site-ownership verification (HTML-tag method).
  verification: { google: "g5p78MpK9-udokFnX994iNw9fLp3F7SCbYsDpuboMz8" },
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
        <MyTeamsProvider>
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
          {user?.is_anonymous && (
            <div className="px-4 pt-1 sm:px-6 lg:px-8">
              <GuestBanner />
            </div>
          )}
          <PageTransition>{children}</PageTransition>
        </div>
        {/* GlobalNav self-hides on auth/landing/league routes; the league layout
            re-renders it with `force` so in-league pages still get the global nav. */}
        {user && <GlobalNav />}
        {user && <SwipeNav />}
        {user && <LiveScoresWidget />}
        <PlayerCardHost />
        <TeamCardHost />
        <VenueCardHost />
        </MyTeamsProvider>
      </body>
    </html>
  );
}
