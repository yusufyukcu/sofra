# Sofra — Yemek Siparişi Platformu

Kapsamlı sistem analizindeki **dört modülün tamamı**, **mobil uygulama** ve
**gerçek bir backend** (Supabase) hazır:

| # | Modül | Adres |
|---|---|---|
| 1 | **Customer App** — müşteri web uygulaması | `/` |
| 2 | **Vendor Dashboard** — restoran paneli | `/isletme` |
| 3 | **Courier App** — kurye uygulaması | `/kurye` |
| 4 | **Superadmin Dashboard** — yönetici paneli | `/yonetim` |
| 5 | **Mobil uygulama** — iOS & Android (Expo), müşteri + kurye | `mobile/` |
| — | **Backend** — Supabase: Postgres, Auth, Realtime, Storage, pg_cron | `supabase/` |

Tüm istemciler aynı `/api/v1` uç noktalarını kullanır. Web kimliği
`httpOnly` çerezde, mobil kimliği cihazın güvenli alanında taşır; sunucu
ikisini de kabul eder.

---

## Hızlı başlangıç

Gereken: Node.js 22+, Vercel hesabı (Supabase, Vercel Marketplace üzerinden
bağlı: `sofra-db`).

```bash
npm install
npx vercel link              # bir kez: yerel klasörü Vercel projesine bağla
npx vercel env pull          # Supabase bağlantı bilgileri → .env.local
npm run db:migrate           # şema, fonksiyonlar, tetikleyiciler, Realtime politikası, pg_cron
npm run db:seed              # katalog + demo hesapları (parola .env.development.local'a yazılır)
npm run dev                  # http://localhost:3000
```

| Giriş | Adres | Nasıl |
|---|---|---|
| Müşteri | `/giris` | Telefon + doğrulama kodu. Hazır demo hesabı: **555 111 22 33** (kayıtlı adres, 2 kart, 450 ₺ cüzdan) |
| Restoran | `/isletme/giris` | `<restoran-adresi>@sofra.app` + demo parolası (ör. `kasap-burger-co@sofra.app`) |
| Kurye | `/kurye/giris` | Telefon **532 111 00 01–04** + doğrulama kodu (05 onay bekleyen kurye). Mesaiye başlamak **konum izni** ister |
| Yönetici | `/yonetim/giris` | `yonetim@sofra.app` + demo parolası |

**Demo parolası** README'de durmaz: `npm run db:seed` rastgele üretir ve
yalnızca yerel `.env.development.local` dosyasına `SOFRA_DEMO_PASSWORD`
olarak yazar (git'e girmez). Üretim derlemesinde giriş ekranlarında gösterilmez.

**SMS / e-posta test modunda:** doğrulama kodu gönderilmez, ekranda gösterilir.

Üretim derlemesi:

```bash
npm run build && npm start
```

### Mobil uygulama

Web sunucusu çalışırken ayrı bir terminalde:

```bash
cd mobile
npm install
npx expo start      # w = tarayıcı · i = iOS · a = Android · QR = Expo Go
```

Ayrıntılar: [`mobile/README.md`](mobile/README.md)

---

## 1 · Müşteri Uygulaması

### Kimlik doğrulama & profil
- Telefon **(OTP)**, e-posta (OTP), **Google / Apple** (test modunda sabit profil)
- **Supabase Auth** oturumu: web'de `httpOnly` çerez, mobilde erişim + yenileme token'ı
- Birden fazla teslimat adresi, **harita üzerinden pin ile konum seçimi**
- Pin durduğunda ters coğrafi kodlama ile mahalle/cadde/ilçe otomatik dolar
- Favori restoranlar, sipariş geçmişi, **“Tekrar Sipariş Ver”**

### Keşif (anasayfa)
- Kullanıcının konumuna göre teslimat bölgesi filtresi — restoranın
  **yarıçapı ya da çizdiği poligon**
- Dinamik kampanya afişleri, yönetimin seçtiği **“Öne çıkanlar”** şeridi
- Kalıcı **“Sofra'da restoranın olsun”** afişi — başvuru ve durum sorgusu
- 16 mutfak kategorisi
- Filtreler: **minimum sepet tutarı, teslimat süresi, puan, mesafe**,
  “şu an açık”, “ücretsiz teslimat”; URL'e yazılır (`/?kategori=burger&sirala=eta`)

### Restoran & menü
- Kategorilere ayrılmış menü + yapışkan navigasyon, menü içi arama
- **Varyant ve ekstra ağacı:** tekli/çoklu seçim, **ücretli ekstralar**,
  min/max seçim sınırları (esnek JSON yapısı, sunucuda yeniden doğrulanır)
- Ürün özelinde sipariş notu; değerlendirmeler, puan dağılımı, restoran yanıtları
- Tükenen ürün restoranın tercihine göre **soluk görünür ya da gizlenir**

### Sepet & ödeme
- Tek restoran kuralı, **minimum sepet tutarı**, **promosyon kodu**
- **Temassız teslimat**, **zile basma**, çatal-bıçak, kurye notu
- Ödeme: **online kart (kayıtlı kartla)**, kapıda nakit / kart, **yemek
  kartları**, **platform cüzdanı**. Ödeme geçidi simülasyonda: yalnızca
  test kartları kabul edilir, kart numarası saklanmaz
- Cüzdan defteri: yükleme (karttan), harcama, iade, bahşiş — bakiye ve
  hareketler her zaman tutar

### Sipariş takibi & satış sonrası
- Canlı durum: **Onay bekliyor → Hazırlanıyor → Yolda → Teslim edildi**
- **Supabase Realtime** ile anında güncelleme (bağlantı koparsa yoklama yedeği)
- **Kurye canlı harita takibi:** kurye konumu kuryenin cihazından gelir ve
  işaretçi yolda akarak ilerler; çizgi, yol tarifi servisinden (OSRM) gelen
  **gerçek yoldur** — önce kurye → restoran, sonra kurye → adres, kurye
  saparsa bulunduğu yerden yenisi. Kalan mesafe ve süre kuryenin önündeki
  yoldan hesaplanır; konum 90 sn'dir gelmiyorsa ekran bunu söyler
- **Maskeli arama:** müşteri kuryeyi platform hattından arar, iki taraf da
  birbirinin numarasını görmez (test modunda simülasyon)
- Sipariş iptali → online ödemede kalan tutar cüzdana bir kez iade
- **Restoran ve kurye için ayrı puanlama** + yorum + **kuryeye bahşiş**
- **Bildirim kutusu + tarayıcı bildirimleri (Web Push):** sipariş durumu
  ve kampanyalar, uygulama kapalıyken de
- **Canlı destek:** asistan sık soruları gerçek veriyle yanıtlar, çözemezse
  temsilciye aktarır; temsilcinin yanıtı anında sohbete düşer

---

## 2 · Restoran Paneli (`/isletme`)

Mutfakta tablet üzerinde kullanılmak üzere tasarlandı: koyu yan menü,
geniş dokunma hedefleri ve her ekranda **siparişe açık/kapalı** ile **zil**.

### Sipariş yönetimi
- **Canlı pano** (Realtime): Onay bekliyor · Hazırlanıyor · Yolda · Kapananlar
- Yeni siparişte **sesli + görsel bildirim** (Web Audio), bekleyen sipariş
  kalmayana dek 5 sn'de bir
- **Onayla** (hazırlık süresiyle) · **Reddet** (neden seçimli, online ödemede
  tutar müşterinin cüzdanına iade) · **Süreyi güncelle**
- Kendi kuryesi olan restoran için **Yola çıktı / Teslim edildi**
- **Sipariş geçmişi** (`/isletme/gecmis`): durum ve tarih aralığı süzgeçli,
  sayfalı; ürünler, iptal nedeni ve değerlendirme

### Menü & stok
- Kategori ve ürün ekle/düzenle/sil, sıralama, kampanyalı eski fiyat
- **Fotoğraf yükleme** — yönetici onayından sonra yayına girer (Supabase Storage, özel bucket)
- **Varyant/opsiyon ağacı düzenleyici**
- **Anlık stok kapatma** — ürün ve **tek malzeme** düzeyinde

### Mağaza ayarları
- Çalışma saatleri + **gün ortası molası**, minimum sepet, teslimat ücreti,
  ücretsiz teslimat eşiği, kabul edilen ödeme yöntemleri
- **Teslimat bölgesi: yarıçap ya da haritada poligon çizimi** (köşe ekle,
  sürükle, sil; yarıçaptan başlat)
- **Varsayılan hazırlık süresi**, **tükenen ürün: soluk göster / gizle**
- **Yoğunlukta siparişe kapat**, **otomatik onay** anahtarları

### Finans & raporlama
- Günlük / haftalık / aylık ciro grafiği (net hakediş + komisyon yığılı)
- **Haftalık hakediş** — teslimatla anında tahakkuk eder; onaylanan haftaya
  sonradan gelen sipariş kaybolmaz, ayrı “ek” kayıt açılır
- En çok ciro getiren ürünler, tablo görünümü

### Değerlendirmeler
- Puan dağılımı, cevapsız yorum sayacı, filtreler, **cevap yazma**

---

## 3 · Kurye Uygulaması (`/kurye`)

Telefonda tek elle kullanım: tek sütun, büyük birincil düğme, her ekranda
mesai anahtarı.

- **Telefon + doğrulama koduyla giriş**; onaysız kurye mesai açamaz
- **Mesai konumla başlar:** konum izni olmadan mesai açılmaz; mesaideyken
  cihazın gerçek konumu paylaşılır (teslimatta 3 sn, beklerken 15 sn'de bir,
  dururken de dakikada bir "buradayım" sinyali)
- **Gerçek atama:** siparişi yalnızca mesaideki, konumu son 5 dakikada
  gelmiş kuryeler alır; 15 dakikadır sinyal gelmeyen kurye (elinde teslimat
  yoksa) otomatik olarak mesaiden düşer — "hayalet" kurye kalmaz
- **Mesai başlatma / bitirme** (açık teslimat varken kapatılamaz)
- **Teklif:** en yakın boş kuryeye 45 saniyelik teklif, geri sayım cihazda;
  reddeden ya da süresi dolan kurye 2 dk tekrar teklif almaz. Dağıtımı
  veritabanında **pg_cron** her 5 saniyede bir çalıştırır
- **Aşamalar:** Restorana vardım → Teslim aldım (müşteride “Yolda”) →
  Teslim ettim (kazanç ve hakediş yazılır)
- **Maskeli arama** — müşterinin numarası kuryeye hiç gönderilmez
- **Konum** — müşterinin haritasına Realtime ile gider; aynı nokta tekrar
  gönderilirse yayın yapılmaz. Kapalı alandaki sapmalı GPS okumaları
  (doğruluk > 100 m) yakın zamanda iyi konum varsa gönderilmez
- **Yol rotası ve kalan süre** haritada; navigasyon düğmesi Google
  Haritalar'ı açar. Webde teslimat sürerken ekran kararmaz (tarayıcı arka
  plandaki sekmenin konumunu göndermez); kilit ekranında da çalışan takip
  mobil uygulamadadır
- **Kazanç, bahşiş, hakediş** ve **performans** (süre, kabul oranı, puan)

---

## 4 · Yönetici Paneli (`/yonetim`)

Her manuel işlem iz kaydına yazılır.

- **Restoran onayı** (başvurudan panele: onay → kurulum bağlantısı →
  işletme parolasını kendisi belirler), komisyon oranı, öne çıkarma
- **Görsel onayları**, **kurye aktivasyonu / askıya alma**
- **Kara liste** — engellenen müşterinin oturumu anında düşer (Auth ban)
- **Canlı operasyon** (Realtime): harita + liste, gecikme alarmı,
  “kurye bekleniyor” işareti, manuel iptal ve iade, **demo girişleri anahtarı**
- **Siparişler & iade** (`/yonetim/siparisler`): kod, ad ya da telefonla
  arama; **teslim edilmiş siparişe kısmi/tam iade** (kalan tutarla sınırlı)
- **Canlı destek konsolu** (`/yonetim/destek`): temsilci bekleyen
  konuşmalar, üstlen / yaz / kuyruğa bırak / kapat, müşterinin son siparişleri
- **Pazarlama:** promosyon kodları, afişler, **push kampanyası** (segment +
  bölge, hedef kitle sayacı) → bildirim kutusu + tarayıcı bildirimi
- **Finans:** GMV, net gelir kırılımı (iadeler dâhil), ödeme geçidi raporu
  (iade sütunu), **hakediş onay akışı** `Onay bekliyor → Onaylandı → Ödendi`

---

## 5 · Mobil Uygulama (`mobile/`)

Expo SDK 57 + React Native. **Müşteri ve kurye** tek projede; kurye modu
Hesabım ekranından açılır ve ayrı oturum kullanır.

- **Müşteri:** keşif (öne çıkanlar + hızlı filtreler), restoran ve menü,
  sepet, ödeme (kayıtlı kart / kart ekleme), canlı takip, maskeli arama,
  değerlendirme + bahşiş, **adres ekleme (GPS)**, **kartlarım**,
  **bildirimler**, **canlı destek**
- **Kurye:** telefon + kodla giriş, mesai, 45 sn teklif, aktif teslimat,
  maskeli arama, gerçek GPS ile konum — **geliştirme/mağaza derlemesinde
  arka planda da** (ekran kilitliyken, navigasyondayken), kazanç ve performans
- **Oturum:** erişim + yenileme token'ı cihazın güvenli alanında; süre
  dolmadan ya da 401'de otomatik yenilenir

| Konu | Web | Mobil |
|---|---|---|
| Kimlik | `httpOnly` çerez (Supabase Auth) | Bearer + yenileme token'ı, Keychain / EncryptedSharedPreferences |
| Canlı veri | Supabase Realtime (özel kanallar) | Aynı GET uçlarını yoklama (2–3 sn), arka planda durur |
| Harita | Leaflet | OpenStreetMap karoları + `react-native-svg` |
| Kurye konumu | Tarayıcı konumu (sekme açıkken) | Cihazın GPS'i (`expo-location`); derlemede arka planda da, Expo Go'da yalnızca açıkken |

### Paylaşılan çekirdek — `packages/core`

Alan modeli, fiyat/kupon hesabı, keşif filtreleri, sepet kuralları,
biçimlendiriciler, API istemcisi ve **tasarım jetonları** web ve mobilde
aynı dosyadan okunur. Palet ayrışması denetlenir: `npm run check:theme`.

### Marka, ikonlar ve fotoğraflar

- **Logo** — "buharlı kâse": kâseden yükselen buhar Sofra'nın "S"sini çizer.
  Geometri `packages/core/src/brand.ts` içinde tek yerde; web
  (`components/brand/logo.tsx`), mobil (`mobile/src/components/brand/logo.tsx`)
  ve uygulama simgeleri aynı ölçüleri kullanır. İşaret değişirse
  `npm run brand:assets` favicon'u, PWA ve iOS/Android simgelerini ve açılış
  görselini yeniden üretir.
- **İkonlar** — arayüzde emoji yok; Lucide ikonları kullanılır. Hangi kavramın
  hangi ikonla çizileceği (sipariş durumu, ödeme yöntemi, adres etiketi,
  mutfak) `packages/core/src/icons.ts` içinde ad olarak tutulur, iki istemci
  aynı adı kendi Lucide paketinden çizer. Veri modelindeki `emoji` alanları
  API uyumu için duruyor, gösterilmiyor. Kişiler baş harfli avatarla görünür.
- **Yemek fotoğrafları** — `public/images/food` altında, Creative Commons
  lisanslı (Openverse: Flickr, Wikimedia Commons, Rawpixel). Hepsine aynı
  renk işlemesi uygulandı (sıcaklık, doygunluk, kontrast, yerel kontrast,
  keskinlik, hafif vinyet); atıflar `lib/image-credits.ts` →
  `/gorsel-kaynaklari`. Mobil uygulama aynı dosyaları web sunucusundan
  `expo-image` ile önbelleğe alarak gösterir; fotoğrafı olmayan ürünlerde
  mutfağa göre renklenen degrade ve mutfak ikonu çizilir.

---

## Mimari özeti

```
Tarayıcı / mobil ──► Next.js (Vercel) /api/v1 ──► Supabase Postgres (postgres-js, sunucu tarafı)
      ▲                    │                         │  tetikleyiciler: hakediş, bildirim,
      │                    │                         │  maskeli hat kapanışı, Realtime yayını
      │                    └─ Supabase Auth ─────────┤  pg_cron: kurye dağıtımı (5 sn)
      └──── Supabase Realtime (özel kanallar) ◄──────┘
```

- **Veri erişimi yalnızca sunucuda.** Tüm tablolarda RLS açık ve politika
  yok; Data API (PostgREST) kapalı. Tarayıcı veritabanına doğrudan erişemez.
- **Realtime:** tetikleyiciler `order:<id>`, `restaurant:<id>`,
  `courier:<id>`, `user:<id>`, `support:<id>`, `admin:ops`, `admin:support`
  kanallarına küçük olaylar yayınlar; kim neyi dinleyebilir veritabanı
  politikası belirler. Ekran olayı alınca güncel veriyi API'den çeker.
- **Kimlik:** dört rol, dört ayrı çerez; JWT `app_metadata` rol ve kimliği
  taşır. Yönetici oturumu 4, işletme/kurye 12 saatte zorunlu yenilenir.

Ayrıntılı mimari ve veri modeli: [`docs/MIMARI.md`](docs/MIMARI.md) ·
API sözleşmesi: [`docs/API.md`](docs/API.md) ·
Mobil: [`mobile/README.md`](mobile/README.md) · Testler: [`tests/README.md`](tests/README.md)

---

## Teknoloji

| Katman | Seçim |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack, `proxy.ts`) |
| Veritabanı | **Supabase Postgres 17** — SQL migrasyonları, `postgres-js` (transaction pooler) |
| Kimlik | **Supabase Auth** (`@supabase/ssr`), kendi OTP servisi (HMAC'li kod, süre ve deneme sınırı) |
| Gerçek zaman | **Supabase Realtime** — özel broadcast kanalları, veritabanı tetikleyicileri |
| Zamanlanmış iş | **pg_cron** — kurye dağıtımı, süresi dolan kod temizliği |
| Dosya | **Supabase Storage** — özel bucket, erişim kontrollü `/media/*` |
| Bildirim | **Web Push (VAPID)** + service worker, gönderim kuyruğu |
| Dil / stil | TypeScript, Tailwind CSS v4, Bricolage Grotesque + Figtree, Lucide ikonları |
| Durum | Zustand (+ persist) |
| Harita | Leaflet + OpenStreetMap (anahtar gerekmez) |
| Mobil | Expo SDK 57, Expo Router, React Native |

---

## Proje yapısı

```
app/                        Next.js sayfaları ve /api/v1 uç noktaları
  isletme/  kurye/  yonetim/   Panel sayfaları (ayrı oturumlar)
  api/v1/                   vendor/ courier/ admin/ + müşteri uçları
supabase/migrations/        SQL: şema, fonksiyonlar, tetikleyiciler, politikalar
scripts/                    db-migrate.ts · db-seed.ts
lib/
  db/                       client (postgres-js) · queries · mappers · settings · seed
  services/                 orders · lifecycle · courier · vendor · admin · support
                            payouts · wallet · cards · calls · notifications · auth …
  auth/                     rol oturumları (Supabase Auth)
  supabase/                 sunucu/istemci yapılandırması
  realtime.ts               tarayıcı Realtime istemcisi (rol başına tek bağlantı)
  push.ts  push-client.ts   Web Push gönderimi ve aboneliği
  messaging/                SMS/e-posta (test modu)
components/                 ui · discovery · order · account · vendor · courier · admin …
packages/core/src/          Paylaşılan çekirdek (web + mobil)
mobile/                     Expo uygulaması
tests/                      birim + uçtan uca testler
public/sw.js                Web Push service worker
```

---

## Yapılandırma

`npx vercel env pull` → `.env.local` (Supabase entegrasyonu yazar):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL` (transaction pooler),
`POSTGRES_URL_NON_POOLING` (migrasyon) …

Yerel ayarlar `.env.development.local` (Vercel bu dosyaya dokunmaz):

| Değişken | Ne işe yarar |
|---|---|
| `SOFRA_DEMO_PASSWORD` | İşletme/yönetici demo hesaplarının parolası (`db:seed` üretir) |
| `SOFRA_ROUTING_URL` | Yol tarifi (OSRM uyumlu; `{profile}` → `car`/`bike`). Boş: herkese açık FOSSGIS sunucusu (yalnızca geliştirme), `off`: kapalı |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` | Web Push anahtarları (yoksa push kapalı, bildirim kutusu çalışır) |
| `SOFRA_SMS_PROVIDER` · `SOFRA_EMAIL_PROVIDER` | Boş/`test` → kod ekranda |
| `SOFRA_VOICE_PROVIDER` | Boş/`test` → maskeli arama simülasyonu |
| `SOFRA_PAYMENT_PROVIDER` | Boş → ödeme simülasyonu, yalnızca test kartları |
| `SOFRA_DB_POOL_MAX` | Sunucu başına veritabanı bağlantısı (varsayılan 5) |
| `NEXT_PUBLIC_SOFRA_ADMIN_PHONES` | Hesap menüsünde "Yönetim paneli" kısayolunu gören telefonlar (virgülle, başında 0 olmadan). Yalnızca kısayol: panel yine yönetici girişi ister |

Vercel'de üretim ve önizleme için ayrı VAPID anahtarları tanımlıdır.

### Veritabanı

```bash
npm run db:migrate              # yeni migrasyonları uygular (supabase_migrations tablosuyla izlenir)
npm run db:seed                 # boş veritabanını doldurur
npm run db:seed -- --reset      # tüm uygulama verisini silip yeniden doldurur
```

> **Dikkat:** Supabase entegrasyonu tek bir veritabanı açar ve üç ortam
> (geliştirme, önizleme, üretim) aynı veritabanını kullanır. Canlıya
> çıkmadan önce geliştirme için ayrı bir Supabase projesi (ya da Supabase
> branching) açman, testleri ve `--reset`'i yalnızca orada çalıştırman önerilir.

### Demo girişleri ve simülasyon

Uygulama **gerçek çalışır** ve teslimat simülasyonu yoktur: siparişi
yalnızca mesaideki kuryeler üstlenir, süreler gerçektir, kurye konumu
kuryenin cihazından, rota yol tarifi servisinden gelir. Mesaide kurye yoksa
sipariş "kurye bekleniyor" durumunda kalır. Yönetici panelindeki **Canlı
operasyon → Demo girişleri (sunum)** anahtarı yalnızca giriş ekranlarında
hazır demo hesaplarını gösterir.

### Yol tarifi (OSRM)

Kuryenin izleyeceği gerçek yol `lib/routing.ts` ile OSRM uyumlu bir
servisten alınır. `SOFRA_ROUTING_URL` boşsa FOSSGIS'in herkese açık sunucusu
kullanılır — saniyede en fazla 1 istek ve ticari olmayan kullanım şartıyla;
geliştirme için yeterli, **canlı için değil**. Canlıya çıkmadan önce kendi
OSRM sunucunu kur (Türkiye OpenStreetMap verisiyle) ve adresini yaz:

```bash
wget https://download.geofabrik.de/europe/turkey-latest.osm.pbf
docker run -t -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/turkey-latest.osm.pbf
docker run -t -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend osrm-partition /data/turkey-latest.osrm
docker run -t -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend osrm-customize /data/turkey-latest.osrm
docker run -p 5000:5000 -v "$PWD:/data" ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld /data/turkey-latest.osrm
# → SOFRA_ROUTING_URL=https://osrm.senin-alanin.com
# Bisikletli kurye için bike.lua ile ikinci bir örnek kurup önüne /car ve /bike
# yolları koyarsan: SOFRA_ROUTING_URL=https://osrm.senin-alanin.com/{profile}
```

Servis yanıt vermezse teslimat akışı etkilenmez: harita çizgisiz kalır,
kalan süre kuş uçuşu mesafeden tahmin edilir.

---

## Hepsini birlikte denemek

Dört sekmeyi yan yana aç — dört oturum aynı tarayıcıda birlikte çalışır.

1. **Yönetici:** `/yonetim/giris` → *Restoranlar*'da onay bekleyen başvuruları,
   *Kullanıcılar → Kuryeler*'de aktivasyon bekleyen kuryeyi gör
2. **Kurye:** `/kurye/giris` → *Elif Şahin* (532 111 00 02) → ekrandaki kod →
   **mesaiyi başlat** (tarayıcı konum izni ister — izin ver)
3. **Restoran:** `/isletme/giris` → *Kasap Burger Co.* → Mağaza'dan
   **otomatik onayı kapat**, üst bardan **zili aç**
4. **Müşteri:** `/giris` → 555 111 22 33 → ekrandaki kod → Kasap Burger Co.'dan sipariş ver
5. Restoran panelinde zil çalar → **Onayla** → kuryeye 45 sn'lik teklif →
   **Siparişi al** → **Restorana vardım / Teslim aldım / Teslim ettim**
6. Müşteri takip ekranında kuryeyi **maskeli hattan ara** (simülasyon),
   **destek**ten temsilci iste → yönetici **Canlı destek**'ten yanıt versin
7. Müşteri **Değerlendir** → puan ver, **bahşiş bırak**
8. Yönetici → **Finans**: hakedişleri **Onayla** → **Ödendi**; restoran ve
   kurye ekranlarında aynı anda görünür

> Mesaide kurye yoksa sipariş "kurye aranıyor" durumunda bekler ve ilk
> müsait kuryeye teklif edilir; yönetici ekranı bunu "kurye bekleniyor"
> olarak işaretler.

### Testler

```bash
npm run test:unit
npm run test:e2e        # sunucu çalışırken; ayrıntı: tests/README.md
```

---

## Test modları ve üretime geçiş

| Konu | Şu an | Üretim için |
|---|---|---|
| SMS / e-posta OTP | Test modu: kod ekranda | `lib/messaging` içine sağlayıcı (Netgsm, Twilio, Resend) + `SOFRA_SMS_PROVIDER` |
| Maskeli arama | Test modu: oturum ve kayıt gerçek, arama simülasyon | Sesli arama sağlayıcısı (Netgsm, Verimor, Twilio Proxy) + `SOFRA_VOICE_PROVIDER` |
| Online ödeme | Simülasyon: test kartları, sahte token | Ödeme kuruluşu (iyzico, PayTR, Stripe) tokenizasyonu + 3D Secure, `SOFRA_PAYMENT_PROVIDER` |
| Apple / Google girişi | Sabit profille simülasyon | Supabase Auth OAuth sağlayıcıları |
| Web push | Gerçek (VAPID) | — |
| Mobil push | Bildirim kutusu (uygulama içi) | Expo Notifications + EAS (`push_subscriptions.kind = 'expo'` hazır) |
| Mobil canlı veri | Yoklama | Realtime'ın mobile taşınması (yalnızca `use-live.ts` değişir) |
| Veritabanı ortamları | Tek veritabanı | Geliştirme için ayrı Supabase projesi / branching |
| Yol tarifi | Herkese açık OSRM (FOSSGIS): saniyede 1 istek, ticari kullanım yok | Kendi OSRM sunucun ya da ticari servis, `SOFRA_ROUTING_URL` |
| Kurye konumu arka planda | Geliştirme derlemesinde hazır; Expo Go'da yok (uygulama açık kalmalı) | EAS Build (Android ön plan servisi, iOS arka plan konumu açık) |
| Mağaza dağıtımı | Expo Go | EAS Build + App Store / Play Store |

Her biri tek bir modül değiştirilerek gerçeğe bağlanabilecek şekilde yalıtılmıştır.
