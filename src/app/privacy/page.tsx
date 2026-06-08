import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Privacy & data",
  description: "What data the World Cup 2026 prediction game collects, why, and how to delete it.",
};

// Plain-language privacy policy. Kept honest and minimal: we store only what an
// account needs, never sell it, run no ads and no third-party tracking. If the data
// practices change (e.g. analytics or ads are added later), this page must change too.
const UPDATED = "June 2026";
const CONTACT = "tomerbutbuleast@gmail.com"; // swap for a dedicated support address if you prefer

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg text-chalk">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-chalk-dim">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-gradient-gold">Privacy &amp; data</h1>
        <p className="text-sm text-chalk-dim">Last updated: {UPDATED}</p>
      </header>

      <p className="rounded-2xl bg-grass/10 p-4 text-sm leading-relaxed text-chalk">
        The short version: this is a free, ad-free game. We store only what your account needs to work,
        we <span className="font-semibold">never sell or rent</span> your data, we run{" "}
        <span className="font-semibold">no ads and no third-party tracking</span>, and you can delete
        everything yourself at any time.
      </p>

      <div className="space-y-6">
        <Section title="What we collect, and why">
          <p>To run your account and the game, we store:</p>
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <span className="font-semibold text-chalk">Sign-in details.</span> If you sign in with
              Google, we receive your name, email and profile picture. If you use email &amp; password,
              we store your email. You can also play as a guest, which creates an anonymous account with
              no email at all.
            </li>
            <li>
              <span className="font-semibold text-chalk">Your profile.</span> A display/manager name and
              a favourite team, if you set them.
            </li>
            <li>
              <span className="font-semibold text-chalk">Your game data.</span> Your bracket, match and
              goal-scorer predictions, award picks, the points they earn, and the leagues you join or
              create.
            </li>
            <li>
              <span className="font-semibold text-chalk">Notifications (optional).</span> If you turn on
              push notifications, we store a push token for your device so we can send them. Turn it off
              and it&apos;s removed.
            </li>
            <li>
              <span className="font-semibold text-chalk">A session cookie.</span> One necessary cookie to
              keep you signed in. No tracking or advertising cookies.
            </li>
          </ul>
        </Section>

        <Section title="What we don't do">
          <ul className="ml-4 list-disc space-y-1.5">
            <li>No ads and no advertising networks.</li>
            <li>No third-party analytics, tracking pixels or fingerprinting.</li>
            <li>We never sell, rent or trade your personal data.</li>
          </ul>
        </Section>

        <Section title="Who we share it with">
          <p>
            Only the infrastructure needed to run the app, acting on our behalf:{" "}
            <span className="font-semibold text-chalk">Vercel</span> (hosting),{" "}
            <span className="font-semibold text-chalk">Supabase</span> (database &amp; sign-in), and{" "}
            <span className="font-semibold text-chalk">Google</span> (only if you choose Google sign-in).
            Live match and player data comes from a sports-data provider, which receives{" "}
            <span className="font-semibold">no personal information</span> from us. If you ever choose to
            donate, payment is handled by a third-party processor — we never see or store your card
            details.
          </p>
        </Section>

        <Section title="Emails">
          <p>
            We may occasionally email you about the app, or to ask for a voluntary donation. Every email
            includes an unsubscribe link, and we don&apos;t share your email with anyone.
          </p>
        </Section>

        <Section title="Cost, ads &amp; donations">
          <p>
            The app is free and ad-free. You may see occasional prompts inviting a voluntary donation —
            entirely optional, and nothing is paywalled.
          </p>
        </Section>

        <Section title="Your controls">
          <ul className="ml-4 list-disc space-y-1.5">
            <li>Edit or clear your profile any time from your profile page.</li>
            <li>
              <span className="font-semibold text-chalk">Delete everything:</span> go to{" "}
              <Link href="/profile" className="text-gold underline underline-offset-2 hover:text-gold-bright">
                your profile
              </Link>{" "}
              → <span className="font-semibold text-chalk">Delete account</span>. This permanently removes
              your account and all associated data (predictions, scores, leagues you created, notification
              settings). It&apos;s immediate and can&apos;t be undone.
            </li>
          </ul>
        </Section>

        <Section title="Children">
          <p>
            This game isn&apos;t directed at children under 13 (or under 16 where local law requires).
            Please don&apos;t sign up if you&apos;re younger than that.
          </p>
        </Section>

        <Section title="Where your data lives">
          <p>
            Your data is stored on our providers&apos; servers, which may be located outside your country.
            We keep it only while you have an account; deleting your account removes it.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If we change how we handle data, we&apos;ll update this page (and the date at the top), and
            note anything significant in the app.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or requests? Email{" "}
            <a href={`mailto:${CONTACT}`} className="text-gold underline underline-offset-2 hover:text-gold-bright">
              {CONTACT}
            </a>
            .
          </p>
        </Section>
      </div>

      <p className="border-t border-night/10 pt-4 text-xs text-chalk-dim">
        This is an independent fan project and is not affiliated with, endorsed by, or associated with
        FIFA or any football federation, league or club.
      </p>

      <div className="pt-2">
        <Link href="/profile" className="text-sm font-semibold text-gold hover:text-gold-bright">
          ← Back to profile
        </Link>
      </div>
    </main>
  );
}
