-- =====================================================================
-- Ayarlar hem JSON sayı/boolean hem de JSON metin olarak okunabilsin
--
-- `"12"` gibi metin olarak yazılmış bir değer dağıtım turunu düşürüyordu
-- (jsonb metni numeric'e çevrilemez). Skaler değer önce metne açılır,
-- sonra çevrilir; okunamayan değerde varsayılan kullanılır.
-- =====================================================================

create or replace function app_private.setting_num(p_key text, p_default numeric) returns numeric
language plpgsql stable set search_path = '' as $$
declare
  v_text text;
begin
  select value #>> '{}' into v_text from public.app_settings where key = p_key;
  return coalesce(v_text::numeric, p_default);
exception when others then
  return p_default;
end $$;

create or replace function app_private.setting_bool(p_key text, p_default boolean) returns boolean
language plpgsql stable set search_path = '' as $$
declare
  v_text text;
begin
  select value #>> '{}' into v_text from public.app_settings where key = p_key;
  return coalesce(v_text::boolean, p_default);
exception when others then
  return p_default;
end $$;

-- Metin olarak yazılmış sayısal ayarları gerçek sayıya çevir
update public.app_settings
   set value = to_jsonb((value #>> '{}')::numeric)
 where key = 'sim_speed' and jsonb_typeof(value) = 'string';
