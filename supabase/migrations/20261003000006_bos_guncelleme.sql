-- =====================================================================
-- Değişmeyen sipariş satırı yayın üretmesin
--
-- Kurye aynı konumu yeniden bildirdiğinde (hedefte beklerken ya da GPS
-- sabitken) satır değişmeden güncelleniyor, tetikleyici bunu tam bir
-- `order_changed` olayı sanıp müşteri, restoran, kurye ve yönetici
-- ekranlarının hepsini yeniden çektiriyordu. Artık yalnızca `updated_at`
-- farkı olan güncellemeler sessizce geçilir.
-- =====================================================================

create or replace function app_private.broadcast_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_payload    jsonb;
  v_moved_only boolean := false;
begin
  -- Hiçbir alanı değişmeyen güncelleme (yalnızca updated_at) yayın üretmez
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
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
