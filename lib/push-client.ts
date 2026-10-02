"use client";

import { api } from "./api-client";

/**
 * Tarayıcı push aboneliği (Web Push / VAPID).
 *
 * Bildirim izni yalnızca kullanıcı düğmeye bastığında istenir. Abonelik
 * sunucuya kaydedilir; uygulama kapalıyken de sipariş durumu ve kampanya
 * bildirimleri gelir. iOS'ta yalnızca ana ekrana eklenen web uygulamasında
 * çalışır.
 */

export type PushState = "unsupported" | "unavailable" | "denied" | "off" | "on";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function pushState(serverAvailable: boolean): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (!serverAvailable || !PUBLIC_KEY) return "unavailable";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** İzin ister, abone olur ve aboneliği sunucuya kaydeder. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported() || !PUBLIC_KEY) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const reg = await registration();
  await navigator.serviceWorker.ready;
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(PUBLIC_KEY),
    }));
  await api.post("/push", { action: "subscribe", subscription: subscription.toJSON() });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const subscription = await reg?.pushManager.getSubscription();
  if (subscription) {
    await api.post("/push", { action: "unsubscribe", endpoint: subscription.endpoint }).catch(() => undefined);
    await subscription.unsubscribe();
  }
  return "off";
}
