# API Sözleşmesi — `/api/v1`

Web (dört rol) ve mobil uygulama aynı uç noktaları kullanır. Mimari:
[`MIMARI.md`](MIMARI.md).

## Ortak kurallar

**Cevap zarfı**

```jsonc
{ "ok": true,  "data": { /* ... */ } }
{ "ok": false, "error": { "code": "coupon_expired", "message": "Bu kampanyanın süresi dolmuş." } }
```

`code` makine tarafından okunur, `message` kullanıcıya doğrudan gösterilebilir
Türkçe metindir.

**Kimlik doğrulama (Supabase Auth)** — iki yol da kabul edilir:

| İstemci | Yöntem |
|---|---|
| Web | Rol başına `httpOnly` çerez (giriş uç noktaları kurar, sunucu kendiliğinden yeniler) |
| Mobil | `Authorization: Bearer <accessToken>`; süresi dolunca `POST /auth/refresh` |

Her giriş uç noktası hem çerezi kurar hem token çiftini döndürür:

```jsonc
{ /* rolün verisi */, "accessToken": "eyJ…", "refreshToken": "…", "expiresAt": 1791000000 }
```

| Rol | Çerez | En uzun oturum |
|---|---|---|
| Müşteri | `sofra-auth-musteri` | Supabase varsayılanı |
| Restoran | `sofra-auth-isletme` | 12 saat |
| Kurye | `sofra-auth-kurye` | 12 saat |
| Yönetici | `sofra-auth-yonetim` | 4 saat |

Bir rolün oturumu diğerinin ucunda çalışmaz (`401`). İşletme işlemleri
oturumdaki restoranla, kurye işlemleri oturumdaki kuryeyle sınırlıdır.

**HTTP durum kodları** — `200` / `201` başarı, `400` iş kuralı ihlali,
`401` oturum yok, `402` ödeme reddedildi, `403` yanlış hesap türü / demo
kapalı, `404` bulunamadı, `409` çakışma (aynı kayıt, eşzamanlı işlem),
`413` dosya büyük, `429` çok fazla kod isteği, `500` beklenmeyen hata
(üretimde ayrıntısız), `503` bağlı olmayan sağlayıcı.

**Gerçek zaman** — Akış uçları yoktur. Web, değişiklikleri Supabase Realtime
özel kanallarından alır (`GET /realtime/token`) ve ilgili GET ucunu yeniden
çeker; mobil aynı GET uçlarını düzenli aralıkla yoklar. Gövdeler aynıdır.

| Ekran | Kanal | GET ucu |
|---|---|---|
| Sipariş takibi | `order:<id>` | `GET /orders/:id` |
| Kurye panosu | `courier:<id>` | `GET /courier/board` |
| İşletme panosu | `restaurant:<id>` | `GET /vendor/orders` |
| Canlı operasyon | `admin:ops` | `GET /admin/overview` |
| Destek konsolu / sohbet | `admin:support` / `support:<id>` | `GET /admin/support`, `GET /support/chat` |
| Bildirim zili | `user:<id>` | `GET /notifications` |

> `progress` **0–1 aralığında** bir orandır, yüzde değil.

**CORS** — geliştirmede yerel kökenlere izin verilir (mobilin web derlemesi
için); üretimde kapalıdır (`proxy.ts`).

---

# Müşteri

## Kimlik doğrulama

### `POST /auth/otp/start`
```jsonc
{ "channel": "phone" | "email", "target": "5551112233" }
→ { "challengeId": "otp_…", "maskedTarget": "0555 *** ** 33",
    "expiresInSeconds": 180, "devCode": "483920" }
```
`devCode` yalnızca **test modunda** (SMS/e-posta sağlayıcısı bağlı değilken)
döner. Kod 3 dakika geçerli, 5 yanlış denemede kilitlenir
(`otp_too_many_attempts`); aynı hedefe 15 dakikada en fazla 5 kod (`otp_rate_limited`).

### `POST /auth/otp/verify`
```jsonc
{ "challengeId": "otp_…", "code": "483920", "name": "Ad Soyad" }
→ { "user": {…}, "addresses": [], "isNewUser": true, "accessToken", "refreshToken", "expiresAt" }
```
Hatalar: `otp_invalid`, `otp_expired`, `otp_too_many_attempts`, `otp_not_found`, `account_blocked` (403).
Yeni kullanıcıya hoş geldin bakiyesi cüzdan defterine yazılır.

### `POST /auth/social`
`{ "provider": "google" | "apple" }` → giriş yükü. Test modunda sabit profil.

### `POST /auth/demo`
Demo hesabıyla giriş. Canlıda yalnızca demo (sunum) modu açıkken
(`demo_disabled`, 403); geliştirme ortamında otomatik testler için açık.
Giriş ekranı düğmeyi yalnızca demo modunda gösterir.

### `GET /config`
```jsonc
→ { "demoMode": false,
    "testModes": { "sms": true, "email": true, "voice": true, "payment": true },
    "webPush": true }
```
Kimlik doğrulama gerekmez; istemciler arayüzü buna göre uyarlar.

### `POST /auth/refresh`
```jsonc
{ "refreshToken": "…" } → { "accessToken", "refreshToken", "expiresAt", "role" }
```
Dört rol de kullanır; rol değişmez. Geçersiz token → `session_expired` (401).

### `GET /auth/me` · `PATCH /auth/me` · `POST /auth/logout`
```jsonc
GET  → { "user": {…}, "addresses": [...], "cards": [...], "activeOrders": [...] }
PATCH { "name", "email", "phone", "avatarEmoji" } → { "user" }
```

### `GET /realtime/token?rol=customer|vendor|courier|admin`
```jsonc
→ { "accessToken": "eyJ…", "expiresAt": 1791000000, "topics": ["user:usr_demo"] }
```
Rolün çerezdeki (ya da Bearer) oturumundan kısa ömürlü erişim token'ı;
bitimine 5 dakikadan az kaldıysa oturum yenilenir. `Cache-Control: no-store`.
Hangi kanalın dinlenebileceğine veritabanı politikası karar verir.

## Adresler

| Uç nokta | Açıklama |
|---|---|
| `GET /addresses` | Adres defteri |
| `POST /addresses` | Yeni adres (`point` zorunlu) → `201 { address, addresses }` |
| `PATCH /addresses/:id` · `DELETE /addresses/:id` | Güncelle / sil |
| `POST /addresses/:id/default` | Varsayılan yap |

```jsonc
{ "label": "ev" | "is" | "diger", "title": "Evim",
  "line1": "Caferağa Mah. Moda Cad. No:42", "district": "Kadıköy", "city": "İstanbul",
  "buildingNo": "42", "floor": "3", "apartmentNo": "7", "directions": "Zile 2 kez basın",
  "contactName": "…", "contactPhone": "…", "point": { "lat": 40.9872, "lng": 29.0263 },
  "isDefault": true }
```

## Keşif

### `GET /restaurants`

| Parametre | Örnek | Açıklama |
|---|---|---|
| `lat`, `lng` | `40.98`, `29.02` | Kullanıcı konumu (yoksa varsayılan merkez) |
| `kategori` | `burger`, `top-rated` | Mutfak |
| `q` | `kebap` | Arama |
| `sirala` | `recommended \| rating \| eta \| distance \| minBasket` | Sıralama |
| `puan` · `sure` · `sepet` | `4.5` · `30` · `300` | En az puan · en fazla süre · en fazla min. sepet |
| `acik` · `ucretsiz` | `1` | Şu an açık · ücretsiz teslimat |
| `bolge` | `0` | Teslimat bölgesi dışındakileri de listele |

```jsonc
→ { "restaurants": [{ …, "distanceKm": 0.6, "deliverable": true, "open": true,
                      "etaText": "26-36 dk", "isFavorite": false }],
    "featured": [...],          // yönetimin öne çıkardıkları, sıralı
    "total": 16, "filters": {…}, "point": {…},
    "categories": [{ "id": "burger", "name": "Burger", "image": "/images/food/…", "count": 3 }, …],
    "banners": [...] }
```
`categories[].count`: seçili mutfaktan bağımsız, diğer filtreler uygulanmış listede o
mutfaktan kaç restoran olduğu (`all` → toplam, `top-rated` → 4,5 ve üzeri puanlılar).
Teslimat bölgesi: restoran poligon çizdiyse nokta-çokgen testi, yoksa yarıçap.
Onaysız/askıdaki restoran hiç listelenmez.

### `GET /restaurants/:slug?lat=&lng=`
```jsonc
{ "restaurant": { …, "menu": [...], "deliveryZone": [{ "lat", "lng" }] | null },
  "delivery": { "distanceKm", "deliverable", "etaText", "open" },
  "isFavorite": false, "reviews": [...] }
```
Tükenen ürün, restoranın tercihine göre `soldOut: true` ile döner ya da hiç
dönmez. Onaysız restoran `404`.

### `GET /favorites?lat=&lng=` · `POST /favorites`
`{ "restaurantId": "rst_kasap" }` → `{ "favoriteIds": [...], "isFavorite": true }`

## Kuponlar & tutarlar

### `GET /coupons`
Kullanıcının kullanabileceği kampanyalar.

### `POST /coupons/validate`
Checkout'un **tek doğru tutar kaynağı**:
```jsonc
{ "restaurantId": "rst_kasap", "lines": [...], "code": "BURGER25", "paymentMethod": "online_card" }
→ { "totals": { "subtotal", "deliveryFee", "discount", "serviceFee", "walletUsed", "grandTotal" },
    "coupon": {…}, "meetsMinBasket": true, "minBasket": 300 }
```
Hatalar: `coupon_not_found`, `coupon_expired`, `coupon_inactive`,
`coupon_restaurant`, `coupon_first_order_only`, `coupon_used`, `coupon_min_subtotal`.

## Siparişler

### `POST /orders`
```jsonc
{ "restaurantId": "rst_kasap", "addressId": "adr_…",
  "lines": [{ "productId": "kb_p1", "quantity": 1, "note": "Sos ayrı",
              "selections": [{ "groupId": "kb_p1_g1", "optionIds": ["kb_p1_g1_o2"] }] }],
  "couponCode": "BURGER25",
  "paymentMethod": "online_card" | "wallet" | "meal_card" | "card_on_delivery" | "cash_on_delivery",
  "cardId": "card_…",           // online_card: seçilmezse ilk kayıtlı kart
  "mealCardBrand": "multinet",
  "preferences": { "contactless": true, "ringDoorbell": false, "cutlery": true, "note": "…" } }
→ 201 { "order": {…}, "walletBalance": 450 }
```
Fiyat, ad ve toplamlar **menüden yeniden hesaplanır**; gövdedeki fiyat
alanları yok sayılır. Kupon kullanıcı başına bir kezdir (eşzamanlı iki
siparişte de).

Hatalar: `restaurant_closed`, `out_of_delivery_zone`, `below_min_basket`,
`product_sold_out`, `option_required`, `option_min`, `option_max`,
`payment_method_unsupported`, `meal_card_required`, `insufficient_wallet`,
`card_required`, `card_not_found`, `card_declined` (402), kupon hataları.

### `GET /orders` · `GET /orders/:id`
```jsonc
GET /orders      → { "orders": [...] }
GET /orders/:id  → { "order": {…}, "progress": 0.57, "remainingMinutes": 2,
                     "arrivalAt": "2026-10-04T12:41:10.000Z" }
```
Kurye paketi almışsa ve konumu canlıysa (son 90 sn) `remainingMinutes` ve
`arrivalAt` kuryenin önündeki gerçek yoldan hesaplanır; değilse planlanan
saatten (`order.etaAt`). Sipariş alanları arasında `courierStage`,
`courierPoint` (kuryenin cihazından; kurye atanmadan yok), `courierLocatedAt`,
`courierRoute` (şu anki ayağın yol çizgisi, `[{ lat, lng }]`),
`courierRouteLeg` (`pickup`: kurye → restoran, `dropoff`: → adres),
`courierRouteDistanceM`, `courierRouteDurationS`, `refundedTotal` bulunur.
Rota ayağı aşamayla uyuşmuyorsa (yenisi hesaplanıyor) çizilmez.

### `POST /orders/:id/cancel`
```jsonc
{ "reason": "Fikrimi değiştirdim" } → { "order", "walletBalance", "refunded": 679.8 }
```
Yalnızca `pending_approval` ve `preparing`; online ödemede kalan tutar
cüzdana **bir kez** iade edilir (`not_cancellable`).

### `POST /orders/:id/rating`
```jsonc
{ "restaurantScore": 5, "restaurantComment": "…",
  "courierScore": 4, "courierComment": "…", "courierTip": 20 } → { "order", "review" }
```
Restoran ve kurye puan ortalamaları güncellenir. Bahşiş cüzdandan düşer,
yalnızca gerçek kuryeye yazılır (`not_deliverable_yet`, `already_rated`).

### `POST /orders/:id/reorder`
Geçmiş siparişin satırlarını güncel menüye göre doğrular →
`{ "restaurant", "lines", "removed": [...] }`.

### `POST /orders/:id/call` — maskeli arama
```jsonc
{ "action": "start" }
→ { "call": { "id": "call_…", "orderId", "callerRole": "customer",
              "proxyNumber": "0850 000 14 02", "extension": "4821",
              "dial": "tel:+908500001402,4821", "calleeLabel": "Kuryen Mert K.",
              "expiresAt": "…", "testMode": true } }
{ "action": "end", "sessionId": "call_…", "durationSeconds": 42 } → { "ended": true }
```
Gerçek numaralar hiçbir yanıtta yer almaz. Kurye atanmadan `no_courier`,
sipariş kapanınca `order_closed`. Açık oturum tekrar istenirse aynısı döner.
Test modunda arama simüle edilir; sağlayıcı yokken canlı mod `503`.

## Cüzdan ve kartlar

| Uç nokta | Açıklama |
|---|---|
| `GET /wallet` | `{ balance, transactions[] }` — her hareket `direction`, `balanceAfter` taşır |
| `POST /wallet` | `{ amount, cardId? }` → `{ balance, transactions }`; tutar kayıtlı karttan çekilir (en fazla 5.000 ₺) |
| `GET /cards` | `{ cards[], simulated: true }` |
| `POST /cards` | `{ number, expiry: "AA/YY", cvc, holder, nickname? }` → `201 { cards }` |
| `DELETE /cards/:id` | `{ cards }` |

Kart numarası ve güvenlik kodu saklanmaz; yanıtta yalnızca marka, son 4
hane, ad ve son kullanma döner. **Simülasyonda yalnızca test kartları**:

| Numara | Sonuç |
|---|---|
| `4242 4242 4242 4242` | Visa · onaylanır |
| `5555 5555 5555 4444` | Mastercard · onaylanır |
| `9792 0300 0000 0000` | Troy · onaylanır |
| `4000 0000 0000 0002` | Visa · **reddedilir** (`card_declined`, 402) |

Hatalar: `invalid_card_number`, `test_card_required`, `unsupported_card`,
`invalid_expiry`, `card_expired`, `invalid_cvc`, `invalid_holder`,
`card_limit` (en fazla 5), `card_exists` (409), `card_not_found`.

## Bildirimler ve push

### `GET /notifications`
```jsonc
→ { "notifications": [{ "id", "kind": "order" | "campaign" | "system",
                        "title", "body", "href": "/siparis/ord_…", "readAt", "createdAt" }],
    "unread": 2, "pushAvailable": true }
```
Sipariş durumu değişince bildirim veritabanı tetikleyicisiyle yazılır.

### `POST /notifications`
```jsonc
{ "action": "read", "ids"?: ["ntf_…"] } → { "unread": 0 }   // ids yoksa tümü
{ "action": "test" }                     → { "sent": true }  // kendine deneme bildirimi
```

### `POST /push`
```jsonc
{ "action": "subscribe", "subscription": { "endpoint": "https://…", "keys": { "p256dh", "auth" } } }
{ "action": "unsubscribe", "endpoint": "https://…" }
→ { "devices": 1 }
```
Tarayıcı aboneliği (Web Push / VAPID). Anahtar yapılandırılmamışsa
`push_unavailable` (503). Bildirimler API yanıtlarının ardından gönderim
kuyruğundan iletilir.

## Destek

### `GET /support/chat?sessionId=&orderId=`
Açık konuşmayı getirir ya da karşılama mesajıyla başlatır.

### `POST /support/chat`
```jsonc
{ "sessionId": "sup_…", "text": "siparişim nerede", "quickReplyId": "cancel_order", "orderId": "ord_…" }
→ { "session": { "id", "status": "bot" | "waiting_agent" | "with_agent" | "closed",
                 "escalated": false, "messages": [{ "id", "role": "bot" | "user" | "agent",
                                                    "text", "at", "authorName"?, "quickReplies"? }] } }
```
Asistan sipariş durumu, gecikme, iptal (onaylı), kurye ile iletişim
konularını gerçek veriyle yanıtlar; eksik/yanlış ürün, fatura, temsilci
talebi temsilci kuyruğuna gider. Temsilci kuyruğundayken asistan araya girmez.

## Restoran başvurusu

| Uç nokta | Açıklama |
|---|---|
| `POST /partner/apply` | İşletme başvurusu → `201 { code, businessName, status, createdAt }` |
| `GET /partner/apply?kod=SF-BV-…` | Başvuru durumu |

---

# Restoran Paneli — `/api/v1/vendor`

## Giriş ve kurulum

### `GET /vendor/auth/login`
`{ "demo": true, "accounts": [{ "restaurantId", "name", "emoji", "district", "email" }] }` —
demo modunda tohum hesapları (parola dönmez).

### `POST /vendor/auth/login`
```jsonc
{ "email": "kasap-burger-co@sofra.app", "password": "…" }
→ { "vendor": {…}, "restaurant": {…}, "accessToken", "refreshToken", "expiresAt" }
```
Hatalar: `invalid_credentials` (401), `wrong_account_type` (403 — başka rolün hesabı).

### `GET /vendor/auth/setup?anahtar=…` · `POST /vendor/auth/setup`
Onaylanan başvurunun tek kullanımlık kurulum bağlantısı:
```jsonc
GET  → { "email", "restaurantName", "expiresAt" }
POST { "token": "…", "password": "En-az-10-karakter" } → giriş yükü
```
Hatalar: `invite_not_found` (404), `invite_used`, `invite_expired`, `weak_password`.

### `GET /vendor/auth/me` · `POST /vendor/auth/logout`
`{ "vendor", "restaurant", "summary": { "todayOrders", "todayGross", "pendingCount", "activeCount", … } }`

## Siparişler

### `GET /vendor/orders`
```jsonc
{ "board": { "incoming": [...], "preparing": [...], "onTheWay": [...], "closed": [...] },
  "summary": {…}, "autoAccept": true }
```

### `GET /vendor/orders?gecmis=1&durum=&baslangic=&bitis=&sayfa=`
Sipariş geçmişi (sayfa başına 25):
```jsonc
// durum: all | delivered | cancelled | active · tarih: YYYY-MM-DD (İstanbul günü)
→ { "orders": [...], "page": 1, "pageSize": 25, "total": 16,
    "totals": { "delivered", "cancelled", "gross" } }
```

### `POST /vendor/orders/:id`
```jsonc
{ "action": "approve",   "prepMinutes": 15 }        // onayla (varsayılan: restoranın hazırlık süresi)
{ "action": "prep-time", "prepMinutes": 30 }        // süreyi güncelle
{ "action": "ready" }                               // paket hazır
{ "action": "dispatch" }                            // kendi kuryesi: yola çıktı
{ "action": "deliver" }                             // kendi kuryesi: teslim edildi
{ "action": "reject",    "reason": "Mutfak çok yoğun" }
→ { "order": {…}, "summary": {…} }
```
`reject` online ödemede tutarı cüzdana iade eder. Platform kuryesi
üstlendiyse `dispatch` reddedilir (`courier_owns_delivery`). Diğer hatalar:
`order_not_pending`, `order_not_preparing`, `invalid_prep_time` (5–120 dk),
`order_closed`, `order_not_found`.

## Menü & stok

### `GET /vendor/menu`
`{ "menu": [...], "productCount": 17, "soldOutCount": 1 }`

### `POST /vendor/menu/categories`
```jsonc
{ "action": "upsert", "id"?: "cat_…", "name": "Başlangıçlar", "description"?: "…" }
{ "action": "delete", "id": "cat_…" }
{ "action": "move",   "id": "cat_…", "direction": "up" | "down" }
→ { "menu": [...] }
```

### `POST /vendor/menu/products`
```jsonc
{ "action": "upsert", "id"?: "prd_…", "categoryId": "cat_…", "name": "Şefin Wagyu Burger",
  "description": "…", "emoji": "🍔", "price": 780, "oldPrice": 890, "popular": true,
  "optionGroups": [
    { "name": "Pişirme derecesi", "type": "single", "required": true,
      "options": [{ "name": "Medium rare", "priceDelta": 0, "default": true }] },
    { "name": "Ekstralar", "type": "multi", "maxSelect": 2,
      "options": [{ "name": "Trüf patates", "priceDelta": 140 }] } ] }
{ "action": "delete",       "productId": "prd_…" }
{ "action": "stock",        "productId": "prd_…", "soldOut": true }
{ "action": "option-stock", "productId": "prd_…", "groupId": "grp_…", "optionId": "opt_…", "soldOut": true }
→ { "menu": [...], "productId"?: "prd_…" }
```
Doğrulama hataları: `invalid_name`, `invalid_price`, `invalid_old_price`,
`empty_option_group`, `invalid_group_name`, `invalid_option_name`,
`invalid_option_price`, `multiple_defaults`, `invalid_select_range`.

## Mağaza ayarları

### `GET /vendor/settings` → `{ "restaurant": {…} }`

### `PATCH /vendor/settings`
```jsonc
{ "description": "…",
  "workingHours": { "open": "11:00", "close": "23:30" },
  "breakHours": { "start": "15:00", "end": "16:00" } | null,
  "minBasket": 300, "deliveryFee": 39.9, "freeDeliveryOver": 500 | null,
  "deliveryRadiusKm": 6,
  "deliveryZone": [{ "lat": 40.99, "lng": 29.02 }, …] | null,   // 3–60 köşe; null = yarıçap
  "etaMin": 25, "etaMax": 35, "defaultPrepMinutes": 20,
  "temporarilyClosed": false, "autoAccept": true,
  "soldOutDisplay": "dim" | "hide",
  "paymentMethods": ["online_card", "wallet", "cash_on_delivery"] }
→ { "restaurant": {…} }
```
Hatalar: `invalid_hours`, `invalid_break`, `invalid_break_range`,
`invalid_radius`, `invalid_zone` (köşe sayısı, geçersiz nokta, 40 km'den
uzak köşe), `invalid_eta`, `invalid_eta_range`, `invalid_prep_time`,
`invalid_value`, `no_payment_method`.

## Fotoğraflar

| Uç nokta | Açıklama |
|---|---|
| `GET /vendor/media` | Talepler (en yenisi başta, en fazla 100) |
| `POST /vendor/media` | `multipart/form-data`: `kind` (`cover` / `product`), `productId`, `file` (JPEG/PNG/WebP, ≤ 5 MB) → `201` |
| `DELETE /vendor/media/:id` | Onay bekleyen fotoğrafı geri çeker |
| `GET /media/:file` | Fotoğraf (onaylı: herkese açık, kalıcı önbellek; bekleyen/reddedilen yalnızca restorana ve yöneticiye) |

Dosya içeriği çözülerek doğrulanır, EXIF silinir, WebP'ye çevrilir; kapak
16:9, ürün 4:3 kırpılır. Dosyalar Supabase Storage'ın özel `media`
bucket'ındadır. Hatalar: `file_required`, `file_too_large` (413),
`invalid_image`, `unsupported_image`, `image_too_small`, `invalid_target`,
`product_not_found`, `media_request_closed`.

## Finans ve değerlendirmeler

### `GET /vendor/finance?donem=day|week|month`
```jsonc
{ "report": { "period", "commissionRate",
    "totals": { "orders", "gross", "commission", "net", "avgBasket", "cancelled", "cancelRate", "deliveryIncome" },
    "buckets": [...], "payouts": [{ "id", "label", "orders", "gross", "commission", "net",
                                    "status": "pending" | "approved" | "paid" }],
    "topProducts": [...] } }
```
Hakediş teslimatla tahakkuk eder; onaylanan haftaya sonradan gelen tutar
ayrı “ek” satırda görünür.

### `GET /vendor/reviews` · `POST /vendor/reviews`
```jsonc
GET  → { "reviews": [...], "rating": 4.7, "ratingCount": 3184, "unanswered": 3 }
POST { "reviewId": "rev_…", "reply": "Teşekkürler!" } → { "review": {…} }
```

---

# Kurye Uygulaması — `/api/v1/courier`

## Giriş ve vardiya

### `GET /courier/auth/login`
`{ "demo": true, "couriers": [{ "id", "name", "emoji", "vehicle", "rating", "online", "status", "phone"? }] }` —
telefon yalnızca demo modunda döner.

### `POST /courier/auth/otp/start` · `POST /courier/auth/otp/verify`
```jsonc
{ "phone": "5321110001" } → { "challengeId", "maskedTarget", "expiresInSeconds", "devCode"? }
{ "challengeId": "otp_…", "code": "123456" }
→ { "courier": {…}, "stats": {…}, "accessToken", "refreshToken", "expiresAt" }
```
Hatalar: `courier_not_found` (404), müşteri OTP hataları. Onaysız kurye
giriş yapar ama mesai açamaz (`courier_not_active`).

### `GET /courier/auth/me` · `POST /courier/auth/logout`
`{ "courier": {…}, "stats": { "online", "todayDeliveries", "todayEarnings", "todayTips", … } }`

### `POST /courier/shift`
`{ "online": true, "point": { "lat", "lng" } }` → `{ "courier", "stats" }`.
Mesai cihazın konumuyla açılır; konumu son 5 dakikada gelmeyen kurye teklif
almaz. Açık teslimat varken kapatılamaz (`active_delivery`); kapatınca
bekleyen teklifler düşer. 15 dakikadır konum gelmeyen (elinde teslimat
olmayan) kurye sunucu tarafından mesaiden düşürülür.

### `POST /courier/location`
`{ "point": { "lat": 40.984, "lng": 29.027 } }` → `{ "courier" }`. Mesaideyken
düzenli gönderilir (teslimatta 3 sn, beklerken 15 sn, dururken dakikada bir
varlık sinyali; mobilde arka planda da). Açık teslimatın canlı konumu da
güncellenir (müşteriye Realtime `courier_moved`, `courierPoint` +
`courierLocatedAt`); aynı nokta tekrar gönderilirse yayın yapılmaz, konum
zamanı 30 sn'de bir tazelenir. Ayağın rotası yoksa ya da kurye rotadan 60
m'den fazla saptıysa yanıttan sonra yeni yol rotası istenir (en fazla 20
sn'de bir).

## Teslimat

### `GET /courier/board`
```jsonc
{ "courier": {…},
  "offer": { "id", "fee", "pickupKm", "dropoffKm", "expiresAt", "secondsLeft": 38, "order": {…} } | null,
  "activeOrder": {…} | null, "stats": {…} }
```
Müşterinin telefonu siparişte yer almaz.

### `POST /courier/offers/:id`
`{ "action": "accept" | "reject" }` → pano gövdesi. Teklif **45 saniye**
geçerli; reddedilen ya da süresi dolan teklif sıradaki en yakın kuryeye
gider, aynı kurye 2 dakika aynı siparişi almaz. Hatalar: `offer_expired`,
`offer_closed`, `already_busy`, `order_taken`.

### `POST /courier/orders/:id`
```jsonc
{ "action": "arrived" }  // Restorana vardım
{ "action": "pickup"  }  // Teslim aldım → sipariş "Yolda"
{ "action": "deliver" }  // Teslim ettim → kazanç ve hakediş yazılır
→ { "order", "courier", "offer", "activeOrder", "stats" }
```
Sıra dışı bildirim `invalid_stage`.

### `POST /courier/orders/:id/call`
Müşteriyi maskeli hattan arama — gövde ve yanıt `POST /orders/:id/call` ile
aynı (`callerRole: "courier"`, platform hattı `0850 000 15 0x`).

## Kazanç ve performans

### `GET /courier/earnings`
`{ "report": { "totals", "buckets", "recent", "payouts" } }` — paket ücreti
`max(45, 35 + toplam_km × 11)` ₺, bahşişin tamamı kuryeye.

### `GET /courier/performance`
`{ "report": { "rating", "ratingCount", "totalDeliveries", "avgDeliveryMinutes", "fastestMinutes", "acceptanceRate", "offers", "avgDistanceKm", "weekDeliveries" } }`

---

# Yönetici Paneli — `/api/v1/admin`

Tüm manuel işlemler iz kaydına (`audit`) yazılır.

## Giriş

### `POST /admin/auth/login`
`{ "email": "yonetim@sofra.app", "password": "…" }` → `{ "admin", "accessToken", "refreshToken", "expiresAt" }`

### `GET /admin/auth/me` · `POST /admin/auth/logout`
```jsonc
{ "admin": {…},
  "kpi": { "activeOrders", "lateOrders", "todayOrders", "todayGmv", "onlineCouriers",
           "openRestaurants", "pendingRestaurants", "pendingCouriers", "pendingPayouts",
           "pendingMedia", "blockedUsers", "waitingSupport" } }
```

## Canlı operasyon ve ayarlar

### `GET /admin/overview`
```jsonc
{ "kpi": {…},
  "live": [{ "order": {…}, "progress", "remainingMinutes", "lateMinutes",
             "severity": "ontime" | "late" | "critical", "waitingCourier": false }],
  "couriers": [{ "id", "name", "emoji", "point", "busy" }],
  "audit": [{ "actor", "action", "target", "detail", "at" }] }
```
Tahmini teslimi 5 dk aşan `late`, 15 dk aşan `critical`. `waitingCourier`:
hazırlanıyor ama vardiyadaki kuryeler teklifi karşılıksız bırakıyor.

### `GET /admin/settings` · `PATCH /admin/settings`
```jsonc
{ "demoMode": true } → { "settings": { "demoMode" } }
```
Demo girişleri (sunum): açıkken giriş ekranlarında hazır demo hesapları
görünür. Teslimatı her durumda gerçek kuryeler yapar; simülasyon ve süre
hızlandırma yoktur. Hata: `invalid_setting`.

## Siparişler ve iade

### `GET /admin/orders?q=`
Kod, müşteri adı ya da telefonla arama (en fazla 20). Boş sorguda son
kapanan siparişler → `{ "orders": [...] }`.

### `POST /admin/orders/:id`
```jsonc
{ "action": "cancel", "reason": "Restoran ulaşılamıyor" }  → { "order" }
{ "action": "refund", "amount": 75, "reason": "Eksik ürün" } → { "order", "refunded", "balance" }
```
İade kalan tutarla sınırlıdır (`refunded_total` ≤ tutar); teslim edilmiş
siparişe de yapılır, kapıda ödemede yalnızca tahsilattan sonra. Hatalar:
`order_closed`, `invalid_amount`, `amount_too_large`, `already_refunded`,
`not_collected`.

## Restoranlar, görseller, kuryeler, müşteriler

### `GET /admin/restaurants` · `POST /admin/restaurants/:id`
```jsonc
{ "action": "approve" }                    // yayına al; başvurudan gelen hesap için kurulum bağlantısı üretir
{ "action": "suspend", "reason": "…" }
{ "action": "pending" }
{ "action": "invite" }                     // kurulum bağlantısını yeniden üret
{ "action": "commission", "rate": 0.15 }   // %0–40
{ "action": "feature", "rank": 1 | null }  // öne çıkanlar sırası
→ { "rows": [...], "invite": { "email", "setupPath": "/isletme-kurulum?anahtar=…", "delivered": false } | null }
```
E-posta sağlayıcısı bağlı değilken kurulum bağlantısı yöneticiye döner
(`delivered: false`).

### `GET /admin/media` · `POST /admin/media/:id`
`{ "action": "approve" }` ya da `{ "action": "reject", "reason": "…" }` → `{ "rows" }`
(`reason_required`, `media_request_closed`, `product_not_found`).

### `GET /admin/couriers` · `POST /admin/couriers/:id`
`{ "action": "activate" | "suspend" | "pending", "reason"? }` → `{ "rows" }`.
Askıya alınan kurye derhal mesaiden düşer.

### `GET /admin/users?q=` · `POST /admin/users/:id`
```jsonc
{ "action": "block", "reason": "…" } | { "action": "unblock" } | { "action": "credit", "amount": 150, "reason": "…" }
→ { "rows": [...] }
```
Kara listedeki kullanıcının Auth hesabı yasaklanır; oturumu anında düşer,
yeniden giremez (`account_blocked`). Bakiye eksiye düşemez (`negative_balance`).

## Canlı destek

### `GET /admin/support?durum=open|closed|all`
```jsonc
→ { "sessions": [{ "id", "status", "topic", "customer": { "id", "name", "phone" },
                   "orderId", "orderCode", "assignedAdmin": { "id", "name" } | null,
                   "lastMessage": { "role", "text", "at" }, "createdAt", "updatedAt" }],
    "counts": { "waiting": 1, "withAgent": 0 } }
```
Temsilci bekleyenler listenin başında.

### `GET /admin/support/:id` · `POST /admin/support/:id`
```jsonc
GET  → { "info": {…}, "session": {…}, "recentOrders": [...] }
POST { "action": "claim" }                          // üstlen
     { "action": "message", "text": "Merhaba…" }    // yaz (bekleyeni otomatik üstlenir)
     { "action": "release" }                        // kuyruğa geri bırak
     { "action": "close" }                          // kapat
→ GET gövdesi
```
Müşteri her adımı Realtime ile anında görür. Hatalar: `empty_message`,
`session_not_found`, `unknown_action`.

## Pazarlama

### `GET /admin/marketing` · `POST /admin/marketing`
```jsonc
{ "action": "coupon-upsert", "coupon": {…}, "originalCode"?: "ESKIKOD" }
{ "action": "coupon-toggle" | "coupon-delete", "code": "YENI50" }
{ "action": "banner-upsert", "banner": {…} }
{ "action": "banner-move", "id": "bn_…", "direction": "up" | "down" }
{ "action": "banner-delete", "id": "bn_…" }
{ "action": "push-send", "push": { "title", "body", "segment": "all" | "active" | "lapsed" | "new", "districts": ["Kadıköy"] } }
→ { "coupons", "banners", "campaigns", "districts", "restaurants", "sent"? }
```
Push kampanyası hedef kitlenin bildirim kutusuna yazılır ve tarayıcı
bildirimi olarak iletilir. `GET`'e `?segment=&districts=` eklenirse
`audienceCount` döner.

## Finans

### `GET /admin/finance`
```jsonc
{ "summary": { "gmv", "productValue", "commission", "serviceFees", "deliveryFees", "discounts",
               "courierCost", "gatewayCost", "refunds", "netRevenue", "orders", "cancelled", "avgOrderValue" },
  "buckets": [{ "key", "label", "orders", "gmv", "netRevenue" }],
  "gateway": [{ "method", "label", "orders", "volume", "gatewayFee", "successRate", "refunded", "settlement" }],
  "payouts": [...], "payoutTotals": { "pending", "approved", "paid" } }
```
```
net gelir = komisyon + hizmet bedeli + platform teslimat ücreti
            − kurye ödemeleri − karşılanan indirimler − geçit komisyonu − manuel iadeler
```
Online ödemede geçit komisyonu %1,8 + 0,25 ₺.

### `POST /admin/payouts/:id`
`{ "action": "approve" }` (pending → approved, tutar donar) · `{ "action": "pay" }`
(approved → paid) → finans gövdesi. Onaysız ödeme `not_approved`.
