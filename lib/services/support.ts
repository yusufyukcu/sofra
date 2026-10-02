import "server-only";
import { CANCELLABLE_STATUSES, ORDER_STATUS_META, PAYMENT_METHODS } from "../constants";
import { sql, type Db } from "../db/client";
import { findOrder, ordersOfUser } from "../db/queries";
import { remainingMinutes } from "../orders/progress";
import type { Order, SupportMessage, SupportSession, User } from "../types";
import { createId, formatPrice, formatTime } from "../utils";
import { DomainError } from "../errors";
import { cancelOrder } from "./orders";

/**
 * Destek: kural tabanlı asistan + temsilci kuyruğu.
 *
 * Asistan sık soruları (sipariş nerede, iptal) gerçek veriyle yanıtlar.
 * Çözemediği konuları — eksik/yanlış ürün, fatura, ödeme iadesi, temsilci
 * talebi — yönetici panelindeki destek kuyruğuna aktarır; oradan bir
 * temsilci yanıt verir. Asistan sistemin yapmadığı bir şeyi vaat etmez.
 */

type Intent =
  | "greeting"
  | "where_is_order"
  | "cancel_order"
  | "missing_item"
  | "late_order"
  | "payment_issue"
  | "invoice"
  | "courier_call"
  | "agent"
  | "thanks"
  | "unknown";

type SessionStatus = NonNullable<SupportSession["status"]>;

const QUICK_REPLIES = {
  root: [
    { id: "where_is_order", label: "Siparişim nerede?" },
    { id: "cancel_order", label: "Siparişimi iptal et" },
    { id: "missing_item", label: "Eksik / yanlış ürün" },
    { id: "payment_issue", label: "Ödeme & iade" },
    { id: "agent", label: "Canlı temsilci" },
  ],
} as const;

const EXTRA_LABELS: Record<string, string> = {
  confirm_cancel: "Evet, iptal et",
  root: "Başka bir konu",
  agent: "Temsilciye bağlan",
};

interface Draft {
  role: SupportMessage["role"];
  text: string;
  quickReplies?: { id: string; label: string }[];
}

const bot = (text: string, quickReplies?: { id: string; label: string }[]): Draft => ({
  role: "bot",
  text,
  quickReplies,
});

/* ------------------------------------------------------------------ */
/* Kalıcılık                                                           */
/* ------------------------------------------------------------------ */

interface SessionRow {
  id: string;
  userId: string;
  orderId: string | null;
  status: SessionStatus;
  topic: string | null;
}

async function loadSession(id: string, db: Db = sql): Promise<SupportSession> {
  const [session] = await db<SessionRow[]>`select * from public.support_sessions where id = ${id}`;
  const messages = await db<
    { id: string; role: SupportMessage["role"] | "system"; text: string; quickReplies: SupportMessage["quickReplies"] | null; at: Date; authorName: string | null }[]
  >`select * from public.support_messages where session_id = ${id} order by at, id`;

  return {
    id: session.id,
    userId: session.userId,
    orderId: session.orderId ?? undefined,
    status: session.status,
    escalated: session.status === "waiting_agent" || session.status === "with_agent",
    messages: messages.map((m) => ({
      id: m.id,
      // Arayüz sistem mesajlarını asistan balonuyla gösterir
      role: m.role === "system" ? "bot" : m.role,
      text: m.authorName && m.role === "agent" ? `${m.text}` : m.text,
      at: m.at.toISOString(),
      quickReplies: m.quickReplies ?? undefined,
    })),
  };
}

async function addMessages(db: Db, sessionId: string, drafts: Draft[]): Promise<void> {
  let at = Date.now();
  for (const draft of drafts) {
    await db`
      insert into public.support_messages (id, session_id, role, text, quick_replies, at)
      values (${createId("msg")}, ${sessionId}, ${draft.role}, ${draft.text},
              ${draft.quickReplies ? db.json(draft.quickReplies) : null}, ${new Date(at)})
    `;
    at += 1; // aynı istekte eklenen mesajların sırası korunsun
  }
  await db`update public.support_sessions set updated_at = now() where id = ${sessionId}`;
}

async function setStatus(db: Db, sessionId: string, status: SessionStatus, topic?: string) {
  await db`
    update public.support_sessions
       set status = ${status}, topic = coalesce(${topic ?? null}, topic),
           closed_at = ${status === "closed" ? new Date() : null}
     where id = ${sessionId}
  `;
}

function greeting(user: User): Draft {
  return bot(
    `Merhaba ${user.name.split(" ")[0]} 👋 Ben Sofra Asistanı. Sana nasıl yardımcı olabilirim?`,
    [...QUICK_REPLIES.root]
  );
}

export async function getOrCreateSession(
  user: User,
  sessionId?: string,
  orderId?: string
): Promise<SupportSession> {
  if (sessionId) {
    const [existing] = await sql<SessionRow[]>`
      select * from public.support_sessions where id = ${sessionId} and user_id = ${user.id}
    `;
    if (existing) return loadSession(existing.id);
  }

  // Açık bir oturum varsa onu sürdür (aynı siparişle ilgiliyse)
  const [open] = await sql<SessionRow[]>`
    select * from public.support_sessions
     where user_id = ${user.id} and status <> 'closed'
       and (${orderId ?? null}::text is null or order_id = ${orderId ?? null}::text)
     order by updated_at desc limit 1
  `;
  if (open) return loadSession(open.id);

  let validOrderId: string | null = null;
  if (orderId) {
    const order = await findOrder(orderId);
    if (order && order.userId === user.id) validOrderId = order.id;
  }

  const id = createId("sup");
  await sql.begin(async (tx) => {
    await tx`
      insert into public.support_sessions (id, user_id, order_id, status)
      values (${id}, ${user.id}, ${validOrderId}, 'bot')
    `;
    await addMessages(tx, id, [greeting(user)]);
  });
  return loadSession(id);
}

/* ------------------------------------------------------------------ */
/* Niyet çözümleme                                                     */
/* ------------------------------------------------------------------ */

const PATTERNS: [Intent, RegExp][] = [
  ["where_is_order", /(nerede|nerde|ne zaman gel|takip|durum|kurye nerede|geliyor mu)/i],
  ["cancel_order", /(iptal|vazge[çc]|geri al)/i],
  ["missing_item", /(eksik|yanl[ıi][şs]|gelmedi|unut|kay[ıi]p|hatal[ıi] [üu]r[üu]n)/i],
  ["late_order", /(gecik|ge[çc] kal|hala gelmedi|[çc]ok uzun)/i],
  ["payment_issue", /([öo]deme|iade|para|[üu]cret|tahsil|c[üu]zdan|bakiye)/i],
  ["invoice", /(fatura|fi[şs]|makbuz)/i],
  ["courier_call", /(kurye.*(ara|telefon|numara)|numaras[ıi])/i],
  ["agent", /(temsilci|insan|canl[ıi] destek|m[üu][şs]teri hizmet|yetkili)/i],
  ["thanks", /(te[şs]ekk[üu]r|sa[ğg] ?ol|eyvallah|tamamd[ıi]r)/i],
  ["greeting", /(merhaba|selam|iyi g[üu]nler|ge[çc]mi[şs] olsun|hey)/i],
];

function detectIntent(text: string): Intent {
  for (const [intent, pattern] of PATTERNS) {
    if (pattern.test(text)) return intent;
  }
  return "unknown";
}

/* ------------------------------------------------------------------ */
/* Yanıt üretimi                                                       */
/* ------------------------------------------------------------------ */

function describeOrder(order: Order): string {
  const meta = ORDER_STATUS_META[order.status];
  const lines = [
    `${meta.emoji} **${order.code}** · ${order.restaurantName}`,
    `Durum: ${meta.label} — ${meta.description}`,
  ];
  if (order.status === "on_the_way" && order.courier) {
    lines.push(`Kuryen ${order.courier.name}, tahmini varış ${remainingMinutes(order)} dakika.`);
  } else if (order.status !== "delivered" && order.status !== "cancelled") {
    lines.push(
      `Tahmini teslim saati ${formatTime(order.etaAt)} (yaklaşık ${remainingMinutes(order)} dk).`
    );
  } else if (order.status === "delivered" && order.deliveredAt) {
    lines.push(`${formatTime(order.deliveredAt)} itibarıyla teslim edildi.`);
  }
  return lines.join("\n");
}

async function pickOrder(user: User, session: SupportSession): Promise<Order | undefined> {
  if (session.orderId) {
    const order = await findOrder(session.orderId);
    if (order && order.userId === user.id) return order;
  }
  const orders = await ordersOfUser(user.id, sql, 10);
  return orders.find((o) => o.status !== "delivered" && o.status !== "cancelled") ?? orders[0];
}

interface Outcome {
  drafts: Draft[];
  /** Konuşma temsilci kuyruğuna aktarılıyorsa konu başlığı */
  escalate?: string;
}

const AGENT_HANDOFF =
  "Talebini müşteri temsilcisi kuyruğuna aktardım. Bir temsilci bu sohbete buradan yanıt verecek.";

async function respond(user: User, session: SupportSession, intent: Intent, rawText: string): Promise<Outcome> {
  const order = await pickOrder(user, session);
  const back = [...QUICK_REPLIES.root];

  switch (intent) {
    case "greeting":
      return { drafts: [greeting(user)] };

    case "where_is_order":
    case "late_order": {
      if (!order) {
        return {
          drafts: [bot("Görünüşe göre aktif bir siparişin yok. Yeni bir sipariş vermek için anasayfaya dönebilirsin.", back)],
        };
      }
      const drafts = [bot(describeOrder(order))];
      if (intent === "late_order" && order.status !== "delivered" && order.status !== "cancelled") {
        drafts.push(
          bot("Gecikme için özür dileriz. İstersen bir temsilci siparişini restoran ve kuryeyle birlikte kontrol etsin.", [
            { id: "agent", label: "Temsilciye bağlan" },
            { id: "root", label: "Başka bir konu" },
          ])
        );
      } else {
        drafts.push(bot("Başka bir konuda yardımcı olabilir miyim?", back));
      }
      return { drafts };
    }

    case "cancel_order": {
      if (!order || order.status === "delivered" || order.status === "cancelled") {
        return { drafts: [bot("İptal edilebilecek aktif bir siparişin bulunmuyor.", back)] };
      }
      if (!CANCELLABLE_STATUSES.includes(order.status)) {
        return {
          drafts: [
            bot(
              `${order.code} numaralı siparişin kuryede olduğu için uygulamadan iptal edilemiyor. Temsilcimiz restoranla görüşerek çözüm üretebilir.`,
              [
                { id: "agent", label: "Temsilciye bağlan" },
                { id: "root", label: "Başka bir konu" },
              ]
            ),
          ],
        };
      }
      return {
        drafts: [
          bot(
            `${order.code} numaralı siparişin (${formatPrice(order.totals.grandTotal)}) iptal edilecek. Onaylıyor musun?`,
            [
              { id: "confirm_cancel", label: "Evet, iptal et" },
              { id: "root", label: "Vazgeçtim" },
            ]
          ),
        ],
      };
    }

    case "missing_item":
      if (!order) {
        return {
          drafts: [bot("Hangi siparişle ilgili olduğunu bulamadım. Siparişlerim sayfasından ilgili siparişi açıp oradan destek başlatabilirsin.", back)],
        };
      }
      return {
        drafts: [
          bot(
            `${order.code} numaralı sipariş için eksik/yanlış ürün bildirimini aldım. ${AGENT_HANDOFF} Onaylanırsa ilgili tutar cüzdanına iade edilir.`
          ),
        ],
        escalate: "missing_item",
      };

    case "payment_issue": {
      const lines = [`Cüzdan bakiyen: **${formatPrice(user.walletBalance)}**.`];
      lines.push("Online ödenen bir siparişi iptal ettiğinde tutar anında cüzdanına yansır.");
      lines.push("Kapıda ödemeli siparişlerde iptal hâlinde tahsilat yapılmaz.");
      return {
        drafts: [
          bot(lines.join("\n"), [
            { id: "agent", label: "İade için temsilci" },
            { id: "root", label: "Başka bir konu" },
          ]),
        ],
      };
    }

    case "invoice":
      return {
        drafts: [
          bot(
            order
              ? `${order.code} numaralı siparişin faturası için talebini aldım. ${AGENT_HANDOFF}`
              : `Fatura talebini aldım. ${AGENT_HANDOFF}`
          ),
        ],
        escalate: "invoice",
      };

    case "courier_call":
      if (order?.courier && order.status !== "delivered" && order.status !== "cancelled") {
        return {
          drafts: [
            bot(
              `Kuryen ${order.courier.name}. Takip ekranındaki "Ara" düğmesiyle maskeli hat üzerinden arayabilirsin; iki taraf da birbirinin numarasını görmez.`,
              back
            ),
          ],
        };
      }
      return {
        drafts: [bot("Siparişine henüz kurye atanmadı. Kurye atandığında takip ekranından arayabilirsin.", back)],
      };

    case "agent":
      return { drafts: [bot(AGENT_HANDOFF)], escalate: "agent" };

    case "thanks":
      return { drafts: [bot("Rica ederim, afiyet olsun! 🧡", back)] };

    case "unknown":
    default:
      return {
        drafts: [
          bot(
            `"${rawText.slice(0, 80)}" ile ilgili emin olamadım. Aşağıdaki başlıklardan birini seçebilir ya da sorunu biraz daha açabilirsin.`,
            [...back, { id: "agent", label: "Temsilciye bağlan" }]
          ),
        ],
      };
  }
}

/* ------------------------------------------------------------------ */
/* Genel giriş noktası                                                 */
/* ------------------------------------------------------------------ */

export interface ChatInput {
  sessionId?: string;
  text?: string;
  quickReplyId?: string;
  orderId?: string;
}

export async function chat(user: User, input: ChatInput): Promise<SupportSession> {
  const session = await getOrCreateSession(user, input.sessionId, input.orderId);
  const quick = input.quickReplyId;
  const text = (input.text ?? "").trim().slice(0, 500);

  const userLabel = quick
    ? (QUICK_REPLIES.root.find((q) => q.id === quick)?.label ?? EXTRA_LABELS[quick] ?? quick)
    : text;
  if (!userLabel) return session;

  // Kapanmış oturuma yazılırsa asistan yeniden devreye girer
  if (session.status === "closed") await setStatus(sql, session.id, "bot");

  await addMessages(sql, session.id, [{ role: "user", text: userLabel }]);

  // Temsilci kuyruğundayken mesajlar temsilciye gider, asistan araya girmez
  if (session.status === "waiting_agent" || session.status === "with_agent") {
    return loadSession(session.id);
  }

  if (quick === "confirm_cancel") {
    const order = await pickOrder(user, session);
    let reply: Draft;
    if (!order) {
      reply = bot("İptal edilecek sipariş bulunamadı.", [...QUICK_REPLIES.root]);
    } else {
      try {
        const result = await cancelOrder(user, order.id, "Canlı destek üzerinden iptal");
        reply = bot(
          PAYMENT_METHODS[order.paymentMethod].onDelivery
            ? `${order.code} numaralı siparişin iptal edildi. Kapıda ödeme seçtiğin için tahsilat yapılmayacak.`
            : `${order.code} numaralı siparişin iptal edildi. ${formatPrice(result.refunded)} cüzdanına iade edildi.`,
          [...QUICK_REPLIES.root]
        );
      } catch (err) {
        reply = bot(
          err instanceof DomainError ? err.message : "İptal işlemi tamamlanamadı, temsilciye bağlanmanı öneririm.",
          [{ id: "agent", label: "Temsilciye bağlan" }]
        );
      }
    }
    await addMessages(sql, session.id, [reply]);
    return loadSession(session.id);
  }

  const intent: Intent = quick === "root" ? "greeting" : quick ? (quick as Intent) : detectIntent(text);
  const outcome = await respond(user, session, intent, text);

  await sql.begin(async (tx) => {
    await addMessages(tx, session.id, outcome.drafts);
    if (outcome.escalate) await setStatus(tx, session.id, "waiting_agent", outcome.escalate);
  });
  return loadSession(session.id);
}
