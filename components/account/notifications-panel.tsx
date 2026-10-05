"use client";

import { BellRing, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push-client";
import type { AppNotification } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

const PUSH_TEXT: Record<PushState, string> = {
  unsupported: "Bu tarayıcı bildirimleri desteklemiyor (iOS'ta uygulamayı ana ekrana eklemelisin).",
  unavailable: "Tarayıcı bildirimleri bu sunucuda yapılandırılmamış.",
  denied: "Bildirim iznini engellemişsin; tarayıcı ayarlarından açabilirsin.",
  off: "Uygulama kapalıyken de sipariş durumların bu cihaza gelsin.",
  on: "Bu cihaz bildirim alıyor.",
};

/** Bildirim kutusu ve bu cihazın tarayıcı bildirimi ayarı. */
export function NotificationsPanel() {
  const toast = useToast();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ notifications: AppNotification[]; unread: number; pushAvailable: boolean }>(
        "/notifications"
      );
      setItems(data.notifications);
      setPush(await pushState(data.pushAvailable));
      if (data.unread > 0) await api.post("/notifications", { action: "read" });
    } catch (err) {
      toast.error(errorMessage(err));
      setItems([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function togglePush() {
    setBusy(true);
    try {
      const next = push === "on" ? await disablePush() : await enablePush();
      setPush(next);
      if (next === "on") {
        await api.post("/notifications", { action: "test" });
        toast.success("Bildirimler açıldı; deneme bildirimi gönderildi.");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Bildirimler</h1>
        <p className="mt-1 text-sm text-muted">Sipariş durumların ve kampanyalar.</p>
      </header>

      {push && (
        <section className="card flex flex-wrap items-center gap-3 p-4">
          <BellRing className={cn("size-5", push === "on" ? "text-pistachio" : "text-muted")} />
          <p className="min-w-0 flex-1 text-sm text-text">{PUSH_TEXT[push]}</p>
          {(push === "on" || push === "off") && (
            <Button size="sm" variant={push === "on" ? "secondary" : "primary"} loading={busy} onClick={togglePush}>
              {push === "on" ? "Kapat" : "Tarayıcı bildirimlerini aç"}
            </Button>
          )}
        </section>
      )}

      {!items ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <EmptyState icon={BellRing} title="Henüz bildirim yok" description="Sipariş verdiğinde durum değişiklikleri burada görünür." />
      ) : (
        <section className="card divide-y divide-border overflow-hidden">
          {items.map((item) => {
            const content = (
              <>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.readAt ? "bg-transparent" : "bg-brand")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{item.title}</span>
                  <span className="block text-sm text-muted">{item.body}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">{relativeTime(item.createdAt)}</span>
                </span>
              </>
            );
            return item.href ? (
              <Link key={item.id} href={item.href as never} className="flex gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60">
                {content}
              </Link>
            ) : (
              <div key={item.id} className="flex gap-3 px-4 py-3">
                {content}
              </div>
            );
          })}
        </section>
      )}

      {items && items.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <CheckCheck className="size-3.5" />
          Bu sayfayı açtığında bildirimler okundu sayılır.
        </p>
      )}
    </div>
  );
}
