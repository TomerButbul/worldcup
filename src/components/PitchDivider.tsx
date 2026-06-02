import SoccerBall from "@/components/SoccerBall";

// Kickoff-style divider: a halfway line with a centre circle + ball.
export default function PitchDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden>
      <span className="h-px flex-1 bg-night/10" />
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-night/15">
        <SoccerBall size={16} />
      </span>
      <span className="h-px flex-1 bg-night/10" />
    </div>
  );
}
