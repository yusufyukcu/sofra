-- =====================================================================
-- Gerçek kurye ataması (varsayılan davranış)
--
-- * Demo modu varsayılan olarak kapalı: simüle kurye yok, siparişi
--   yalnızca gerçek kuryeler üstlenir, süreler gerçek. (Sunum için yönetici
--   panelinden açılabilir.)
-- * Kurye varlığı: konumu son 5 dakikada gelmeyen kurye teklif almaz;
--   15 dakikadır sinyal yoksa ve elinde teslimat yoksa mesaiden düşer.
--   Kurye uygulaması mesaideyken konumunu düzenli gönderir.
-- * Demo kapatıldığında yolda olan simüle teslimatlar yarıda kalmaz.
-- =====================================================================

update public.app_settings set value = 'false'::jsonb, updated_at = now() where key = 'demo_mode';

create or replace function app_private.dispatch_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_demo    boolean := app_private.setting_bool('demo_mode', false);
  v_speed   numeric := greatest(app_private.setting_num('sim_speed', 12), 1);
  v_online  integer;
  r         record;
  c         record;
  v_dropoff double precision;
  v_t       double precision;
  v_lat     double precision;
  v_lng     double precision;
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
       and not o.simulated
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

  -- 3) Önceden başlamış simüle teslimatlar (demo kapatılmış olsa da) rota üzerinde ilerler
  for r in
    select o.id, o.picked_up_at, o.travel_minutes, o.courier_route,
           (o.address -> 'point' ->> 'lat')::float8 as dest_lat,
           (o.address -> 'point' ->> 'lng')::float8 as dest_lng
      from public.orders o
     where o.simulated and o.status = 'on_the_way'
     for update skip locked
  loop
    v_t := extract(epoch from (now() - r.picked_up_at))
           / greatest(r.travel_minutes * 60.0 / v_speed, 5);
    if v_t >= 1 then
      update public.orders
         set status = 'delivered', courier_stage = 'delivered', delivered_at = now(),
             courier_lat = r.dest_lat, courier_lng = r.dest_lng
       where id = r.id;
      insert into public.order_events (order_id, status, note)
      values (r.id, 'delivered', 'Sipariş adresine teslim edildi.');
    else
      select p.lat, p.lng into v_lat, v_lng from app_private.route_point(r.courier_route, v_t) p;
      if v_lat is not null then
        update public.orders set courier_lat = v_lat, courier_lng = v_lng where id = r.id;
      end if;
    end if;
  end loop;

  if not v_demo then
    return;
  end if;

  -- 3a) Demo: vardiyada kurye yoksa hazırlığı biten siparişi simüle kurye alır
  select count(*) into v_online from public.couriers
   where online and status = 'active' and location_updated_at > now() - interval '5 minutes';
  if v_online = 0 then
    for r in
      select o.id
        from public.orders o
       where o.status = 'preparing'
         and o.courier_mode = 'platform'
         and o.courier_id is null
         and not o.simulated
         and coalesce(o.courier_stage, 'unassigned') = 'unassigned'
         and o.approved_at is not null
         and now() >= o.approved_at
                      + make_interval(secs => (coalesce(o.prep_minutes, 20) * 60.0 / v_speed)::float8)
       for update skip locked
    loop
      update public.orders o
         set simulated     = true,
             status        = 'on_the_way',
             courier_stage = 'picked_up',
             picked_up_at  = now(),
             courier       = coalesce((
               select jsonb_build_object(
                        'id', 'demo-' || cr.id, 'name', cr.name, 'emoji', cr.emoji,
                        'vehicle', cr.vehicle, 'rating', cr.rating, 'maskedPhone', cr.masked_phone)
                 from public.couriers cr
                order by md5(o.id || cr.id)
                limit 1),
               jsonb_build_object('id', 'demo', 'name', 'Demo Kurye', 'emoji', '🛵',
                                  'vehicle', 'moto', 'rating', 4.8, 'maskedPhone', '0850 000 00 00')),
             courier_lat   = o.restaurant_lat,
             courier_lng   = o.restaurant_lng,
             eta_at        = now() + make_interval(secs => (o.travel_minutes * 60.0 / v_speed)::float8)
       where o.id = r.id;
      insert into public.order_events (order_id, status, note)
      values (r.id, 'on_the_way', 'Kurye siparişi restorandan teslim aldı.');
    end loop;
  end if;

  -- 3c) Demo: restoranın kendi kuryesi yola çıktıysa yol süresi sonunda teslim
  for r in
    select o.id
      from public.orders o
     where o.courier_mode = 'vendor'
       and o.status = 'on_the_way'
       and o.picked_up_at is not null
       and now() >= o.picked_up_at + make_interval(secs => (o.travel_minutes * 60.0 / v_speed)::float8)
     for update skip locked
  loop
    update public.orders set status = 'delivered', delivered_at = now() where id = r.id;
    insert into public.order_events (order_id, status, note)
    values (r.id, 'delivered', 'Restoran kuryesi siparişi teslim etti.');
  end loop;
end $$;

-- Uygulaması kapanmış / konumu gelmeyen kurye mesaiden düşer (her dakika)
create or replace function app_private.expire_idle_couriers() returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in
    select cr.id
      from public.couriers cr
     where cr.online
       and coalesce(cr.location_updated_at, cr.shift_started_at, 'epoch'::timestamptz)
           < now() - interval '15 minutes'
       and not exists (
         select 1 from public.orders o
          where o.courier_id = cr.id
            and o.courier_stage in ('assigned', 'at_restaurant', 'picked_up')
            and o.status not in ('delivered', 'cancelled'))
     for update skip locked
  loop
    update public.couriers set online = false, shift_started_at = null where id = r.id;

    with expired as (
      update public.delivery_offers
         set status = 'expired', responded_at = now()
       where courier_id = r.id and status = 'pending'
      returning order_id
    )
    update public.orders o
       set courier_stage = 'unassigned'
     where o.id in (select order_id from expired)
       and o.courier_stage = 'offered' and o.courier_id is null;
  end loop;
end $$;

select cron.schedule('sofra-idle-couriers', '* * * * *', 'select app_private.expire_idle_couriers()');
