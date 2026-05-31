export default function LeagueLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6">
      <div className="glass-strong rounded-3xl p-5 sm:p-6">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton mt-3 h-8 w-48" />
        <div className="skeleton mt-2 h-3 w-64" />
      </div>
      <div>
        <div className="skeleton mb-3 h-5 w-32" />
        <div className="glass-strong space-y-2 rounded-2xl p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton h-6 w-6 rounded-full" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-10" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
