-- =====================================================================
-- Kupon kullanıcı başına bir kez (veritabanı güvencesi)
--
-- Servis "bu kuponu daha önce kullandı mı" diye bakıyor; aynı anda gelen
-- iki sipariş bu kontrolü birlikte geçebilirdi. İptalle serbest bırakılan
-- (released_at dolu) kullanım sayılmaz, kupon yeniden kullanılabilir.
-- =====================================================================

create unique index if not exists coupon_redemptions_active_once
  on public.coupon_redemptions (user_id, code)
  where released_at is null;
