// Shown on navigation to any dynamic page (most of the app reads your data fresh).
// A shell-shaped skeleton — not a centered spinner — so a tab switch reads as "your
// page is filling in" rather than a blocking "loading screen", and still gives
// instant tap feedback. Mirrors the league skeleton for a consistent feel.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4 sm:space-y-6 sm:p-6 lg:max-w-5xl lg:p-8">
      {/* Header card placeholder */}
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <div className="skeleton h-8 w-44 sm:h-9" />
        <div className="skeleton mt-2.5 h-3 w-60" />
      </div>
      {/* Content list placeholder */}
      <div className="glass-strong space-y-2.5 rounded-2xl p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-7 w-7 shrink-0 rounded-full" />
            <div className="skeleton h-4 flex-1" />
            <div className="skeleton h-4 w-10 shrink-0" />
          </div>
        ))}
      </div>
    </main>
  );
}
