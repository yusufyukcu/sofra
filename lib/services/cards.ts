import "server-only";
import { TEST_PAYMENT_CARDS } from "../constants";
import { sql, type Db } from "../db/client";
import { cardsOf } from "../db/queries";
import { DomainError } from "../errors";
import type { SavedCard, User } from "../types";
import { cardBrandOf, createId, dayKey, luhnValid } from "../utils";

/**
 * Kayıtlı kartlar — ödeme simülasyonu.
 *
 * Gerçek bir ödeme kuruluşu bağlanana kadar (`SOFRA_PAYMENT_PROVIDER`)
 * yalnızca yayımlanmış test kartları kabul edilir; gerçek kart bilgisi
 * sisteme hiç girmez. Saklanan: marka, son 4 hane, kart üzerindeki ad,
 * son kullanma tarihi ve sağlayıcı token'ı (simülasyonda sahte). Kart
 * numarası ve güvenlik kodu hiçbir yerde tutulmaz.
 */

const MAX_CARDS = 5;
const DECLINE_PREFIX = "tok_sim_decline_";

export interface CardInput {
  number?: string;
  expiry?: string;
  cvc?: string;
  holder?: string;
  nickname?: string;
}

export function paymentSimulated(): boolean {
  return !process.env.SOFRA_PAYMENT_PROVIDER;
}

export async function addCard(user: User, input: CardInput): Promise<SavedCard[]> {
  const number = String(input.number ?? "").replace(/\D/g, "");
  if (!luhnValid(number)) throw new DomainError("invalid_card_number", "Kart numarası geçersiz.");

  const test = TEST_PAYMENT_CARDS.find((card) => card.number === number);
  if (paymentSimulated() && !test) {
    throw new DomainError(
      "test_card_required",
      "Ödemeler şu an simülasyonda: yalnızca test kartları kabul ediliyor (ör. 4242 4242 4242 4242)."
    );
  }

  const brand = cardBrandOf(number);
  if (!brand) throw new DomainError("unsupported_card", "Visa, Mastercard ya da Troy kart kullanabilirsin.");

  const expiry = String(input.expiry ?? "").trim();
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry);
  if (!match) throw new DomainError("invalid_expiry", "Son kullanma tarihini AA/YY biçiminde gir.");
  if (`20${match[2]}-${match[1]}` < dayKey(new Date()).slice(0, 7)) {
    throw new DomainError("card_expired", "Kartın son kullanma tarihi geçmiş.");
  }
  if (!/^\d{3,4}$/.test(String(input.cvc ?? ""))) {
    throw new DomainError("invalid_cvc", "Güvenlik kodu 3 haneli olmalı.");
  }

  const holder = String(input.holder ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (holder.length < 3) throw new DomainError("invalid_holder", "Kart üzerindeki adı yaz.");
  const nickname = String(input.nickname ?? "").trim().slice(0, 30);

  const existing = await cardsOf(user.id);
  if (existing.length >= MAX_CARDS) {
    throw new DomainError("card_limit", `En fazla ${MAX_CARDS} kart kaydedebilirsin.`);
  }
  if (existing.some((c) => c.brand === brand && c.last4 === number.slice(-4) && c.expiry === expiry)) {
    throw new DomainError("card_exists", "Bu kart zaten kayıtlı.", 409);
  }

  // Sağlayıcı token'ı: simülasyonda sahte; "reddedilir" test kartı işaretli
  const token = `${test?.outcome === "decline" ? DECLINE_PREFIX : "tok_sim_"}${createId("t").slice(2)}`;
  await sql`
    insert into public.saved_cards (id, user_id, brand, last4, holder, expiry, nickname, provider_token)
    values (${createId("card")}, ${user.id}, ${brand}, ${number.slice(-4)},
            ${holder.toLocaleUpperCase("tr-TR")}, ${expiry}, ${nickname}, ${token})
  `;
  return cardsOf(user.id);
}

export async function deleteCard(user: User, cardId: string): Promise<SavedCard[]> {
  const result = await sql`delete from public.saved_cards where id = ${cardId} and user_id = ${user.id}`;
  if (result.count === 0) throw new DomainError("card_not_found", "Kart bulunamadı.", 404);
  return cardsOf(user.id);
}

/**
 * Online ödemede kullanılacak kart. Kart seçilmediyse ilk kayıtlı kart;
 * hiç kart yoksa sipariş verilemez. Simülasyonda "reddedilir" test kartı
 * bankanın onaylamadığı ödemeyi taklit eder.
 */
export async function chargeCard(
  userId: string,
  cardId: string | undefined,
  db: Db = sql
): Promise<{ brand: string; last4: string }> {
  const rows = await db<{ id: string; brand: string; last4: string; providerToken: string | null }[]>`
    select id, brand, last4, provider_token from public.saved_cards
     where user_id = ${userId} and (${cardId ?? null}::text is null or id = ${cardId ?? null}::text)
     order by created_at limit 1
  `;
  const card = rows[0];
  if (!card) {
    throw cardId
      ? new DomainError("card_not_found", "Seçtiğin kart bu hesapta kayıtlı değil.")
      : new DomainError("card_required", "Online ödeme için önce bir kart eklemelisin.");
  }
  if (card.providerToken?.startsWith(DECLINE_PREFIX)) {
    throw new DomainError(
      "card_declined",
      "Bankan bu ödemeyi onaylamadı. Başka bir kart ya da ödeme yöntemi dene.",
      402
    );
  }
  return { brand: card.brand, last4: card.last4 };
}
