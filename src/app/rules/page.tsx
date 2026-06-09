import Link from "next/link";
import type { ReactNode } from "react";
import {
  INVITATIONAL_NAME,
  PRIZE_LABEL,
  SPONSOR_NAME,
  CONTACT_EMAIL,
  CONTEST_LOCK_LABEL,
  CONTEST_END_LABEL,
  MIN_AGE,
} from "@/lib/contest";

export const metadata = {
  title: `Official Rules — ${INVITATIONAL_NAME}`,
  description: `Official rules for ${INVITATIONAL_NAME}: a free, skill-based World Cup bracket contest with ${PRIZE_LABEL}. No purchase necessary.`,
};

const UPDATED = "June 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg text-chalk">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-chalk-dim">{children}</div>
    </section>
  );
}

export default function RulesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-gradient-gold">Official Rules</h1>
        <p className="text-sm text-chalk-dim">
          {INVITATIONAL_NAME} · Last updated: {UPDATED}
        </p>
      </header>

      <p className="rounded-2xl bg-grass/10 p-4 text-sm leading-relaxed text-chalk">
        The short version: it&rsquo;s <span className="font-semibold">free</span> to enter,{" "}
        <span className="font-semibold">no purchase necessary</span>, and it&rsquo;s a game of{" "}
        <span className="font-semibold">skill</span> — whoever builds the highest-scoring World Cup
        bracket wins {PRIZE_LABEL}. No gambling, no entry fee, no catch.
      </p>

      <div className="space-y-6">
        <Section title="1. No purchase necessary">
          <p>
            No purchase, payment or entry fee is required to enter or win. Entry is completely free.
          </p>
        </Section>

        <Section title="2. Sponsor">
          <p>
            This contest is run and funded personally by the operator of {SPONSOR_NAME} (&ldquo;the
            Sponsor&rdquo;). It is an independent project — see section 11. Contact:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-gold underline underline-offset-2 hover:text-gold-bright"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="3. Eligibility">
          <p>
            Open to registered {SPONSOR_NAME} players who are at least {MIN_AGE} years old at the time
            of entry. Void where prohibited or restricted by law. Guest (anonymous) accounts cannot
            win the cash prize — create a full account to be eligible. The Sponsor and members of
            their immediate household are not eligible to win.
          </p>
        </Section>

        <Section title="4. Contest period">
          <p>
            Enter and finalize your bracket any time before {CONTEST_LOCK_LABEL}, when all brackets
            lock. The contest ends when {CONTEST_END_LABEL} is decided and final scores are settled.
          </p>
        </Section>

        <Section title="5. How to enter (two free ways)">
          <p>You become eligible to compete in either of these free ways:</p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <span className="font-semibold text-chalk">Invite or be invited.</span> Share your
              personal invite link and have at least one friend create a new account through it — or
              join through a friend&rsquo;s link yourself. Either side of a referral qualifies. This
              is free.
            </li>
            <li>
              <span className="font-semibold text-chalk">Alternative free entry (no referral).</span>{" "}
              Don&rsquo;t want to invite anyone? Email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Invitational%20entry`}
                className="text-gold underline underline-offset-2 hover:text-gold-bright"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              from your account email with the subject &ldquo;Invitational entry&rdquo; and we&rsquo;ll
              add you to the contest at no cost. There is no advantage to referring versus this method
              — both simply get you in.
            </li>
          </ul>
          <p>
            You must also build a bracket (your tournament predictions) before the lock in section 4.
          </p>
        </Section>

        <Section title="6. How the winner is chosen — skill, not chance">
          <p>
            The winner is the eligible player with the single highest total bracket score when the
            tournament ends, using the same scoring shown on the worldwide leaderboard (points for
            correctly predicting group results, knockout advancement, the champion, match scores and
            goal scorers). Outcomes are determined entirely by participants&rsquo; knowledge and
            judgment of football — not by chance.
          </p>
          <p>
            <span className="font-semibold text-chalk">Tiebreaker:</span> if two or more players tie
            on total points, the prize goes to the one who finalized their bracket earliest
            (earliest submission timestamp).
          </p>
        </Section>

        <Section title="7. Prize">
          <p>
            One (1) cash prize, awarded to the single highest-scoring eligible player. The exact
            amount will be confirmed and posted on this page before brackets lock (see section 4).
            It is paid by the Sponsor via a common electronic method (e.g. PayPal, Venmo or Zelle)
            within 30 days of the winner confirming their details. One prize total; one winner. The
            prize is non-transferable and cannot be exchanged for anything else.
          </p>
        </Section>

        <Section title="8. Winner notification">
          <p>
            The winner will be contacted at their account email after the tournament concludes. If a
            winner cannot be reached, declines, is found ineligible, or does not respond within 14
            days, the prize passes to the next highest-scoring eligible player.
          </p>
        </Section>

        <Section title="9. Taxes">
          <p>
            The winner is solely responsible for any taxes on the prize. Given the prize amount,
            reporting is typically not required, but confirm what applies where you live.
          </p>
        </Section>

        <Section title="10. Fair play">
          <p>
            One account per person. Fake, duplicate, automated or fraudulently-created accounts —
            including referrals to accounts that aren&rsquo;t real new players — are not allowed and
            will be disqualified. The Sponsor may verify how an entrant qualified and may disqualify
            anyone who manipulates the contest or violates these rules.
          </p>
        </Section>

        <Section title="11. Not affiliated with FIFA, EA or any football body">
          <p>
            This is an independent fan project. It is not affiliated with, endorsed by, sponsored by,
            or associated with FIFA, EA Sports, any World Cup organizer, or any football federation,
            league or club. All team and competition names belong to their respective owners.
          </p>
        </Section>

        <Section title="12. Privacy">
          <p>
            Entering uses only your existing account information. See our{" "}
            <Link
              href="/privacy"
              className="text-gold underline underline-offset-2 hover:text-gold-bright"
            >
              Privacy &amp; data
            </Link>{" "}
            page for what we store and how to delete it. We won&rsquo;t publish more than your
            display/manager name on the leaderboard.
          </p>
        </Section>

        <Section title="13. Changes">
          <p>
            If anything material changes, we&rsquo;ll update this page and the date above. If the
            contest must be cancelled for reasons outside the Sponsor&rsquo;s control, the Sponsor may
            award the prize to the highest-scoring eligible player at that time.
          </p>
        </Section>

        <Section title="14. Contact">
          <p>
            Questions about these rules? Email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-gold underline underline-offset-2 hover:text-gold-bright"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </div>

      <div className="flex flex-wrap gap-4 border-t border-night/10 pt-4">
        <Link href="/rankings" className="text-sm font-semibold text-gold hover:text-gold-bright">
          ← Back to leagues
        </Link>
      </div>
    </main>
  );
}
