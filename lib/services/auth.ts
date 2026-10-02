import {
  commit,
  db,
  findUserByEmail,
  findUserByPhone,
} from "../db/store";
import type { AuthProvider, User } from "../types";
import {
  createId,
  isValidEmail,
  isValidPhone,
  normalizePhone,
} from "../utils";
import { DomainError } from "../errors";

/**
 * Kimlik doğrulama servisi.
 *
 * Telefon (OTP), e-posta (OTP) ve sosyal giriş (Apple/Google) desteklenir.
 * Prototipte SMS/e-posta göndermek yerine kodu cevapta döndürüyoruz; gerçek
 * sistemde burada bir SMS sağlayıcısı (Netgsm/Twilio) çağrılır ve `devCode`
 * alanı kaldırılır.
 */

/** Kara listedeki hesap giriş yapamaz. */
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

const OTP_TTL_MS = 3 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function maskTarget(channel: "phone" | "email", target: string): string {
  if (channel === "phone") {
    const p = normalizePhone(target);
    return `0${p.slice(0, 3)} *** ** ${p.slice(8)}`;
  }
  const [name, domain] = target.split("@");
  const head = name.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ------------------------------------------------------------------ */
/* OTP                                                                 */
/* ------------------------------------------------------------------ */

export interface StartOtpResult {
  challengeId: string;
  maskedTarget: string;
  expiresInSeconds: number;
  /** Yalnızca prototip: gerçek sistemde SMS ile gönderilir. */
  devCode: string;
}

export function startOtp(
  channel: "phone" | "email",
  target: string
): StartOtpResult {
  if (channel === "phone" && !isValidPhone(target)) {
    throw new DomainError(
      "invalid_phone",
      "Geçerli bir cep telefonu numarası gir (5XX XXX XX XX)."
    );
  }
  if (channel === "email" && !isValidEmail(target)) {
    throw new DomainError("invalid_email", "Geçerli bir e-posta adresi gir.");
  }

  const normalized =
    channel === "phone" ? normalizePhone(target) : target.trim().toLowerCase();

  // Aynı hedefe ait eski kodları temizle
  const store = db();
  store.otps = store.otps.filter(
    (o) => o.target !== normalized && o.expiresAt > Date.now()
  );

  const challenge = {
    id: createId("otp"),
    channel,
    target: normalized,
    code: generateCode(),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  };
  store.otps.push(challenge);
  commit();

  return {
    challengeId: challenge.id,
    maskedTarget: maskTarget(channel, normalized),
    expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
    devCode: challenge.code,
  };
}

export interface VerifyOtpResult {
  user: User;
  isNewUser: boolean;
}

export function verifyOtp(
  challengeId: string,
  code: string,
  name?: string
): VerifyOtpResult {
  const store = db();
  const challenge = store.otps.find((o) => o.id === challengeId);

  if (!challenge) {
    throw new DomainError(
      "otp_not_found",
      "Doğrulama oturumu bulunamadı, kodu tekrar iste."
    );
  }
  if (challenge.expiresAt < Date.now()) {
    store.otps = store.otps.filter((o) => o.id !== challengeId);
    commit();
    throw new DomainError("otp_expired", "Kodun süresi doldu, yeniden gönder.");
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    throw new DomainError(
      "otp_too_many_attempts",
      "Çok fazla hatalı deneme yaptın. Yeni kod iste."
    );
  }

  if (challenge.code !== code.replace(/\D/g, "")) {
    challenge.attempts += 1;
    commit();
    throw new DomainError(
      "otp_invalid",
      `Kod hatalı. ${MAX_ATTEMPTS - challenge.attempts} deneme hakkın kaldı.`
    );
  }

  store.otps = store.otps.filter((o) => o.id !== challengeId);

  const existing =
    challenge.channel === "phone"
      ? findUserByPhone(challenge.target)
      : findUserByEmail(challenge.target);

  if (existing) {
    assertNotBlocked(existing);
    const provider: AuthProvider = challenge.channel;
    if (!existing.providers.includes(provider)) existing.providers.push(provider);
    commit();
    return { user: existing, isNewUser: false };
  }

  const user = createUser({
    name: name?.trim() || (challenge.channel === "phone" ? "Misafir" : ""),
    phone: challenge.channel === "phone" ? challenge.target : undefined,
    email: challenge.channel === "email" ? challenge.target : undefined,
    provider: challenge.channel,
  });

  return { user, isNewUser: true };
}

/* ------------------------------------------------------------------ */
/* Sosyal giriş                                                        */
/* ------------------------------------------------------------------ */

const SOCIAL_PROFILES: Record<
  "google" | "apple",
  { name: string; email: string; avatarEmoji: string }
> = {
  google: {
    name: "Google Kullanıcısı",
    email: "google.kullanici@gmail.com",
    avatarEmoji: "🧑‍💻",
  },
  apple: {
    name: "Apple Kullanıcısı",
    email: "apple.kullanici@icloud.com",
    avatarEmoji: "🧑‍🎤",
  },
};

/**
 * Prototipte OAuth akışı simüle edilir: gerçek sistemde bu fonksiyon,
 * sağlayıcıdan dönen `id_token` doğrulandıktan sonra çağrılır.
 */
export function socialLogin(provider: "google" | "apple"): VerifyOtpResult {
  const profile = SOCIAL_PROFILES[provider];
  const existing = findUserByEmail(profile.email);

  if (existing) {
    assertNotBlocked(existing);
    if (!existing.providers.includes(provider)) existing.providers.push(provider);
    commit();
    return { user: existing, isNewUser: false };
  }

  const user = createUser({
    name: profile.name,
    email: profile.email,
    provider,
    avatarEmoji: profile.avatarEmoji,
  });
  return { user, isNewUser: true };
}

/* ------------------------------------------------------------------ */
/* Kullanıcı oluşturma & profil                                        */
/* ------------------------------------------------------------------ */

const AVATARS = ["🧑", "👩", "🧔", "👨‍🦰", "👩‍🦱", "🧑‍🦲", "👱", "🧑‍🍳"];

function createUser(input: {
  name: string;
  phone?: string;
  email?: string;
  provider: AuthProvider;
  avatarEmoji?: string;
}): User {
  const user: User = {
    id: createId("usr"),
    name: input.name || "Misafir",
    phone: input.phone,
    email: input.email,
    avatarEmoji:
      input.avatarEmoji ?? AVATARS[Math.floor(Math.random() * AVATARS.length)],
    providers: [input.provider],
    // Yeni üyelere hoş geldin bakiyesi
    walletBalance: 100,
    favoriteRestaurantIds: [],
    createdAt: new Date().toISOString(),
  };
  db().users.push(user);
  commit();
  return user;
}

export interface ProfileUpdate {
  name?: string;
  email?: string;
  phone?: string;
  avatarEmoji?: string;
}

export function updateProfile(user: User, patch: ProfileUpdate): User {
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 2) {
      throw new DomainError("invalid_name", "Ad soyad en az 2 karakter olmalı.");
    }
    user.name = name.slice(0, 60);
  }
  if (patch.email !== undefined && patch.email.trim()) {
    if (!isValidEmail(patch.email)) {
      throw new DomainError("invalid_email", "Geçerli bir e-posta adresi gir.");
    }
    const owner = findUserByEmail(patch.email);
    if (owner && owner.id !== user.id) {
      throw new DomainError(
        "email_taken",
        "Bu e-posta başka bir hesapta kayıtlı."
      );
    }
    user.email = patch.email.trim().toLowerCase();
  }
  if (patch.phone !== undefined && patch.phone.trim()) {
    if (!isValidPhone(patch.phone)) {
      throw new DomainError("invalid_phone", "Geçerli bir telefon numarası gir.");
    }
    const owner = findUserByPhone(patch.phone);
    if (owner && owner.id !== user.id) {
      throw new DomainError(
        "phone_taken",
        "Bu numara başka bir hesapta kayıtlı."
      );
    }
    user.phone = normalizePhone(patch.phone);
  }
  if (patch.avatarEmoji) user.avatarEmoji = patch.avatarEmoji.slice(0, 4);

  commit();
  return user;
}

/** Demo hesabı — hızlı giriş butonu için. */
export function demoLogin(): User {
  const demo = db().users.find((u) => u.id === "usr_demo");
  if (!demo) {
    throw new DomainError("demo_unavailable", "Demo hesap bulunamadı.", 500);
  }
  assertNotBlocked(demo);
  return demo;
}
