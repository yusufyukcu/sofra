# Mimari Notları

Bu belge dört modülün — Müşteri Uygulaması, Restoran Paneli, Kurye
Uygulaması ve Yönetici Paneli — nasıl kurgulandığını ve birbirine nasıl
bağlandığını anlatır.

---

## 1. Katmanlar

```
┌──────────────────────────────────────────────────────────────┐
│  İstemciler                                                  │
│  ┌────────────────────────┐   ┌───────────────────────────┐  │
│  │ Web (bu proje)         │   │ Mobil (ileride)           │  │
│  │ Sunucu bileşeni + RSC  │   │ React Native / Flutter    │  │
│  │ httpOnly çerez         │   │ Authorization: Bearer     │  │
│  └───────────┬────────────┘   └─────────────┬─────────────┘  │
└──────────────┼──────────────────────────────┼────────────────┘
               │            /api/v1           │
┌──────────────▼──────────────────────────────▼────────────────┐
│  Route handler'lar — ince bir kabuk                          │
│  Doğrulama + yetkilendirme + { ok, data } zarfı              │
├──────────────────────────────────────────────────────────────┤
│  Servisler (lib/services)                                    │
│  orders · account · auth · support                           │
│  vendor · courier · admin · payouts                          │
├──────────────────────────────────────────────────────────────┤
│  Saf iş kuralları (lib)                                      │
│  discovery.ts · pricing.ts · utils.ts   ← istemcide de çalışır│
├──────────────────────────────────────────────────────────────┤
│  Depo (lib/db)                                               │
│  store.ts (JSON) · seed.ts · simulator.ts                    │
└──────────────────────────────────────────────────────────────┘
```

**Önemli kural:** Sayfalar (sunucu bileşenleri) HTTP üzerinden kendi API'sine
istek atmaz; doğrudan servis/depo katmanını çağırır. API yalnızca tarayıcıdaki
etkileşimler ve mobil uygulama için vardır. Böylece ilk boyamada gereksiz bir
ağ turu oluşmaz, mantık ise tek yerde kalır.

---

## 2. Mobil uygulama hazırlığı — ve sonucu

Backend baştan mobil düşünülerek yazılmıştı. Mobil uygulama yazılırken bu
kararların **hiçbiri değiştirilmedi**; sunucu tarafında tek satır kod
gerekmedi (yalnızca web önizlemesi için geliştirme CORS'u eklendi).

| Karar | Mobilde karşılığı |
|---|---|
| `/api/v1/*` sürümlenmiş uç noktalar | 60 uç noktanın tamamı olduğu gibi kullanıldı |
| Tek cevap zarfı `{ ok, data } \| { ok, error }` | Tek bir istemci zarfı açıyor, hata kodları ortak |
| Oturum hem çerez hem `Bearer` | Mobil `Bearer` kullanır; `currentUser(request)` zaten kabul ediyordu |
| Girişte `accessToken` da dönüyordu | Cihazın güvenli alanına yazılıyor (Keychain / EncryptedSharedPreferences) |
| Alan modeli framework'süz | `packages/core`'a taşındı, iki istemci aynı dosyayı okuyor |
| İş kuralları saf fonksiyon | `pricing`, `discovery`, `cart` mobilde de aynen çalışıyor |
| Sunucu tarafında yeniden doğrulama | Mobil de fiyatı sunucudan alır, kendi hesaplamaz |

**Doğrulandı:** çerez olmadan, yalnızca `Authorization: Bearer` ile
`/auth/me` ve `/addresses` çalışıyor; token'sız istek `unauthorized`,
müşteri token'ıyla kurye ucu `courier_unauthorized` dönüyor.

---

## 2.1 Paylaşılan çekirdek — `packages/core`

Tek kaynak ilkesi: bir iş kuralının iki istemcide ayrışması mümkün
olmamalı. Bu yüzden arayüzden bağımsız olan her şey ayrı bir pakete alındı.

```
packages/core/src/
  types.ts        Alan modeli
  pricing.ts      Kupon kontrolü, tutar hesabı, sepet doğrulama
  discovery.ts    Filtreleme, sıralama, parametre adları
  cart.ts         Satır birleştirme, varyant varsayılanları, adet sınırı
  utils.ts        Biçimlendirme, mesafe, ETA, çalışma saati
  constants.ts    Kategoriler, ödeme yöntemleri, sipariş akışı
  api-client.ts   Yapılandırılabilir istemci (çerez ↔ Bearer)
  theme.ts        Palet, tipografi ölçeği, boşluk ritmi, görsel üreteci
  errors.ts  courier-constants.ts
```

Paket **React, Next.js, React Native veya DOM API'si kullanmaz.**

**Web nasıl kullanıyor:** `lib/types.ts`, `lib/pricing.ts` gibi dosyalar
artık birer yeniden dışa aktarımdan ibaret:

```ts
// lib/pricing.ts
export * from "@sofra/core/pricing";
```

Böylece mevcut 197 dosyadaki `@/lib/...` importlarının hiçbiri değişmedi
ama gerçek kaynak tek yerde.

**Mobil nasıl kullanıyor:** Metro'ya `watchFolders` + `extraNodeModules`
ile paketin yolu tanıtıldı; `@sofra/core` adıyla import ediliyor.
Çekirdekte yapılan bir değişiklik iki istemciye aynı anda yansıyor.

### Palet ayrışmasını makine denetliyor

`theme.ts` ile `app/globals.css` elle tutulan iki dosya; zamanla ayrışırlar.
`npm run check:theme` CSS'i ayrıştırıp her jetonu karşılaştırır ve fark
bulursa çıkış kodu 1 ile döner — **58 jeton**, açık ve koyu mod.

### Görseller birebir aynı

`foodArtwork(seed, tone)` rengi ve geometriyi çekirdekte üretir. Web bunu
CSS `radial-gradient` katmanlarıyla, mobil `react-native-svg` ile çizer;
aynı restoran iki istemcide **aynı görseli** alır. Karma fonksiyonu da
ortak, yoksa lekeler kayardı.

---

## 3. Güvenlik: istemciye güvenilmez

`POST /api/v1/orders` yalnızca `productId`, seçilen `optionIds`, adet ve not
alanlarını kullanır. Fiyat, ad ve toplamlar **menüden yeniden hesaplanır**
(`lib/pricing.ts → validateCart`). Ek olarak sunucu şunları doğrular:

- Zorunlu opsiyon grupları seçilmiş mi, min/max sınırları aşılmış mı
- Ürün veya opsiyon tükenmiş mi
- Restoran açık mı, adres teslimat yarıçapı içinde mi
- Sepet minimum tutarı karşılıyor mu
- Kupon geçerli mi (süre, restoran kısıtı, ilk sipariş şartı, tekrar kullanım)
- Ödeme yöntemi restoranca kabul ediliyor mu, cüzdan bakiyesi yetiyor mu

Doğrulanmış örnekler:

```
istemci 1 ₺ fiyat iddia etti  → sunucu ara toplamı 665 ₺ hesapladı
zorunlu "Boyut" seçimi yok    → option_required
süresi dolmuş kupon           → coupon_expired
aynı kupon ikinci kez         → coupon_used
```

Korumalı sayfalar ayrıca ağ sınırında (`proxy.ts`, Next.js 16'nın middleware
yerine gelen sözleşmesi) kontrol edilir; oturumsuz istek `/giris?devam=…`
adresine 307 ile yönlendirilir.

---

## 4. Ürün varyantları — esnek model

Analiz raporundaki “JSON tabanlı veya esnek ilişkisel model” önerisi tek bir
yapıyla karşılanır:

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
    soldOut?: boolean;           // Vendor panelinden anlık stok kapatma
  }[];
}
```

Bu tek model ile ifade edilenler:

- **Tekli seçim:** Boyut (Küçük/Orta/Büyük), pişirme derecesi, hamur tipi
- **Çoklu seçim:** Malzemeler, “İstemediklerim”, yanında ne olsun
- **Ücretli ekstralar:** `priceDelta > 0`
- **İndirimli seçenek:** `priceDelta < 0` (ör. “Yarım porsiyon −180 ₺”)
- **Sınırlı çoklu seçim:** `minSelect` / `maxSelect`

Birim fiyat = `product.price + Σ(seçilen opsiyonların priceDelta'ları)`.

---

## 5. Gerçek zamanlı akış

`GET /api/v1/orders/:id/stream` **Server-Sent Events** yayınlar:

```
retry: 3000

event: update
data: { "order": {...}, "progress": 0.57, "remainingMinutes": 2 }

event: done
data: { "status": "delivered" }
```

Neden WebSocket değil? Müşteri tarafındaki ihtiyaç **tek yönlü** (sunucu →
istemci): durum değişimi ve kurye konumu. SSE bunun için daha az altyapı
gerektirir, HTTP üzerinden çalışır ve tarayıcı otomatik yeniden bağlanır.
İstemci ayrıca 5 saniyelik yoklama yedeğiyle korunur (`lib/use-order-stream.ts`).

Vendor ve Courier panelleri geldiğinde çift yönlü iletişim gerekecektir
(sipariş kabul/ret, kurye konum yayını). O noktada bir WebSocket sunucusu
eklenebilir; müşteri tarafındaki sözleşme (`order`, `progress`,
`remainingMinutes`) değişmediği sürece bu ekran etkilenmez.

---

## 6. Sipariş simülatörü — diğer modüllerin durduğu yer

Restoran Paneli devreye girdiğinden beri simülatörün rolü daraldı: yalnızca
**otomatik onay açıkken** ve **kurye bacağında** çalışır. Panel bir siparişi
devraldığında (`controlMode: "manual"`) durum geçişleri oradan gelir — detay
için bölüm 9.3. Courier App yazılana kadar teslimat anı hâlâ burada üretilir.

`lib/db/simulator.ts` geçişleri şöyle üretir:

Simülatör **zamanlayıcıyla değil, okuma anında (lazy)** çalışır: sipariş her
okunduğunda `createdAt` ile `etaAt` arasındaki orana bakılarak doğru duruma
ilerletilir. Sunucu yeniden başlasa bile sipariş kaldığı yerden devam eder.

```
0%          12%                     55%                        100%
├─ Onay bekliyor ─┼─ Hazırlanıyor ───┼─ Yolda ───────────────────┤
                  ↑ kurye atanır      ↑ kurye rota üzerinde ilerler
```

**Courier App devreye girdiğinde:** bu dosya tamamen silinebilir; teslimat
anı ve kurye konumu kurye uygulamasından gelir. `Order` modeli, zaman
çizelgesi ve API sözleşmesi aynı kalır — müşteri uygulamasında değişiklik
gerekmez.

---

## 7. Veri modeli

Prototipte tek JSON dosyası (`.data/db.json`), erişim yalnızca
`lib/db/store.ts` üzerinden. Postgres'e geçerken değişecek tek yer burasıdır.

| Varlık | Alanlar (özet) |
|---|---|
| `User` | id, ad, telefon, e-posta, avatar, providers[], cüzdan bakiyesi, favoriler[] |
| `Address` | id, userId, etiket (ev/iş/diğer), açık adres, ilçe/il, bina·kat·daire, tarif, **point{lat,lng}**, varsayılan mı |
| `Restaurant` | id, slug, ad, mutfaklar[], puan, ETA aralığı, min sepet, teslimat ücreti, ücretsiz eşiği, **konum + teslimat yarıçapı**, çalışma saatleri + mola, **komisyon oranı**, **otomatik onay**, kurye modu, ödeme yöntemleri, **menu[]** |
| `VendorAccount` | id, restaurantId, ad, e-posta, PIN — restoran paneli hesabı |
| `MenuCategory` → `Product` → `OptionGroup` → `ProductOption` | Bölüm 4 |
| `Order` | id, kod, userId, restoran özeti, **adres anlık görüntüsü**, satırlar[], toplamlar, ödeme, kupon, tercihler, durum, **timeline[]**, kurye, **courierRoute[] + courierPoint**, etaAt, rating, **controlMode · approvedAt · pickedUpAt · prepMinutes · travelMinutes** |
| `Coupon` | kod, tip (percent/amount/free_delivery), değer, min sepet, max indirim, restoran kısıtı, ilk sipariş şartı, son kullanma |
| `Review` | restoranId, orderId, kullanıcı adı, puan, yorum, restoran yanıtı |
| `SupportSession` | userId, orderId, mesajlar[], temsilciye devredildi mi |

Notlar:

- Sipariş, adresin **anlık görüntüsünü** saklar: kullanıcı adresi sonradan
  silse veya değiştirse bile geçmiş sipariş doğru kalır.
- Teslimat bölgesi prototipte **merkez + yarıçap** ile modellenmiştir. Vendor
  panelindeki poligon desteği geldiğinde `deliveryRadiusKm` alanı bir poligon
  alanıyla değiştirilir; kontrol tek bir fonksiyonda (`createOrder`) yapıldığı
  için etki alanı dardır.
- Cüzdan hareketleri ayrı bir tablo yerine sipariş geçmişinden türetilir.
  Üretimde `wallet_transactions` tablosu açılmalıdır.

---

## 8. Keşif (filtreleme) mantığı

`lib/discovery.ts` saf fonksiyonlardan oluşur ve üç yerde aynı şekilde çalışır:
anasayfanın istemci tarafı, `/api/v1/restaurants` (mobil için) ve testler.

- `decorate()` — kullanıcı konumuna göre mesafe, düzeltilmiş ETA, teslimat
  bölgesi içinde mi ve favori bilgisini ekler
- `filterAndSort()` — kategori, arama, puan, süre, min sepet, açık/kapalı,
  ücretsiz teslimat filtreleri; sıralama seçenekleri
- “Önerilen” sıralaması puan + yakınlık + hız + popülerlik + favori skorunu
  harmanlar (üretimde bir öneri servisine devredilir)

Anasayfa akışı: sunucu tüm restoranları menüsüz gönderir → istemci seçili
adrese göre anlık filtreler → filtreler `history.replaceState` ile URL'e
yazılır. Sonuç: derin bağlantılar çalışır, her tuşta sunucuya gidilmez.

---

## 9. Restoran Paneli (Modül 2)

### 9.1 Katalog artık değiştirilebilir

Müşteri uygulaması tek başınayken restoran kataloğu sabit bir tohum
dizisiydi. Panel menüyü, fiyatı, stoğu ve mağaza ayarlarını değiştirdiği
için katalog veri deposuna taşındı:

```
db().restaurants   ← Vendor Dashboard yazar, müşteri uygulaması okur
db().vendors       ← her restoran için bir işletme hesabı
```

`allRestaurants()` artık bu listeden okur. Restoran sayfası bu yüzden
`dynamic = "force-dynamic"`: menü kaydedildiği anda müşteri tarafında
görünür, önbellek geçersizleştirme adımı gerekmez.

### 9.2 İki ayrı oturum

| | Müşteri | İşletme |
|---|---|---|
| Çerez | `sofra_session` | `sofra_vendor` |
| JWT `audience` | `sofra-customer` | `sofra-vendor` |
| Ek claim | — | `rid` (restaurantId) |
| Süre | 30 gün | 12 saat (vardiya) |
| Modül | `lib/auth/session.ts` | `lib/auth/vendor-session.ts` |

Ayrı `audience` sayesinde müşteri token'ı işletme uç noktalarında
geçersizdir. İkisi aynı tarayıcıda birlikte açık kalabilir — restoran
sahibi kendi uygulamasından sipariş verebilsin diye.

`proxy.ts` her iki yolu da ağ sınırında korur: `/isletme/*` işletme
oturumu ister, `/hesabim` ve `/odeme` müşteri oturumu.

Her işletme fonksiyonu oturumdaki `restaurantId` ile sınırlanır; gövdeden
gelen bir restoran kimliğine asla güvenilmez.

### 9.3 Simülatör artık panele yol veriyor

`Order.controlMode` iki değer alır:

```
auto   → durum geçişleri zaman tabanlı simülatörden gelir
manual → panel siparişi devraldı; geçişler oradan yapılır
```

Sipariş oluşturulurken mod restoranın `autoAccept` ayarından belirlenir.
Panel "Siparişleri otomatik onayla"yı kapattığında yeni siparişler
`manual` doğar ve **restoran onaylayana kadar kendiliğinden ilerlemez**
(`scheduleOf` → `preparingAt = Infinity`).

Elle yönetilen siparişin takvimi gerçek zaman damgalarından türer:

```
preparingAt = approvedAt                       (panel: "Onayla")
onTheWayAt  = pickedUpAt ?? approvedAt + prep  (panel: "Yola çıktı")
deliveredAt = onTheWayAt + travelMinutes       (kurye modülü gelene kadar otomatik)
```

`travelMinutes` sipariş anında mesafeden hesaplanır ve sabit kalır, böylece
restoran hazırlık süresini değiştirdiğinde yalnızca mutfak süresi kayar —
yol süresi değil.

**Courier App geldiğinde:** `deliveredAt`'i de simülatör değil kurye
uygulaması bildirecek, `courierPoint` gerçek GPS akışından beslenecek.
`Order` modeli ve müşteri takip ekranı aynı kalır.

### 9.4 Canlı pano ve zil

`/api/v1/vendor/orders/stream` iki saniyede bir tüm panoyu yayınlar
(SSE). Panel, `incoming` listesindeki kimlikleri bir öncekiyle
karşılaştırır; yeni kimlik varsa zil çalar ve bekleyen sipariş kalmayana
kadar beş saniyede bir tekrarlar.

Zil `lib/vendor/chime.ts` içinde **Web Audio ile sentezlenir**: iki
osilatör (taşıyıcı + 2.76× harmonik) üstel sönümlü bir zarfla çalınır.
Ses dosyası indirilmez, gecikme sıfıra yakındır, çevrimdışı çalışır.

Tarayıcılar sesi kullanıcı hareketi olmadan başlatmadığı için panel bir
"Zili aç" düğmesi sunar — mutfak tabletinde vardiya başında sesi açmak
zaten doğal bir alışkanlıktır.

### 9.5 Finans hesabı

```
brüt ciro       = teslim edilen siparişlerin ürün ara toplamı
komisyon        = brüt × restaurant.commissionRate
net hakediş     = brüt − komisyon
```

Teslimat ücreti ve hizmet bedeli platforma aittir, restoranın hakedişine
girmez. Hakediş dönemleri pazartesi başlangıçlı haftalardır.

Grafik iki seriyi üst üste yığar (net + komisyon = brüt). Seri renkleri
`--chart-net` / `--chart-commission` jetonlarından gelir; açık ve koyu mod
adımları ayrı ayrı seçilip parlaklık bandı, kroma tabanı, renk körlüğü
ayrımı ve zemin kontrastı kontrollerinden geçirildi. Grafiğin yanında bir
**tablo görünümü** de vardır.

### 9.6 Panel arayüzü

Müşteri kabuğu (`AppChrome`) `/isletme` altında devre dışı kalır: panel
mutfakta tablet üzerinde kullanılan operasyonel bir ekrandır, müşteri
başlığı ve alt gezinmesi oraya ait değildir.

Sipariş fişi mutfakta okunacak şekilde dizildi: adet ve ürün adı en büyük
tipografi, seçenekler ve ürün notu hemen altında, tutar ve adres en sonda.
Aksiyonlar siparişin durumuna göre değişir; hazırlık süresi altı hazır
seçenekle tek dokunuşta bildirilir.

---

## 10. Kurye Uygulaması (Modül 3)

### 10.1 Teslimat bacağının sahibi değişti

İki modüllük sürümde `on_the_way` ve `delivered` geçişlerini ya simülatör
ya da restoran paneli yapıyordu. Artık **platform kuryesi** modelindeki
siparişlerde bu iki geçiş yalnızca Courier App'ten gelir.

`Order.courierStage` bunu taşır:

```
unassigned  → kurye aranıyor
offered     → teklif gönderildi, kurye yanıt bekleniyor (45 sn)
assigned    → kurye kabul etti, restorana gidiyor
at_restaurant → restorana vardı
picked_up   → siparişi aldı   → müşteri tarafında "Yolda"
delivered   → teslim etti      → müşteri tarafında "Teslim edildi"
```

`courierDriven(order)` bu aşamalardan biri aktifse `true` döner ve
simülatör teslimat bacağına hiç dokunmaz (`scheduleOf` içinde
`onTheWayAt` ve `deliveredAt` sonsuz kalır). Doğrulandı: kurye "Teslim
aldım" dedikten sonra 20 saniye beklendi, sipariş kendiliğinden teslim
edilmedi — kuryenin bildirimini bekledi.

### 10.2 Teklif akışı (dispatcher)

Atama kimseye sabit değil, **teklif** olarak gider:

```
sipariş "Hazırlanıyor"a geçer
   ↓
en yakın uygun kurye bulunur       (vardiyada · boşta · bu siparişi görmemiş)
   ↓
45 saniyelik teklif oluşturulur     DeliveryOffer{ fee, pickupKm, dropoffKm }
   ↓
kabul  → courierStage = "assigned", sipariş kuryenin üzerine geçer
ret    → sıradaki en yakın kuryeye anında gider
süre   → teklif "expired", sıradaki kuryeye gider
```

Aynı kuryeye aynı sipariş ikinci kez gönderilmez ve bir kuryede aynı anda
yalnızca bir teklif bulunur. Doğrulandı: restorana 0,2 km uzaklıktaki
kuryeye önce gitti, reddedince 0,6 km'deki kuryeye geçti.

`syncOffers()` de simülatörle aynı mantıkla **okuma anında** çalışır:
zamanlayıcı yok, sunucu yeniden başlasa da akış kaldığı yerden devam eder.
Kurye uygulaması, restoran paneli ve müşteri takip ekranı — üçü de
okurken bu fonksiyonu tetikler.

### 10.3 Simülatör ne zaman devrede kalıyor

| Durum | Teslimat bacağını kim yönetir |
|---|---|
| Vardiyada kurye yok | Simülatör (müşteri uygulaması tek başına denenebilsin diye) |
| Vardiyada kurye var, teklif bekliyor | Kimse — sipariş kurye kabul edene kadar bekler |
| Kurye kabul etti | Courier App |
| Restoran kendi kuryesini kullanıyor | Restoran paneli (`dispatch`) |

`assignCourier()` artık yalnızca "vardiyada hiç kurye yoksa" otomatik
atama yapar; aksi hâlde işi teklif akışına bırakır.

### 10.4 Kurye konumu

Kurye uygulaması `POST /courier/location` ile konum bildirir; sunucu bunu
hem kurye kaydına hem de açık siparişin `courierPoint` alanına yazar.
Müşterinin canlı takip haritası doğrudan bu alandan beslenir — yani
müşterinin gördüğü nokta artık simülasyon değil, kuryenin bildirdiği
konumdur.

Prototipte cihaz GPS'inin yerine **simüle sürüş** kullanılır: uygulama,
kuryeyi üç saniyede bir hedefe doğru bir miktar ilerletir ve bunu sunucuya
bildirir. Uygulamadaki anahtarla gerçek `navigator.geolocation` akışına
geçilebilir; sunucu sözleşmesi aynıdır.

### 10.5 Kazanç, bahşiş ve performans

```
paket ücreti = max(45, 35 + toplam_km × 11) ₺
```

Teslimat tamamlandığında bir `CourierEarning` kaydı yazılır (ücret,
mesafe, teslim alma → teslim etme süresi). Bahşiş müşterinin değerlendirme
ekranından bırakılır: tutar müşterinin cüzdanından düşer ve aynı kazanç
kaydına eklenir. Doğrulandı: 30 ₺ bahşiş sonrası müşteri cüzdanı
450 → 420 ₺, kurye kazancı 49,69 → 79,69 ₺.

Performans metrikleri tamamlanan teslimatlardan ve teklif geçmişinden
türetilir: ortalama teslimat süresi, en hızlı teslimat, kabul oranı
(kabul / kabul+ret+süre dolan), ortalama mesafe.

Kurye puanı da müşteri değerlendirmesinden gelir: `applyCourierRating`
kuryenin `ratingSum`/`ratingCount` alanlarını günceller ve ortalamayı
yeniden hesaplar.

### 10.6 Üç oturum, üç kabuk

| Rol | Çerez | JWT audience | Kabuk |
|---|---|---|---|
| Müşteri | `sofra_session` | `sofra-customer` | Başlık + alt gezinme |
| İşletme | `sofra_vendor` | `sofra-vendor` | Yan menü (tablet) |
| Kurye | `sofra_courier` | `sofra-courier` | Tek sütun (telefon) |

`AppChrome` `/isletme` ve `/kurye` altında müşteri kabuğunu devre dışı
bırakır; `proxy.ts` üç yolu da ağ sınırında korur. Üç oturum aynı
tarayıcıda birlikte açık kalabilir — demo sırasında üç sekmeyi yan yana
açıp akışı uçtan uca izlemek için gerekli.

Kurye uygulaması telefonda tek elle kullanılır: masaüstünde bile telefon
genişliğinde ortalanır, birincil aksiyon düğmesi 64 piksel yüksektir ve
her ekranda mesai anahtarı görünür.

---

## 11. Yönetici Paneli (Modül 4)

Son modül, diğer üçünün üzerinde durur: onay, kontrol ve mutabakat.

### 11.1 Katalog ve kampanyalar da yönetilebilir hâle geldi

Müşteri uygulaması tek başınayken restoran kataloğu sabit tohumdu; ikinci
modülde menü ve mağaza ayarları veri deposuna taşındı. Dördüncü modülle
birlikte **kampanya kodları ve vitrin afişleri** de depoya geçti:

```
db().restaurants   ← Vendor yazar, Superadmin onaylar/askıya alır
db().couriers      ← Courier App yazar, Superadmin aktive eder
db().coupons       ← Superadmin yönetir, müşteri ödeme adımında kullanır
db().banners       ← Superadmin yönetir, anasayfa vitrini okur
db().payouts       ← ortak hakediş defteri (üç panel de okur)
db().audit         ← manuel işlemlerin izi
```

`allRestaurants()` yönetim tarafı için tüm listeyi döner;
`publishedRestaurants()` yalnızca onaylıları — müşteri uygulamasının
gördüğü budur. Onaysız restoranın sayfası 404 verir ve sipariş
oluşturma `restaurant_unavailable` ile reddedilir.

### 11.2 Dört rol, dört oturum

| Rol | Çerez | `audience` | Süre | Kabuk |
|---|---|---|---|---|
| Müşteri | `sofra_session` | `sofra-customer` | 30 gün | Başlık + alt gezinme |
| İşletme | `sofra_vendor` | `sofra-vendor` | 12 saat | Yan menü (tablet) |
| Kurye | `sofra_courier` | `sofra-courier` | 12 saat | Tek sütun (telefon) |
| Yönetici | `sofra_admin` | `sofra-admin` | 4 saat | Kontrol masası |

`proxy.ts` dördünü de ağ sınırında korur. Farklı `audience` sayesinde bir
rolün token'ı diğerinin uç noktasında geçersizdir — doğrulandı: müşteri
token'ıyla `/admin/overview` çağrısı `admin_unauthorized`, yönetici
token'ıyla `/vendor/orders` çağrısı `vendor_unauthorized` döndü.

### 11.3 Kara liste ve aktivasyon zinciri

Yönetici kararları diğer modüllerde anında karşılık bulur:

```
müşteri kara listeye alınır
   → currentUser() null döner (oturum anında geçersiz)
   → yeniden giriş account_blocked ile reddedilir
   → createOrder account_blocked ile reddedilir

kurye askıya alınır
   → status = "suspended", online = false (mesaiden düşer)
   → setShift(online: true) courier_not_active ile reddedilir

restoran askıya alınır
   → approvalStatus = "suspended", temporarilyClosed = true
   → keşif listesinden, aramadan ve restoran sayfasından kalkar
```

### 11.4 Ortak hakediş defteri

`lib/services/payouts.ts` üç panelin de okuduğu tek kaynaktır. Ayrı bir
modülde durur ki `vendor.ts` ↔ `courier.ts` ↔ `admin.ts` arasında
döngüsel bağımlılık oluşmasın.

```
syncPayouts()                       (okuma anında, zamanlayıcısız)
  teslim edilen siparişler  → restoran hakedişi (brüt − komisyon)
  kurye kazançları          → kurye hakedişi (ücret + bahşiş)

pending ──approve──▶ approved ──pay──▶ paid
   ▲                    │
   └── tutar güncellenir └── tutar dondurulur
```

Onaylanmamış bir hakediş "ödendi" yapılamaz (`not_approved`). Onaydan
sonra tutar donar; sonradan gelen düzeltmeler bir sonraki döneme yazılır.
Durum aynı anda restoran panelinde ve kurye uygulamasında görünür —
doğrulandı: yöneticide `approved` yapıldığı anda restoran paneli de
`approved`, `paid` yapıldığında `paid` gösterdi.

### 11.5 Finansal mutabakat

```
GMV        = Σ grandTotal            (müşterilerin ödediği)
net gelir  = komisyon + hizmet bedeli + teslimat ücreti
             − kurye ödemeleri − karşılanan indirimler − geçit komisyonu
```

Doğrulanmış örnek: 444,80 ₺ GMV'li bir siparişte ürün tutarı 395 ₺,
%12 komisyon 47,40 ₺, restoran hakedişi 347,60 ₺, ödeme geçidi kesintisi
8,26 ₺ ve platform net geliri 88,94 ₺.

Grafik GMV'yi iki seriye ayırır: altta platformda kalan net gelir, üstte
diğer taraflara aktarılan pay. İkisi toplanınca GMV'yi verir — bu yüzden
yığılmış sütun doğru formdur, çift eksen değil.

### 11.6 İz kaydı

Manuel yetki kullanımı denetlenebilir olmalı: her onay, askıya alma, kara
liste, bakiye işlemi, iptal, iade, kampanya değişikliği ve hakediş kararı
`recordAudit(actor, action, target, detail)` ile kaydedilir ve canlı
operasyon ekranında akış hâlinde görünür.

---

## 12. Mobil Uygulama (Modül 5)

Expo SDK 57 + React Native. Müşteri ve kurye uygulamaları tek projede;
kurye modu ayrı oturum kullanır.

### 12.1 Neden tek proje

Spec iki ayrı uygulamadan söz ediyor. Tek Expo projesinde tutmanın nedeni
pratik: iki uygulamanın da aynı çekirdeği, aynı arayüz kitini, aynı haritayı
ve aynı API istemcisini kullanması. Ayrıştırmak gerekirse `src/app/kurye`
kendi projesine taşınır; paylaşılan her şey zaten `packages/core` ve
`src/components` altında.

Kurye modu **Hesabım → Kurye modu** ile açılır. Oturumlar birbirinden
bağımsız: müşteri olarak giriş yapmışken kurye olarak da girebilirsin,
ikisi birbirini düşürmez — tıpkı webde iki ayrı çerezin birlikte durması gibi.

### 12.2 Kimlik ve token deposu

```
Giriş → sunucu { user, accessToken } döner
      → accessToken cihazın güvenli alanına yazılır
        (iOS Keychain · Android EncryptedSharedPreferences)
      → her istekte Authorization: Bearer <token>
```

`src/lib/token-store.ts` senkron bir önbellek tutar, böylece her istek için
diske gidilmez; açılışta `hydrateTokens()` bir kez okur. Sunucu 401
döndüğünde istemci token'ı silip oturumu düşürür.

Web ve mobil **aynı token'ı** kullanır — yalnızca taşıma yeri farklı
(çerez ↔ başlık). Aynı JWT, aynı `audience`, aynı doğrulama.

### 12.3 Canlı veri: SSE yerine yoklama

React Native'de `EventSource` yok ve `fetch` gövdesi güvenilir biçimde akış
olarak okunamıyor. Bu yüzden mobil, SSE uçlarının **GET karşılığını**
düzenli aralıkla yokluyor:

| Ekran | Web | Mobil |
|---|---|---|
| Sipariş takibi | `GET /orders/:id/stream` (SSE) | `GET /orders/:id` · 2 sn |
| Kurye panosu | `GET /courier/board/stream` (SSE) | `GET /courier/board` · 3 sn |

Gövde ikisinde de aynı: `{ order, progress, remainingMinutes }`. Sunucu
sözleşmesi değişmedi.

`useLive` uygulama arka plana alındığında yoklamayı durdurur, öne geldiğinde
hemen bir tur atıp devam eder. Bu bilinçli bir seçim — telefon boşuna istek
atıp pil harcamamalı. Yan etkisi: arka plandaki kurye ekranı teklifi
kaçırabilir; üretimde bunun cevabı push bildirimidir.

### 12.4 Harita: karoları kendimiz döşüyoruz

`expo-maps` alfa ve Expo Go'da yok; `react-native-maps` native derleme
gerektiriyor. İkisi de "QR okut ve dene" akışını bozuyordu.

Bunun yerine `src/components/map/` altında ince bir harita var:

- **Projeksiyon** (`projection.ts`): Web Mercator, slippy-map karo düzeni,
  noktaları kapsayan yakınlaştırmayı bulan `fitZoom`
- **Karolar**: `expo-image` ile `tile.openstreetmap.org` — web'deki Leaflet
  haritasıyla **aynı karo kaynağı**
- **Katman**: `react-native-svg` ile rota çizgisi ve işaretçi halkaları

Tek kod, üç platform (iOS, Android, web), Expo Go'da doğrudan çalışıyor.
Ödün: sürükleme ve yakınlaştırma yok — harita ilgili noktalara kendini
oturtuyor. Sipariş takibinde zaten istenen davranış bu.

> `fitZoom` kenar payını uygularken kutunun en az %60'ını korur. Sabit bir
> pay, 150 px yüksekliğindeki teklif haritasında görünür alanı yutup
> haritayı gereksiz yere uzaklaştırıyordu.

### 12.5 Kurye konumu artık gerçek

Web panelinde kurye konumu simüle bir sürüşle üretiliyordu. Mobilde
`expo-location` cihazın gerçek GPS akışını dinliyor ve aynı uç noktaya
gönderiyor:

```
POST /api/v1/courier/location  { point: { lat, lng } }
```

Uç nokta, gövde ve tüketiciler değişmedi — müşterinin takip haritasında
görünen nokta artık kuryenin telefonundan geliyor. Konum en fazla
`LOCATION_PING_MS` (3 sn) sıklığında gönderilir; sabit çekirdekte,
iki istemci aynı değeri kullanır.

### 12.6 Türkçe büyük harf

CSS `text-transform: uppercase` belge diline bakar. Expo web sayfası
İngilizce olduğu için "teslimat" → "TESLIMAT" oluyordu; doğrusu "TESLİMAT".
Native tarafta da `textTransform` yerelden bağımsız çalışır.

Bu yüzden dönüşüm CSS'e bırakılmadı: `Text` bileşeni `label` varyantında
metni `toLocaleUpperCase("tr")` ile kendisi büyütüyor.

Benzer bir tuzak yazı tiplerinde: Geist ve Bricolage Grotesque'te ₺
(U+20BA) glifi yok. Native'de işletim sistemi eksik glifi kendisi yedekler,
webde yedeklemez — orada aile adının arkasına sistem yığını ekleniyor.

### 12.7 Doğrulanan akış

İki ayrı tarayıcı (= iki telefon) ile uçtan uca koşturuldu:

```
Kurye:   giriş → mesai aç → teklif (₺45,00 · 45 sn geri sayım)
                → Siparişi al → Restorana vardım → Teslim aldım → Teslim ettim
Müşteri: sipariş ver → "Restorana gidiyor" → "Restoranda"
                → "Yolda · Sana geliyor" → "Teslim edildi"
Kurye:   Kazanç ekranında ₺45,00 yazıldı
```

Her aşama bildirimi karşı taraftaki ekrana anında düştü. Native paket
üretimi de doğrulandı (`expo export --platform android|ios`), `expo-doctor`
21/21 temiz.
