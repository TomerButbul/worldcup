import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

// VAPID keys are read at runtime (server env), so adding them in Vercel takes
// effect without a rebuild. NEXT_PUBLIC_ fallback supports local .env.local.
function publicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}

let configured = false;
function ensure(): boolean {
  if (configured) return true;
  const pub = publicKey();
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:tomerbutbuleast@gmail.com", pub, priv);
  configured = true;
  return true;
}

export function vapidPublicKey(): string {
  return publicKey();
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

// Fan a notification out to every stored subscription. Dead endpoints (the
// browser unsubscribed / uninstalled) return 404/410 and are pruned.
export async function broadcast(payload: PushPayload): Promise<number> {
  if (!ensure()) return 0;
  const s = createServiceClient();
  const { data: subs } = await s.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (!subs?.length) return 0;

  const dead: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(sub.endpoint);
      }
    }),
  );
  if (dead.length) await s.from("push_subscriptions").delete().in("endpoint", dead);
  return sent;
}
