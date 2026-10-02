"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { Footer } from "./footer";
import { SupportLauncher } from "@/components/support/support-launcher";

/**
 * Uygulama kabuğu.
 *
 * Restoran paneli (`/isletme`), kurye uygulaması (`/kurye`) ve yönetici
 * paneli (`/yonetim`) kendi düzenlerini kurar: mutfak tableti, kuryenin
 * telefonu ve kontrol masası — müşteri başlığı ve alt gezinmesi oralara
 * ait değildir.
 */
export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Operasyonel paneller kendi düzenlerini kurar.
  if (
    pathname.startsWith("/isletme") ||
    pathname.startsWith("/kurye") ||
    pathname.startsWith("/yonetim")
  ) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      {/* Mobil alt gezinmenin payı alt bilgide (globals.css · .site-footer),
          içerikle alt bilgi arasında değil */}
      <main className="flex-1">{children}</main>
      <Footer />
      <BottomNav />
      <SupportLauncher />
    </>
  );
}
