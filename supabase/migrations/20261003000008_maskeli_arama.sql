-- =====================================================================
-- Maskeli arama oturumları
--
-- Kurye ile müşteri birbirinin numarasını görmeden platform hattı
-- üzerinden görüşür. Her arama isteği için sanal numara + dahili kodlu
-- geçici bir oturum açılır; sesli arama sağlayıcısı aramayı yalnızca
-- süresi dolmamış oturum için köprüler.
--
-- * ended_at / duration_seconds: görüşme kaydı (test modunda simülasyon)
-- * Sipariş teslim edilince ya da iptal olunca oturumlar hemen kapanır.
-- * Aynı hat ve dahili kod aynı anda iki açık oturumda kullanılamaz
--   (uygulama yeniden dener).
-- =====================================================================

alter table public.call_sessions
  add column if not exists ended_at timestamptz,
  add column if not exists duration_seconds integer check (duration_seconds is null or duration_seconds >= 0);

create index if not exists call_sessions_proxy_idx
  on public.call_sessions (proxy_number, extension, expires_at);

create or replace function app_private.close_call_sessions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('delivered', 'cancelled') and new.status is distinct from old.status then
    update public.call_sessions
       set expires_at = least(expires_at, now())
     where order_id = new.id and expires_at > now();
  end if;
  return null;
end $$;

drop trigger if exists orders_close_calls on public.orders;
create trigger orders_close_calls after update of status on public.orders
  for each row execute function app_private.close_call_sessions();
