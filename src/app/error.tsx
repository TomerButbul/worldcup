"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="text-5xl">🟥</div>
      <div>
        <h1 className="font-display text-3xl text-chalk">Red card!</h1>
        <p className="mt-1 max-w-sm text-sm text-chalk-dim">
          Something went wrong. Give it another go.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-xl bg-grass px-5 py-2.5 text-sm font-semibold text-night glow-grass transition hover:brightness-110"
      >
        Try again
      </button>
    </main>
  );
}
