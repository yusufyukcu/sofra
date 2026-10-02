"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "./admin-shell";

/** Giris ekrani panel kabugunun disinda kalir. */
export function AdminGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/yonetim/giris") return <>{children}</>;
  return <AdminShell>{children}</AdminShell>;
}
