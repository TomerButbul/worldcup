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

type Subscription = { endpoint: string; p256dh: string; auth: string };

// Send a payload to each subscription, then prune any that are gone (the browser
// unsubscribed / uninstalled → 404/410). Shared by broadcast and sendToUsers.
async function sendAndPrune(
  s: ReturnType<typeof createServiceClient>,
  subs: Subscription[],
  payload: PushPayload,
): Promise<number> {
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

// Fan a notification out to every stored subscription. Dead endpoints (the
// browser unsubscribed / uninstalled) return 404/410 and are pruned.
export async function broadcast(payload: PushPayload): Promise<number> {
  if (!ensure()) return 0;
  const s = createServiceClient();
  const { data: subs } = await s.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (!subs?.length) return 0;
  return sendAndPrune(s, subs, payload);
}

// Targeted send: notify only the given users (across all their devices). Dead
// endpoints are pruned exactly like broadcast. Returns the number of pushes sent.
export async function sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  const ids = [...new Set(userIds)];
  if (!ids.length || !ensure()) return 0;
  const s = createServiceClient();
  const { data: subs } = await s
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", ids);
  if (!subs?.length) return 0;
  return sendAndPrune(s, subs, payload);
}

// Of the given users, those who have NOT switched off this category. Opt-out /
// default-on: a missing pref (or true) means enabled, so a user with no prefs
// row still gets everything. Keys: deadlines | matches | goals | results.
async function enabledFor(
  s: ReturnType<typeof createServiceClient>,
  category: string,
  userIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Set();
  const { data } = await s.from("profiles").select("id, notif_prefs").in("id", ids);
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const p of data ?? []) {
    seen.add(p.id as string);
    const prefs = (p.notif_prefs ?? {}) as Record<string, boolean>;
    if (prefs[category] !== false) out.add(p.id as string);
  }
  for (const id of ids) if (!seen.has(id)) out.add(id); // no profile row → default on
  return out;
}

// Broadcast, but only to subscribers who have `category` enabled.
export async function broadcastCategory(category: string, payload: PushPayload): Promise<number> {
  if (!ensure()) return 0;
  const s = createServiceClient();
  const { data: subs } = await s
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id");
  if (!subs?.length) return 0;
  const enabled = await enabledFor(s, category, subs.map((x) => x.user_id as string));
  const filtered = subs.filter((x) => enabled.has(x.user_id as string));
  if (!filtered.length) return 0;
  return sendAndPrune(
    s,
    filtered.map(({ endpoint, p256dh, auth }) => ({ endpoint, p256dh, auth })),
    payload,
  );
}

// Targeted send to specific users, filtered to those with `category` enabled.
export async function sendToUsersCategory(
  userIds: string[],
  category: string,
  payload: PushPayload,
): Promise<number> {
  if (!userIds.length || !ensure()) return 0;
  const s = createServiceClient();
  const enabled = await enabledFor(s, category, userIds);
  if (!enabled.size) return 0;
  const { data: subs } = await s
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", [...enabled]);
  if (!subs?.length) return 0;
  return sendAndPrune(s, subs, payload);
}
