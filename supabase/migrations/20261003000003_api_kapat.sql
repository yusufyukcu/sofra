-- =====================================================================
-- Data API'yi kapat
--
-- Uygulama veritabanına yalnızca sunucudan bağlanır. RLS politikası
-- olmadığı için anon/authenticated zaten satır göremiyordu; varsayılan
-- tablo yetkileri de kaldırılınca GraphQL tanıtımı (introspection) tablo
-- ve kolon adlarını da gösteremez. İleride bir tablo bilinçli olarak
-- açılacaksa yetki ve politika birlikte, tablo bazında verilir.
-- =====================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
