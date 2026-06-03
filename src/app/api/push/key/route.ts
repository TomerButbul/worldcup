import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/lib/push";

// The client needs the VAPID public key to subscribe. Served at runtime so the
// env var can be added in Vercel without a rebuild.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ key: vapidPublicKey() });
}
