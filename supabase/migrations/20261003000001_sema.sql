-- =====================================================================
-- Sofra — veritabanı şeması
--
-- Tüm iş mantığı Next.js sunucusundaki servislerde çalışır ve veritabanına
-- `postgres` rolüyle bağlanır. Bu yüzden her tabloda RLS açık ama
-- anon/authenticated için hiçbir politika yok: yayınlanan anahtarla Data API
-- üzerinden tek satır bile okunamaz. Tarayıcının doğrudan dokunduğu tek yer
-- Realtime kanallarıdır; onların yetkisi ikinci migrasyondaki politikadadır.
--
-- Kimlikler metin ve önekli (rst_, ord_, usr_ …): API sözleşmesi ve mobil
-- uygulama bu biçimi zaten kullanıyor.
-- =====================================================================

create schema if not exists app_private;
revoke all on schema app_private from public;
alter default privileges in schema app_private revoke execute on functions from public;

-- ---------------------------------------------------------------------
-- Uygulama ayarları (demo modu, simülasyon hızı …)
-- ---------------------------------------------------------------------
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Restoranlar ve menü
-- ---------------------------------------------------------------------
create table public.restaurants (
  id                   text primary key,
  slug                 text not null unique,
  name                 text not null,
  emoji                text not null default '🍽️',
  cover_seed           text not null,
  image                text,
  tags                 text[] not null default '{}',
  description          text not null default '',
  rating               numeric(2,1) not null default 0,
  rating_sum           numeric(12,1) not null default 0,
  rating_count         integer not null default 0,
  eta_min              integer not null check (eta_min > 0),
  eta_max              integer not null check (eta_max >= eta_min),
  min_basket           numeric(10,2) not null default 0 check (min_basket >= 0),
  delivery_fee         numeric(10,2) not null default 0 check (delivery_fee >= 0),
  free_delivery_over   numeric(10,2) check (free_delivery_over >= 0),
  lat                  double precision not null,
  lng                  double precision not null,
  district             text not null,
  delivery_radius_km   numeric(5,1) not null check (delivery_radius_km > 0),
  -- Poligon teslimat bölgesi: [{lat,lng}, …]. Boşsa yarıçap geçerlidir.
  delivery_zone        jsonb,
  working_hours        jsonb not null,
  break_hours          jsonb,
  commission_rate      numeric(5,3) not null default 0.12
                         check (commission_rate >= 0 and commission_rate <= 0.4),
  approval_status      text not null
                         check (approval_status in ('pending','approved','suspended')),
  joined_at            timestamptz not null default now(),
  temporarily_closed   boolean not null default false,
  auto_accept          boolean not null default true,
  default_prep_minutes integer not null default 20
                         check (default_prep_minutes between 5 and 120),
  courier_mode         text not null check (courier_mode in ('platform','vendor')),
  payment_methods      text[] not null,
  badges               text[] not null default '{}',
  -- Öne çıkanlar (Superadmin): küçük sayı önce gelir, boşsa öne çıkmaz
  featured_rank        integer,
  -- Tükenen ürün müşteri menüsünde gizlensin mi, soluk mu görünsün
  sold_out_display     text not null default 'hide'
                         check (sold_out_display in ('hide','dim')),
  updated_at           timestamptz not null default now()
);
create index restaurants_approved_idx on public.restaurants (approval_status);

create table public.menu_categories (
  id            text primary key,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  name          text not null,
  description   text,
  position      integer not null default 0
);
create index menu_categories_restaurant_idx on public.menu_categories (restaurant_id, position);

create table public.products (
  id            text primary key,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  category_id   text not null references public.menu_categories(id) on delete cascade,
  name          text not null,
  description   text not null default '',
  emoji         text not null default '🍽️',
  image         text,
  price         numeric(10,2) not null check (price >= 0),
  old_price     numeric(10,2),
  sold_out      boolean not null default false,
  popular       boolean not null default false,
  -- Varyant/opsiyon ağacı (esnek JSON): tekli/çoklu grup, min/max, fiyat farkı
  option_groups jsonb not null default '[]',
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index products_category_idx on public.products (category_id, position);
create index products_restaurant_idx on public.products (restaurant_id);

-- ---------------------------------------------------------------------
-- Müşteriler
-- ---------------------------------------------------------------------
create table public.profiles (
  id                 text primary key,
  -- Supabase Auth kullanıcısı (oturum, JWT, Realtime yetkisi)
  auth_user_id       uuid unique references auth.users(id) on delete set null,
  name               text not null,
  phone              text unique,
  email              text unique,
  avatar_emoji       text not null default '🧑',
  providers          text[] not null default '{}',
  wallet_balance     numeric(12,2) not null default 0 check (wallet_balance >= 0),
  default_address_id text,
  blocked            boolean not null default false,
  block_reason       text,
  blocked_at         timestamptz,
  created_at         timestamptz not null default now()
);

create table public.addresses (
  id            text primary key,
  user_id       text not null references public.profiles(id) on delete cascade,
  label         text not null check (label in ('ev','is','diger')),
  title         text not null,
  line1         text not null,
  district      text not null,
  city          text not null,
  directions    text,
  building_no   text,
  floor         text,
  apartment_no  text,
  contact_name  text,
  contact_phone text,
  lat           double precision not null,
  lng           double precision not null,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);

alter table public.profiles
  add constraint profiles_default_address_fk
  foreign key (default_address_id) references public.addresses(id) on delete set null;

create table public.favorites (
  user_id       text not null references public.profiles(id) on delete cascade,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);

-- Kart bilgisi saklanmaz: yalnızca marka, son dört hane ve geçit tokenı
create table public.saved_cards (
  id             text primary key,
  user_id        text not null references public.profiles(id) on delete cascade,
  brand          text not null check (brand in ('visa','mastercard','troy')),
  last4          text not null check (last4 ~ '^[0-9]{4}$'),
  holder         text not null,
  expiry         text not null check (expiry ~ '^(0[1-9]|1[0-2])/[0-9]{2}$'),
  nickname       text not null default '',
  provider_token text,
  created_at     timestamptz not null default now()
);
create index saved_cards_user_idx on public.saved_cards (user_id);

-- Cüzdanın her hareketi defterde: bakiye tek başına değil, izi ile tutulur
create table public.wallet_transactions (
  id            bigint generated always as identity primary key,
  user_id       text not null references public.profiles(id) on delete cascade,
  amount        numeric(12,2) not null check (amount <> 0),
  balance_after numeric(12,2) not null check (balance_after >= 0),
  type          text not null check (type in (
                  'welcome','topup','order_payment','order_refund',
                  'tip','admin_credit','admin_debit','manual_refund')),
  label         text not null,
  order_id      text,
  created_at    timestamptz not null default now()
);
create index wallet_transactions_user_idx on public.wallet_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- İşletme, kurye ve yönetici hesapları
-- ---------------------------------------------------------------------
create table public.vendor_members (
  id            text primary key,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  name          text not null,
  email         text not null unique,
  role          text not null default 'owner' check (role in ('owner','staff')),
  created_at    timestamptz not null default now()
);
create index vendor_members_restaurant_idx on public.vendor_members (restaurant_id);

-- Onaylanan başvuruya gönderilen tek kullanımlık panel kurulum bağlantısı
create table public.vendor_invites (
  token_hash       text primary key,
  vendor_member_id text not null references public.vendor_members(id) on delete cascade,
  expires_at       timestamptz not null,
  used_at          timestamptz,
  created_at       timestamptz not null default now()
);

create table public.couriers (
  id                  text primary key,
  auth_user_id        uuid unique references auth.users(id) on delete set null,
  name                text not null,
  emoji               text not null default '🛵',
  vehicle             text not null check (vehicle in ('moto','bisiklet','araba')),
  phone               text not null unique,
  masked_phone        text not null,
  rating              numeric(2,1) not null default 5,
  rating_sum          numeric(12,1) not null default 0,
  rating_count        integer not null default 0,
  total_deliveries    integer not null default 0,
  online              boolean not null default false,
  shift_started_at    timestamptz,
  lat                 double precision not null,
  lng                 double precision not null,
  home_lat            double precision not null,
  home_lng            double precision not null,
  location_updated_at timestamptz,
  status              text not null default 'pending'
                        check (status in ('pending','active','suspended')),
  created_at          timestamptz not null default now()
);

create table public.admins (
  id           text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name         text not null,
  email        text not null unique,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Kampanyalar ve vitrin
-- ---------------------------------------------------------------------
create table public.coupons (
  code             text primary key check (code = upper(code)),
  type             text not null check (type in ('percent','amount','free_delivery')),
  value            numeric(10,2) not null check (value >= 0),
  title            text not null,
  description      text not null default '',
  min_subtotal     numeric(10,2) not null default 0,
  max_discount     numeric(10,2),
  restaurant_ids   text[],
  first_order_only boolean not null default false,
  expires_at       timestamptz not null,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create table public.banners (
  id       text primary key,
  title    text not null,
  subtitle text not null default '',
  code     text,
  emoji    text not null default '🎉',
  image    text,
  gradient text[] not null check (array_length(gradient, 1) = 2),
  href     text not null default '/',
  active   boolean not null default true,
  position integer not null default 0
);

-- ---------------------------------------------------------------------
-- Siparişler
-- ---------------------------------------------------------------------
create table public.orders (
  id                 text primary key,
  code               text not null unique,
  user_id            text not null references public.profiles(id),
  restaurant_id      text not null references public.restaurants(id),
  -- Sipariş anındaki restoran bilgisi (restoran sonradan değişse de doğru kalır)
  restaurant_name    text not null,
  restaurant_slug    text not null,
  restaurant_emoji   text not null,
  restaurant_image   text,
  restaurant_lat     double precision not null,
  restaurant_lng     double precision not null,
  commission_rate    numeric(5,3) not null,
  -- Adresin ve satırların anlık görüntüsü
  address            jsonb not null,
  lines              jsonb not null,
  subtotal           numeric(10,2) not null,
  delivery_fee       numeric(10,2) not null,
  discount           numeric(10,2) not null default 0,
  service_fee        numeric(10,2) not null,
  wallet_used        numeric(10,2) not null default 0,
  grand_total        numeric(10,2) not null check (grand_total >= 0),
  -- Yapılan iadelerin toplamı: tutarı hiçbir zaman aşamaz
  refunded_total     numeric(10,2) not null default 0,
  payment_method     text not null check (payment_method in (
                       'online_card','card_on_delivery','cash_on_delivery','meal_card','wallet')),
  payment_label      text not null,
  coupon_code        text,
  preferences        jsonb not null,
  status             text not null check (status in (
                       'pending_approval','preparing','on_the_way','delivered','cancelled')),
  courier_mode       text not null check (courier_mode in ('platform','vendor')),
  courier_id         text references public.couriers(id),
  courier            jsonb,
  courier_stage      text check (courier_stage in (
                       'unassigned','offered','assigned','at_restaurant','picked_up','delivered')),
  courier_arrived_at timestamptz,
  courier_fee        numeric(10,2),
  courier_lat        double precision,
  courier_lng        double precision,
  courier_route      jsonb,
  -- Demo modunda vardiyada kurye yoksa teslimatı simülasyon üstlenir
  simulated          boolean not null default false,
  ready_at           timestamptz,
  approved_at        timestamptz,
  picked_up_at       timestamptz,
  prep_minutes       integer,
  travel_minutes     integer not null,
  eta_at             timestamptz not null,
  delivered_at       timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text,
  cancelled_by       text check (cancelled_by in ('user','vendor','support')),
  rating             jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint orders_refund_cap check (refunded_total >= 0 and refunded_total <= grand_total)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_restaurant_idx on public.orders (restaurant_id, created_at desc);
create index orders_courier_idx on public.orders (courier_id) where courier_id is not null;
create index orders_active_idx on public.orders (status)
  where status in ('pending_approval','preparing','on_the_way');

-- Zaman çizelgesi: yalnızca eklenir, hiç güncellenmez
create table public.order_events (
  id       bigint generated always as identity primary key,
  order_id text not null references public.orders(id) on delete cascade,
  status   text not null,
  note     text,
  at       timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, at);

create table public.coupon_redemptions (
  id          bigint generated always as identity primary key,
  user_id     text not null references public.profiles(id) on delete cascade,
  code        text not null,
  order_id    text references public.orders(id) on delete set null,
  at          timestamptz not null default now(),
  -- Sipariş iptal edilirse kupon kullanıcıya geri verilir
  released_at timestamptz
);
create index coupon_redemptions_user_idx on public.coupon_redemptions (user_id, code);

-- Ödeme kayıtları (şimdilik simüle geçit). Ödeme geçidi raporu buradan üretilir.
create table public.payments (
  id              text primary key,
  order_id        text references public.orders(id) on delete set null,
  user_id         text not null references public.profiles(id),
  provider        text not null default 'simulated',
  method          text not null,
  purpose         text not null default 'order' check (purpose in ('order','wallet_topup')),
  amount          numeric(12,2) not null check (amount >= 0),
  refunded_amount numeric(12,2) not null default 0,
  status          text not null check (status in (
                    'captured','failed','refunded','partially_refunded',
                    'pending_collection','collected','voided')),
  card_brand      text,
  card_last4      text,
  meal_card_brand text,
  provider_ref    text,
  failure_reason  text,
  created_at      timestamptz not null default now(),
  constraint payments_refund_cap check (refunded_amount >= 0 and refunded_amount <= amount)
);
create index payments_created_idx on public.payments (created_at);
create index payments_order_idx on public.payments (order_id);

-- ---------------------------------------------------------------------
-- Kurye operasyonu
-- ---------------------------------------------------------------------
create table public.delivery_offers (
  id           text primary key,
  order_id     text not null references public.orders(id) on delete cascade,
  courier_id   text not null references public.couriers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  responded_at timestamptz,
  status       text not null default 'pending'
                 check (status in ('pending','accepted','rejected','expired')),
  fee          numeric(10,2) not null,
  pickup_km    numeric(6,1) not null,
  dropoff_km   numeric(6,1) not null
);
create index delivery_offers_courier_idx on public.delivery_offers (courier_id, created_at desc);
create index delivery_offers_order_idx on public.delivery_offers (order_id);
-- Bir kuryede ve bir siparişte aynı anda tek bekleyen teklif
create unique index delivery_offers_pending_courier on public.delivery_offers (courier_id)
  where status = 'pending';
create unique index delivery_offers_pending_order on public.delivery_offers (order_id)
  where status = 'pending';

create table public.courier_earnings (
  id               text primary key,
  courier_id       text not null references public.couriers(id) on delete cascade,
  order_id         text not null unique references public.orders(id) on delete cascade,
  order_code       text not null,
  restaurant_name  text not null,
  fee              numeric(10,2) not null check (fee >= 0),
  tip              numeric(10,2) not null default 0 check (tip >= 0),
  distance_km      numeric(6,1) not null,
  duration_minutes integer not null,
  at               timestamptz not null default now()
);
create index courier_earnings_courier_idx on public.courier_earnings (courier_id, at desc);

-- Maskeli arama oturumu: iki taraf birbirinin numarasını görmez
create table public.call_sessions (
  id           text primary key,
  order_id     text not null references public.orders(id) on delete cascade,
  caller_role  text not null check (caller_role in ('customer','courier')),
  proxy_number text not null,
  extension    text not null,
  provider     text not null default 'test',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index call_sessions_order_idx on public.call_sessions (order_id);

-- ---------------------------------------------------------------------
-- Hakediş, değerlendirme, destek, bildirim
-- ---------------------------------------------------------------------
create table public.payouts (
  id           text primary key,
  kind         text not null check (kind in ('vendor','courier')),
  target_id    text not null,
  target_name  text not null,
  -- Haftanın pazartesisi (İstanbul saatiyle)
  period_key   date not null,
  period_label text not null,
  orders       integer not null default 0,
  gross        numeric(12,2) not null default 0,
  commission   numeric(12,2) not null default 0,
  tips         numeric(12,2) not null default 0,
  net          numeric(12,2) not null default 0,
  status       text not null default 'pending' check (status in ('pending','approved','paid')),
  approved_at  timestamptz,
  approved_by  text,
  paid_at      timestamptz,
  created_at   timestamptz not null default now()
);
-- Bir hedefin her haftasında en fazla bir açık (bekleyen) hakediş
create unique index payouts_one_pending on public.payouts (kind, target_id, period_key)
  where status = 'pending';
create index payouts_target_idx on public.payouts (kind, target_id, period_key desc);

create table public.reviews (
  id            text primary key,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  order_id      text unique references public.orders(id) on delete set null,
  user_id       text references public.profiles(id) on delete set null,
  user_name     text not null,
  score         smallint not null check (score between 1 and 5),
  comment       text,
  at            timestamptz not null default now(),
  reply         text,
  replied_at    timestamptz
);
create index reviews_restaurant_idx on public.reviews (restaurant_id, at desc);

create table public.support_sessions (
  id                text primary key,
  user_id           text not null references public.profiles(id) on delete cascade,
  order_id          text references public.orders(id) on delete set null,
  status            text not null default 'bot'
                      check (status in ('bot','waiting_agent','with_agent','closed')),
  topic             text,
  assigned_admin_id text references public.admins(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  closed_at         timestamptz
);
create index support_sessions_user_idx on public.support_sessions (user_id, updated_at desc);
create index support_sessions_queue_idx on public.support_sessions (status, updated_at);

create table public.support_messages (
  id            text primary key,
  session_id    text not null references public.support_sessions(id) on delete cascade,
  role          text not null check (role in ('bot','user','agent','system')),
  author_name   text,
  text          text not null,
  quick_replies jsonb,
  at            timestamptz not null default now()
);
create index support_messages_session_idx on public.support_messages (session_id, at);

-- Uygulama içi bildirim kutusu (push izni olmasa da kampanya buradan ulaşır)
create table public.notifications (
  id          text primary key,
  user_id     text not null references public.profiles(id) on delete cascade,
  title       text not null,
  body        text not null,
  href        text,
  campaign_id text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id              text primary key,
  user_id         text not null references public.profiles(id) on delete cascade,
  kind            text not null default 'web' check (kind in ('web','expo')),
  endpoint        text not null unique,
  p256dh          text,
  auth            text,
  user_agent      text,
  failure_count   integer not null default 0,
  last_success_at timestamptz,
  created_at      timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.push_campaigns (
  id              text primary key,
  title           text not null,
  body            text not null,
  href            text,
  segment         text not null check (segment in ('all','active','lapsed','new')),
  districts       text[] not null default '{}',
  recipient_count integer not null default 0,
  push_sent       integer not null default 0,
  push_failed     integer not null default 0,
  sent_by         text,
  sent_at         timestamptz not null default now()
);

create table public.audit_log (
  id     bigint generated always as identity primary key,
  actor  text not null,
  action text not null,
  target text not null,
  detail text,
  at     timestamptz not null default now()
);
create index audit_log_at_idx on public.audit_log (at desc);

-- ---------------------------------------------------------------------
-- Restoran başvuruları ve fotoğraf talepleri
-- ---------------------------------------------------------------------
create table public.partner_applications (
  id               text primary key,
  code             text not null unique,
  business_name    text not null,
  cuisine          text not null,
  city             text not null,
  district         text not null,
  address          text not null,
  lat              double precision not null,
  lng              double precision not null,
  branch_count     integer not null default 1,
  contact_name     text not null,
  phone            text not null,
  email            text not null,
  tax_number       text,
  has_own_courier  boolean not null default false,
  monthly_orders   text,
  note             text,
  status           text not null default 'received'
                     check (status in ('received','approved','rejected')),
  created_at       timestamptz not null default now(),
  decided_at       timestamptz,
  rejection_reason text,
  restaurant_id    text not null references public.restaurants(id) on delete cascade
);

create table public.media_requests (
  id                text primary key,
  restaurant_id     text not null references public.restaurants(id) on delete cascade,
  target_kind       text not null check (target_kind in ('cover','product')),
  target_product_id text,
  target_name       text not null,
  storage_path      text not null,
  url               text not null unique,
  width             integer not null,
  height            integer not null,
  bytes             integer not null,
  note              text,
  status            text not null default 'pending'
                      check (status in ('pending','approved','rejected')),
  created_at        timestamptz not null default now(),
  decided_at        timestamptz,
  decided_by        text,
  reject_reason     text
);
create index media_requests_restaurant_idx on public.media_requests (restaurant_id, created_at desc);
create index media_requests_status_idx on public.media_requests (status, created_at);

-- ---------------------------------------------------------------------
-- Tek kullanımlık doğrulama kodları (kodun kendisi değil özeti saklanır)
-- ---------------------------------------------------------------------
create table public.otp_challenges (
  id          text primary key,
  purpose     text not null check (purpose in ('customer','courier')),
  channel     text not null check (channel in ('phone','email')),
  target      text not null,
  code_hash   text not null,
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  ip          text,
  created_at  timestamptz not null default now()
);
create index otp_challenges_target_idx on public.otp_challenges (target, created_at desc);

-- ---------------------------------------------------------------------
-- RLS: hepsi açık, hiçbirinde anon/authenticated politikası yok
-- ---------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;
