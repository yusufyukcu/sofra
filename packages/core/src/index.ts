/**
 * @sofra/core — web ve mobilin paylaştığı çekirdek.
 *
 * Bu paket hiçbir arayüz kütüphanesine bağlı değildir: React, Next.js,
 * React Native veya DOM API'si kullanmaz. İçinde yalnızca alan modeli,
 * saf iş kuralları, biçimlendiriciler, API istemcisi ve tasarım jetonları
 * bulunur. Böylece bir kuralın iki istemcide ayrışması mümkün değil —
 * fiyat hesabı, filtreleme ve palet tek yerden gelir.
 */

export * from "./types";
export * from "./errors";
export * from "./utils";
export * from "./constants";
export * from "./pricing";
export * from "./discovery";
export * from "./cart";
export * from "./courier-constants";
export * from "./api-client";
export * from "./theme";
