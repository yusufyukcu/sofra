import "server-only";
import { iso, isoRequired, sql } from "../db/client";
import { DomainError } from "../errors";
import { pushConfigured } from "../push";
import type { AppNotification } from "../types";
import { createId } from "../utils";

/**
 * Bildirim kutusu ve tarayıcı push abonelikleri.
 *
 * Sipariş bildirimlerini veritabanı tetikleyicisi yazar; kampanyaları
 * yönetici paneli. Burada okunur, okundu işaretlenir ve tarayıcı
 * abonelikleri kaydedilir. Gönderim `lib/push.ts` içindedir.
 */

interface NotificationRow {
  id: string;
  kind: AppNotification["kind"];
  title: string;
  body: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}

function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href ?? undefined,
    readAt: iso(row.readAt),
    createdAt: isoRequired(row.createdAt),
  };
}

export async function listNotifications(
  userId: string,
  limit = 40
): Promise<{ notifications: AppNotification[]; unread: number }> {
  const [rows, [count]] = await Promise.all([
    sql<NotificationRow[]>`
      select id, kind, title, body, href, read_at, created_at from public.notifications
       where user_id = ${userId}
       order by created_at desc
       limit ${limit}
    `,
    sql<{ unread: number }[]>`
      select count(*)::int as unread from public.notifications
       where user_id = ${userId} and read_at is null
    `,
  ]);
  return { notifications: rows.map(toNotification), unread: count.unread };
}

/** Okundu işaretle; `ids` verilmezse tümü. */
export async function markRead(userId: string, ids?: string[]): Promise<number> {
  if (ids && (!Array.isArray(ids) || ids.some((id) => typeof id !== "string"))) {
    throw new DomainError("invalid_ids", "Geçersiz bildirim listesi.");
  }
  await sql`
    update public.notifications set read_at = now()
     where user_id = ${userId} and read_at is null
       and (${ids ?? null}::text[] is null or id = any(${ids ?? null}::text[]))
  `;
  const [count] = await sql<{ unread: number }[]>`
    select count(*)::int as unread from public.notifications where user_id = ${userId} and read_at is null
  `;
  return count.unread;
}

export interface PushSubscriptionInput {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

/** Tarayıcı aboneliğini kaydeder; aynı tarayıcı başka hesaba geçtiyse devralınır. */
export async function subscribePush(
  userId: string,
  input: PushSubscriptionInput,
  userAgent: string | null
): Promise<void> {
  if (!pushConfigured()) {
    throw new DomainError("push_unavailable", "Tarayıcı bildirimleri bu sunucuda yapılandırılmamış.", 503);
  }
  const endpoint = String(input.endpoint ?? "");
  const p256dh = String(input.keys?.p256dh ?? "");
  const auth = String(input.keys?.auth ?? "");
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth) {
    throw new DomainError("invalid_subscription", "Geçersiz bildirim aboneliği.");
  }
  await sql`
    insert into public.push_subscriptions (id, user_id, kind, endpoint, p256dh, auth, user_agent)
    values (${createId("psub")}, ${userId}, 'web', ${endpoint}, ${p256dh}, ${auth}, ${userAgent?.slice(0, 200) ?? null})
    on conflict (endpoint) do update
       set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
           user_agent = excluded.user_agent, failure_count = 0
  `;
}

export async function unsubscribePush(userId: string, endpoint: string): Promise<void> {
  await sql`delete from public.push_subscriptions where user_id = ${userId} and endpoint = ${endpoint}`;
}

export async function pushSubscriptionCount(userId: string): Promise<number> {
  const [row] = await sql<{ count: number }[]>`
    select count(*)::int as count from public.push_subscriptions where user_id = ${userId} and kind = 'web'
  `;
  return row.count;
}

/** "Deneme bildirimi gönder": kutuya yazılır, push kuyruğu iletir. */
export async function sendTestNotification(userId: string): Promise<void> {
  await sql`
    insert into public.notifications (id, user_id, title, body, href, kind)
    values (${createId("ntf")}, ${userId}, 'Bildirimler açık 🎉',
            'Sipariş durumların ve kampanyalar artık bu cihaza da gelecek.', '/hesabim/bildirimler', 'system')
  `;
}
