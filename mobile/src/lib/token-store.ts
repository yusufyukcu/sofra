import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Oturum deposu.
 *
 * Erişim token'ı (1 saat), yenileme token'ı ve bitiş anı cihazın güvenli
 * alanında tutulur: iOS'ta Keychain, Android'de EncryptedSharedPreferences.
 * Webde `SecureStore` yok, orada `localStorage` kullanılır — webde uygulama
 * yalnızca geliştirme önizlemesi olarak çalıştığı için bu kabul edilebilir.
 *
 * API istemcisi her istekte `readToken` çağırır. Senkron bir önbellek
 * tutuyoruz ki her istek için diske gitmeyelim; uygulama açılışında
 * `hydrateTokens` bir kez diski okur.
 */

export type Role = "customer" | "courier";

export interface StoredSession {
  accessToken: string;
  /** Erişim token'ı dolunca yenisini almak için (Supabase Auth) */
  refreshToken: string | null;
  /** Erişim token'ının bitişi (Unix saniye) */
  expiresAt: number | null;
}

const KEY: Record<Role, string> = {
  customer: "sofra_customer_token",
  courier: "sofra_courier_token",
};

const cache: Record<Role, StoredSession | null> = { customer: null, courier: null };
const isWeb = Platform.OS === "web";

async function readDisk(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeDisk(key: string, value: string | null): Promise<void> {
  if (isWeb) {
    try {
      if (value === null) globalThis.localStorage?.removeItem(key);
      else globalThis.localStorage?.setItem(key, value);
    } catch {
      /* gizli sekmede localStorage kapalı olabilir */
    }
    return;
  }
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    /* cihaz deposu yazılamadıysa oturum yalnızca bu açılışta yaşar */
  }
}

/** Eski sürümler yalnızca çıplak token yazıyordu; ikisini de okuyabiliriz. */
function parse(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof value?.accessToken === "string") {
      return {
        accessToken: value.accessToken,
        refreshToken: typeof value.refreshToken === "string" ? value.refreshToken : null,
        expiresAt: typeof value.expiresAt === "number" ? value.expiresAt : null,
      };
    }
  } catch {
    /* çıplak token */
  }
  return { accessToken: raw, refreshToken: null, expiresAt: null };
}

/** Uygulama açılışında bir kez çağrılır. */
export async function hydrateTokens(): Promise<void> {
  const [customer, courier] = await Promise.all([readDisk(KEY.customer), readDisk(KEY.courier)]);
  cache.customer = parse(customer);
  cache.courier = parse(courier);
}

/** Senkron okuma — API istemcisi her istekte bunu kullanır. */
export function readToken(role: Role): string | null {
  return cache[role]?.accessToken ?? null;
}

export function readSession(role: Role): StoredSession | null {
  return cache[role];
}

export async function saveSession(role: Role, session: StoredSession): Promise<void> {
  cache[role] = session;
  await writeDisk(KEY[role], JSON.stringify(session));
}

/** Girişte dönen yükten oturumu yazar ({ accessToken, refreshToken, expiresAt }). */
export async function saveAuthPayload(
  role: Role,
  payload: { accessToken?: string; refreshToken?: string | null; expiresAt?: number | null }
): Promise<void> {
  if (!payload.accessToken) return;
  await saveSession(role, {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken ?? null,
    expiresAt: payload.expiresAt ?? null,
  });
}

export async function clearToken(role: Role): Promise<void> {
  cache[role] = null;
  await writeDisk(KEY[role], null);
}
