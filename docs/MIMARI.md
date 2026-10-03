# Mimari Notları

Bu belge sistemin bugünkü hâlini anlatır: Next.js uygulaması + Supabase
backend'i (Postgres, Auth, Realtime, Storage, pg_cron) + Expo mobil
uygulaması. API sözleşmesi [`API.md`](API.md), kurulum ve demo hesapları
[`../README.md`](../README.md) içinde.

---

## 1. Genel bakış

```
┌────────────┐   ┌────────────┐   ┌──────────────────────────────────────────┐
│ Web (4 rol)│   │ Mobil      │   │ Supabase                                 │
│ Next.js UI │   │ Expo / RN  │   │                                          │
└─────┬──────┘   └─────┬──────┘   │  Postgres 17 ── tetikleyiciler ──┐       │
      │ çerez          │ Bearer   │     ▲   │  (hakediş, bildirim,  │       │
      ▼                ▼          │     │   │   arama kapanışı,     │       │
┌─────────────────────────────┐   │     │   │   Realtime yayını)    ▼       │
│ Next.js /api/v1 (Vercel)    │───┼─────┘   └─ pg_cron (dağıtım) Realtime ─┼──► tarayıcı
│ services/ → db/ (postgres-js)│  │  Auth ◄── oturum                Storage│
└─────────────────────────────┘   └──────────────────────────────────────────┘
```

İlkeler:

1. **Veriye yalnızca sunucu erişir.** Tarayıcı ve mobil, veritabanına değil
   API'ye konuşur. Tüm tablolarda RLS açık, hiçbir politika yok; `anon` ve
   `authenticated` rollerinin tablo yetkileri kaldırıldı (Data API kapalı).
   Sunucu, Postgres'e servis kimliğiyle bağlanır.
2. **İstemciye güvenilmez.** Fiyat, kupon, teslimat bölgesi, stok, ödeme
   yöntemi ve durum geçişleri sunucuda yeniden doğrulanır (§4).
3. **İş kuralı tek yerde.** Fiyat/kupon hesabı, keşif filtreleri, sepet
   kuralları ve biçimlendiriciler `packages/core` içinde; web ve mobil aynı
   dosyayı kullanır. Zamanla ilerleyen işler (kurye dağıtımı, hakediş
   tahakkuku, bildirim) veritabanında; uygulama sunucusu durumsuz kalır.
4. **Realtime "bir şey değişti" der, veri API'den gelir.** Yayın yükü
   küçüktür; ekran olayı alınca ilgili GET ucunu yeniden çeker.

---

## 2. Katmanlar

```
app/                    Sayfalar (sunucu + istemci bileşenleri) ve /api/v1 uçları
  api/v1/**/route.ts    İnce: kimlik → servis çağrısı → { ok, data } zarfı
lib/services/           İş akışları (sipariş, kurye, işletme, yönetici, destek…)
lib/db/                 client (postgres-js) · queries · mappers · settings
lib/auth/               Rol oturumları (Supabase Auth)
supabase/migrations/    Şema, fonksiyonlar, tetikleyiciler, politikalar, cron
packages/core/          Alan modeli + saf kurallar + API istemcisi + tasarım jetonları
```

- **Uç noktalar** `handle()` ile sarılır: `DomainError` → kendi kodu ve
  durumu; Postgres `23505` (benzersizlik) → 409 `conflict`, `23514` (kısıt)
  → 409; beklenmeyen hata üretimde ayrıntısız 500. Yanıt gönderildikten sonra
  `after()` ile web push kuyruğu boşaltılır (§11).
- **Servisler** domain kurallarını taşır; çok adımlı işler tek
  `sql.begin` işlemi içinde, sıra/çakışma gereken satırlar `for update`
  ile kilitlenir.
- **Veri erişimi** `postgres-js` ile: Supavisor **transaction pooler**
  (6543, `prepare: false`), sütun adları snake ↔ camel otomatik, `numeric`
  ve `bigint` sayıya çevrilir. Migrasyonlar oturum havuzunu (5432) kullanır.

---

## 3. Veritabanı

### 3.1 Migrasyonlar

`supabase/migrations/*.sql` sırayla uygulanır (`npm run db:migrate`);
uygulananlar `supabase_migrations.schema_migrations` tablosunda izlenir
(Supabase CLI ile uyumlu). Yardımcı fonksiyonlar API'ye açık olmayan
`app_private` şemasında durur.

| Dosya | İçerik |
|---|---|
| `…0001_sema` | 33 tablo, kısıtlar, dizinler, RLS |
| `…0002_fonksiyonlar` | Yardımcılar, hakediş tahakkuku, Realtime yayınları ve politikası, kurye dağıtımı, cron, Storage bucket |
| `…0003_api_kapat` | `anon` / `authenticated` tablo yetkileri kaldırılır |
| `…0004_tahsilat` | Kapıda ödeme teslimatta tahsil edildi sayılır |
| `…0005_ayar_okuma` | Ayarlar JSON sayı/metin olarak okunabilir |
| `…0006_bos_guncelleme` | Değişmeyen sipariş güncellemesi yayın üretmez |
| `…0007_bildirimler` | Bildirim türü, push kuyruğu, sipariş durum bildirimi tetikleyicisi |
| `…0008_maskeli_arama` | Görüşme kaydı, siparişle kapanan arama oturumları |
| `…0009_kupon_tek_kullanim` | Kupon kullanıcı başına bir kez (eşzamanlı siparişe karşı) |
| `…0010_gercek_dagitim` | Demo varsayılan kapalı, kurye varlığı (taze konum), hayalet kurye temizliği |

### 3.2 Tablolar

| Alan | Tablolar |
|---|---|
| Katalog | `restaurants` (bölge: yarıçap + `delivery_zone` poligonu, `featured_rank`, `sold_out_display`, `default_prep_minutes`, puan toplamı), `menu_categories`, `products` (`option_groups` JSON) |
| Hesaplar | `profiles` (müşteri), `couriers`, `vendor_members`, `vendor_invites`, `admins` — her biri `auth_user_id` ile Supabase Auth'a bağlı |
| Müşteri | `addresses`, `favorites`, `saved_cards` (yalnızca marka/son 4/son kullanma/sahte token), `wallet_transactions` (defter) |
| Sipariş | `orders` (komisyon oranı sipariş anında dondurulur, `refunded_total` ≤ tutar kısıtı), `order_events`, `coupon_redemptions`, `payments` |
| Kurye | `delivery_offers` (kurye başına tek bekleyen teklif), `courier_earnings`, `call_sessions` |
| Finans | `payouts` (dönem/hedef başına tek bekleyen kayıt) |
| Etkileşim | `reviews`, `support_sessions`, `support_messages`, `notifications`, `push_subscriptions`, `push_campaigns` |
| Yönetim | `coupons`, `banners`, `partner_applications`, `media_requests`, `audit_log`, `app_settings`, `otp_challenges` |

Para tutarları `numeric(10,2)` / `numeric(12,2)`. Değişken yapılar (opsiyon ağacı, adres
anlık görüntüsü, sepet satırları, poligon) `jsonb`; sipariş, verildiği
andaki adres ve satırları kopyalar — menü sonradan değişse de fiş değişmez.

### 3.3 Kısıtlar son savunma hattı

Servis kontrolleri aynı anda gelen iki istekte birlikte geçebilir; tutarlılığı
veritabanı korur:

- `orders.refunded_total <= grand_total` — iade üst sınırı
- `delivery_offers`: kurye başına ve sipariş başına tek `pending` teklif
- `payouts`: tür + hedef + dönem başına tek `pending` satır
- `coupon_redemptions`: kullanıcı + kupon başına tek aktif kullanım (iptalle serbest kalan sayılmaz)

### 3.4 Ayarlar

`app_settings` anahtar/değer: `demo_mode` (varsayılan **kapalı**),
`sim_speed`. Dağıtım fonksiyonu da buradan okur; değer yönetici panelinden
değişir (5 sn önbellek). İstemciler `GET /api/v1/config` ile demo modunu ve
hangi servislerin test modunda olduğunu öğrenir.

---

## 4. Güvenlik: istemciye güvenilmez

`POST /api/v1/orders` yalnızca `productId`, seçilen `optionIds`, adet ve not
alanlarını kullanır. Fiyat, ad ve toplamlar **menüden yeniden hesaplanır**
(`packages/core` → `validateCart`, `computeTotals`). Sunucu ayrıca:

- Zorunlu opsiyon grupları ve min/max sınırları, tükenen ürün/opsiyon
- Restoran onaylı ve açık mı, adres **teslimat bölgesinde** mi (poligon varsa
  poligon, yoksa yarıçap)
- Minimum sepet, kupon (süre, restoran, ilk sipariş, tekrar kullanım)
- Ödeme yöntemi restoranca kabul ediliyor mu, cüzdan yetiyor mu, online
  ödemede kayıtlı kart var mı

Diğer kurallar:

- **Kuryeye müşterinin telefonu gönderilmez** (`toCourierView`); iletişim
  maskeli hat üzerinden (§12).
- **Onaysız restoran** listede, aramada ve detayda görünmez (API 404).
- Üretimde iç hata ayrıntısı (SQL vb.) istemciye dönmez; demo parolası
  giriş ekranlarında yalnızca geliştirmede gösterilir.
- Korumalı sayfalar ağ sınırında (`proxy.ts`) kontrol edilir; oturumsuz
  istek `…/giris?devam=…` adresine yönlendirilir.

---

## 5. Kimlik (Supabase Auth)

### 5.1 Dört rol, dört oturum

| Rol | Giriş | Çerez | En uzun oturum |
|---|---|---|---|
| Müşteri | Telefon/e-posta + kod, sosyal (test), demo | `sofra-auth-musteri` | Supabase varsayılanı |
| İşletme | E-posta + parola (kurulum bağlantısıyla belirlenir) | `sofra-auth-isletme` | 12 saat |
| Kurye | Telefon + kod | `sofra-auth-kurye` | 12 saat |
| Yönetici | E-posta + parola | `sofra-auth-yonetim` | 4 saat |

Her rol ayrı `httpOnly`, `SameSite=Lax`, üretimde `Secure` çerez kullanır;
dört oturum aynı tarayıcıda birbirini düşürmeden durur. JWT'nin
`app_metadata` alanı rolü (`role`), uygulama kimliğini (`sid`) ve işletmede
restoranı (`rid`) taşır. Sunucu JWT'yi `getClaims()` ile yerelde doğrular
(ES256, JWKS). Yanlış rolün hesabıyla giriş (`wrong_account_type`) ve süre
aşımı (oturumun `amr` zamanına göre) reddedilir.

### 5.2 Kod (OTP) servisi

Müşteri ve kurye Supabase'in e-posta/SMS akışını değil, kendi kod
servisimizi kullanır: 6 haneli kod HMAC ile saklanır, 3 dakika geçerlidir,
5 yanlış denemede kilitlenir, aynı hedefe 15 dakikada en fazla 5 kod
gönderilir. Doğrulanınca oturum sunucuda açılır: hesabın iç e-postası
(`customer.<id>@auth.sofra.invalid`) için `admin.generateLink(magiclink)` →
`verifyOtp(token_hash)`. Böylece telefonla giriş için Supabase'te SMS
sağlayıcısı gerekmez.

### 5.3 Mobil

Mobil Bearer token kullanır; girişte erişim token'ı (1 saat), yenileme
token'ı ve bitiş anı döner. `POST /api/v1/auth/refresh` yenisini verir
(rol değişmez). Mobil, bitime 2 dakika kala ya da 401'de yenileyip isteği
bir kez tekrarlar (`packages/core` → `refreshOnUnauthorized`).

### 5.4 Kara liste ve kurulum bağlantısı

- Engellenen müşterinin Auth hesabı yasaklanır (ban); açık oturumu anında
  geçersiz olur, yeniden giriş yapamaz.
- Restoran başvurusu onaylanınca işletme hesabı açılır ve tek kullanımlık
  kurulum bağlantısı üretilir (`/isletme-kurulum?anahtar=…`, karması
  saklanır). E-posta sağlayıcısı bağlanana kadar bağlantı yöneticiye gösterilir.

---

## 6. Ürün varyantları — esnek model

“JSON tabanlı veya esnek ilişkisel model” önerisi tek bir yapıyla karşılanır
(`products.option_groups jsonb`):

```ts
interface OptionGroup {
  id: string;
  name: string;                  // "Boyut", "Malzemeler", "Ekstralar"
  type: "single" | "multi";      // radio | checkbox
  required: boolean;
  minSelect?: number;
  maxSelect?: number;
  options: {
    id: string;
    name: string;
    priceDelta: number;          // 0 = ücretsiz, negatif = indirim
    default?: boolean;
    soldOut?: boolean;           // panelden anlık stok kapatma
  }[];
}
```

Tekli seçim (boyut, pişirme), çoklu seçim (malzemeler, istemediklerim),
ücretli ekstralar (`priceDelta > 0`), indirimli seçenek (`< 0`) ve sınırlı
çoklu seçim (`minSelect`/`maxSelect`) bu tek modelle ifade edilir. Birim
fiyat = ürün fiyatı + seçilenlerin `priceDelta` toplamı.

---

## 7. Sipariş yaşam döngüsü

```
pending_approval ──onay──► preparing ──kurye teslim aldı──► on_the_way ──► delivered
        │                     │
        └──────── iptal ──────┴──► cancelled
```

- **Otomatik onay** açık restoranda sipariş doğrudan `preparing` başlar
  (varsayılan hazırlık süresiyle).
- **İptal** (`lifecycle.cancelOrderTx`) tek işlemde: açık teklifleri
  kapatır, kuponu serbest bırakır, online ödemede kalan tutarı **bir kez**
  cüzdana iade eder, kapıda ödemeyi düşürür; kurye üzerindeki iş kalkar.
- **Teslim** (`on_order_delivered` tetikleyicisi): kapıda ödeme tahsil
  edildi sayılır, restoran ve kurye hakedişi tahakkuk eder (§10).
- **Manuel iade** (yönetici): `refunded_total` kalan tutarla sınırlı; ödeme
  kaydı `partially_refunded` / `refunded` olur; tutar cüzdana gider.
- **Cüzdan defteri:** her hareket (`topup`, `spend`, `refund`, `tip`,
  `credit`, `debit`) bakiyeyle birlikte yazılır; bakiye ile defter tutar.

Saatler **İstanbul** takvimine göredir (`APP_TIME_ZONE`): çalışma saatleri,
gün/hafta/ay anahtarları ve hakediş dönemleri sunucunun saat diliminden
bağımsızdır.

---

## 8. Kurye dağıtımı (veritabanında)

`app_private.dispatch_tick()` **pg_cron ile her 5 saniyede** çalışır;
uygulama da sipariş hazır olunca hemen çağırır (`dispatchNow`). Aynı anda
tek tur çalışır (advisory lock).

1. Süresi dolan teklifler kapanır, sipariş yeniden teklif bekler.
2. Hazırlanan ve kuryesi olmayan platform siparişi, vardiyadaki **en yakın
   boş kuryeye** (Haversine) 45 saniyelik teklif olarak gider. Yalnızca
   **konumu son 5 dakikada gelmiş** kurye aday olur; elinde iş ya da bekleyen
   teklif olan kurye atlanır; aynı siparişi son 2 dakikada reddeden/kaçıran
   kurye ona tekrar seçilmez. Ücret mesafeden hesaplanır.
3. Önceden başlamış simüle teslimatlar (demo kapatılmış olsa da) tamamlanır.
4. **Demo (sunum) modu — varsayılan kapalı:** açıkken vardiyada hiç kurye
   yoksa hazırlık süresi dolan siparişi simüle kurye alır, rota üzerinde
   ilerletir ve teslim eder; süreler `sim_speed` kat hızlıdır.

**Kurye varlığı.** Kurye mesaiyi cihazın konumuyla açar (`POST /courier/shift`
`point`); mesaideyken uygulama konumu teslimatta 3 sn, beklerken 15 sn'de bir
gönderir, kurye dururken de dakikada bir son konumu yeniden yollar
(`location_updated_at` tazelenir, yayın üretmez). `app_private.expire_idle_couriers()`
**her dakika** çalışır: 15 dakikadır sinyal gelmeyen ve elinde teslimat
olmayan kurye mesaiden düşer, bekleyen teklifleri kapanır.

Kabul (`acceptOffer`) teklifin hâlâ geçerli ve siparişin hâlâ boşta
olduğunu kilit altında doğrular; iki kurye aynı siparişi alamaz.

---

## 9. Gerçek zaman (Supabase Realtime)

### 9.1 Yayınlar

Tetikleyiciler `realtime.send(payload, event, topic, private => true)` ile
**özel** kanallara küçük olaylar gönderir:

| Kanal | Olaylar | Dinleyen |
|---|---|---|
| `order:<id>` | `order_changed`, `courier_moved` | Siparişin müşterisi (kuryesi, restoranı) |
| `restaurant:<id>` | `order_changed`, `restaurant_changed`, `review_changed`, `media_changed`, `payout_changed` | O restoranın işletme hesabı |
| `courier:<id>` | `offer_changed`, `order_changed`, `courier_changed` (mesai/durum), `payout_changed` | O kurye |
| `user:<id>` | `notification` | O müşteri |
| `support:<id>` | `support_message`, `support_session` | Konuşmanın müşterisi |
| `admin:ops` | sipariş/teklif/kurye/medya/hakediş olayları | Yöneticiler |
| `admin:support` | destek olayları | Yöneticiler |

Kim hangi kanalı dinleyebilir, `realtime.messages` üzerindeki politika
(`app_private.realtime_can_listen`) JWT'nin `app_metadata` bilgisiyle
belirler. Konum güncellemesi yalnızca haritası olanlara (`order:`,
`admin:ops`) gider; **değişmeyen** bir güncelleme hiç yayın üretmez
(aynı noktayı tekrar gönderen kurye tüm ekranları yeniden çektirmez).

### 9.2 Tarayıcı istemcisi — `lib/realtime.ts`

- Rol başına **tek WebSocket bağlantısı**; aynı kanalı dinleyen ekranlar
  tek aboneliği paylaşır (referans sayımı, 1,5 sn bırakma gecikmesi —
  sayfa geçişinde ve React StrictMode'da yeniden katılma olmaz).
- Token, `GET /api/v1/realtime/token?rol=` ucundan alınır: `httpOnly`
  çerezdeki oturumun erişim token'ı (JavaScript yenileme token'ını görmez).
  Bitimine 5 dakika kala sunucu oturumu yeniler, istemci yenisini alır.
- Token supabase-js'e **`accessToken` geri çağrısıyla** verilir.
  `realtime.setAuth(token)` ile elle verilen token, supabase-js'in kendi geri
  çağrısı tarafından ilk abonelikten sonra anonim anahtarla eziliyor ve aynı
  bağlantıdaki ikinci kanal reddediliyordu. Katılma da token hazır olunca yapılır.
- Kanal koparsa (ağ, token süresi, henüz açılmamış günlük bölüm) artan
  aralıkla yeniden denenir; yetki hatasında önce token yenilenir.

Ekranlar (`useRealtime`): müşteri takibi, işletme panosu, kurye ekranı,
canlı operasyon, destek konsolu ve müşteri sohbeti, bildirim zili. Her biri
olay gelince ilgili GET ucunu (birleştirerek) çeker; bağlantı yoksa
**yoklama yedeği** sıklaşır (canlıyken 15–30 sn, değilken 4–5 sn).

> Realtime, `realtime.messages` tablosunun günlük bölümlerini ilk istemci
> bağlandığında açar. Uzun süre boş kalan projede günün ilk aboneliği
> `MissingPartition` alabilir; istemci birkaç saniye sonra yeniden dener.

---

## 10. Hakediş ve finans

- **Tahakkuk tetikleyicide:** sipariş teslim edilince restoranın haftalık
  hakedişine (brüt − komisyon), kurye kazancı yazılınca kuryenin hakedişine
  eklenir (`app_private.accrue_payout`).
- **Onaylanan hafta donar:** onaylanmış ya da ödenmiş döneme sonradan gelen
  tutar kaybolmaz; aynı dönem için “· ek” etiketli yeni bekleyen satır açılır.
- **Akış:** `pending → approved → paid` (yönetici); restoran ve kurye
  ekranları aynı satırı gösterir.
- **Yönetici finansı:** GMV, net gelir = komisyon + hizmet bedeli +
  platform teslimat ücreti − kurye ödemeleri − indirimler − geçit
  komisyonu − manuel iadeler; ödeme geçidi raporu yöntem bazında hacim,
  kesinti, iade ve valör.

---

## 11. Bildirimler ve Web Push

1. **Yazma:** sipariş durumu değişince `orders_notify_status` tetikleyicisi
   müşteriye bildirim yazar (hazırlanıyor, yolda, teslim, iptal). Kampanya
   bildirimlerini yönetici paneli toplu yazar. Dağıtım fonksiyonunun
   ilerlettiği siparişler de kaçmaz.
2. **Anında:** `notifications` tetikleyicisi `user:<id>` kanalına yayınlar;
   açık sekmede zil sayacı artar ve kısa uyarı görünür.
3. **Cihaza (Web Push / VAPID):** her API yanıtından sonra (`after()`, en
   fazla 2 sn'de bir) `flushPushOutbox` gönderilmemiş bildirimleri tek bir
   `UPDATE … WHERE id IN (… FOR UPDATE SKIP LOCKED) RETURNING` ile atomik
   olarak üstlenir ve kullanıcının tarayıcılarına gönderir — aynı bildirim
   iki kez gitmez. 15 dakikadan eski bildirim gönderilmez. Geçersiz abonelik
   (404/410) silinir, art arda 5 hatada da.
4. **Abonelik:** kullanıcı “Tarayıcı bildirimlerini aç” dediğinde izin
   istenir, `public/sw.js` kaydedilir, abonelik `POST /api/v1/push` ile
   saklanır. Anahtarlar her ortamda ayrıdır (yerel, önizleme, üretim);
   anahtar yoksa push kapalı, bildirim kutusu çalışır.

Mobil için `push_subscriptions.kind = 'expo'` hazırdır; Expo Notifications
bağlanınca aynı kuyruk kullanılır.

---

## 12. Maskeli arama

Kurye ile müşteri birbirinin numarasını görmeden görüşür:

1. Arayan taraf `POST …/call` ister; sunucu sipariş sahipliğini ve aşamayı
   doğrular, **sanal numara + 4 haneli dahili kod** ile 30 dakikalık oturum
   açar (`call_sessions`). Müşteri kuryenin maskeli hattını, kurye platform
   hatlarından birini arar; aynı hat ve dahili kod iki açık oturumda
   kullanılmaz, açık oturum tekrar istenirse aynısı döner.
2. İstemci `tel:+90850…,<dahili>` bağlantısıyla arar (virgül = bekle ve tuşla).
   Sesli arama sağlayıcısı oturuma bakıp karşı tarafa köprüler.
3. Sipariş teslim edilince ya da iptal olunca oturumlar tetikleyiciyle kapanır.

**Test modu** (`SOFRA_VOICE_PROVIDER` boş): oturum ve görüşme süresi gerçek
kaydedilir, arama ekranda simüle edilir. Gerçek numaralar hiçbir yanıtta
yer almaz. Demo simülasyonundaki simüle kurye de aranabilir.

---

## 13. Ödeme simülasyonu ve kayıtlı kartlar

- Kart eklenirken numara Luhn ile, son kullanma ve güvenlik kodu biçimle
  doğrulanır; **saklanan:** marka, son 4 hane, ad, son kullanma ve sağlayıcı
  token'ı. Numara ve güvenlik kodu saklanmaz.
- Gerçek ödeme kuruluşu bağlanana kadar yalnızca yayımlanmış **test
  kartları** kabul edilir (gerçek kart bilgisi sisteme hiç girmez). Token
  sahtedir; "reddedilir" test kartı bankanın onaylamadığı ödemeyi taklit
  eder (402 `card_declined`).
- Online sipariş ve cüzdana yükleme kayıtlı karttan çekilir; ödeme kaydı
  kart markası ve son 4 haneyle yazılır. Sipariş etiketi kart hanesi
  içermez (restoran ve kurye görmez).
- Gerçek sağlayıcıya geçişte değişen yer: `lib/services/cards.ts`
  (`addCard` tokenizasyonu, `chargeCard` tahsilatı).

---

## 14. Destek

Kural tabanlı asistan sık soruları gerçek veriyle yanıtlar (sipariş nerede,
iptal, kurye ile iletişim). Çözemediği konular (eksik/yanlış ürün, fatura,
temsilci talebi) konuşmayı `waiting_agent` durumuna alır; asistan
yapmadığı bir şeyi vaat etmez. Yönetici konsolunda temsilci konuşmayı
üstlenir (`with_agent`), yazar, kuyruğa bırakır ya da kapatır; her adım
müşterinin sohbetine Realtime ile anında düşer. Kapanmış konuşmaya müşteri
yazarsa asistan yeniden devreye girer.

---

## 15. Dosyalar (Supabase Storage)

Restoran fotoğrafları özel `media` bucket'ında durur ve `/media/[file]`
ucundan erişim kontrolüyle sunulur. Yeni fotoğraf `media_requests` kaydıyla
yönetici onayına gider; onaylanınca yayına girer, reddedilirse gerekçe
panelde görünür.

---

## 16. Keşif (filtreleme) mantığı

`packages/core/src/discovery.ts` saf fonksiyonlardır; anasayfa (istemci),
`/api/v1/restaurants` (mobil) ve testler aynı kodu çalıştırır.

- `decorate()` — konuma göre mesafe, ETA, **teslimat bölgesi içinde mi**
  (poligon varsa nokta-çokgen testi, yoksa yarıçap) ve favori
- `filterAndSort()` — kategori, arama, puan, süre, min sepet, açık,
  ücretsiz teslimat; varsayılan olarak bölge dışındakiler listelenmez (`bolge=0`)
- **Öne çıkanlar** yönetimin verdiği sırayla, yalnızca o adrese teslim edenler

Anasayfa: sunucu restoranları menüsüz gönderir → istemci seçili adrese göre
anlık filtreler → filtreler URL'e yazılır.

---

## 17. Mobil uygulama

### 17.1 Taşıma katmanı

| Konu | Web | Mobil |
|---|---|---|
| Kimlik | `httpOnly` çerez | Bearer + yenileme token'ı, cihazın güvenli alanında |
| Canlı veri | Realtime | Aynı GET uçlarını yoklama (takip 2 sn, kurye 3 sn); arka planda durur |
| Harita | Leaflet | OSM karoları + `react-native-svg` |
| Kurye konumu | Tarayıcı konum servisi (izin zorunlu) | Cihaz GPS'i (`expo-location`, izin zorunlu) |

Yoklama tek bir kancada (`mobile/src/lib/use-live.ts`); Realtime'ın mobile
taşınması yalnızca bu kancayı değiştirir. Kurye ve müşteri oturumları ayrı
token, ayrı "oturum düştü" işleyicisiyle çalışır.

### 17.2 Harita: karoları kendimiz döşüyoruz

`expo-maps` Expo Go'da yok, `react-native-maps` native derleme gerektiriyor.
Bunun yerine ince bir harita: Web Mercator projeksiyonu ve `fitZoom`,
`expo-image` ile OpenStreetMap karoları (web ile aynı kaynak),
`react-native-svg` ile rota ve işaretçiler. Tek kod iOS, Android ve webde
Expo Go'da çalışır; sürükleme yok, harita noktalara kendini oturtur.

### 17.3 Türkçe büyük harf ve ₺

CSS `text-transform: uppercase` belge diline bakar ("TESLIMAT"); `Text`
bileşeni `label` varyantında metni `toLocaleUpperCase("tr")` ile kendisi
büyütür. Geist ve Bricolage Grotesque'te ₺ glifi yok; webde aile adının
arkasına sistem yığını eklenir.

---

## 18. Doğrulama

- `npm run typecheck`, `npm run build` (üretim derlemesi), mobilde `tsc` ve
  Metro ile iOS/Android paket derlemesi
- `npm run test:unit` — ortak API istemcisinin oturum yenileme davranışı
- `npm run test:e2e` — gerçek API, veritabanı ve Realtime'a karşı 8 dosya:
  dört rolün akışları, sipariş hataları, demo simülasyonu, başvuru, Realtime
  kanal yetkileri, işletme/yönetici panelleri, kart/bildirim/push/maskeli
  arama ve Realtime istemci modülü ([`../tests/README.md`](../tests/README.md))
