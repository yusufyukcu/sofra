-- =====================================================================
-- Sofra — fonksiyonlar, tetikleyiciler, Realtime yetkisi ve dağıtım
--
-- Yardımcı fonksiyonlar `app_private` şemasında durur: bu şema Data API'ye
-- açık değildir, yayınlanan anahtarla çağrılamaz.
-- =====================================================================

create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------
-- Genel yardımcılar
-- ---------------------------------------------------------------------

create or replace function app_private.new_id(p_prefix text) returns text
language sql volatile set search_path = '' as $$
  select p_prefix || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 14)
$$;

-- TypeScript tarafındaki `distanceKm` ile aynı formül (Haversine, R = 6371 km)
create or replace function app_private.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql immutable parallel safe set search_path = '' as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + power(sin(radians(lng2 - lng1) / 2), 2) * cos(radians(lat1)) * cos(radians(lat2))
  ))
$$;

-- Hakediş dönemleri İstanbul saatiyle pazartesi başlar
create or replace function app_private.istanbul_week_start(ts timestamptz) returns date
language sql stable set search_path = '' as $$
  select date_trunc('week', ts at time zone 'Europe/Istanbul')::date
$$;

create or replace function app_private.week_label(d date) returns text
language sql immutable set search_path = '' as $$
  select extract(day from d)::int || ' '
      || (array['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'])[extract(month from d)::int]
      || ' – ' || extract(day from d + 6)::int || ' '
      || (array['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'])[extract(month from d + 6)::int]
$$;

create or replace function app_private.setting_bool(p_key text, p_default boolean) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select (value)::boolean from public.app_settings where key = p_key), p_default)
$$;

create or replace function app_private.setting_num(p_key text, p_default numeric) returns numeric
language sql stable set search_path = '' as $$
  select coalesce((select (value)::numeric from public.app_settings where key = p_key), p_default)
$$;

create or replace function app_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger orders_touch before update on public.orders
  for each row execute function app_private.touch_updated_at();
create trigger restaurants_touch before update on public.restaurants
  for each row execute function app_private.touch_updated_at();
create trigger support_sessions_touch before update on public.support_sessions
  for each row execute function app_private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Hakediş tahakkuku
--
-- Teslim edilen sipariş ve kurye kazancı, işlemle aynı anda ilgili haftanın
-- açık hakedişine eklenir. O haftanın hakedişi onaylanmışsa tutar donmuştur;
-- yeni kayıt aynı hafta için açılan ek bir hakedişe yazılır. Böylece onaydan
-- sonra gelen sipariş ya da bahşiş hiçbir dönemde kaybolmaz.
-- ---------------------------------------------------------------------

create or replace function app_private.accrue_payout(
  p_kind text, p_target_id text, p_target_name text, p_at timestamptz,
  p_orders integer, p_gross numeric, p_commission numeric, p_tips numeric, p_net numeric
) returns text
language plpgsql set search_path = '' as $$
declare
  v_period date := app_private.istanbul_week_start(p_at);
  v_id     text;
  v_extra  boolean;
begin
  select id into v_id from public.payouts
   where kind = p_kind and target_id = p_target_id and period_key = v_period and status = 'pending'
   for update;

  if v_id is null then
    select exists (
      select 1 from public.payouts
       where kind = p_kind and target_id = p_target_id and period_key = v_period
    ) into v_extra;

    insert into public.payouts (id, kind, target_id, target_name, period_key, period_label)
    values (
      app_private.new_id('pay'), p_kind, p_target_id, p_target_name, v_period,
      app_private.week_label(v_period) || case when v_extra then ' · ek' else '' end
    )
    on conflict (kind, target_id, period_key) where status = 'pending' do nothing
    returning id into v_id;

    -- Eşzamanlı başka bir işlem aynı satırı açtıysa onu kullan
    if v_id is null then
      select id into v_id from public.payouts
       where kind = p_kind and target_id = p_target_id and period_key = v_period and status = 'pending'
       for update;
    end if;
  end if;

  update public.payouts
     set orders      = orders + p_orders,
         gross       = gross + p_gross,
         commission  = commission + p_commission,
         tips        = tips + p_tips,
         net         = net + p_net,
         target_name = p_target_name
   where id = v_id;

  return v_id;
end $$;

-- Restoran: brüt ciro − komisyon. Restoran kendi kuryesiyle götürdüyse
-- teslimat ücreti de restoranındır (komisyonsuz eklenir).
create or replace function app_private.on_order_delivered() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_commission numeric(12,2);
  v_delivery   numeric(12,2);
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    v_commission := round(new.subtotal * new.commission_rate, 2);
    v_delivery := case when new.courier_mode = 'vendor' then new.delivery_fee else 0 end;
    perform app_private.accrue_payout(
      'vendor', new.restaurant_id,
      coalesce((select name from public.restaurants where id = new.restaurant_id), new.restaurant_name),
      coalesce(new.delivered_at, now()),
      1, new.subtotal, v_commission, 0, new.subtotal - v_commission + v_delivery
    );
  end if;
  return null;
end $$;

create trigger orders_payout after update of status on public.orders
  for each row execute function app_private.on_order_delivered();

-- Kurye: paket ücreti + bahşiş. Bahşiş sonradan eklenirse farkı tahakkuk eder.
create or replace function app_private.on_courier_earning() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  select name into v_name from public.couriers where id = new.courier_id;
  if tg_op = 'INSERT' then
    perform app_private.accrue_payout(
      'courier', new.courier_id, coalesce(v_name, new.courier_id), new.at,
      1, new.fee, 0, new.tip, new.fee + new.tip
    );
  elsif new.tip <> old.tip then
    perform app_private.accrue_payout(
      'courier', new.courier_id, coalesce(v_name, new.courier_id), new.at,
      0, 0, 0, new.tip - old.tip, new.tip - old.tip
    );
  end if;
  return null;
end $$;

create trigger courier_earnings_payout after insert or update of tip on public.courier_earnings
  for each row execute function app_private.on_courier_earning();

-- ---------------------------------------------------------------------
-- Realtime: değişiklikler özel kanallara yayınlanır
--
-- Konular:
--   order:<id>        müşteri takibi, atanan kurye, restoran
--   restaurant:<id>   restoran paneli
--   courier:<id>      kurye uygulaması (teklif, aktif teslimat, hakediş)
--   user:<id>         müşterinin bildirim kutusu
--   support:<id>      destek sohbeti
--   admin:ops         yönetici canlı operasyon
--   admin:support     yönetici destek kuyruğu
-- Yük küçüktür; istemci olayı alınca güncel veriyi API'den çeker.
-- ---------------------------------------------------------------------

create or replace function app_private.emit(p_topic text, p_event text, p_payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(p_payload, p_event, p_topic, true);
exception when others then
  -- Yayın başarısız olsa bile asıl işlem geri alınmasın
  raise warning 'realtime yayını başarısız (%): %', p_topic, sqlerrm;
end $$;

create or replace function app_private.broadcast_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_payload    jsonb;
  v_moved_only boolean := false;
begin
  v_payload := jsonb_build_object(
    'id', new.id,
    'status', new.status,
    'courierStage', new.courier_stage,
    'courierId', new.courier_id,
    'restaurantId', new.restaurant_id,
    'courierPoint', case when new.courier_lat is null then null
                    else jsonb_build_object('lat', new.courier_lat, 'lng', new.courier_lng) end,
    'at', now()
  );

  if tg_op = 'UPDATE' then
    v_moved_only :=
      (new.courier_lat is distinct from old.courier_lat or new.courier_lng is distinct from old.courier_lng)
      and new.status = old.status
      and new.courier_stage is not distinct from old.courier_stage
      and new.courier_id is not distinct from old.courier_id
      and new.eta_at = old.eta_at
      and new.ready_at is not distinct from old.ready_at
      and new.prep_minutes is not distinct from old.prep_minutes
      and new.rating is not distinct from old.rating
      and new.refunded_total = old.refunded_total;
  end if;

  -- Konum güncellemesi sık gelir: yalnızca haritası olanlara gider
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

create trigger orders_broadcast after insert or update on public.orders
  for each row execute function app_private.broadcast_order();

create or replace function app_private.broadcast_offer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object(
    'id', new.id, 'orderId', new.order_id, 'courierId', new.courier_id,
    'status', new.status, 'at', now());
begin
  perform app_private.emit('courier:' || new.courier_id, 'offer_changed', v_payload);
  perform app_private.emit('admin:ops', 'offer_changed', v_payload);
  return null;
end $$;

create trigger delivery_offers_broadcast after insert or update on public.delivery_offers
  for each row execute function app_private.broadcast_offer();

create or replace function app_private.broadcast_courier() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_payload jsonb;
begin
  if tg_op = 'UPDATE'
     and new.online = old.online and new.status = old.status
     and new.lat = old.lat and new.lng = old.lng and new.rating = old.rating then
    return null;
  end if;
  v_payload := jsonb_build_object(
    'id', new.id, 'online', new.online, 'status', new.status,
    'point', jsonb_build_object('lat', new.lat, 'lng', new.lng), 'at', now());
  perform app_private.emit('admin:ops', 'courier_changed', v_payload);
  perform app_private.emit('courier:' || new.id, 'courier_changed', v_payload);
  return null;
end $$;

create trigger couriers_broadcast after update on public.couriers
  for each row execute function app_private.broadcast_courier();

create or replace function app_private.broadcast_support_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object(
    'id', new.id, 'sessionId', new.session_id, 'role', new.role, 'at', new.at);
begin
  perform app_private.emit('support:' || new.session_id, 'support_message', v_payload);
  perform app_private.emit('admin:support', 'support_message', v_payload);
  return null;
end $$;

create trigger support_messages_broadcast after insert on public.support_messages
  for each row execute function app_private.broadcast_support_message();

create or replace function app_private.broadcast_support_session() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object('id', new.id, 'status', new.status, 'at', now());
begin
  perform app_private.emit('support:' || new.id, 'support_session', v_payload);
  perform app_private.emit('admin:support', 'support_session', v_payload);
  return null;
end $$;

create trigger support_sessions_broadcast after insert or update on public.support_sessions
  for each row execute function app_private.broadcast_support_session();

create or replace function app_private.broadcast_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.emit('user:' || new.user_id, 'notification',
    jsonb_build_object('id', new.id, 'title', new.title, 'at', new.created_at));
  return null;
end $$;

create trigger notifications_broadcast after insert on public.notifications
  for each row execute function app_private.broadcast_notification();

create or replace function app_private.broadcast_restaurant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.emit('restaurant:' || new.id, 'restaurant_changed',
    jsonb_build_object('id', new.id, 'at', now()));
  return null;
end $$;

create trigger restaurants_broadcast after update on public.restaurants
  for each row execute function app_private.broadcast_restaurant();

create or replace function app_private.broadcast_media() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object('id', new.id, 'status', new.status, 'at', now());
begin
  perform app_private.emit('restaurant:' || new.restaurant_id, 'media_changed', v_payload);
  perform app_private.emit('admin:ops', 'media_changed', v_payload);
  return null;
end $$;

create trigger media_requests_broadcast after insert or update on public.media_requests
  for each row execute function app_private.broadcast_media();

create or replace function app_private.broadcast_payout() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object('id', new.id, 'status', new.status, 'at', now());
begin
  perform app_private.emit(
    case when new.kind = 'vendor' then 'restaurant:' else 'courier:' end || new.target_id,
    'payout_changed', v_payload);
  perform app_private.emit('admin:ops', 'payout_changed', v_payload);
  return null;
end $$;

create trigger payouts_broadcast after insert or update on public.payouts
  for each row execute function app_private.broadcast_payout();

create or replace function app_private.broadcast_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.emit('restaurant:' || new.restaurant_id, 'review_changed',
    jsonb_build_object('id', new.id, 'at', now()));
  return null;
end $$;

create trigger reviews_broadcast after insert or update on public.reviews
  for each row execute function app_private.broadcast_review();

-- ---------------------------------------------------------------------
-- Realtime yetkisi
--
-- Oturum JWT'sindeki app_metadata {role, sid, rid} sunucu tarafından
-- (service role) yazılır, kullanıcı değiştiremez. Politika her kanala
-- katılımda bir kez değerlendirilir.
-- ---------------------------------------------------------------------

create or replace function app_private.realtime_can_listen(p_topic text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_claims jsonb := coalesce(auth.jwt(), '{}'::jsonb);
  v_role   text  := v_claims -> 'app_metadata' ->> 'role';
  v_sid    text  := v_claims -> 'app_metadata' ->> 'sid';
  v_rid    text  := v_claims -> 'app_metadata' ->> 'rid';
  v_kind   text  := split_part(p_topic, ':', 1);
  v_key    text  := substr(p_topic, length(split_part(p_topic, ':', 1)) + 2);
begin
  if v_role is null or v_sid is null or v_key = '' then
    return false;
  end if;

  if v_role = 'admin' then
    return exists (select 1 from public.admins a where a.id = v_sid);
  end if;

  if v_kind = 'order' then
    return exists (
      select 1 from public.orders o
       where o.id = v_key
         and ((v_role = 'customer' and o.user_id = v_sid)
           or (v_role = 'courier' and o.courier_id = v_sid)
           or (v_role = 'vendor' and o.restaurant_id = v_rid))
    );
  elsif v_kind = 'restaurant' then
    return v_role = 'vendor' and v_key = v_rid and exists (
      select 1 from public.vendor_members m where m.id = v_sid and m.restaurant_id = v_rid
    );
  elsif v_kind = 'courier' then
    return v_role = 'courier' and v_key = v_sid;
  elsif v_kind = 'user' then
    return v_role = 'customer' and v_key = v_sid and not exists (
      select 1 from public.profiles p where p.id = v_sid and p.blocked
    );
  elsif v_kind = 'support' then
    return v_role = 'customer' and exists (
      select 1 from public.support_sessions s where s.id = v_key and s.user_id = v_sid
    );
  end if;

  return false;
end $$;

grant usage on schema app_private to authenticated;
revoke all on function app_private.realtime_can_listen(text) from public;
grant execute on function app_private.realtime_can_listen(text) to authenticated;

drop policy if exists "sofra: yetkili kanallar" on realtime.messages;
create policy "sofra: yetkili kanallar" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and app_private.realtime_can_listen((select realtime.topic()))
  );

-- ---------------------------------------------------------------------
-- Kurye dağıtımı (dispatcher) — pg_cron her 5 saniyede bir çalıştırır
--
--  1. Süresi dolan teklifleri kapatır.
--  2. Hazırlanan ve kurye bekleyen siparişi, vardiyadaki en yakın boş
--     kuryeye 45 saniyelik teklif olarak gönderir. Reddeden ya da süresi
--     dolan kuryeye aynı sipariş 2 dakika boyunca tekrar gönderilmez.
--  3. Demo modunda: vardiyada hiç kurye yoksa teslimatı simülasyon üstlenir.
--     Vardiyada kurye varken sipariş asla kendiliğinden ilerlemez.
-- ---------------------------------------------------------------------

create or replace function app_private.route_point(
  p_route jsonb, p_t double precision,
  out lat double precision, out lng double precision
) language plpgsql immutable set search_path = '' as $$
declare
  n int := coalesce(jsonb_array_length(p_route), 0);
  s double precision;
  i int;
  f double precision;
begin
  if n = 0 then
    return;
  end if;
  if n = 1 then
    lat := (p_route -> 0 ->> 'lat')::float8;
    lng := (p_route -> 0 ->> 'lng')::float8;
    return;
  end if;
  s := least(greatest(p_t, 0), 1) * (n - 1);
  i := least(floor(s)::int, n - 2);
  f := s - i;
  lat := (p_route -> i ->> 'lat')::float8
       + ((p_route -> (i + 1) ->> 'lat')::float8 - (p_route -> i ->> 'lat')::float8) * f;
  lng := (p_route -> i ->> 'lng')::float8
       + ((p_route -> (i + 1) ->> 'lng')::float8 - (p_route -> i ->> 'lng')::float8) * f;
end $$;

create or replace function app_private.dispatch_tick() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_demo    boolean := app_private.setting_bool('demo_mode', true);
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

  if not v_demo then
    return;
  end if;

  -- 3a) Demo: vardiyada kurye yoksa hazırlığı biten siparişi simüle kurye alır
  select count(*) into v_online from public.couriers where online and status = 'active';
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

  -- 3b) Demo: simüle teslimatlar rota üzerinde ilerler, varınca teslim edilir
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

revoke all on function app_private.dispatch_tick() from public;

select cron.schedule('sofra-dispatch', '5 seconds', 'select app_private.dispatch_tick()');

-- Süresi geçmiş doğrulama kodlarını her gece temizle
select cron.schedule(
  'sofra-otp-cleanup', '17 3 * * *',
  $$delete from public.otp_challenges where created_at < now() - interval '1 day'$$
);

-- ---------------------------------------------------------------------
-- Fotoğraf deposu: özel bucket. Erişim /media/<dosya> rotasından,
-- onay durumuna göre kontrol edilerek verilir.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 5242880, array['image/webp'])
on conflict (id) do nothing;
