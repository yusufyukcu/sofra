import "server-only";

/**
 * SMS ve e-posta gönderimi — sağlayıcıdan bağımsız katman.
 *
 * Şimdilik yalnızca test modu var: mesaj gönderilmez, sunucu günlüğüne
 * yazılır ve doğrulama kodu ekranda gösterilir. Gerçek sağlayıcı (Netgsm,
 * Twilio, Resend…) bağlanırken yalnızca bu dosyaya bir `send` uygulaması
 * eklenir ve `SOFRA_SMS_PROVIDER` / `SOFRA_EMAIL_PROVIDER` ayarlanır;
 * çağıran kod değişmez.
 */

export type Channel = "phone" | "email";

export interface DeliveryResult {
  /** Mesaj gerçekten bir sağlayıcıya teslim edildi mi */
  delivered: boolean;
  /** Test modunda kod ekranda gösterilir */
  testMode: boolean;
}

function providerFor(channel: Channel): string {
  const value =
    channel === "phone" ? process.env.SOFRA_SMS_PROVIDER : process.env.SOFRA_EMAIL_PROVIDER;
  return (value ?? "test").toLowerCase();
}

/** Bu kanal test modunda mı (kod ekranda gösterilecek mi)? */
export function isTestMode(channel: Channel): boolean {
  return providerFor(channel) === "test";
}

export async function sendMessage(
  channel: Channel,
  to: string,
  text: string,
  subject = "Sofra"
): Promise<DeliveryResult> {
  const provider = providerFor(channel);

  if (provider === "test") {
    // Gerçek kişiye ulaşmaz; geliştirirken akışı izleyebilmek için günlüğe yazılır
    console.info(`[sofra/mesaj:test] ${channel} → ${to}: ${subject} · ${text}`);
    return { delivered: false, testMode: true };
  }

  throw new Error(
    `${channel === "phone" ? "SMS" : "E-posta"} sağlayıcısı "${provider}" henüz bağlı değil. ` +
      "lib/messaging/index.ts içine sağlayıcıyı ekle ya da test moduna dön."
  );
}
