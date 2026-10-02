-- =====================================================================
-- Bildirim kutusu ve web push
--
-- * notifications.kind: order | campaign | system
-- * notifications.push_sent_at: push gönderim kuyruğu. Uygulama gönderilmemiş
--   bildirimleri atomik olarak "üstlenip" tarayıcılara iletir; aynı bildirim
--   iki kez gönderilmez.
-- * Sipariş durumu değişince müşteriye bildirim yazılır (tetikleyici).
--   Böylece dağıtım fonksiyonunun (pg_cron) ilerlettiği siparişler de
--   kaçmaz. Mevcut broadcast_notification tetikleyicisi Realtime ile
--   `user:<id>` kanalına anında yayınlar.
-- =====================================================================

alter table public.notifications
  add column if not exists kind text not null default 'system'
    check (kind in ('order', 'campaign', 'system')),
  add column if not exists push_sent_at timestamptz;

update public.notifications set kind = 'campaign' where campaign_id is not null;
-- Mevcut bildirimler için push gönderilmesin
update public.notifications set push_sent_at = coalesce(push_sent_at, created_at);

create index if not exists notifications_push_queue_idx
  on public.notifications (created_at) where push_sent_at is null;
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

create or replace function app_private.notify_order_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_title   text;
  v_body    text;
  v_courier text;
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    return null;
  end if;

  if new.status = 'preparing' then
    v_title := 'Siparişin hazırlanıyor';
    v_body := new.restaurant_name || ' siparişini onayladı'
      || case when new.prep_minutes is not null then ', hazırlık yaklaşık ' || new.prep_minutes || ' dk.' else '.' end;
  elsif new.status = 'on_the_way' then
    select c.name into v_courier from public.couriers c where c.id = new.courier_id;
    v_title := 'Siparişin yolda';
    v_body := coalesce(split_part(v_courier, ' ', 1) || ' siparişini teslim aldı, ', 'Siparişin teslim alındı, ')
      || 'haritadan takip edebilirsin.';
  elsif new.status = 'delivered' then
    v_title := 'Afiyet olsun!';
    v_body := new.restaurant_name || ' siparişin teslim edildi. Deneyimini puanlamayı unutma.';
  elsif new.status = 'cancelled' then
    v_title := 'Siparişin iptal edildi';
    v_body := new.code || ' numaralı siparişin iptal edildi'
      || case when new.cancel_reason is not null and new.cancel_reason <> '' then ': ' || new.cancel_reason else '.' end;
  else
    return null; -- onay bekliyor: müşteri zaten sipariş ekranında
  end if;

  insert into public.notifications (id, user_id, title, body, href, kind)
  values (app_private.new_id('ntf'), new.user_id, v_title, v_body, '/siparis/' || new.id, 'order');
  return null;
end $$;

drop trigger if exists orders_notify_status on public.orders;
create trigger orders_notify_status after insert or update of status on public.orders
  for each row execute function app_private.notify_order_status();

-- Realtime yayınına bildirim türü eklensin
create or replace function app_private.broadcast_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.emit('user:' || new.user_id, 'notification',
    jsonb_build_object('id', new.id, 'title', new.title, 'body', new.body,
                       'href', new.href, 'kind', new.kind, 'at', new.created_at));
  return null;
end $$;
