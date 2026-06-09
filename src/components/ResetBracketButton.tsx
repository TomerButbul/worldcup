"use client";

import { useState, useTransition } from "react";
import { resetBracket } from "@/app/leagues/[id]/bracket/actions";

// The "second chance" control. Re-opens the knockout bracket (editable until the
// Round of 32) in exchange for permanently forfeiting the group-stage points. Two
// deliberate steps + a typed confirm so nobody nukes their points by accident.
export default function ResetBracketButton({ leagueId }: { leagueId: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const armed = typed.trim().toUpperCase() === "RESET";

  function doReset() {
    if (!armed) return;
    setError(null);
    start(async () => {
      const r = await resetBracket(leagueId);
      if (!r.ok) setError(r.error ?? "Couldn't reset — try again.");
      // On success the page revalidates and re-renders in second-chance mode.
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-gold/50 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/20"
      >
        🔄 Take the second chance — re-pick my knockout
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-4">
      <p className="font-semibold text-chalk">Reset your knockout bracket?</p>
      <ul className="mt-2 space-y-1 text-sm text-chalk-dim">
        <li>
          • You&rsquo;ll <span className="font-semibold text-chalk">permanently forfeit your
          group-stage points</span> — this can&rsquo;t be undone.
        </li>
        <li>
          • Your knockout re-opens to edit until the <span className="font-semibold text-chalk">Round
          of 32</span>, scoring in full.
        </li>
        <li>
          • Your original bracket is kept — you can still look back on it, group stages and all.
        </li>
      </ul>
      <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-chalk-dim">
        Type <span className="text-red-500">RESET</span> to confirm
      </label>
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="mt-1 w-full max-w-[180px] rounded-lg border border-night/15 bg-white px-3 py-2 text-sm font-mono uppercase tracking-widest text-chalk outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!armed || pending}
          onClick={doReset}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-40"
        >
          {pending ? "Resetting…" : "Yes, forfeit my group points"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(null);
          }}
          className="rounded-xl glass px-4 py-2 text-sm font-semibold text-chalk transition hover:bg-night/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
