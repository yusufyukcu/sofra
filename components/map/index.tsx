"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

/**
 * Leaflet yalnızca tarayıcıda çalıştığı için haritalar sunucuda render
 * edilmez (`ssr: false`). Yüklenene kadar iskelet gösterilir.
 */

function MapSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "skeleton flex items-center justify-center text-sm text-muted",
        className
      )}
    >
      Harita yükleniyor…
    </div>
  );
}

export const PickerMap = dynamic(
  () => import("./leaflet-map").then((m) => m.PickerMap),
  { ssr: false, loading: () => <MapSkeleton className="h-full w-full" /> }
);

export const TrackingMap = dynamic(
  () => import("./leaflet-map").then((m) => m.TrackingMap),
  { ssr: false, loading: () => <MapSkeleton className="h-full w-full" /> }
);

export const OpsMap = dynamic(
  () => import("./leaflet-map").then((m) => m.OpsMap),
  { ssr: false, loading: () => <MapSkeleton className="h-full w-full" /> }
);

export const StaticMap = dynamic(
  () => import("./leaflet-map").then((m) => m.StaticMap),
  { ssr: false, loading: () => <MapSkeleton className="h-full w-full" /> }
);
