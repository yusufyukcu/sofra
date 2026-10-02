import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppChrome } from "@/components/layout/app-chrome";

/**
 * Tipografi iki aileye dayanır:
 *   Bricolage Grotesque → başlıklar ve fiyatlar (pazar tabelası karakteri)
 *   Geist               → arayüz ve gövde metni (nötr, yoğun ekranlarda okunur)
 * Türkçe için `latin-ext` alt kümesi zorunlu (ğ, ı, İ, ş, ç, ö, ü).
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sofra — Yemek siparişi, kapında",
    template: "%s · Sofra",
  },
  description:
    "Çevrendeki restoranları keşfet, dakikalar içinde sipariş ver ve kuryeni canlı takip et.",
  applicationName: "Sofra",
  appleWebApp: { capable: true, title: "Sofra", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2e1720" },
    { media: "(prefers-color-scheme: dark)", color: "#1d0f15" },
  ],
};

/** Tema tercihini ilk boyamadan önce uygular (FOUC engelleme). */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("sofra:theme");
    var dark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-paper text-text">
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
