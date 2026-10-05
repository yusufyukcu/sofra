"use client";

import { ChevronRight, ReceiptText, RotateCcw, Star } from "lucide-react";
import { ORDER_STATUS_ICONS } from "@sofra/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { ORDER_STATUS_META } from "@/lib/constants";
import { useCart, type CartRestaurantMeta } from "@/lib/store/cart";
import type { CartLine, Order } from "@/lib/types";
import { cn, formatDateTime, formatPrice } from "@/lib/utils";
import { Badge, Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { RestaurantThumb } from "@/components/ui/restaurant-thumb";
import { useToast } from "@/components/ui/toast";

type Filter = "all" | "active" | "past";

interface ReorderResponse {
  restaurant: CartRestaurantMeta;
  lines: CartLine[];
  removed: string[];
}

/** Sipariş geçmişi ve "Tekrar Sipariş Ver". */
export function OrdersList() {
  const router = useRouter();
  const toast = useToast();
  const setLines = useCart((s) => s.setLines);
  const cartRestaurant = useCart((s) => s.restaurant);
  const cartLines = useCart((s) => s.lines);

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<ReorderResponse | null>(null);

  useEffect(() => {
    api
      .get<{ orders: Order[] }>("/orders")
      .then((data) => setOrders(data.orders))
      .catch((err) => {
        toast.error(errorMessage(err));
        setOrders([]);
      });
  }, [toast]);

  function applyReorder(data: ReorderResponse) {
    setLines(data.restaurant, data.lines);
    if (data.removed.length) {
      toast.show(
        `${data.removed.join(", ")} artık satışta değil, sepete eklenmedi.`,
        "info"
      );
    } else {
      toast.success("Ürünler sepetine eklendi.");
    }
    router.push("/sepet");
  }

  async function reorder(order: Order) {
    setBusyId(order.id);
    try {
      const data = await api.post<ReorderResponse>(`/orders/${order.id}/reorder`);
      const conflict =
        cartLines.length > 0 &&
        cartRestaurant &&
        cartRestaurant.id !== data.restaurant.id;

      if (conflict) setPending(data);
      else applyReorder(data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (!orders) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const filtered = orders.filter((order) => {
    if (filter === "active") {
      return order.status !== "delivered" && order.status !== "cancelled";
    }
    if (filter === "past") {
      return order.status === "delivered" || order.status === "cancelled";
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Siparişlerim</h1>
        <p className="mt-1 text-sm text-muted">
          Geçmiş siparişlerini görüntüle, tek dokunuşla tekrar sipariş ver.
        </p>
      </header>

      <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
        {(
          [
            ["all", "Tümü"],
            ["active", "Devam eden"],
            ["past", "Geçmiş"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
              filter === id
                ? "bg-surface text-text shadow-sm"
                : "text-muted hover:text-text"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={
            filter === "active"
              ? "Devam eden siparişin yok"
              : "Henüz sipariş vermemişsin"
          }
          description="Çevrendeki restoranları keşfet ve ilk siparişini ver."
          action={
            <Link href="/">
              <Button>Restoranları keşfet</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((order) => {
            const meta = ORDER_STATUS_META[order.status];
            const active =
              order.status !== "delivered" && order.status !== "cancelled";
            return (
              <li key={order.id} className="card overflow-hidden">
                <Link
                  href={`/siparis/${order.id}`}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-2"
                >
                  <RestaurantThumb
                    image={order.restaurantImage}
                    className="size-12 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-bold text-text">
                        {order.restaurantName}
                      </h2>
                      <Badge
                        tone={
                          order.status === "delivered"
                            ? "success"
                            : order.status === "cancelled"
                              ? "danger"
                              : "brand"
                        }
                      >
                        <Icon name={ORDER_STATUS_ICONS[order.status]} className="size-3.5" />
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {order.code} · {formatDateTime(order.createdAt)}
                    </p>
                    <p className="mt-1 truncate text-sm text-muted">
                      {order.lines
                        .map((l) => `${l.quantity}× ${l.name}`)
                        .join(", ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-extrabold text-text">
                      {formatPrice(order.totals.grandTotal)}
                    </p>
                    <ChevronRight className="ml-auto mt-1 size-4 text-muted" />
                  </div>
                </Link>

                <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyId === order.id}
                    onClick={() => reorder(order)}
                  >
                    <RotateCcw className="size-3.5" />
                    Tekrar sipariş ver
                  </Button>

                  {order.status === "delivered" && !order.rating && (
                    <Link href={`/siparis/${order.id}/degerlendir`}>
                      <Button size="sm" variant="outline">
                        <Star className="size-3.5" />
                        Değerlendir
                      </Button>
                    </Link>
                  )}

                  {order.rating && (
                    <span className="inline-flex items-center gap-1 self-center text-xs font-semibold text-muted">
                      <Star className="size-3.5 fill-accent text-accent" />
                      {order.rating.restaurantScore}/5 verdin
                    </span>
                  )}

                  {active && (
                    <Link href={`/siparis/${order.id}`} className="ml-auto">
                      <Button size="sm">Canlı takip</Button>
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title="Sepetini değiştirelim mi?"
        description={`Sepetinde ${cartRestaurant?.name} siparişi var. Tekrar sipariş vermek için mevcut sepeti boşaltmamız gerekiyor.`}
        size="sm"
      >
        <div className="mt-2 flex gap-3">
          <Button variant="secondary" block onClick={() => setPending(null)}>
            Vazgeç
          </Button>
          <Button
            block
            onClick={() => {
              if (pending) applyReorder(pending);
              setPending(null);
            }}
          >
            Sepeti boşalt ve ekle
          </Button>
        </div>
      </Modal>
    </div>
  );
}
