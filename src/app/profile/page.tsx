import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { getCachedTeams } from "@/lib/tournamentData";
import Reveal from "@/components/Reveal";
import Avatar from "@/components/Avatar";
import Flag from "@/components/Flag";
import ProfileEditor from "@/components/ProfileEditor";
import FavoriteTeamPicker from "@/components/FavoriteTeamPicker";
import NotificationToggle from "@/components/NotificationToggle";
import ShareBracket from "@/components/ShareBracket";
import SupportCard from "@/components/SupportCard";
import DeleteAccount from "@/components/DeleteAccount";
import type { Team } from "@/lib/types";

export const metadata = { title: "Profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, team_name, avatar_url, favorite_team_id, notif_prefs, share_slug")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name ?? "player";
  const teams = (await getCachedTeams()) as Team[];
  const favId = profile?.favorite_team_id ?? null;
  const favTeam = teams.find((t) => t.id === favId) ?? null;
  const notifPrefs =
    (profile as { notif_prefs?: Record<string, boolean> } | null)?.notif_prefs ?? {};
  const shareSlug = profile?.share_slug ?? null;

  return (
    <main className="mx-auto w-full max-w-2xl lg:max-w-[1600px] flex-1 space-y-4 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      {error && (
        <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-600">{error}</p>
      )}
      {/* Header card — who you are at a glance */}
      <Reveal>
        <header className="glass-strong rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <Avatar
              url={profile?.avatar_url}
              name={profile?.team_name || displayName}
              size={52}
            />
            <div className="min-w-0">
              <h1 className="flex min-w-0 items-center gap-2 font-display text-2xl text-gradient-gold">
                {favTeam && (
                  <Flag
                    teamId={favTeam.id}
                    logoUrl={favTeam.logo_url}
                    code={favTeam.code}
                    name={favTeam.name}
                    size={28}
                  />
                )}
                <span className="truncate">Your profile</span>
              </h1>
              <p className="truncate text-sm text-chalk-dim">
                {profile?.team_name
                  ? `${profile.team_name} · managed by ${displayName}`
                  : `Account & settings for ${displayName}`}
              </p>
            </div>
          </div>
        </header>
      </Reveal>

      {/* Desktop: primary settings left, lighter extras in a right rail */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:items-start">
        {/* Primary column — the things you change */}
        <div className="space-y-4 sm:space-y-6">
          <Reveal>
            <section className="space-y-2">
              <h2 className="px-1 font-display text-lg text-chalk">Profile</h2>
              <ProfileEditor
                userId={user.id}
                displayName={displayName}
                teamName={profile?.team_name ?? null}
                avatarUrl={profile?.avatar_url ?? null}
              />
            </section>
          </Reveal>

          <Reveal index={1}>
            <section className="space-y-2">
              <h2 className="px-1 font-display text-lg text-chalk">Favourite team</h2>
              <FavoriteTeamPicker teams={teams} current={favId} />
              <p className="px-1 text-xs text-chalk-dim">
                Shows your crest across the app and powers your team&apos;s live updates.
              </p>
            </section>
          </Reveal>

          <Reveal index={2}>
            <section className="space-y-3">
              <h2 className="px-1 font-display text-lg text-chalk">Notifications</h2>
              <NotificationToggle placement="top" />
              <NotificationToggle placement="bottom" initialPrefs={notifPrefs} />
            </section>
          </Reveal>
        </div>

        {/* Aside — share, helpful links, sign out */}
        <div className="mt-4 space-y-4 lg:mt-0">
          {shareSlug && (
            <Reveal>
              <section className="glass rounded-2xl p-4">
                <h2 className="font-display text-chalk">Share</h2>
                <p className="mb-3 mt-1 text-xs text-chalk-dim">
                  Built your bracket? Share a public link — no account needed.
                </p>
                <ShareBracket slug={shareSlug} />
              </section>
            </Reveal>
          )}

          <Reveal index={1}>
            <section className="glass rounded-2xl p-2">
              <h2 className="px-2 pb-1 pt-2 font-display text-chalk">More</h2>
              <Link
                href="/how-it-works"
                className="group flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-night/5"
              >
                <span className="flex items-center gap-3">
                  <span aria-hidden className="text-xl">ℹ️</span>
                  <span className="text-sm font-semibold text-chalk">How it works &amp; scoring</span>
                </span>
                <span className="text-gold transition group-hover:translate-x-0.5">&rarr;</span>
              </Link>
              <Link
                href="/install"
                className="group flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-night/5"
              >
                <span className="flex items-center gap-3">
                  <span aria-hidden className="text-xl">📲</span>
                  <span className="text-sm font-semibold text-chalk">Install the app</span>
                </span>
                <span className="text-gold transition group-hover:translate-x-0.5">&rarr;</span>
              </Link>
              <Link
                href="/privacy"
                className="group flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-night/5"
              >
                <span className="flex items-center gap-3">
                  <span aria-hidden className="text-xl">🔒</span>
                  <span className="text-sm font-semibold text-chalk">Privacy &amp; data</span>
                </span>
                <span className="text-gold transition group-hover:translate-x-0.5">&rarr;</span>
              </Link>
            </section>
          </Reveal>

          <Reveal index={2}>
            <SupportCard />
          </Reveal>

          <Reveal index={3}>
            <form action={logout}>
              <button
                type="submit"
                className="w-full rounded-2xl glass px-4 py-3 text-sm font-semibold text-chalk-dim transition hover:bg-red-500/10 hover:text-red-600"
              >
                Log out
              </button>
            </form>
          </Reveal>

          <Reveal index={4}>
            <div className="flex justify-center pt-1">
              <DeleteAccount />
            </div>
          </Reveal>
        </div>
      </div>
    </main>
  );
}
