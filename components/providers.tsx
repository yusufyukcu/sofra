"use client";

import { useEffect, type ReactNode } from "react";
import { ToastProvider } from "./ui/toast";
import { useSession } from "@/lib/store/session";

/**
 * Uygulama genelinde geçerli istemci sağlayıcıları.
 * Açılışta `/auth/me` çağrılarak oturum, adresler ve aktif siparişler
 * tek istekte yüklenir.
 */
export function Providers({ children }: { children: ReactNode }) {
  const bootstrap = useSession((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return <ToastProvider>{children}</ToastProvider>;
}
