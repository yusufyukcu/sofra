import "server-only";
import { sql } from "../db/client";
import { DomainError } from "../errors";
import { createId } from "../utils";

/**
 * Maskeli arama — kurye ile müşteri birbirinin numarasını görmeden görüşür.
 *
 * Arayan taraf için platform hattından geçici bir oturum açılır: sanal
 * numara + dahili kod. Arayan sanal numarayı arar, dahili kodu tuşlar (ya
 * da `tel:` bağlantısı kodu otomatik tuşlar); sesli arama sağlayıcısı
 * oturuma bakıp karşı tarafa köprüler. İki taraf da yalnızca platform
 * numarasını görür. Oturum 30 dakika ya da sipariş kapanana kadar geçerlidir.
 *
 * Sağlayıcı (`SOFRA_VOICE_PROVIDER`: Netgsm, Verimor, Twilio Proxy…)
 * bağlanana kadar test modu: oturum ve görüşme kaydı tutulur, arama ekranda
 * simüle edilir, kimse gerçekten aranmaz. Gerçek numaralar hiçbir yanıtta
 * yer almaz.
 */

export type CallerRole = "customer" | "courier";

export interface CallSession {
  id: string;
  orderId: string;
  callerRole: CallerRole;
  /** Aranacak platform hattı, ör. "0850 000 14 02" */
  proxyNumber: string;
  /** Hattı aradıktan sonra tuşlanacak dahili kod */
  extension: string;
  /** Telefon uygulaması için: numara + duraklama + dahili kod */
  dial: string;
  /** Kimi aradığı (gerçek numara olmadan) */
  calleeLabel: string;
  expiresAt: string;
  testMode: boolean;
}

const SESSION_MINUTES = 30;
/** Kuryenin müşteriyi aradığı platform hatları (müşteri, kuryenin maskeli hattını arar) */
const COURIER_LINES = ["0850 000 15 01", "0850 000 15 02", "0850 000 15 03", "0850 000 15 04"];
const ACTIVE_STAGES = ["assigned", "at_restaurant", "picked_up"];

export function voiceTestMode(): boolean {
  return (process.env.SOFRA_VOICE_PROVIDER ?? "test").toLowerCase() === "test";
}

interface CallOrderRow {
  id: string;
  userId: string;
  status: string;
  courierId: string | null;
  courierStage: string | null;
  courierName: string | null;
  courierMaskedPhone: string | null;
  customerName: string;
}

interface SessionRow {
  id: string;
  orderId: string;
  callerRole: CallerRole;
  proxyNumber: string;
  extension: string;
  expiresAt: Date;
}

function firstNameAndInitial(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toLocaleUpperCase("tr-TR")}.` : first;
}

function toSession(row: SessionRow, calleeLabel: string): CallSession {
  const digits = row.proxyNumber.replace(/\D/g, "").replace(/^0/, "");
  return {
    id: row.id,
    orderId: row.orderId,
    callerRole: row.callerRole,
    proxyNumber: row.proxyNumber,
    extension: row.extension,
    dial: `tel:+90${digits},${row.extension}`,
    calleeLabel,
    expiresAt: row.expiresAt.toISOString(),
    testMode: voiceTestMode(),
  };
}

/**
 * Arama oturumu açar (ya da aynı sipariş için açık oturumu döndürür).
 * Müşteri yalnızca kendi siparişinin kuryesini, kurye yalnızca üzerindeki
 * açık teslimatın müşterisini arayabilir.
 */
export async function startCall(role: CallerRole, actorId: string, orderId: string): Promise<CallSession> {
  const [order] = await sql<CallOrderRow[]>`
    select o.id, o.user_id, o.status, o.courier_id, o.courier_stage,
           coalesce(c.name, o.courier ->> 'name') as courier_name,
           coalesce(c.masked_phone, o.courier ->> 'maskedPhone') as courier_masked_phone,
           p.name as customer_name
      from public.orders o
      join public.profiles p on p.id = o.user_id
      left join public.couriers c on c.id = o.courier_id
     where o.id = ${orderId}
  `;
  const own = order && (role === "customer" ? order.userId === actorId : order.courierId === actorId);
  if (!order || !own) throw new DomainError("order_not_found", "Sipariş bulunamadı.", 404);
  if (order.status === "delivered" || order.status === "cancelled") {
    throw new DomainError("order_closed", "Sipariş kapandı; maskeli hat artık kullanılamaz.");
  }
  if (!order.courierId || !order.courierStage || !ACTIVE_STAGES.includes(order.courierStage)) {
    throw new DomainError("no_courier", "Siparişe henüz kurye atanmadı.");
  }

  if (!voiceTestMode()) {
    // Gerçek sağlayıcı bağlanırken oturum burada sağlayıcıya da kaydedilir
    throw new DomainError(
      "voice_provider_missing",
      `Sesli arama sağlayıcısı "${process.env.SOFRA_VOICE_PROVIDER}" henüz bağlı değil.`,
      503
    );
  }

  const calleeLabel =
    role === "customer"
      ? `Kuryen ${firstNameAndInitial(order.courierName ?? "Kurye")}`
      : `Müşteri ${firstNameAndInitial(order.customerName)}`;

  const [open] = await sql<SessionRow[]>`
    select id, order_id, caller_role, proxy_number, extension, expires_at
      from public.call_sessions
     where order_id = ${orderId} and caller_role = ${role} and expires_at > now() + interval '2 minutes'
     order by created_at desc limit 1
  `;
  if (open) return toSession(open, calleeLabel);

  const proxyNumber =
    role === "customer" && order.courierMaskedPhone
      ? order.courierMaskedPhone
      : COURIER_LINES[Math.abs(hash(orderId)) % COURIER_LINES.length];

  // Aynı hatta açık oturumlarla çakışmayan 4 haneli dahili kod
  for (let attempt = 0; attempt < 8; attempt++) {
    const extension = String(1000 + Math.floor(Math.random() * 9000));
    const [clash] = await sql<{ id: string }[]>`
      select id from public.call_sessions
       where proxy_number = ${proxyNumber} and extension = ${extension} and expires_at > now()
       limit 1
    `;
    if (clash) continue;

    const [row] = await sql<SessionRow[]>`
      insert into public.call_sessions (id, order_id, caller_role, proxy_number, extension, provider, expires_at)
      values (${createId("call")}, ${orderId}, ${role}, ${proxyNumber}, ${extension}, 'test',
              now() + make_interval(mins => ${SESSION_MINUTES}))
      returning id, order_id, caller_role, proxy_number, extension, expires_at
    `;
    return toSession(row, calleeLabel);
  }
  throw new DomainError("line_busy", "Platform hattı şu an yoğun, birazdan tekrar dene.", 503);
}

/** Görüşme bitti: süre kaydedilir (test modunda simülasyon süresi). */
export async function endCall(
  role: CallerRole,
  actorId: string,
  orderId: string,
  sessionId: string,
  durationSeconds: number
): Promise<void> {
  const seconds = Math.max(0, Math.min(3600, Math.round(Number(durationSeconds) || 0)));
  const result = await sql`
    update public.call_sessions s
       set ended_at = now(), duration_seconds = ${seconds}
      from public.orders o
     where s.id = ${sessionId} and s.order_id = ${orderId} and s.caller_role = ${role}
       and o.id = s.order_id
       and (${role} = 'customer' and o.user_id = ${actorId} or ${role} = 'courier' and o.courier_id = ${actorId})
  `;
  if (result.count === 0) throw new DomainError("call_not_found", "Arama oturumu bulunamadı.", 404);
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return h;
}
