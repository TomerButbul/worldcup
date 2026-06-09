import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getReferrerPreview } from "@/lib/referral";
import { acceptReferral } from "./actions";
import { INVITATIONAL_NAME, PRIZE_LABEL } from "@/lib/contest";
import Trophy from "@/components/art/Trophy";
import LocalTime from "@/components/LocalTime";

// The referral landing page. Replaces the old redirect-only route handler so a shared
// /r/<slug> link gets a real HTML page with Open Graph tags (see generateMetadata +
// the colocated opengraph-image) — a rich invite card in iMessage/WhatsApp/X instead
// of a bare redirect. The cookie write happens in the acceptReferral Server Action.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

// The Invitational bracket lock = the World Cup opener (Jun 11, 19:00 UTC); see
// clock.ts KICKOFF_MS + leagues.bracket_lock_at.
const LOCK_ISO = "2026-06-11T19:00:00Z";

function lockRel(): string | null {
  const days = Math.ceil((Date.parse(LOCK_ISO) - Date.now()) / 86_400_000);
  return days > 1 ? `in ${days} days` : days === 1 ? "tomorrow" : days === 0 ? "today" : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const ref = await getReferrerPreview(slug);
  const who = ref ? `${ref.name} invited you to the ${INVITATIONAL_NAME}` : `You're invited to the ${INVITATIONAL_NAME}`;
  const description = `Sign up with this link and you're both in the running — best World Cup bracket wins ${PRIZE_LABEL}. Free to enter, no purchase necessary.`;
  return {
    title: who,
    description,
    // Image comes from the colocated opengraph-image.tsx (file-based metadata wins).
    openGraph: { title: `${who} · World Cup 2026`, description, type: "website" },
    twitter: { card: "summary_large_image", title: `${who} · World Cup 2026`, description },
    robots: { index: false }, // referral links are for direct sharing, not search
  };
}

export default async function ReferralPage({ params }: Params) {
  const { slug } = await params;
  const ref = await getReferrerPreview(slug);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rel = lockRel();
  const eyebrow = ref ? `${ref.name} invited you to` : "You're invited to";
  const ctaLabel = user ? "Open the Invitational →" : "Join free — you're both in →";

  return (
    <main className="relative mx-auto flex min-h-[88vh] w-full max-w-md flex-1 flex-col items-center justify-center p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-10 h-56 w-56 -translate-x-1/2 rounded-full bg-gold/20 blur-3xl"
      />

      <div className="glass-strong relative w-full overflow-hidden rounded-[28px] p-7 text-center sm:p-8">
        <div className="mb-6 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-gold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#ffd970] to-[#f6c453] text-base">
            🏆
          </span>
          The 2026 Prediction Game
        </div>

        <div className="flex justify-center">
          <Trophy size={52} />
        </div>

        <p className="mt-4 text-sm font-medium text-chalk-dim">{eyebrow}</p>
        <h1 className="mt-1 font-display text-[30px] leading-tight text-gradient-gold sm:text-4xl">
          {INVITATIONAL_NAME}
        </h1>

        <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-chalk">
          Sign up with {ref ? `${ref.name}'s` : "this"} link and you&rsquo;re{" "}
          <span className="font-semibold">both</span> in the running — the best World Cup bracket
          wins {PRIZE_LABEL}.
        </p>

        {/* lock urgency */}
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-night/[0.06] px-3 py-1.5 text-xs font-semibold text-chalk-dim">
          <span>
            🔒 Brackets lock <LocalTime iso={LOCK_ISO} mode="date" />
            {rel ? ` · ${rel}` : ""}
          </span>
        </div>

        {/* CTA */}
        <div className="mt-6">
          <form action={acceptReferral}>
            <input type="hidden" name="slug" value={slug} />
            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center rounded-2xl px-5 text-base font-bold text-night bg-gradient-to-b from-gold-bright to-gold glow-gold shine transition hover:brightness-105"
            >
              {ctaLabel}
            </button>
          </form>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-chalk-dim">
          Free to enter, no purchase necessary. Predict the bracket, every match &amp; goal scorer.{" "}
          <Link href="/rules" className="font-semibold text-gold hover:underline">
            Official rules
          </Link>
        </p>
      </div>

      <Link
        href="/"
        className="relative mt-5 text-xs text-chalk-dim underline decoration-dotted underline-offset-2 hover:text-chalk"
      >
        What is this?
      </Link>
    </main>
  );
}
