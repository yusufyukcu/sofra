"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useRealtime } from "@/lib/realtime";
import { useSession } from "@/lib/store/session";
import { useToast } from "@/components/ui/toast";

/**
 * Başlıktaki bildirim zili: okunmamış sayısı, kullanıcının Realtime
 * kanalından (`user:<id>`) canlı güncellenir; yeni bildirim gelince kısa
 * bir uyarı gösterilir. Tıklanınca bildirim kutusu açılır.
 */
export function NotificationBell() {
  const toast = useToast();
  const pathname = usePathname();
  const status = useSession((s) => s.status);
  const userId = useSession((s) => s.user?.id);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ unread: number }>("/notifications");
      setUnread(data.unread);
    } catch {
      /* oturum düşmüş olabilir */
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") void load();
    else setUnread(0);
  }, [status, load]);

  // Bildirim kutusundan dönünce (okundu işaretlenmiş olabilir) sayacı tazele
  useEffect(() => {
    if (status === "authenticated" && !pathname.startsWith("/hesabim/bildirimler")) void load();
  }, [pathname, status, load]);

  useRealtime(
    "customer",
    userId ? [`user:${userId}`] : [],
    (message) => {
      if (message.event !== "notification") return;
      setUnread((n) => n + 1);
      const title = String(message.payload.title ?? "");
      if (title && !pathname.startsWith("/hesabim/bildirimler")) {
        toast.show(`${title}${message.payload.body ? ` — ${String(message.payload.body)}` : ""}`, "info");
      }
    },
    status === "authenticated" && Boolean(userId)
  );

  if (status !== "authenticated") return null;

  return (
    <Link
      href="/hesabim/bildirimler"
      aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : "Bildirimler"}
      className="relative flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="tabular absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-extrabold leading-4 text-brand-contrast ring-2 ring-surface">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
