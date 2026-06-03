import Link from "next/link";
import InstallGuide from "@/components/InstallGuide";

export const metadata = { title: "Install the app" };

export default function InstallPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-5 p-4 sm:p-6">
      <Link href="/" className="text-sm text-chalk-dim hover:text-chalk">
        &larr; Home
      </Link>
      <div className="glass-strong rounded-3xl p-5 text-center">
        <h1 className="font-display text-3xl text-gradient-gold">Get the app</h1>
        <p className="mt-1 text-sm text-chalk-dim">
          Add World Cup to your home screen — just follow the pictures for your phone.
        </p>
      </div>
      <InstallGuide />
    </main>
  );
}
