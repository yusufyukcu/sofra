"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { VendorShell } from "./vendor-shell";

/**
 * Giris ekrani panel kabugunun disinda kalir; aksi halde oturum
 * kontrolu kendini surekli giris sayfasina yonlendirirdi.
 */
export function VendorGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/isletme/giris") return <>{children}</>;
  return <VendorShell>{children}</VendorShell>;
}
