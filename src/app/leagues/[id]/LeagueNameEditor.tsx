"use client";

import { useState, useTransition } from "react";
import { renameLeague } from "./actions";
import { PencilIcon } from "@/components/icons";
import { playPop } from "@/lib/sound";

export default function LeagueNameEditor({
  leagueId,
  initialName,
  isOwner,
}: {
  leagueId: string;
  initialName: string;
  isOwner: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialName);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    const next = draft.trim();
    if (next.length < 2 || next.length > 50) {
      setError("2–50 characters");
      return;
    }
    if (next === name) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await renameLeague(leagueId, next);
      if (res.ok) {
        setName(res.name ?? next);
        setEditing(false);
        playPop();
      } else {
        setError(res.error ?? "Something went wrong");
      }
    });
  }

  if (!editing) {
    return (
      <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl break-words text-gradient-gold sm:text-4xl">
        {name}
        {isOwner && (
          <button
            onClick={() => {
              setDraft(name);
              setError(null);
              setEditing(true);
            }}
            className="rounded-lg border border-night/10 px-2 py-1 text-xs font-medium text-chalk-dim transition hover:bg-night/5 hover:text-chalk"
            title="Rename league"
            aria-label="Rename league"
          >
            <span className="inline-flex items-center gap-1"><PencilIcon size={12} /> Rename</span>
          </button>
        )}
      </h1>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          maxLength={50}
          aria-label="League name"
          className="min-w-0 flex-1 rounded-xl border border-night/10 bg-white px-3 py-2 font-display text-2xl text-chalk outline-none focus:border-grass focus:ring-2 focus:ring-grass/30 sm:text-3xl"
        />
        <button
          onClick={save}
          disabled={pending}
          className="min-h-11 rounded-xl bg-grass px-4 py-2.5 text-sm font-semibold text-night glow-grass transition hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={pending}
          className="min-h-11 rounded-xl border border-night/10 px-4 py-2.5 text-sm font-medium text-chalk-dim transition hover:bg-night/5 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
