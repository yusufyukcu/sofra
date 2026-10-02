import { ORDER_STATUS_META, CANCELLABLE_STATUSES } from "../constants";
import { commit, db } from "../db/store";
import { remainingMinutes } from "../db/simulator";
import type { Order, SupportMessage, SupportSession, User } from "../types";
import { createId, formatPrice, formatTime } from "../utils";
import { activeOrders, cancelOrder, listOrders } from "./orders";

/**
 * Kural tabanlı destek botu.
 *
 * Sık sorulan sipariş sorularını (nerede, iptal, eksik ürün, iade) niyet
 * eşleştirmesiyle karşılar; çözemediğinde canlı temsilciye devreder.
 * Gerçek sistemde bu katman bir LLM veya üçüncü parti canlı destek
 * entegrasyonuyla değiştirilebilir — API sözleşmesi aynı kalır.
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

const QUICK_REPLIES = {
  root: [
    { id: "where_is_order", label: "Siparişim nerede?" },
    { id: "cancel_order", label: "Siparişimi iptal et" },
    { id: "missing_item", label: "Eksik / yanlış ürün" },
    { id: "payment_issue", label: "Ödeme & iade" },
    { id: "agent", label: "Canlı temsilci" },
  ],
} as const;

function message(
  role: SupportMessage["role"],
  text: string,
  quickReplies?: { id: string; label: string }[]
): SupportMessage {
  return {
    id: createId("msg"),
    role,
    text,
    at: new Date().toISOString(),
    quickReplies,
  };
}

export function greetingMessage(user: User): SupportMessage {
  return message(
    "bot",
    `Merhaba ${user.name.split(" ")[0]} 👋 Ben Sofra Asistanı. Sana nasıl yardımcı olabilirim?`,
    [...QUICK_REPLIES.root]
  );
}

export function getOrCreateSession(
  user: User,
  sessionId?: string,
  orderId?: string
): SupportSession {
  const existing = sessionId
    ? db().support.find((s) => s.id === sessionId && s.userId === user.id)
    : undefined;
  if (existing) return existing;

  const session: SupportSession = {
    id: createId("sup"),
    userId: user.id,
    orderId,
    messages: [greetingMessage(user)],
    escalated: false,
  };
  db().support.push(session);
  commit();
  return session;
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
    lines.push(
      `Kuryen ${order.courier.name}, tahmini varış ${remainingMinutes(order)} dakika.`
    );
  } else if (order.status !== "delivered" && order.status !== "cancelled") {
    lines.push(
      `Tahmini teslim saati ${formatTime(order.etaAt)} (yaklaşık ${remainingMinutes(order)} dk).`
    );
  } else if (order.status === "delivered" && order.deliveredAt) {
    lines.push(`${formatTime(order.deliveredAt)} itibarıyla teslim edildi.`);
  }
  return lines.join("\n");
}

function pickOrder(user: User, session: SupportSession): Order | undefined {
  if (session.orderId) {
    const byId = listOrders(user).find((o) => o.id === session.orderId);
    if (byId) return byId;
  }
  const active = activeOrders(user);
  if (active.length) return active[0];
  return listOrders(user)[0];
}

function respond(
  user: User,
  session: SupportSession,
  intent: Intent,
  rawText: string
): SupportMessage[] {
  const order = pickOrder(user, session);
  const back = [...QUICK_REPLIES.root];

  if (session.escalated) {
    return [
      message(
        "agent",
        "Mesajın temsilciye iletildi. Yoğunluğa göre ortalama yanıt süremiz 2-3 dakika. 🙏"
      ),
    ];
  }

  switch (intent) {
    case "greeting":
      return [greetingMessage(user)];

    case "where_is_order":
    case "late_order": {
      if (!order) {
        return [
          message(
            "bot",
            "Görünüşe göre aktif bir siparişin yok. Yeni bir sipariş vermek için anasayfaya dönebilirsin.",
            back
          ),
        ];
      }
      const out = [message("bot", describeOrder(order))];
      if (intent === "late_order" && order.status !== "delivered") {
        out.push(
          message(
            "bot",
            "Gecikme için özür dileriz. Sipariş tahmini süreyi 10 dakikadan fazla aşarsa cüzdanına otomatik 50 ₺ jest kodu tanımlanır.",
            [
              { id: "agent", label: "Yine de temsilciye bağlan" },
              { id: "root", label: "Başka bir konu" },
            ]
          )
        );
      } else {
        out.push(
          message("bot", "Başka bir konuda yardımcı olabilir miyim?", back)
        );
      }
      return out;
    }

    case "cancel_order": {
      if (!order || order.status === "delivered" || order.status === "cancelled") {
        return [
          message(
            "bot",
            "İptal edilebilecek aktif bir siparişin bulunmuyor.",
            back
          ),
        ];
      }
      if (!CANCELLABLE_STATUSES.includes(order.status)) {
        return [
          message(
            "bot",
            `${order.code} numaralı siparişin kuryede olduğu için uygulamadan iptal edilemiyor. Temsilcimiz restoranla görüşerek çözüm üretebilir.`,
            [
              { id: "agent", label: "Temsilciye bağlan" },
              { id: "root", label: "Başka bir konu" },
            ]
          ),
        ];
      }
      return [
        message(
          "bot",
          `${order.code} numaralı siparişin (${formatPrice(order.totals.grandTotal)}) iptal edilecek. Onaylıyor musun?`,
          [
            { id: "confirm_cancel", label: "Evet, iptal et" },
            { id: "root", label: "Vazgeçtim" },
          ]
        ),
      ];
    }

    case "missing_item":
      return [
        message(
          "bot",
          order
            ? `${order.code} numaralı sipariş için eksik/yanlış ürün kaydı oluşturdum. Restoranla görüşülüp 30 dakika içinde dönüş yapılacak; onaylanırsa tutar cüzdanına iade edilir.`
            : "Hangi siparişle ilgili olduğunu bulamadım. Siparişlerim sayfasından ilgili siparişi seçerek tekrar deneyebilirsin.",
          [
            { id: "agent", label: "Temsilciye bağlan" },
            { id: "root", label: "Başka bir konu" },
          ]
        ),
      ];

    case "payment_issue":
      return [
        message(
          "bot",
          [
            `Cüzdan bakiyen: **${formatPrice(user.walletBalance)}**.`,
            "Online ödemelerde iptal ettiğin siparişlerin tutarı anında cüzdanına yansır.",
            "Kredi kartına iade talep edersen banka sürecine bağlı olarak 1-7 iş günü sürer.",
          ].join("\n"),
          [
            { id: "agent", label: "Kartıma iade istiyorum" },
            { id: "root", label: "Başka bir konu" },
          ]
        ),
      ];

    case "invoice":
      return [
        message(
          "bot",
          order
            ? `${order.code} numaralı siparişin e-faturası ${user.email ?? "kayıtlı e-posta adresine"} gönderildi.`
            : "Fatura talebin için sipariş numarasını paylaşabilir misin?",
          back
        ),
      ];

    case "courier_call":
      if (order?.courier) {
        return [
          message(
            "bot",
            `Kuryen ${order.courier.name}. Gizliliğin için maskeli hattımız üzerinden arayabilirsin: **${order.courier.maskedPhone}**. Bu numara teslimattan 1 saat sonra devre dışı kalır.`,
            back
          ),
        ];
      }
      return [
        message(
          "bot",
          "Siparişine henüz kurye atanmadı. Kurye atandığında takip ekranından arayabilirsin.",
          back
        ),
      ];

    case "agent":
      session.escalated = true;
      return [
        message(
          "bot",
          "Seni bir müşteri temsilcisine aktarıyorum, hattan ayrılma. ⏳"
        ),
        message(
          "agent",
          `Merhaba, ben Sofra destek ekibinden Nazlı. ${
            order ? `${order.code} numaralı siparişini` : "Konunu"
          } inceliyorum, hemen dönüş yapacağım.`
        ),
      ];

    case "thanks":
      return [
        message("bot", "Rica ederim, afiyet olsun! 🧡", back),
      ];

    case "unknown":
    default:
      return [
        message(
          "bot",
          `"${rawText.slice(0, 80)}" ile ilgili emin olamadım. Aşağıdaki başlıklardan birini seçebilir ya da sorunu biraz daha açabilirsin.`,
          [...back, { id: "agent", label: "Temsilciye bağlan" }]
        ),
      ];
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

export function chat(user: User, input: ChatInput): SupportSession {
  const session = getOrCreateSession(user, input.sessionId, input.orderId);
  if (input.orderId) session.orderId = input.orderId;

  const quick = input.quickReplyId;
  const text = (input.text ?? "").trim();

  // Kullanıcı mesajını kaydet
  if (quick) {
    const label =
      [...QUICK_REPLIES.root, { id: "confirm_cancel", label: "Evet, iptal et" },
        { id: "root", label: "Başka bir konu" },
        { id: "agent", label: "Temsilciye bağlan" }].find((q) => q.id === quick)
        ?.label ?? quick;
    session.messages.push(message("user", label));
  } else if (text) {
    session.messages.push(message("user", text.slice(0, 500)));
  } else {
    commit();
    return session;
  }

  // Özel aksiyon: iptal onayı
  if (quick === "confirm_cancel") {
    const order = pickOrder(user, session);
    if (order) {
      try {
        cancelOrder(user, order.id, "Canlı destek üzerinden iptal");
        session.messages.push(
          message(
            "bot",
            `${order.code} numaralı siparişin iptal edildi. Ödeme tutarı ${formatPrice(order.totals.grandTotal)} cüzdanına iade edildi.`,
            [...QUICK_REPLIES.root]
          )
        );
      } catch (err) {
        session.messages.push(
          message(
            "bot",
            err instanceof Error
              ? err.message
              : "İptal işlemi tamamlanamadı, temsilciye bağlanmanı öneririm.",
            [{ id: "agent", label: "Temsilciye bağlan" }]
          )
        );
      }
    }
    commit();
    return session;
  }

  const intent: Intent =
    quick === "root"
      ? "greeting"
      : quick
        ? (quick as Intent)
        : detectIntent(text);

  respond(user, session, intent, text).forEach((m) => session.messages.push(m));
  commit();
  return session;
}
