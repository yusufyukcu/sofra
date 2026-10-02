-- =====================================================================
-- Teslim anında kapıda ödeme "tahsil edildi" olur
--
-- Sipariş hangi yoldan teslim edilirse edilsin (kurye, restoran kuryesi,
-- demo simülasyonu) aynı tetikleyiciden geçer: restoran hakedişi tahakkuk
-- eder ve kapıda ödemenin kaydı tahsil edildiye döner.
-- =====================================================================

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

    update public.payments
       set status = 'collected'
     where order_id = new.id and status = 'pending_collection';
  end if;
  return null;
end $$;
