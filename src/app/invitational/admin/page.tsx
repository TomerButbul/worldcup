import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAdminProvenance } from "@/lib/invitational";
import { INVITATIONAL_NAME } from "@/lib/contest";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";
// No title on purpose: a non-admin hitting this route triggers notFound(), but page
// metadata still resolves first — so a descriptive "Admin · …" <title> would leak the
// route's purpose to anyone who probes the URL. Falling back to the site-default title
// keeps a non-admin response indistinguishable from any nonexistent page. noindex too.
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function InvitationalAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Default-safe gate: anyone who isn't an admin (incl. logged-out) gets a 404 —
  // the page simply doesn't exist for them.
  if (!user || !isAdminEmail(user.email)) notFound();

  const rows = await getAdminProvenance();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl text-chalk">
          {INVITATIONAL_NAME} — vetting
        </h1>
        <p className="text-sm text-chalk-dim">
          Eligible players ranked by score. Before paying out, confirm the leader
          qualified legitimately (real referral, not a fake/duplicate account). The winner&rsquo;s
          payout email is in your Supabase Auth dashboard.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-center text-sm text-chalk-dim">
          No eligible entrants yet.
        </p>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-chalk-dim">
              <tr className="border-b border-night/10">
                <th className="px-3 py-2.5 font-semibold">#</th>
                <th className="px-3 py-2.5 font-semibold">Player</th>
                <th className="px-3 py-2.5 text-right font-semibold">Score</th>
                <th className="px-3 py-2.5 font-semibold">Qualified by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b border-night/5 last:border-0">
                  <td className="px-3 py-2.5 font-semibold text-chalk-dim">{r.rank}</td>
                  <td className="px-3 py-2.5 text-chalk">
                    <span className="font-medium">{r.name}</span>
                    <span className="ml-2 font-mono text-[11px] text-chalk-dim/70">
                      {r.user_id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-display text-chalk">{r.total}</td>
                  <td className="px-3 py-2.5 text-chalk-dim">
                    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                      {r.referredByName && (
                        <span>
                          invited by <span className="text-chalk">{r.referredByName}</span>
                        </span>
                      )}
                      {r.referralCount > 0 && (
                        <span>
                          referred <span className="text-chalk">{r.referralCount}</span>
                        </span>
                      )}
                      {!r.referredByName && r.referralCount === 0 && <span>—</span>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="px-1 text-xs text-chalk-dim">
        Showing the top {rows.length}. A referral to a guest/anonymous account does not count toward
        a player&rsquo;s referral total — only real sign-ups do.
      </p>

      <Link href="/invitational" className="text-sm font-semibold text-gold hover:text-gold-bright">
        ← Back to {INVITATIONAL_NAME}
      </Link>
    </main>
  );
}
