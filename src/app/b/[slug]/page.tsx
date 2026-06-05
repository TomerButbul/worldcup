import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSharedBracket } from "@/lib/shareBracket";
import KnockoutBracket from "@/components/KnockoutBracket";
import Podium from "@/components/Podium";
import Trophy from "@/components/art/Trophy";
import Flag from "@/components/Flag";

// Public, read-only view of a manager's predicted bracket — the "beat my bracket"
// share. No auth (service-client read), link-only + noindex. Renders the exact tree
// the editor shows (treeOnly), the podium, and a sign-up CTA so every share funnels
// new players in. Per the owner's choice this exposes their full picks.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSharedBracket(slug);
  if (!data) return { title: "Bracket", robots: { index: false } };

  const champ = data.view.champion != null ? data.teamsById[data.view.champion]?.name : null;
  const title = `${data.name}'s World Cup 2026 bracket`;
  const description = champ
    ? `${data.name} predicts ${champ} to win the 2026 World Cup. See the full bracket — then build your own and beat it. Free to play.`
    : `${data.name}'s 2026 World Cup bracket. Build your own, call every match, and compete with friends. Free to play.`;
  return {
    title,
    description,
    openGraph: { title: `${title} · World Cup 2026`, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: false }, // share pages are for direct sharing, not search
  };
}

export default async function SharedBracketPage({ params }: Params) {
  const { slug } = await params;
  const data = await getSharedBracket(slug);
  if (!data) notFound();

  const { name, view, teamsById, fifaRank, favoriteTeamId, hasPicks } = data;
  const championTeam = view.champion != null ? (teamsById[view.champion] ?? null) : null;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 sm:p-6 lg:max-w-[1600px] lg:p-8">
      <div className="glass-strong rounded-3xl p-5 text-center sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-chalk-dim">
          World Cup 2026 · Predicted bracket
        </p>
        <h1 className="mt-1 font-display text-3xl text-gradient-gold sm:text-4xl">
          {name}&rsquo;s bracket
        </h1>
        {championTeam ? (
          <div className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-gold/10 px-4 py-2">
            <Trophy size={20} />
            <span className="text-sm text-chalk-dim">Picks to win:</span>
            <Flag
              teamId={championTeam.id}
              logoUrl={championTeam.logo_url}
              code={championTeam.code}
              name={championTeam.name}
              size={20}
            />
            <span className="font-display text-base text-chalk">{championTeam.name}</span>
          </div>
        ) : (
          <p className="mt-2 text-sm text-chalk-dim">This bracket isn&rsquo;t finished yet.</p>
        )}
      </div>

      {hasPicks ? (
        <>
          <KnockoutBracket
            rounds={view.rounds}
            teamsById={teamsById}
            championNo={104}
            treeOnly
            fifaRank={fifaRank}
            highlightIds={favoriteTeamId != null ? [favoriteTeamId] : undefined}
          />
          <Podium
            champion={view.champion != null ? (teamsById[view.champion] ?? null) : null}
            runnerUp={view.runnerUp != null ? (teamsById[view.runnerUp] ?? null) : null}
            third={view.third != null ? (teamsById[view.third] ?? null) : null}
          />
        </>
      ) : (
        <p className="glass rounded-2xl p-8 text-center text-sm text-chalk-dim">
          {name} hasn&rsquo;t filled in their bracket yet.
        </p>
      )}

      <div className="glass-strong rounded-3xl p-6 text-center">
        <h2 className="font-display text-2xl text-chalk">Think you can do better?</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-chalk-dim">
          Build your own 2026 World Cup bracket free — call every match and goal scorer, then climb
          live leaderboards with friends.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-2xl px-6 text-base font-bold text-night bg-gradient-to-b from-gold-bright to-gold glow-gold shine transition hover:brightness-105"
        >
          Build your own bracket — free →
        </Link>
      </div>
    </main>
  );
}
