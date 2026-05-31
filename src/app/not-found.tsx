import Link from "next/link";
import { btnClass } from "@/components/buttonStyles";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="text-6xl">🧤</div>
      <div>
        <h1 className="font-display text-5xl text-gradient-gold">404</h1>
        <p className="mt-1 text-sm text-chalk-dim">
          That page sailed over the bar. Nothing here.
        </p>
      </div>
      <Link href="/" className={btnClass("primary")}>
        Back to home
      </Link>
    </main>
  );
}
