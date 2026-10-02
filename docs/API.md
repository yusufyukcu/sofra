# API Sözleşmesi — `/api/v1`

Web istemcisi ve ileride yazılacak mobil uygulama aynı uç noktaları kullanır.

## Ortak kurallar

**Cevap zarfı**

```jsonc
{ "ok": true,  "data": { /* ... */ } }
{ "ok": false, "error": { "code": "coupon_expired", "message": "Bu kampanyanın süresi dolmuş." } }
```

`code` makine tarafından okunur, `message` kullanıcıya doğrudan gösterilebilir.

**Kimlik doğrulama** — iki yol da kabul edilir:

| İstemci | Yöntem |
|---|---|
| Web | `sofra_session` adlı `httpOnly` çerez (giriş uç noktaları otomatik kurar) |
| Mobil | `Authorization: Bearer <accessToken>` (giriş cevabında döner) |

Her giriş uç noktası hem çerezi kurar hem `accessToken` döndürür; istemci
hangisini kullanacağına kendisi karar verir. Mobil uygulama token'ı cihazın
güvenli alanında saklar. Dört rolün dördü de aynı deseni izler:

| Rol | Çerez | JWT `audience` | Süre |
|---|---|---|---|
| Müşteri | `sofra_session` | `sofra-customer` | 30 gün |
| Restoran | `sofra_vendor` | `sofra-vendor` | 12 saat |
| Kurye | `sofra_courier` | `sofra-courier` | 12 saat |
| Yönetici | `sofra_admin` | `sofra-admin` | 4 saat |

Bir rolün token'ı diğerinin ucunda çalışmaz — `audience` doğrulaması
reddeder (`vendor_unauthorized`, `courier_unauthorized`, `admin_unauthorized`).

**HTTP durum kodları** — `200` / `201` başarı, `400` iş kuralı ihlali,
`401` oturum yok, `404` bulunamadı, `500` beklenmeyen hata.

**CORS** — geliştirmede yerel kökenlere (`localhost`, `127.0.0.1`, LAN IP)
izin verilir; mobil uygulamanın web derlemesi farklı bir porttan servis
edildiği için gerekli. Native derlemede CORS diye bir şey yoktur. Üretimde
kapalıdır; orada izin verilen kökenler açıkça listelenir (`proxy.ts`).

**Akış uçları** — `/stream` ile biten uç noktalar Server-Sent Events yayar.
React Native'de `EventSource` bulunmadığı için mobil istemci aynı yolun
`/stream`'siz **GET karşılığını** düzenli aralıkla yoklar; gövde birebir
aynıdır.

| SSE | GET karşılığı | Gövde |
|---|---|---|
| `GET /orders/:id/stream` | `GET /orders/:id` | `{ order, progress, remainingMinutes }` |
| `GET /courier/board/stream` | `GET /courier/board` | `{ courier, offer, activeOrder, stats }` |
| `GET /vendor/orders/stream` | `GET /vendor/orders` | `{ board }` |
| `GET /admin/overview/stream` | `GET /admin/overview` | `{ kpi, live, couriers, audit }` |

> `progress` **0–1 aralığında** bir orandır, yüzde değil.

---

## Kimlik doğrulama

### `POST /auth/otp/start`
```jsonc
// istek
{ "channel": "phone" | "email", "target": "5551112233" }
// cevap
{ "challengeId": "otp_…", "maskedTarget": "0555 *** ** 33",
  "expiresInSeconds": 180, "devCode": "483920" }
```
> `devCode` yalnızca prototipte döner; üretimde SMS/e-posta ile gönderilir.

### `POST /auth/otp/verify`
```jsonc
{ "challengeId": "otp_…", "code": "483920", "name": "Ad Soyad" }
→ { "user": {…}, "accessToken": "eyJ…", "addresses": [], "isNewUser": true }
```

### `POST /auth/social`
```jsonc
{ "provider": "google" | "apple" }  → { "user", "accessToken", "addresses", "isNewUser" }
```

### `POST /auth/demo`
Hazır demo hesabıyla giriş (yalnızca prototip).

### `GET /auth/me`
Açılışta tek istekte önyükleme:
```jsonc
{ "user": {…}, "addresses": [...], "cards": [...], "activeOrders": [...] }
```

### `PATCH /auth/me`
```jsonc
{ "name": "…", "email": "…", "phone": "…", "avatarEmoji": "🧑" } → { "user" }
```

### `POST /auth/logout`

---

## Adresler

| Uç nokta | Açıklama |
|---|---|
| `GET /addresses` | Adres defteri |
| `POST /addresses` | Yeni adres — `point {lat,lng}` **zorunlu** |
| `PATCH /addresses/:id` | Güncelle |
| `DELETE /addresses/:id` | Sil (varsayılansa bir sonraki varsayılan olur) |
| `POST /addresses/:id/default` | Varsayılan yap |

Adres gövdesi:
```jsonc
{ "label": "ev" | "is" | "diger", "title": "Evim",
  "line1": "Caferağa Mah. Moda Cad. No:42", "district": "Kadıköy", "city": "İstanbul",
  "buildingNo": "42", "floor": "3", "apartmentNo": "7",
  "directions": "Zile 2 kez basın", "contactName": "…", "contactPhone": "…",
  "point": { "lat": 40.9872, "lng": 29.0263 }, "isDefault": true }
```

---

## Keşif

### `GET /restaurants`

| Parametre | Örnek | Açıklama |
|---|---|---|
| `lat`, `lng` | `40.98`, `29.02` | Kullanıcı konumu (yoksa varsayılan merkez) |
| `kategori` | `burger`, `top-rated`, `all` | Mutfak filtresi |
| `q` | `kebap` | Arama |
| `sirala` | `recommended \| rating \| eta \| distance \| minBasket` | Sıralama |
| `puan` | `4.5` | Minimum restoran puanı |
| `sure` | `45` | En fazla teslimat süresi (dk) |
| `sepet` | `300` | En fazla minimum sepet tutarı |
| `acik` | `1` | Yalnızca şu an açık olanlar |
| `ucretsiz` | `1` | Yalnızca ücretsiz teslimat sunanlar |
| `bolge` | `0` | Teslimat bölgesi dışındakileri de listele |

```jsonc
→ { "restaurants": [{ …, "distanceKm": 0.6, "deliverable": true,
                      "open": true, "etaText": "26-36 dk", "isFavorite": false }],
    "total": 16, "filters": {…}, "point": {…}, "categories": [...], "banners": [...] }
```

### `GET /restaurants/:slug?lat=&lng=`
```jsonc
{ "restaurant": { …, "menu": [...] },
  "delivery": { "distanceKm": 0.6, "deliverable": true, "etaText": "26-36 dk", "open": true },
  "isFavorite": false, "reviews": [...] }
```

### `GET /favorites?lat=&lng=` · `POST /favorites`
```jsonc
{ "restaurantId": "rst_kasap" } → { "favoriteIds": [...], "isFavorite": true }
```

---

## Kuponlar & tutarlar

### `GET /coupons`
Kullanıcının kullanabileceği (süresi geçmemiş, daha önce kullanılmamış,
ilk sipariş şartını sağlayan) kampanyalar.

### `POST /coupons/validate`
Kupon doğrulamanın yanı sıra **checkout'un tek doğru tutar kaynağıdır**.

```jsonc
// istek
{ "restaurantId": "rst_kasap", "lines": [...], "code": "BURGER25",
  "paymentMethod": "online_card" }
// cevap
{ "totals": { "subtotal": 665, "deliveryFee": 0, "discount": 166.25,
              "serviceFee": 9.9, "walletUsed": 0, "grandTotal": 508.65 },
  "coupon": { "code": "BURGER25", … }, "meetsMinBasket": true, "minBasket": 300 }
```

Hata kodları: `coupon_not_found`, `coupon_expired`, `coupon_restaurant`,
`coupon_first_order_only`, `coupon_used`, `coupon_min_subtotal`.

---

## Siparişler

### `POST /orders`
```jsonc
{ "restaurantId": "rst_kasap", "addressId": "adr_…",
  "lines": [{ "productId": "kb_p1", "quantity": 1, "note": "Sos ayrı",
              "selections": [{ "groupId": "kb_p1_g1", "optionIds": ["kb_p1_g1_o2"] }] }],
  "couponCode": "BURGER25",
  "paymentMethod": "online_card" | "wallet" | "meal_card"
                 | "card_on_delivery" | "cash_on_delivery",
  "mealCardBrand": "multinet", "cardId": "crd_1",
  "preferences": { "contactless": true, "ringDoorbell": false,
                   "cutlery": true, "note": "Güvenliğe bırakın" } }
→ 201 { "order": {…}, "walletBalance": 450 }
```

> Fiyatlar, adlar ve toplamlar **menüden yeniden hesaplanır**; gövdedeki
> fiyat alanları yok sayılır.

Hata kodları: `restaurant_closed`, `out_of_delivery_zone`, `below_min_basket`,
`product_sold_out`, `option_required`, `option_max`, `option_min`,
`payment_method_unsupported`, `meal_card_required`, `insufficient_wallet`.

### `GET /orders` · `GET /orders/:id`
```jsonc
{ "order": {…}, "progress": 0.57, "remainingMinutes": 2 }
```

### `GET /orders/:id/stream` — Server-Sent Events
```
retry: 3000

event: update
data: {"order":{…},"progress":0.57,"remainingMinutes":2}

event: done
data: {"status":"delivered"}
```
Saniyede bir yayın; sipariş teslim edildiğinde veya iptal olduğunda kapanır.

### `POST /orders/:id/cancel`
```jsonc
{ "reason": "Fikrimi değiştirdim" } → { "order", "walletBalance": 679.8 }
```
Yalnızca `pending_approval` ve `preparing` durumlarında. Online ödemelerde
tutar cüzdana iade edilir. Aksi hâlde `not_cancellable`.

### `POST /orders/:id/rating`
```jsonc
{ "restaurantScore": 5, "restaurantComment": "…",
  "courierScore": 4, "courierComment": "…" } → { "order", "review" }
```
Yalnızca teslim edilmiş ve daha önce puanlanmamış siparişler
(`not_deliverable_yet`, `already_rated`).

### `POST /orders/:id/reorder` — “Tekrar Sipariş Ver”
```jsonc
{ "restaurant": { "id", "name", "slug", "emoji", "minBasket",
                  "deliveryFee", "freeDeliveryOver" },
  "lines": [...],                    // güncel menüye göre doğrulanmış
  "removed": ["BBQ Bacon Burger"] }  // artık satışta olmayanlar
```

---

## Cüzdan

| Uç nokta | Açıklama |
|---|---|
| `GET /wallet` | `{ balance, transactions[] }` — harcama ve iadeler |
| `POST /wallet` | `{ amount: 250 }` → `{ balance }` (ödeme geçidi simüle edilir) |

---

## Destek

### `GET /support/chat?sessionId=&orderId=`
Oturumu getirir veya karşılama mesajıyla başlatır.

### `POST /support/chat`
```jsonc
{ "sessionId": "sup_…", "text": "siparişim nerede",
  "quickReplyId": "cancel_order", "orderId": "ord_…" }
→ { "session": { "id", "messages": [...], "escalated": false } }
```

Bot mesajları `quickReplies: [{ id, label }]` taşıyabilir. Desteklenen
niyetler: sipariş durumu, gecikme, iptal (onaylı), eksik/yanlış ürün,
ödeme & iade, fatura, kurye arama, temsilciye devir.

---

# Restoran Paneli — `/api/v1/vendor`

İşletme uç noktaları ayrı bir oturum kullanır:

| İstemci | Yöntem |
|---|---|
| Panel (web) | `sofra_vendor` adlı `httpOnly` çerez |
| Tablet uygulaması (ileride) | `Authorization: Bearer <accessToken>` |

Müşteri token'ı bu uç noktalarda geçersizdir (`vendor_unauthorized`), ve
her işlem oturumdaki `restaurantId` ile sınırlanır — bir işletme başka bir
işletmenin verisine erişemez.

## Giriş

### `GET /vendor/auth/login`
Giriş ekranındaki restoran seçici için hafif liste (kimlik doğrulama gerekmez).
```jsonc
{ "restaurants": [{ "id", "name", "emoji", "district", "tags" }] }
```

### `POST /vendor/auth/login`
```jsonc
{ "restaurantId": "rst_kasap", "pin": "1234" }
→ { "vendor": { "id", "name", "email" }, "restaurant": {…}, "accessToken": "eyJ…" }
```
Hata: `invalid_pin` (401), `restaurant_not_found` (404).

### `GET /vendor/auth/me`
Panel açılışında tek istekte önyükleme.
```jsonc
{ "vendor": {…}, "restaurant": {…},
  "summary": { "todayOrders", "todayGross", "pendingCount",
               "activeCount", "averageRating", "unansweredReviews" } }
```

### `POST /vendor/auth/logout`

## Siparişler

### `GET /vendor/orders`
```jsonc
{ "board": { "incoming": [...], "preparing": [...],
             "onTheWay": [...], "closed": [...] },
  "summary": {…}, "autoAccept": true }
```
`?gecmis=1` → `{ "orders": [...] }` (tüm geçmiş).

### `GET /vendor/orders/stream` — Server-Sent Events
```
event: board
data: {"board":{…},"summary":{…},"at":"2026-09-30T12:26:31.000Z"}
```
2 saniyede bir yayın. Panel, `incoming` listesindeki yeni kimlikleri
karşılaştırarak zili tetikler.

### `POST /vendor/orders/:id`
Tek uç noktada dört işlem:

```jsonc
{ "action": "approve",   "prepMinutes": 15 }  // onayla, süreyi bildir
{ "action": "prep-time", "prepMinutes": 30 }  // süreyi güncelle
{ "action": "dispatch" }                      // kuryeye teslim → "Yolda"
{ "action": "reject",    "reason": "Mutfak çok yoğun" }
→ { "order": {…}, "summary": {…} }
```

- `approve` siparişi `controlMode: "manual"` yapar, `approvedAt` ve
  `prepMinutes` yazar, müşterinin `etaAt` değerini yeniden hesaplar.
- `reject` online ödemelerde tutarı müşterinin cüzdanına iade eder.
- Kurye yola çıktıysa reddetme engellenir (`order_dispatched`).

Diğer hatalar: `order_not_pending`, `order_not_preparing`,
`invalid_prep_time`, `order_closed`, `order_not_found`.

## Menü & stok

### `GET /vendor/menu`
```jsonc
{ "menu": [...], "productCount": 17, "soldOutCount": 1 }
```

### `POST /vendor/menu/categories`
```jsonc
{ "action": "upsert", "id"?: "cat_…", "name": "Başlangıçlar", "description"?: "…" }
{ "action": "delete", "id": "cat_…" }
{ "action": "move",   "id": "cat_…", "direction": "up" | "down" }
→ { "menu": [...] }
```

### `POST /vendor/menu/products`
```jsonc
// ürün ekle / güncelle — varyant ağacıyla birlikte
{ "action": "upsert", "id"?: "prd_…", "categoryId": "cat_…",
  "name": "Şefin Wagyu Burger", "description": "…", "emoji": "🍔",
  "price": 780, "oldPrice": 890, "popular": true, "soldOut": false,
  "optionGroups": [
    { "name": "Pişirme derecesi", "type": "single", "required": true,
      "options": [{ "name": "Medium rare", "priceDelta": 0, "default": true }] },
    { "name": "Ekstralar", "type": "multi", "maxSelect": 2,
      "options": [{ "name": "Trüf patates", "priceDelta": 140 }] }
  ] }

{ "action": "delete",       "productId": "prd_…" }
{ "action": "stock",        "productId": "prd_…", "soldOut": true }
{ "action": "option-stock", "productId": "prd_…", "groupId": "grp_…",
                            "optionId": "opt_…", "soldOut": true }
→ { "menu": [...], "productId"?: "prd_…" }   // productId yalnızca upsert'te
```

Ürünün fotoğrafı bu uçtan değişmez; `POST /vendor/media` ile yönetici
onayına gönderilir. Silinen ürünün onay bekleyen fotoğrafı da düşer.

Doğrulama hataları: `invalid_name`, `invalid_price`, `invalid_old_price`,
`empty_option_group`, `invalid_group_name`, `invalid_option_name`,
`invalid_option_price`, `multiple_defaults`, `invalid_select_range`.

> Menü kaydedildiği anda müşteri uygulamasına yansır — restoran sayfası
> `dynamic = "force-dynamic"` olarak işaretlidir.

## Mağaza ayarları

### `GET /vendor/settings` → `{ "restaurant": {…} }`

### `PATCH /vendor/settings`
```jsonc
{ "description": "…",
  "workingHours": { "open": "11:00", "close": "23:30" },
  "breakHours": { "start": "15:00", "end": "16:00" } | null,
  "minBasket": 300, "deliveryFee": 39.9, "freeDeliveryOver": 500 | null,
  "deliveryRadiusKm": 6, "etaMin": 25, "etaMax": 35,
  "temporarilyClosed": false, "autoAccept": true,
  "paymentMethods": ["online_card", "wallet", "cash_on_delivery"] }
→ { "restaurant": {…} }
```
Hatalar: `invalid_hours`, `invalid_break`, `invalid_break_range`,
`invalid_radius`, `invalid_eta`, `invalid_eta_range`, `invalid_value`,
`no_payment_method`.

## Fotoğraflar

Restoranın kapak ve ürün fotoğrafları doğrudan yayına girmez: yönetici
onaylayınca kapağa ya da ürüne işlenir (`POST /admin/media/:id`).

### `GET /vendor/media`
```jsonc
{ "requests": [{ "id": "med_…", "target": { "kind": "cover" }
                   | { "kind": "product", "productId": "prd_…" },
                 "targetName": "Adana Kebap", "url": "/media/med_….webp",
                 "width": 1200, "height": 900, "bytes": 98312,
                 "status": "pending" | "approved" | "rejected",
                 "rejectReason"?: "…", "createdAt", "decidedAt"? }] }
```
En yenisi başta, en fazla 100 kayıt.

### `POST /vendor/media` — `multipart/form-data`
| Alan | Değer |
|---|---|
| `kind` | `cover` ya da `product` |
| `productId` | `kind=product` ise ürün kimliği |
| `file` | JPEG, PNG ya da WebP, en fazla 5 MB |

```jsonc
→ 201 { "request": {…}, "requests": [...] }
```
Dosya içeriği çözülerek doğrulanır, EXIF (konum dahil) silinir ve WebP'ye
çevrilir. Kapak 16:9'a (en az 960 px), ürün 4:3'e (en az 480 px) kırpılır;
büyütülmez. Aynı hedefe bekleyen eski fotoğrafın yerini alır.
Hatalar: `file_required`, `file_too_large` (413), `invalid_image`,
`unsupported_image`, `image_too_small`, `invalid_target`, `product_not_found`.

### `DELETE /vendor/media/:id`
Onay bekleyen fotoğrafı geri çeker → `{ "requests": [...] }`.
Sonuçlanmış talep geri çekilemez (`media_request_closed`).

### `GET /media/:file`
Fotoğrafın kendisi. Onaylanan herkese açık ve kalıcı önbellekli
(`immutable`). Onay bekleyen ya da reddedilen yalnızca yükleyen restorana ve
yöneticiye görünür; diğerlerine `404`.

## Finans

### `GET /vendor/finance?donem=day|week|month`
```jsonc
{ "report": {
    "period": "day", "commissionRate": 0.12,
    "totals": { "orders", "gross", "commission", "net",
                "avgBasket", "cancelled", "cancelRate" },
    "buckets": [{ "key", "label", "orders", "gross", "commission", "net" }],
    "payouts": [{ "id", "label", "orders", "gross", "commission", "net",
                  "status": "paid" | "processing" | "pending", "date" }],
    "topProducts": [{ "name", "quantity", "revenue" }] } }
```

Restoranın brüt cirosu = ürün ara toplamı. Teslimat ve hizmet bedeli
platforma aittir. Net hakediş = brüt − platform komisyonu.

## Değerlendirmeler

### `GET /vendor/reviews`
```jsonc
{ "reviews": [...], "rating": 4.7, "ratingCount": 3184, "unanswered": 3 }
```

### `POST /vendor/reviews`
```jsonc
{ "reviewId": "rev_…", "reply": "Geri bildiriminiz için teşekkürler!" }
→ { "review": {…} }
```
Cevap, müşterinin gördüğü restoran sayfasında anında yayınlanır.

---

# Kurye Uygulaması — `/api/v1/courier`

Üçüncü ve son oturum türü. Müşteri ve işletme oturumlarından ayrıdır:

| İstemci | Yöntem |
|---|---|
| Kurye web uygulaması | `sofra_courier` adlı `httpOnly` çerez |
| Mobil kurye uygulaması (ileride) | `Authorization: Bearer <accessToken>` |

Üç oturum aynı tarayıcıda birlikte açık kalabilir. Her işlem oturumdaki
kurye kimliğiyle sınırlanır; PIN hiçbir cevapta dönmez.

## Giriş ve vardiya

### `GET /courier/auth/login`
Giriş ekranındaki kurye seçicisi (kimlik doğrulama gerekmez).
```jsonc
{ "couriers": [{ "id", "name", "emoji", "vehicle", "rating", "online" }] }
```

### `POST /courier/auth/login`
```jsonc
{ "courierId": "crr_1", "pin": "1234" }
→ { "courier": {…}, "accessToken": "eyJ…" }
```

### `GET /courier/auth/me` · `POST /courier/auth/logout`
```jsonc
{ "courier": {…}, "stats": { "online", "todayDeliveries", "todayEarnings",
                             "todayTips", "weekEarnings", "totalDeliveries", "rating" } }
```

### `POST /courier/shift` — mesai başlat / bitir
```jsonc
{ "online": true } → { "courier", "stats" }
```
Üzerinde açık teslimat varken mesai kapatılamaz (`active_delivery`).
Mesai kapatıldığında bekleyen teklifler düşer.

### `POST /courier/location` — konum bildirimi
```jsonc
{ "point": { "lat": 40.984, "lng": 29.027 } } → { "courier" }
```
Açık teslimat varsa siparişin `courierPoint` alanı da güncellenir; müşterinin
canlı takip haritası bu alandan beslenir.

## Teslimat panosu

### `GET /courier/board`
```jsonc
{ "courier": {…},
  "offer": { "id", "fee", "pickupKm", "dropoffKm",
             "secondsLeft": 38, "order": {…} } | null,
  "activeOrder": {…} | null,
  "stats": {…} }
```

### `GET /courier/board/stream` — Server-Sent Events
```
event: board
data: {"courier":{…},"offer":{…},"activeOrder":{…},"stats":{…}}
```
Saniyede bir yayın — teklifin kalan süresi böyle geri sayar.

### `POST /courier/offers/:id` — atanan siparişi kabul/ret
```jsonc
{ "action": "accept" | "reject" } → { "courier", "offer", "activeOrder", "stats" }
```

Teklifler **45 saniye** geçerlidir. Süre dolarsa veya kurye reddederse
sipariş sıradaki en yakın uygun kuryeye geçer; aynı kuryeye ikinci kez
gönderilmez. Hatalar: `offer_expired`, `offer_closed`, `already_busy`,
`order_taken`.

### `POST /courier/orders/:id` — aşama bildirimleri
```jsonc
{ "action": "arrived" }  // Restorana vardım
{ "action": "pickup"  }  // Teslim aldım  → sipariş "Yolda"ya geçer
{ "action": "deliver" }  // Teslim ettim  → sipariş kapanır, kazanç yazılır
→ { "order", "courier", "offer", "activeOrder", "stats" }
```
Sıra dışı bildirim reddedilir (`invalid_stage`).

## Kazanç ve performans

### `GET /courier/earnings`
```jsonc
{ "report": {
    "totals": { "deliveries", "fee", "tip", "total" },
    "buckets": [{ "key", "label", "deliveries", "fee", "tip", "total" }],
    "recent": [{ "orderCode", "restaurantName", "fee", "tip",
                 "distanceKm", "durationMinutes", "at" }],
    "payouts": [{ "label", "deliveries", "total",
                  "status": "paid" | "processing" | "pending" }] } }
```

Paket ücreti: `max(45, 35 + toplam_km × 11)` ₺. Bahşiş müşterinin
değerlendirme ekranından bırakılır ve tamamı kuryeye gider.

### `GET /courier/performance`
```jsonc
{ "report": { "rating", "ratingCount", "totalDeliveries",
              "avgDeliveryMinutes", "fastestMinutes", "acceptanceRate",
              "offers": { "accepted", "rejected", "expired" },
              "avgDistanceKm", "weekDeliveries" } }
```

## Müşteri ve işletme tarafındaki değişiklikler

| Uç nokta | Değişiklik |
|---|---|
| `POST /orders/:id/rating` | `courierTip` alanı eklendi — cüzdandan düşer, kuryenin kazancına yazılır |
| `POST /vendor/orders/:id` | `ready` aksiyonu eklendi (paket hazır). Platform kuryesi üstlendiyse `dispatch` reddedilir (`courier_owns_delivery`) |
| `GET /orders/:id` | `courierStage`, `courierArrivedAt`, `readyAt`, `courierFee` alanları döner |

---

# Yönetici Paneli — `/api/v1/admin`

Dördüncü ve son oturum türü. Diğer üçünden ayrı çerez (`sofra_admin`) ve
`audience` kullanır; müşteri, işletme veya kurye token'ı burada geçersizdir.
Oturum süresi kasıtlı olarak kısa (4 saat).

Tüm manuel işlemler iz kaydına (`audit`) yazılır: kim, ne zaman, neyi, neden.

## Giriş

### `POST /admin/auth/login`
```jsonc
{ "pin": "1234" } → { "admin": {…}, "accessToken": "eyJ…" }
```

### `GET /admin/auth/me` · `POST /admin/auth/logout`
```jsonc
{ "admin": {…},
  "kpi": { "activeOrders", "lateOrders", "todayOrders", "todayGmv",
           "onlineCouriers", "openRestaurants", "pendingRestaurants",
           "pendingCouriers", "pendingPayouts", "pendingMedia",
           "blockedUsers" } }
```

## Canlı operasyon

### `GET /admin/overview` · `GET /admin/overview/stream` (SSE)
```jsonc
{ "kpi": {…},
  "live": [{ "order": {…}, "progress": 0.4, "remainingMinutes": 8,
             "lateMinutes": -3, "severity": "ontime" | "late" | "critical" }],
  "couriers": [{ "id", "name", "emoji", "point", "busy" }],
  "audit": [{ "actor", "action", "target", "detail", "at" }] }
```

Tahmini teslim saatini **5 dakika** aşan sipariş `late`, **15 dakika** aşan
`critical` olur. SSE iki saniyede bir yayınlar.

### `POST /admin/orders/:id` — manuel iptal ve iade
```jsonc
{ "action": "cancel", "reason": "Restoran ulaşılamıyor" }
{ "action": "refund", "amount": 75, "reason": "Gecikme jesti" }
→ { "order" } | { "order", "refunded", "balance" }
```
Tutar müşterinin cüzdanına eklenir. Hatalar: `order_closed`,
`amount_too_large`, `invalid_amount`.

## Restoran yönetimi

### `GET /admin/restaurants`
```jsonc
{ "rows": [{ "restaurant": {…}, "orders", "gmv",
             "commissionEarned", "rating", "open" }] }
```
Onay bekleyenler listenin başında döner.

### `POST /admin/restaurants/:id`
```jsonc
{ "action": "approve" }                    // yayına al
{ "action": "suspend", "reason": "…" }     // askıya al
{ "action": "pending" }                    // onay kuyruğuna geri al
{ "action": "commission", "rate": 0.15 }   // restoran bazlı komisyon
→ { "rows": [...] }
```
Onaylanmayan restoran müşteri uygulamasında **hiç görünmez** (liste, arama
ve restoran sayfası 404). Komisyon oranı %0–%40 arasında olmalı
(`invalid_rate`) ve restoranın Finans ekranına anında yansır.

## Görsel onayları

### `GET /admin/media`
```jsonc
{ "rows": [{ "request": {…},
             "restaurant": { "id", "name", "emoji", "district", "image" },
             "currentImage"?: "/images/food/…",   // hedefin yayındaki fotoğrafı
             "targetExists": true }] }            // ürün silinmişse false
```
Bekleyenler geliş sırasıyla başta, ardından son 60 karar.

### `POST /admin/media/:id`
```jsonc
{ "action": "approve" }                                 // kapağa / ürüne işle
{ "action": "reject", "reason": "Fotoğraf ürünle uyuşmuyor" }
→ { "rows": [...] }
```
Onaylanan fotoğraf müşteri sitesinde anında görünür. Ret gerekçesi zorunlu
(`reason_required`) ve restoran panelinde görünür. Karar iz kaydına yazılır.
Hatalar: `media_request_closed`, `product_not_found` (409 — ürün menüden
kaldırılmış).

## Kurye yönetimi

### `GET /admin/couriers` · `POST /admin/couriers/:id`
```jsonc
{ "action": "activate" | "suspend" | "pending", "reason"?: "…" }
→ { "rows": [{ "courier": {…}, "deliveries", "earnings", "busy" }] }
```
`pending` ve `suspended` kuryeler mesaiye başlayamaz
(`courier_not_active`); askıya alınan kurye derhal mesaiden düşer.

## Müşteri yönetimi

### `GET /admin/users?q=` · `POST /admin/users/:id`
```jsonc
{ "action": "block", "reason": "Sahte sipariş şikâyeti" }
{ "action": "unblock" }
{ "action": "credit", "amount": 150, "reason": "Gecikme tazminatı" }
→ { "rows": [{ "user": {…}, "orders", "spent", "lastOrderAt" }] }
```
Kara listedeki kullanıcının **oturumu anında geçersiz olur**, yeniden giriş
yapamaz (`account_blocked`) ve sipariş veremez. Manuel bakiye işlemi negatif
de olabilir; bakiye eksiye düşemez (`negative_balance`).

## Pazarlama

### `GET /admin/marketing`
```jsonc
{ "coupons": [...], "banners": [...], "campaigns": [...],
  "districts": ["Kadıköy", …], "restaurants": [{ "id", "name", "emoji" }] }
```
`?segment=all|active|lapsed|new&districts=Kadıköy,Üsküdar` eklenirse
gönderim öncesi hedef kitle sayısı da döner (`audienceCount`).

### `POST /admin/marketing`
```jsonc
{ "action": "coupon-upsert", "coupon": {…}, "originalCode"?: "ESKIKOD" }
{ "action": "coupon-toggle", "code": "YENI50" }   // yayına al / kaldır
{ "action": "coupon-delete", "code": "YENI50" }

{ "action": "banner-upsert", "banner": {…} }
{ "action": "banner-move", "id": "bn_…", "direction": "up" | "down" }
{ "action": "banner-delete", "id": "bn_…" }

{ "action": "push-send",
  "push": { "title", "body", "segment", "districts": ["Kadıköy"] } }
→ { "coupons", "banners", "campaigns", "districts", "restaurants", "sent"? }
```

Yayından kaldırılan kod ödeme adımında reddedilir (`coupon_inactive`).
Afiş sırası anasayfa vitrinindeki dönüş sırasını belirler.

Push segmentleri: `all` (kara listedekiler hariç), `active` (son 30 günde
sipariş verenler), `lapsed` (30 gündür vermeyenler), `new` (hiç sipariş
vermemişler). Bölge filtresi kullanıcının kayıtlı adreslerinden eşleşir.

## Finansal mutabakat

### `GET /admin/finance`
```jsonc
{ "summary": { "gmv", "productValue", "commission", "serviceFees",
               "deliveryFees", "discounts", "courierCost", "gatewayCost",
               "netRevenue", "orders", "cancelled", "avgOrderValue" },
  "buckets": [{ "key", "label", "orders", "gmv", "netRevenue" }],
  "gateway": [{ "method", "label", "orders", "volume",
                "gatewayFee", "settlement" }],
  "payouts": [{ "id", "kind", "targetName", "periodLabel", "orders",
                "gross", "commission", "tips", "net", "status" }],
  "payoutTotals": { "pending", "approved", "paid" } }
```

Hesap:
```
GMV        = teslim edilen siparişlerin müşteri ödemeleri toplamı
net gelir  = komisyon + hizmet bedeli + teslimat ücreti
             − kurye ödemeleri − karşılanan indirimler − geçit komisyonu
```
Online ödemede geçit komisyonu **%1,8 + 0,25 ₺**; kapıda ödeme ve cüzdan
harcamalarında kesinti yoktur.

### `POST /admin/payouts/:id`
```jsonc
{ "action": "approve" }   // pending → approved (tutar dondurulur)
{ "action": "pay" }       // approved → paid
→ { "summary", "buckets", "gateway", "payouts", "payoutTotals" }
```
Onaylanmadan ödeme yapılamaz (`not_approved`). Durum **aynı anda** restoran
panelinde ve kurye uygulamasında görünür — üçü aynı hakediş defterini okur.
