"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CourierShell } from "./courier-shell";

/**
 * Giris ekrani uygulama kabugunun disinda kalir; aksi halde oturum
 * kontrolu kendini surekli giris sayfasina yonlendirirdi.
 */
export function CourierGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/kurye/giris") return <>{children}</>;
  return <CourierShell>{children}</CourierShell>;
}
