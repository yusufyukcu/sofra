# Sofra — Mobil Uygulama

Expo (SDK 57) + React Native ile yazılmış müşteri ve kurye uygulaması.
Web uygulamasının kullandığı `/api/v1` uç noktalarının aynısına bağlanır;
mobil için ayrı bir backend yok.

## Çalıştırma

Önce **kök dizinde** web sunucusunu başlat — mobil uygulama API'yi oradan alır:

```bash
cd ..
npm run dev            # http://localhost:3000
```

Sonra bu klasörde:

```bash
npm install
npx expo start
```

Açılan ekrandan:

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

Bağlı olduğun adresi uygulamada **Hesabım → Bağlı sunucu** altında görebilirsin.

## Ne var

**Müşteri** (alt sekmeler)

| Ekran | İçerik |
|---|---|
| Keşfet | Konum, kampanya vitrini, kategori şeridi, sıralama, restoran listesi |
| Ara | Restoran / mutfak / ürün araması, popüler mutfak önerileri |
| Siparişlerim | Aktif siparişler üstte, geçmiş altta; tekrarla ve değerlendir |
| Hesabım | Cüzdan, adresler, kayıtlı kartlar, kurye moduna geçiş |

Yığın ekranları: restoran + menü, ürün seçim yaprağı (varyantlar), sepet,
ödeme, canlı sipariş takibi, değerlendirme (puan + bahşiş), giriş.

**Kurye** (`/kurye`, alt sekmeler)

| Ekran | İçerik |
|---|---|
| Teslimat | Mesai anahtarı, 45 sn'lik teklif, aktif teslimat ve aşama bildirimi |
| Kazanç | Günlük kırılım, son teslimatlar, hakediş defteri |
| Performans | Puan, kabul oranı, süre ve teklif dağılımı |

Kurye modu aynı uygulamanın içinde ama **ayrı oturum**: farklı token, farklı
uç noktalar. Müşteri oturumu açıkken kurye olarak da girebilirsin.

## Web ile ne paylaşıyor

`@sofra/core` (`../packages/core`) — arayüz kütüphanesinden bağımsız çekirdek:

- alan modeli (`types`)
- fiyat ve kupon hesabı (`pricing`)
- restoran filtreleme ve sıralama (`discovery`)
- sepet kuralları (`cart`)
- biçimlendiriciler ve mesafe (`utils`)
- API istemcisi (`api-client`)
- **tasarım jetonları** (`theme`) — palet, tipografi ölçeği, boşluk ritmi

Web ve mobil bu dosyaların aynısını okur; bir kuralın iki istemcide
ayrışması mümkün değil. Palet tutarlılığı ayrıca doğrulanır:

```bash
cd .. && npm run check:theme
```

## Mobile özgü olanlar

| Konu | Web | Mobil |
|---|---|---|
| Kimlik | `httpOnly` çerez | `Authorization: Bearer` + cihaz güvenli alanı |
| Canlı veri | Server-Sent Events | Aynı uç noktanın GET karşılığı, düzenli yoklama |
| Harita | Leaflet | OpenStreetMap karoları + `react-native-svg` katmanı |
| Kurye konumu | Simüle sürüş | Cihazın gerçek GPS akışı (`expo-location`) |
| Geri bildirim | Görsel | Görsel + haptik (yeni teklif, ana eylemler) |
| Yol tarifi | — | Cihazın harita uygulamasını açar |

Uygulama arka plana alındığında yoklama durur, öne geldiğinde kaldığı
yerden devam eder — telefon boşuna istek atıp pil harcamaz.

## Komutlar

```bash
npx expo start          # geliştirme sunucusu
npx tsc --noEmit        # tip denetimi
npx expo-doctor         # bağımlılık ve yapılandırma denetimi
npx expo export --platform android   # native paket üretimi (doğrulama)
```

## Bilinen sınırlar

- **Harita sürüklenmiyor / yakınlaştırılmıyor.** İlgili noktalara kendini
  oturtur. `expo-maps` alfa ve Expo Go'da yok, `react-native-maps` native
  derleme istiyor; bu yaklaşım üç platformda tek kodla ve Expo Go'da
  doğrudan çalışıyor.
- **Push bildirimi yok.** Yönetici panelindeki gönderim hedef kitleyi
  hesaplayıp kaydediyor; gerçek teslim için APNs/FCM gerekir.
- **Adres ve kart düzenleme** web panelinde; mobilde okunur, seçilebilir.
- **Destek sohbeti** web'de açık, mobilde sıradaki sürümde.
