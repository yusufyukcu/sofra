import "server-only";
import webpush from "web-push";
import { sql } from "./db/client";

/**
 * Web Push gönderimi (VAPID — harici hesap gerektirmez).
 *
 * Bildirimler önce `notifications` tablosuna yazılır (sipariş tetikleyicisi,
 * kampanya…). `flushPushOutbox` gönderilmemiş bildirimleri tek bir UPDATE
 * ile atomik olarak üstlenir ve kullanıcının kayıtlı tarayıcılarına iletir;
 * aynı bildirim iki kez gönderilmez. API isteklerinin ardından (yanıt
 * gönderildikten sonra) kısıtlı aralıkla çağrılır.
 *
 * Geçersizleşen abonelik (404/410) silinir; art arda 5 hatadan sonra da.
 */

const MAX_AGE_MINUTES = 15;
const FLUSH_INTERVAL_MS = 2_000;

let configured: boolean | null = null;
let lastFlush = 0;
let running = false;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:destek@sofra.app", publicKey, privateKey);
  return (configured = true);
}

interface Pending {
  id: string;
  userId: string;
  title: string;
  body: string;
  href: string | null;
  kind: string;
}

interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

/** Gönderilmemiş bildirimleri tarayıcılara iletir; gönderilen sayısını döner. */
export async function flushPushOutbox(limit = 50): Promise<number> {
  if (!pushConfigured() || running) return 0;
  running = true;
  try {
    const pending = await sql<Pending[]>`
      update public.notifications n
         set push_sent_at = now()
       where n.id in (
         select id from public.notifications
          where push_sent_at is null
            and created_at > now() - make_interval(mins => ${MAX_AGE_MINUTES})
          order by created_at
          limit ${limit}
          for update skip locked
       )
      returning n.id, n.user_id, n.title, n.body, n.href, n.kind
    `;
    if (pending.length === 0) return 0;

    const userIds = [...new Set(pending.map((p) => p.userId))];
    const subs = await sql<(Subscription & { userId: string })[]>`
      select id, user_id, endpoint, p256dh, auth from public.push_subscriptions
       where kind = 'web' and user_id = any(${userIds}::text[])
    `;
    const byUser = new Map<string, Subscription[]>();
    for (const sub of subs) byUser.set(sub.userId, [...(byUser.get(sub.userId) ?? []), sub]);

    let sent = 0;
    await Promise.all(
      pending.flatMap((item) =>
        (byUser.get(item.userId) ?? []).map(async (sub) => {
          if (!sub.p256dh || !sub.auth) return;
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({ title: item.title, body: item.body, href: item.href ?? "/", tag: item.id, kind: item.kind }),
              { TTL: MAX_AGE_MINUTES * 60, urgency: item.kind === "order" ? "high" : "normal" }
            );
            sent++;
            await sql`
              update public.push_subscriptions
                 set last_success_at = now(), failure_count = 0
               where id = ${sub.id}
            `;
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await sql`delete from public.push_subscriptions where id = ${sub.id}`;
            } else {
              await sql`
                with bumped as (
                  update public.push_subscriptions set failure_count = failure_count + 1
                   where id = ${sub.id} returning id, failure_count
                )
                delete from public.push_subscriptions
                 where id in (select id from bumped where failure_count >= 5)
              `;
            }
          }
        })
      )
    );
    return sent;
  } finally {
    running = false;
  }
}

/** API isteklerinden sonra çağrılır; en fazla 2 saniyede bir kuyruğu boşaltır. */
export function schedulePushFlush(): Promise<number> | null {
  if (!pushConfigured()) return null;
  const now = Date.now();
  if (now - lastFlush < FLUSH_INTERVAL_MS) return null;
  lastFlush = now;
  return flushPushOutbox().catch((err) => {
    console.warn("[push] gönderim kuyruğu boşaltılamadı:", err instanceof Error ? err.message : err);
    return 0;
  });
}
