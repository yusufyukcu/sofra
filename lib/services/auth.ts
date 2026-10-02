import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { sql, type Changes, type Db } from "../db/client";
import { findUser, findUserByEmail, findUserByPhone } from "../db/queries";
import { appSettings } from "../db/settings";
import { isTestMode, sendMessage, type Channel } from "../messaging";
import type { AuthProvider, User } from "../types";
import { createId, isValidEmail, isValidPhone, normalizePhone } from "../utils";
import { DomainError } from "../errors";
import { applyWallet } from "./wallet";

/**
 * Kimlik doğrulama: telefon ya da e-postaya tek kullanımlık kod.
 *
 * Kod veritabanına düz metin yazılmaz; sunucu anahtarıyla HMAC özeti
 * saklanır. Hedef başına 15 dakikada en fazla 5 kod istenebilir, her kod
 * 3 dakika geçerlidir ve en fazla 5 kez denenebilir.
 *
 * SMS/e-posta sağlayıcısı bağlı değilken (test modu) kod cevapta `devCode`
 * olarak döner ve ekranda gösterilir. Sağlayıcı bağlanınca bu alan
 * kendiliğinden kaybolur.
 */

const OTP_TTL_MS = 3 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_WINDOW = 5;
const WINDOW_MINUTES = 15;

export type OtpPurpose = "customer" | "courier";

function pepper(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Doğrulama kodu anahtarı yok (SUPABASE_SERVICE_ROLE_KEY).");
  return key;
}

function hashCode(challengeId: string, code: string): string {
  return createHmac("sha256", pepper()).update(`${challengeId}:${code}`).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Kod mesajında hedefin tamamı yerine maskeli hâli gösterilir. */
export function maskTarget(channel: Channel, target: string): string {
  if (channel === "phone") {
    const p = normalizePhone(target);
    return `0${p.slice(0, 3)} *** ** ${p.slice(8)}`;
  }
  const [name, domain] = target.split("@");
  const head = name.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

export function normalizeTarget(channel: Channel, target: string): string {
  if (channel === "phone") {
    if (!isValidPhone(target)) {
      throw new DomainError("invalid_phone", "Geçerli bir cep telefonu numarası gir (5XX XXX XX XX).");
    }
    return normalizePhone(target);
  }
  if (!isValidEmail(target)) {
    throw new DomainError("invalid_email", "Geçerli bir e-posta adresi gir.");
  }
  return target.trim().toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Kod gönderme ve doğrulama                                           */
/* ------------------------------------------------------------------ */

export interface StartOtpResult {
  challengeId: string;
  maskedTarget: string;
  expiresInSeconds: number;
  /** Yalnızca test modunda dolu: SMS/e-posta sağlayıcısı bağlı değil. */
  devCode?: string;
}

export async function startOtp(
  purpose: OtpPurpose,
  channel: Channel,
  rawTarget: string,
  ip?: string | null
): Promise<StartOtpResult> {
  const target = normalizeTarget(channel, rawTarget);

  const [{ recent }] = await sql<{ recent: number }[]>`
    select count(*)::int as recent from public.otp_challenges
     where target = ${target}
       and created_at > now() - make_interval(mins => ${WINDOW_MINUTES})
  `;
  if (recent >= MAX_CODES_PER_WINDOW) {
    throw new DomainError(
      "otp_rate_limited",
      `Çok sık kod istedin. ${WINDOW_MINUTES} dakika sonra tekrar dene.`,
      429
    );
  }

  const id = createId("otp");
  const code = String(randomInt(100000, 1000000));

  await sql`
    insert into public.otp_challenges (id, purpose, channel, target, code_hash, expires_at, ip)
    values (${id}, ${purpose}, ${channel}, ${target}, ${hashCode(id, code)},
            ${new Date(Date.now() + OTP_TTL_MS)}, ${ip ?? null})
  `;

  const delivery = await sendMessage(
    channel,
    target,
    `Sofra doğrulama kodun: ${code}. Kodu kimseyle paylaşma.`,
    "Sofra doğrulama kodu"
  );

  return {
    challengeId: id,
    maskedTarget: maskTarget(channel, target),
    expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
    devCode: delivery.testMode ? code : undefined,
  };
}

export interface VerifiedTarget {
  purpose: OtpPurpose;
  channel: Channel;
  target: string;
}

/** Kodu doğrular ve tüketir. Başarılıysa kodun gönderildiği hedefi döner. */
export async function consumeOtp(challengeId: string, rawCode: string): Promise<VerifiedTarget> {
  const code = (rawCode ?? "").replace(/\D/g, "");

  return sql.begin(async (tx) => {
    const [challenge] = await tx<
      {
        id: string;
        purpose: OtpPurpose;
        channel: Channel;
        target: string;
        codeHash: string;
        attempts: number;
        expiresAt: Date;
        consumedAt: Date | null;
      }[]
    >`select * from public.otp_challenges where id = ${challengeId ?? ""} for update`;

    if (!challenge || challenge.consumedAt) {
      throw new DomainError("otp_not_found", "Doğrulama oturumu bulunamadı, kodu tekrar iste.");
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw new DomainError("otp_expired", "Kodun süresi doldu, yeniden gönder.");
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new DomainError("otp_too_many_attempts", "Çok fazla hatalı deneme yaptın. Yeni kod iste.");
    }

    if (code.length !== 6 || !sameHash(challenge.codeHash, hashCode(challenge.id, code))) {
      await tx`update public.otp_challenges set attempts = attempts + 1 where id = ${challenge.id}`;
      const left = MAX_ATTEMPTS - challenge.attempts - 1;
      // Hatalı deneme sayacı işlem geri alınmasın diye hata işlemi bitirdikten sonra fırlatılır
      return { error: left > 0 ? `Kod hatalı. ${left} deneme hakkın kaldı.` : "Kod hatalı. Yeni kod iste." };
    }

    await tx`update public.otp_challenges set consumed_at = now() where id = ${challenge.id}`;
    return { purpose: challenge.purpose, channel: challenge.channel, target: challenge.target };
  }).then((result) => {
    if ("error" in result) throw new DomainError("otp_invalid", result.error as string);
    return result as VerifiedTarget;
  });
}

/* ------------------------------------------------------------------ */
/* Müşteri hesabı                                                      */
/* ------------------------------------------------------------------ */

function assertNotBlocked(user: User) {
  if (!user.blocked) return;
  throw new DomainError(
    "account_blocked",
    user.blockReason
      ? `Hesabın askıya alındı: ${user.blockReason}`
      : "Hesabın askıya alındı. Destek ekibiyle iletişime geçebilirsin.",
    403
  );
}

const AVATARS = ["🧑", "👩", "🧔", "👨‍🦰", "👩‍🦱", "🧑‍🦲", "👱", "🧑‍🍳"];
const WELCOME_BONUS = 100;

async function createUser(
  db: Db,
  input: { name: string; phone?: string; email?: string; provider: AuthProvider; avatarEmoji?: string }
): Promise<string> {
  const id = createId("usr");
  await db`
    insert into public.profiles (id, name, phone, email, avatar_emoji, providers)
    values (${id}, ${input.name.slice(0, 60) || "Misafir"}, ${input.phone ?? null},
            ${input.email ?? null},
            ${input.avatarEmoji ?? AVATARS[randomInt(AVATARS.length)]}, ${[input.provider]})
  `;
  // Yeni üyelere hoş geldin bakiyesi — defterde izi ile
  await applyWallet(db, id, WELCOME_BONUS, "welcome", "Hoş geldin bakiyesi");
  return id;
}

async function addProvider(db: Db, userId: string, provider: AuthProvider) {
  await db`
    update public.profiles
       set providers = array_append(providers, ${provider})
     where id = ${userId} and not (${provider} = any(providers))
  `;
}

export interface CustomerAuthResult {
  user: User;
  isNewUser: boolean;
}

/** Doğrulanmış telefon/e-postayla müşteri hesabını bulur ya da açar. */
export async function customerFromVerifiedTarget(
  verified: VerifiedTarget,
  name?: string
): Promise<CustomerAuthResult> {
  if (verified.purpose !== "customer") {
    throw new DomainError("otp_purpose", "Bu doğrulama kodu müşteri girişi için değil.");
  }

  const existing =
    verified.channel === "phone"
      ? await findUserByPhone(verified.target)
      : await findUserByEmail(verified.target);

  if (existing) {
    assertNotBlocked(existing);
    await addProvider(sql, existing.id, verified.channel);
    return { user: (await findUser(existing.id))!, isNewUser: false };
  }

  const id = await sql.begin((tx) =>
    createUser(tx, {
      name: name?.trim() || "Misafir",
      phone: verified.channel === "phone" ? verified.target : undefined,
      email: verified.channel === "email" ? verified.target : undefined,
      provider: verified.channel,
    })
  );
  return { user: (await findUser(id))!, isNewUser: true };
}

/* ------------------------------------------------------------------ */
/* Sosyal giriş (test modu)                                            */
/* ------------------------------------------------------------------ */

const SOCIAL_PROFILES: Record<"google" | "apple", { name: string; email: string; avatarEmoji: string }> = {
  google: { name: "Google Kullanıcısı", email: "google.kullanici@gmail.com", avatarEmoji: "🧑‍💻" },
  apple: { name: "Apple Kullanıcısı", email: "apple.kullanici@icloud.com", avatarEmoji: "🧑‍🎤" },
};

/**
 * Google/Apple sağlayıcısı Supabase'te yapılandırılana kadar akış sabit bir
 * test profiliyle çalışır. Gerçek kimlik bilgileri eklendiğinde istemci
 * Supabase OAuth akışına yönlenir; bu fonksiyon yalnızca test içindir.
 */
export async function socialTestLogin(provider: "google" | "apple"): Promise<CustomerAuthResult> {
  const profile = SOCIAL_PROFILES[provider];
  const existing = await findUserByEmail(profile.email);

  if (existing) {
    assertNotBlocked(existing);
    await addProvider(sql, existing.id, provider);
    return { user: (await findUser(existing.id))!, isNewUser: false };
  }

  const id = await sql.begin((tx) =>
    createUser(tx, {
      name: profile.name,
      email: profile.email,
      provider,
      avatarEmoji: profile.avatarEmoji,
    })
  );
  return { user: (await findUser(id))!, isNewUser: true };
}

/** Demo hesabı — yalnızca demo modu açıkken. */
export async function demoLogin(): Promise<User> {
  const settings = await appSettings();
  if (!settings.demoMode) {
    throw new DomainError("demo_disabled", "Demo girişi kapalı.", 403);
  }
  const demo = await findUser("usr_demo");
  if (!demo) throw new DomainError("demo_unavailable", "Demo hesap bulunamadı.", 500);
  assertNotBlocked(demo);
  return demo;
}

export function socialTestModeEnabled(): boolean {
  return isTestMode("email");
}

/* ------------------------------------------------------------------ */
/* Profil                                                              */
/* ------------------------------------------------------------------ */

export interface ProfileUpdate {
  name?: string;
  email?: string;
  phone?: string;
  avatarEmoji?: string;
}

export async function updateProfile(user: User, patch: ProfileUpdate): Promise<User> {
  const changes: Changes = {};

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 2) throw new DomainError("invalid_name", "Ad soyad en az 2 karakter olmalı.");
    changes.name = name.slice(0, 60);
  }
  if (patch.email !== undefined && patch.email.trim()) {
    if (!isValidEmail(patch.email)) {
      throw new DomainError("invalid_email", "Geçerli bir e-posta adresi gir.");
    }
    const email = patch.email.trim().toLowerCase();
    const owner = await findUserByEmail(email);
    if (owner && owner.id !== user.id) {
      throw new DomainError("email_taken", "Bu e-posta başka bir hesapta kayıtlı.");
    }
    changes.email = email;
  }
  if (patch.phone !== undefined && patch.phone.trim()) {
    if (!isValidPhone(patch.phone)) {
      throw new DomainError("invalid_phone", "Geçerli bir telefon numarası gir.");
    }
    const phone = normalizePhone(patch.phone);
    const owner = await findUserByPhone(phone);
    if (owner && owner.id !== user.id) {
      throw new DomainError("phone_taken", "Bu numara başka bir hesapta kayıtlı.");
    }
    changes.phone = phone;
  }
  if (patch.avatarEmoji) changes.avatarEmoji = [...patch.avatarEmoji].slice(0, 2).join("");

  if (Object.keys(changes).length > 0) {
    await sql`update public.profiles set ${sql(changes, Object.keys(changes))} where id = ${user.id}`;
  }
  return (await findUser(user.id))!;
}
