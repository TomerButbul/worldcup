"use client";

import { useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

// Debounced autosave. Pass a `signature` string that changes whenever the data
// to persist changes; `save` then runs `delay`ms after it settles (the initial
// mount is skipped, so loading a saved prediction never re-saves it). Set
// `enabled: false` to pause (e.g. once a match or the bracket locks).
export function useAutosave(
  signature: string,
  save: () => Promise<{ ok: boolean; error?: string }>,
  { delay = 800, enabled = true }: { delay?: number; enabled?: boolean } = {},
): { state: SaveState; error: string | null } {
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const saveRef = useRef(save);
  const first = useRef(true);

  // Keep the latest save closure current without retriggering the debounce below.
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    if (!enabled) return;
    if (first.current) {
      first.current = false;
      return;
    }
    setState("saving");
    const t = setTimeout(async () => {
      const res = await saveRef.current();
      if (res.ok) {
        setState("saved");
        setError(null);
      } else {
        setState("error");
        setError(res.error ?? "Save failed");
      }
    }, delay);
    return () => clearTimeout(t);
  }, [signature, enabled, delay]);

  return { state, error };
}
