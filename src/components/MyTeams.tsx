"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// The viewer's drafted team ids, shared app-wide so <Flag> can subtly ring
// "your teams" wherever a crest appears. Loaded once after mount (one cheap
// fetch); empty until then and for non-draft users — so nothing flashes and the
// highlight only ever shows for people who are actually in a draft.
const MyTeamsCtx = createContext<Set<number>>(new Set());

export function useMyTeams(): Set<number> {
  return useContext(MyTeamsCtx);
}

export function MyTeamsProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    let alive = true;
    fetch("/api/my-teams")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && Array.isArray(d?.teamIds) && d.teamIds.length) setIds(new Set<number>(d.teamIds));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return <MyTeamsCtx.Provider value={ids}>{children}</MyTeamsCtx.Provider>;
}
