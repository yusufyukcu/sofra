# Sofra — Mobil Uygulama

Expo (SDK 57) + React Native ile yazılmış müşteri ve kurye uygulaması.
Web uygulamasının kullandığı `/api/v1` uç noktalarının aynısına bağlanır;
backend Supabase üzerindedir, mobil için ayrı bir sunucu yok.

## Çalıştırma

Önce **kök dizinde** web sunucusunu başlat — mobil uygulama API'yi oradan alır
(kurulum: kök `README.md` → Hızlı başlangıç):

```bash
cd ..
npm run dev            # http://localhost:3000
```

Sonra bu klasörde:

```bash
npm install
npx expo start
```

| Tuş | Hedef |
|-----|-------|
| `w` | Tarayıcı (hızlı bakmak için) |
| `i` | iOS simülatörü (macOS) |
| `a` | Android emülatörü |
| QR  | Telefonda **Expo Go** |

Telefonla denerken bilgisayar ve telefon aynı Wi-Fi ağında olmalı. Uygulama
sunucu adresini Expo'nun bildirdiği LAN adresinden kendisi bulur; elle
ayarlamak istersen:

```bash
EXPO_PUBLIC_SOFRA_API=http://192.168.1.42:3000 npx expo start
```

Bağlı olduğun adresi **Hesabım → Bağlı sunucu** altında görebilirsin.

**Giriş:** müşteri telefon + kod ya da demo hesabı; kurye telefon
(532 111 00 01–04) + kod. SMS test modundayken kod ekranda gösterilir.

## Ne var

**Müşteri** (alt sekmeler)

| Ekran | İçerik |
|---|---|
| Keşfet | Konum, kampanya vitrini, **öne çıkanlar**, kategori şeridi, sıralama, **hızlı filtreler** (açık, ücretsiz teslimat, 4,5+ puan, 30 dk altı) |
| Ara | Restoran / mutfak / ürün araması |
| Siparişlerim | Aktif siparişler üstte, geçmiş altta; tekrarla ve değerlendir |
| Hesabım | Cüzdan, adresler (seç / **ekle**), **bildirimler**, **kartlarım**, **canlı destek**, kurye moduna geçiş |

Yığın ekranları: restoran + menü, ürün seçim yaprağı (varyantlar), sepet,
ödeme (kayıtlı kart, kart ekleme, adres ekleme), canlı sipariş takibi
(**maskeli arama**, destek), değerlendirme (puan + bahşiş), adres ekleme
(GPS + ters coğrafi kodlama), kartlar (test kartlarıyla), bildirimler,
canlı destek sohbeti, giriş.

**Kurye** (`/kurye`, alt sekmeler)

| Ekran | İçerik |
|---|---|
| Teslimat | Mesai anahtarı, 45 sn'lik teklif, aktif teslimat, aşama bildirimi, **maskeli arama** |
| Kazanç | Günlük kırılım, son teslimatlar, hakediş defteri |
| Performans | Puan, kabul oranı, süre ve teklif dağılımı |

Kurye modu aynı uygulamanın içinde ama **ayrı oturum**: farklı token,
farklı uç noktalar, ayrı "oturum düştü" işleyicisi. Kurye oturumu düşünce
müşteri oturumu etkilenmez.

## Oturum

Girişte sunucu erişim token'ı (1 saat), yenileme token'ı ve bitiş anını
döndürür; üçü cihazın güvenli alanında (Keychain / EncryptedSharedPreferences)
tutulur. Erişim token'ının bitmesine 2 dakika kala ya da sunucu 401
dönerse `POST /api/v1/auth/refresh` ile yenisi alınır ve istek bir kez
tekrarlanır (`src/lib/api.ts`, ortak `refreshOnUnauthorized`). Yenileme de
reddedilirse giriş ekranına dönülür.

## Web ile ne paylaşıyor

`@sofra/core` (`../packages/core`) — arayüz kütüphanesinden bağımsız çekirdek:
alan modeli, fiyat ve kupon hesabı, keşif filtreleri, sepet kuralları,
biçimlendiriciler, kart numarası denetimi, API istemcisi ve **tasarım
jetonları**. Palet tutarlılığı: `cd .. && npm run check:theme`.

## Mobile özgü olanlar

| Konu | Web | Mobil |
|---|---|---|
| Kimlik | `httpOnly` çerez | Bearer + yenileme token'ı, cihazın güvenli alanı |
| Canlı veri | Supabase Realtime | Aynı GET uçlarını yoklama (takip 2 sn, kurye 3 sn) |
| Harita | Leaflet | OpenStreetMap karoları + `react-native-svg` katmanı |
| Kurye konumu | Simüle sürüş / cihaz | Cihazın GPS akışı (`expo-location`) |
| Geri bildirim | Görsel | Görsel + haptik |
| Yol tarifi | Google Haritalar bağlantısı | Cihazın harita uygulaması |

Uygulama arka plana alındığında yoklama durur, öne geldiğinde kaldığı
yerden devam eder. Realtime'ın mobile taşınması yalnızca
`src/lib/use-live.ts` kancasını değiştirir.

## Komutlar

```bash
npx expo start          # geliştirme sunucusu
npx tsc --noEmit        # tip denetimi
npx expo-doctor         # bağımlılık ve yapılandırma denetimi
npx expo export --platform android   # native paket üretimi (doğrulama)
```

## Bilinen sınırlar

- **Harita sürüklenmiyor / yakınlaştırılmıyor.** İlgili noktalara kendini
  oturtur; `expo-maps` Expo Go'da yok, `react-native-maps` native derleme istiyor.
- **Mobil push bildirimi yok.** Bildirimler uygulama içindeki kutuda;
  cihaza push için Expo Notifications + EAS gerekir (sunucu tarafında
  `push_subscriptions.kind = 'expo'` hazır).
- **Canlı veri yoklamayla** gelir (web Realtime kullanır).
- **Maskeli arama ve ödeme test modunda:** arama simüle edilir, yalnızca
  test kartları kabul edilir.
