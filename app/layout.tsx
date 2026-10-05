import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppChrome } from "@/components/layout/app-chrome";

/**
 * Tipografi iki aileye dayanır:
 *   Bricolage Grotesque → logo, başlıklar ve fiyatlar (pazar tabelası karakteri)
 *   Figtree             → arayüz ve gövde metni (sıcak, yuvarlak hatlı; küçük
 *                         boyda da okunur)
 * Türkçe için `latin-ext` alt kümesi zorunlu (ğ, ı, İ, ş, ç, ö, ü).
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
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
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1617" },
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
      className={`${figtree.variable} ${bricolage.variable} h-full antialiased`}
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
