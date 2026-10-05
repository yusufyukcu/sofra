"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { deliveryPoint, useSession } from "@/lib/store/session";
import type { RestaurantListItem } from "@/lib/types";
import { RestaurantCard } from "@/components/discovery/restaurant-card";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/** Favori restoranlar. */
export function FavoritesList() {
  const toast = useToast();
  const point = useSession(deliveryPoint);
  const favoriteIds = useSession((s) => s.user?.favoriteRestaurantIds);

  const [items, setItems] = useState<RestaurantListItem[] | null>(null);

  useEffect(() => {
    api
      .get<{ favorites: RestaurantListItem[] }>(
        `/favorites?lat=${point.lat}&lng=${point.lng}`
      )
      .then((data) => setItems(data.favorites))
      .catch((err) => {
        toast.error(errorMessage(err));
        setItems([]);
      });
    // Favori listesi değiştiğinde yeniden çek
  }, [point.lat, point.lng, favoriteIds?.length, toast]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Favorilerim</h1>
        <p className="mt-1 text-sm text-muted">
          Kalp attığın restoranlar burada birikiyor.
        </p>
      </header>

      {!items ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Henüz favorin yok"
          description="Beğendiğin restoranların kartındaki kalbe dokunarak buraya ekleyebilirsin."
          action={
            <Link href="/">
              <Button>Restoranları keşfet</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:gap-6 xl:grid-cols-3">
          {items.map((item) => (
            <RestaurantCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
