import "server-only";
import { after } from "next/server";
import {
  HANDOVER_SECONDS,
  ROUTE_OFF_TRACK_M,
  ROUTE_REFRESH_MS,
  legForStage,
  projectOnPath,
  travelSeconds,
} from "@sofra/core/route";
import { asJson, sql } from "../db/client";
import { fetchRoadRoute, routeProfileFor, routingEnabled } from "../routing";
import type { CourierStage, CourierVehicle, LatLng, RouteLeg } from "../types";

/**
 * Canlı teslimat takibi.
 *
 * Kuryenin cihazından gelen her konum açık teslimatına yazılır; müşterinin
 * haritası bunu Realtime ile anında görür. İzlenecek yol, yol tarifi
 * servisinden alınır (`lib/routing.ts`): teklif kabul edilince kurye →
 * restoran, restorana varınca restoran → adres; kurye rotadan saparsa
 * bulunduğu yerden yenisi. Rota isteği yanıt gönderildikten sonra yapılır
 * (`after`) — kurye uygulaması hiçbir zaman yol tarifini beklemez.
 */

const ACTIVE_STAGES = ["assigned", "at_restaurant", "picked_up"];

/** Konum değişmese de konum zamanı bu sıklıkta tazelenir (varlık sinyali) */
const LOCATED_AT_REFRESH_SECONDS = 30;
/** Ayak değişince eksik rota için iki istek arasındaki en kısa süre (ms) */
const MISSING_ROUTE_RETRY_MS = 5_000;

interface TrackedOrder {
  id: string;
  courierStage: CourierStage;
  courierLat: number | null;
  courierLng: number | null;
  restaurantLat: number;
  restaurantLng: number;
  destLat: number;
  destLng: number;
  courierRoute: LatLng[] | null;
  courierRouteLeg: RouteLeg | null;
  courierRouteAt: Date | null;
  vehicle: CourierVehicle;
}

async function trackedOrder(
  key: { orderId: string } | { courierId: string }
): Promise<TrackedOrder | null> {
  const match =
    "orderId" in key ? sql`o.id = ${key.orderId}` : sql`o.courier_id = ${key.courierId}`;
  const [row] = await sql<TrackedOrder[]>`
    select o.id, o.courier_stage, o.courier_lat, o.courier_lng,
           o.restaurant_lat, o.restaurant_lng,
           (o.address -> 'point' ->> 'lat')::float8 as dest_lat,
           (o.address -> 'point' ->> 'lng')::float8 as dest_lng,
           o.courier_route, o.courier_route_leg, o.courier_route_at,
           c.vehicle
      from public.orders o
      join public.couriers c on c.id = o.courier_id
     where ${match}
       and o.courier_stage = any(${ACTIVE_STAGES}::text[])
       and o.status not in ('delivered', 'cancelled')
     order by o.created_at desc
     limit 1
  `;
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/* Konum                                                               */
/* ------------------------------------------------------------------ */

/**
 * Kuryenin konumunu açık teslimatına yazar. Ayağın rotası yoksa ya da
 * kurye rotadan saptıysa yeni rota ister.
 *
 * Aynı nokta art arda geldiğinde satır değişmez (yayın üretmez); konum
 * zamanı yine de 30 sn'de bir tazelenir ki müşteri, duran kuryeyi
 * "konumu gelmiyor" sanmasın.
 */
export async function trackDelivery(courierId: string, point: LatLng): Promise<void> {
  const order = await trackedOrder({ courierId });
  if (!order) return;

  await sql`
    update public.orders
       set courier_lat = ${point.lat},
           courier_lng = ${point.lng},
           courier_located_at = case
             when courier_lat is distinct from ${point.lat}
               or courier_lng is distinct from ${point.lng}
               or courier_located_at is null
               or courier_located_at < now() - make_interval(secs => ${LOCATED_AT_REFRESH_SECONDS}::float8)
             then now()
             else courier_located_at
           end
     where id = ${order.id}
       and courier_stage = ${order.courierStage}
       and status not in ('delivered', 'cancelled')
  `;

  if (!routingEnabled()) return;
  const leg = legForStage(order.courierStage);
  if (!leg) return;

  const routeAge = order.courierRouteAt ? Date.now() - order.courierRouteAt.getTime() : Infinity;
  const route = order.courierRouteLeg === leg ? order.courierRoute : null;
  if (!route || route.length < 2) {
    if (routeAge > MISSING_ROUTE_RETRY_MS) scheduleRouteRefresh(order.id);
    return;
  }
  // Restoranda beklerken rota restorandan başlar; yalnızca yoldayken sapma aranır
  if (order.courierStage === "at_restaurant") return;
  const offset = projectOnPath(route, point)?.offsetM ?? 0;
  if (offset > ROUTE_OFF_TRACK_M && routeAge > ROUTE_REFRESH_MS) {
    scheduleRouteRefresh(order.id);
  }
}

/* ------------------------------------------------------------------ */
/* Rota                                                                */
/* ------------------------------------------------------------------ */

/**
 * Siparişin şu anki ayağı için yol rotası alır ve yazar.
 *
 * - Restorana giderken: kuryenin konumundan restorana
 * - Restoranda: restorandan adrese (müşteri gidilecek yolu önceden görür)
 * - Yolda: kuryenin konumundan adrese; tahmini teslim bu rotaya göre güncellenir
 *
 * Aynı sipariş için aynı anda tek istek gider; yeniden rota en fazla
 * 20 sn'de bir. Servis yanıt vermezse eski durum korunur.
 */
export async function refreshCourierRoute(orderId: string): Promise<void> {
  if (!routingEnabled()) return;
  const order = await trackedOrder({ orderId });
  const leg = legForStage(order?.courierStage);
  if (!order || !leg) return;

  const claimed = await sql`
    update public.orders set courier_route_at = now()
     where id = ${order.id}
       and courier_stage = ${order.courierStage}
       and (
         courier_route_at is null
         or courier_route_at < now() - make_interval(secs => ${ROUTE_REFRESH_MS / 1000}::float8)
         or (courier_route_leg is distinct from ${leg}
             and courier_route_at < now() - make_interval(secs => ${MISSING_ROUTE_RETRY_MS / 1000}::float8))
       )
    returning id
  `;
  if (claimed.length === 0) return;

  const restaurant = { lat: order.restaurantLat, lng: order.restaurantLng };
  const destination = { lat: order.destLat, lng: order.destLng };
  const courierPoint =
    order.courierLat !== null && order.courierLng !== null
      ? { lat: order.courierLat, lng: order.courierLng }
      : null;

  const from =
    order.courierStage === "assigned"
      ? courierPoint
      : order.courierStage === "picked_up"
        ? courierPoint ?? restaurant
        : restaurant;
  if (!from) return;
  const to = leg === "pickup" ? restaurant : destination;

  const route = await fetchRoadRoute(from, to, routeProfileFor(order.vehicle));
  if (!route) return;

  // Yoldaki siparişte tahmini teslim, kuryenin önündeki gerçek yola göre
  const etaAt =
    order.courierStage === "picked_up"
      ? new Date(
          Date.now() +
            (travelSeconds(route.distanceM, route.durationS, order.vehicle) + HANDOVER_SECONDS) * 1000
        )
      : null;

  await sql`
    update public.orders
       set courier_route = ${sql.json(asJson(route.points))},
           courier_route_leg = ${leg},
           courier_route_at = now(),
           courier_route_distance_m = ${route.distanceM},
           courier_route_duration_s = ${route.durationS},
           eta_at = coalesce(${etaAt}::timestamptz, eta_at)
     where id = ${order.id}
       and courier_stage = ${order.courierStage}
       and status not in ('delivered', 'cancelled')
  `;
}

/**
 * Rota isteğini yanıt gönderildikten sonraya bırakır. İstek bağlamı dışında
 * (betik, test) hemen çalıştırır.
 */
export function scheduleRouteRefresh(orderId: string): void {
  const run = () =>
    refreshCourierRoute(orderId).catch((err) => console.warn("[sofra/tracking]", err));
  try {
    after(run);
  } catch {
    void run();
  }
}
