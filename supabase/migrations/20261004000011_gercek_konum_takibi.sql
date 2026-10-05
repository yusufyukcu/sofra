-- =====================================================================
-- Gerçek konum takibi — teslimat simülasyonu kaldırıldı
--
-- * Simüle teslimat yok: siparişi yalnızca mesaideki gerçek kuryeler
--   üstlenir, süreler hiçbir modda hızlandırılmaz. Dağıtım turu artık
--   yalnızca teklif üretir (süresi dolanı kapatır, en yakın kuryeye
--   gönderir). Restoranın kendi kuryesiyle giden siparişi restoran
--   panelinden "Teslim edildi" ile kapatır.
-- * Kurye rotası yol tarifi servisinden (OSRM) gelen gerçek yol
--   çizgisidir. Hangi ayağa ait olduğu (restorana gidiş / müşteriye
--   götürüş), ne zaman hesaplandığı, yol mesafesi ve süresi saklanır.
-- * `courier_located_at`: kurye konumunun son geldiği an; müşteri ekranı
--   konum eskidiyse bunu söyler.
-- * Yayın: yalnızca konum alanları değiştiyse hafif `courier_moved`;
--   rota hesabının iç kaydı (`courier_route_at`) yayın üretmez.
-- =====================================================================

-- 1) Dağıtım turu: yalnızca teklifler --------------------------------

create or replace function app_private.dispatch_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare
  r         record;
  c         record;
  v_dropoff double precision;
begin
  -- Aynı anda tek dağıtım turu
  if not pg_try_advisory_xact_lock(4206001) then
    return;
  end if;

  -- 1) Süresi dolan teklifler
  with expired as (
    update public.delivery_offers
       set status = 'expired', responded_at = now()
     where status = 'pending' and expires_at <= now()
    returning order_id
  )
  update public.orders o
     set courier_stage = 'unassigned'
   where o.id in (select order_id from expired)
     and o.courier_stage = 'offered' and o.courier_id is null;

  -- 2) Kurye bekleyen siparişlere teklif
  for r in
    select o.id, o.restaurant_lat, o.restaurant_lng,
           (o.address -> 'point' ->> 'lat')::float8 as dest_lat,
           (o.address -> 'point' ->> 'lng')::float8 as dest_lng
      from public.orders o
     where o.status = 'preparing'
       and o.courier_mode = 'platform'
       and o.courier_id is null
       and coalesce(o.courier_stage, 'unassigned') = 'unassigned'
     order by o.created_at
     for update skip locked
  loop
    select cr.id,
           app_private.haversine_km(cr.lat, cr.lng, r.restaurant_lat, r.restaurant_lng) as km
      into c
      from public.couriers cr
     where cr.online and cr.status = 'active'
       -- Konumu son 5 dakikada gelmeyen kurye teklif almaz (uygulaması kapalı / konum izni yok)
       and cr.location_updated_at > now() - interval '5 minutes'
       and not exists (
         select 1 from public.orders a
          where a.courier_id = cr.id
            and a.courier_stage in ('assigned', 'at_restaurant', 'picked_up')
            and a.status not in ('delivered', 'cancelled'))
       and not exists (
         select 1 from public.delivery_offers p
          where p.courier_id = cr.id and p.status = 'pending')
       and not exists (
         select 1 from public.delivery_offers p
          where p.courier_id = cr.id and p.order_id = r.id
            and p.status in ('rejected', 'expired')
            and p.responded_at > now() - interval '2 minutes')
     order by km
     limit 1;

    if not found then
      continue;
    end if;

    v_dropoff := app_private.haversine_km(r.restaurant_lat, r.restaurant_lng, r.dest_lat, r.dest_lng);

    insert into public.delivery_offers (id, order_id, courier_id, expires_at, fee, pickup_km, dropoff_km)
    values (
      app_private.new_id('ofr'), r.id, c.id, now() + interval '45 seconds',
      round(greatest(45, 35 + (c.km + v_dropoff) * 11)::numeric, 2),
      round(c.km::numeric, 1),
      round(v_dropoff::numeric, 1)
    );
    update public.orders set courier_stage = 'offered' where id = r.id;
  end loop;
end $$;

-- Simülasyonun rota üzerinde nokta bulan yardımcısı artık kullanılmıyor
drop function if exists app_private.route_point(jsonb, double precision);

-- 2) Simülasyon izleri ----------------------------------------------

-- Yolda kalmış simüle teslimat varsa simülasyonun yapacağı gibi kapanır
with finished as (
  update public.orders
     set status = 'delivered', courier_stage = 'delivered', delivered_at = now()
   where simulated and status = 'on_the_way'
  returning id
)
insert into public.order_events (order_id, status, note)
select id, 'delivered', 'Simüle teslimat sonlandırıldı.' from finished;

alter table public.orders drop column simulated;
delete from public.app_settings where key = 'sim_speed';

-- Kurye atanmamış siparişte kurye konumu ve rota olmaz (eskiden restoran
-- konumu ve uydurma bir eğri yazılıyordu); açık teslimatların uydurma
-- rotası silinir, ilk konum bildiriminde gerçeği hesaplanır.
update public.orders
   set courier_lat = null, courier_lng = null, courier_route = null
 where courier_id is null and status not in ('delivered', 'cancelled');
update public.orders
   set courier_route = null
 where courier_id is not null and status not in ('delivered', 'cancelled');

-- 3) Gerçek rota ve konum zamanı --------------------------------------

alter table public.orders
  add column courier_located_at timestamptz,
  add column courier_route_leg text check (courier_route_leg in ('pickup', 'dropoff')),
  add column courier_route_at timestamptz,
  add column courier_route_distance_m integer,
  add column courier_route_duration_s integer;

comment on column public.orders.courier_route is
  'Kuryenin şu anki ayağının yol çizgisi ([{lat,lng}], yol tarifi servisinden)';
comment on column public.orders.courier_route_leg is
  'courier_route hangi ayağa ait: pickup (kurye → restoran) ya da dropoff (→ adres)';
comment on column public.orders.courier_route_at is
  'Son rota isteği (yeniden rota sıklığını sınırlar; değişimi yayın üretmez)';
comment on column public.orders.courier_located_at is
  'Kurye konumunun son geldiği an';

-- 4) Yayın ----------------------------------------------------------

create or replace function app_private.broadcast_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_payload    jsonb;
  v_moved_only boolean := false;
begin
  -- Hiçbir alanı değişmeyen güncelleme (yalnızca updated_at ya da rota
  -- isteğinin iç kaydı) yayın üretmez
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'updated_at' - 'courier_route_at')
       = (to_jsonb(old) - 'updated_at' - 'courier_route_at') then
    return null;
  end if;

  v_payload := jsonb_build_object(
    'id', new.id,
    'status', new.status,
    'courierStage', new.courier_stage,
    'courierId', new.courier_id,
    'restaurantId', new.restaurant_id,
    'courierPoint', case when new.courier_lat is null then null
                    else jsonb_build_object('lat', new.courier_lat, 'lng', new.courier_lng) end,
    'courierLocatedAt', new.courier_located_at,
    'at', now()
  );

  -- Yalnızca konum alanları değiştiyse: sık gelir, yalnızca haritası olanlara gider
  if tg_op = 'UPDATE' then
    v_moved_only :=
      (to_jsonb(new) - 'updated_at' - 'courier_route_at'
                     - 'courier_lat' - 'courier_lng' - 'courier_located_at')
      = (to_jsonb(old) - 'updated_at' - 'courier_route_at'
                       - 'courier_lat' - 'courier_lng' - 'courier_located_at');
  end if;

  if v_moved_only then
    perform app_private.emit('order:' || new.id, 'courier_moved', v_payload);
    perform app_private.emit('admin:ops', 'courier_moved', v_payload);
    return null;
  end if;

  perform app_private.emit('order:' || new.id, 'order_changed', v_payload);
  perform app_private.emit('restaurant:' || new.restaurant_id, 'order_changed', v_payload);
  perform app_private.emit('admin:ops', 'order_changed', v_payload);
  if new.courier_id is not null then
    perform app_private.emit('courier:' || new.courier_id, 'order_changed', v_payload);
  end if;
  if tg_op = 'UPDATE' and old.courier_id is not null
     and old.courier_id is distinct from new.courier_id then
    perform app_private.emit('courier:' || old.courier_id, 'order_changed', v_payload);
  end if;
  return null;
end $$;
