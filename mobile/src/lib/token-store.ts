import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Oturum token'ı deposu.
 *
 * Token cihazın güvenli alanında tutulur: iOS'ta Keychain, Android'de
 * EncryptedSharedPreferences. Webde `SecureStore` yok, orada `localStorage`
 * kullanılır — webde uygulama yalnızca geliştirme önizlemesi olarak
 * çalıştığı için bu kabul edilebilir.
 *
 * API istemcisi her istekte `readToken` çağırır. Senkron bir önbellek
 * tutuyoruz ki her istek için diske gitmeyelim; uygulama açılışında
 * `hydrateTokens` bir kez diski okur.
 */

export type Role = "customer" | "courier";

const KEY: Record<Role, string> = {
  customer: "sofra_customer_token",
  courier: "sofra_courier_token",
};

const cache: Record<Role, string | null> = { customer: null, courier: null };
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

/** Uygulama açılışında bir kez çağrılır. */
export async function hydrateTokens(): Promise<void> {
  const [customer, courier] = await Promise.all([
    readDisk(KEY.customer),
    readDisk(KEY.courier),
  ]);
  cache.customer = customer;
  cache.courier = courier;
}

/** Senkron okuma — API istemcisi her istekte bunu kullanır. */
export function readToken(role: Role): string | null {
  return cache[role];
}

export async function saveToken(role: Role, token: string): Promise<void> {
  cache[role] = token;
  await writeDisk(KEY[role], token);
}

export async function clearToken(role: Role): Promise<void> {
  cache[role] = null;
  await writeDisk(KEY[role], null);
}
