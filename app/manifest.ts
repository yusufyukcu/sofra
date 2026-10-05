import type { MetadataRoute } from "next";

/** Ana ekrana eklendiğinde uygulama gibi açılsın (simgeler `npm run brand:assets` ile üretilir). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sofra — Yemek siparişi",
    short_name: "Sofra",
    description: "Çevrendeki restoranlardan sipariş ver, kuryeni canlı takip et.",
    lang: "tr",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f5",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
