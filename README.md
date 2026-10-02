# Sofra — Yemek Siparişi Platformu

Kapsamlı sistem analizindeki **dört modülün tamamı** ve üstüne
**mobil uygulama** hazır:

| # | Modül | Durum | Adres |
|---|---|---|---|
| 1 | **Customer App** — müşteri web uygulaması | ✅ Tamamlandı | `/` |
| 2 | **Vendor Dashboard** — restoran paneli | ✅ Tamamlandı | `/isletme` |
| 3 | **Courier App** — kurye uygulaması | ✅ Tamamlandı | `/kurye` |
| 4 | **Superadmin Dashboard** — yönetici paneli | ✅ Tamamlandı | `/yonetim` |
| 5 | **Mobil uygulama** — iOS & Android (Expo) | ✅ Tamamlandı | `mobile/` |

Backend baştan **API-first** tasarlanmıştı; mobil uygulama `/api/v1` uç
noktalarının **hiçbirini değiştirmeden** kullanıyor. Tek fark kimliğin
çerez yerine `Authorization: Bearer` başlığıyla taşınması — sunucu ikisini
de baştan kabul ediyordu.

---

## Hızlı başlangıç

```bash
npm install
npm run dev          # http://localhost:3000
```

| Giriş | Adres | Nasıl |
|---|---|---|
| Müşteri | `/giris` | **“Demo hesabıyla hızlı giriş”** — kayıtlı adres, 2 kart, 450 ₺ cüzdan |
| Restoran | `/isletme/giris` | Restoranı seç, PIN **1234** |
| Kurye | `/kurye/giris` | Kuryeyi seç, PIN **1234** |
| Yönetici | `/yonetim/giris` | PIN **1234** |

Telefon/e-posta ile giriş yaparsan doğrulama kodu ekranda gösterilir (SMS
gönderilmez).

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
- Telefon **(OTP)**, e-posta (OTP), **Google / Apple** ile giriş
- Oturum: `httpOnly` çerez **+** `accessToken` (mobil için Bearer)
- Birden fazla teslimat adresi, **harita üzerinden pin ile konum seçimi**
- Pin durduğunda ters coğrafi kodlama ile mahalle/cadde/ilçe otomatik dolar
- Favori restoranlar, sipariş geçmişi, **“Tekrar Sipariş Ver”**

### Keşif (anasayfa)
- Kullanıcının konumuna göre teslimat bölgesi filtresi (mesafe & yarıçap)
- Dinamik kampanya afişleri (otomatik ilerleyen slider, kod kopyalama)
- 16 mutfak kategorisi
- Filtreler: **minimum sepet tutarı, teslimat süresi, puan, mesafe**,
  “şu an açık”, “ücretsiz teslimat”
- Filtreler URL’e yazılır → `/?kategori=burger&sirala=eta` derin bağlantı
- Sıralamadaki ilk restoran geniş kartla açılır: yapı “en iyi eşleşme”
  bilgisini taşır

### Restoran & menü
- Kategorilere ayrılmış menü + yapışkan navigasyon, menü içi arama
- **Varyant ve ekstra ağacı:** tekli seçim (Boyut, Pişirme derecesi),
  çoklu seçim (Malzemeler, İstemediklerim), **ücretli ekstralar**,
  min/max seçim sınırları
- Ürün özelinde sipariş notu
- Değerlendirmeler, puan dağılımı ve restoran yanıtları
- Stok kapatma, geçici kapalı restoran, teslimat bölgesi dışı uyarıları

### Sepet & ödeme
- Tek restoran kuralı, **minimum sepet tutarı** kontrolü + ilerleme çubuğu
- **Promosyon kodu / kupon** + kullanılabilir kampanya önerileri
- **Temassız teslimat**, **zile basma**, çatal-bıçak tercihleri, kurye notu
- Ödeme yöntemleri: **online kart**, **kapıda nakit / kredi kartı**,
  **yemek kartları** (Multinet, Sodexo, Ticket, Setcard, Metropol),
  **platform içi cüzdan**

### Sipariş takibi & satış sonrası
- Canlı durum: **Onay bekliyor → Hazırlanıyor → Yolda → Teslim edildi**
- **Server-Sent Events** ile saniyelik güncelleme (+ yoklama yedeği)
- **Kurye canlı harita takibi**, kat edilen ve kalan rota ayrı çizilir
- **Maskeli numara** ile kuryeyi arama
- Sipariş iptali → online ödemelerde cüzdana anında iade
- **Restoran ve kurye için ayrı puanlama** + yorum + **kuryeye bahşiş**
  (cüzdandan düşer, tamamı kuryeye gider)
- **Canlı destek / chatbot**: “Siparişim nerede”, iptal, eksik ürün, iade,
  fatura, kurye arama; çözemezse müşteri temsilcisine devir

---

## 2 · Restoran Paneli (`/isletme`)

Mutfakta tablet üzerinde kullanılmak üzere tasarlandı: koyu yan menü,
geniş dokunma hedefleri ve her ekranda görünen iki kritik kontrol —
**siparişe açık/kapalı** ve **zil**.

### Sipariş yönetimi
- **Canlı pano** (SSE): Onay bekliyor · Hazırlanıyor · Yolda · Kapananlar
- Yeni sipariş düşünce **sesli + görsel bildirim** — zil Web Audio ile
  sentezlenir (ses dosyası yok), bekleyen sipariş kalmayana dek 5 sn’de bir
  çalar
- **Onayla** (hazırlık süresini bildir) · **Reddet** (neden seçimli,
  online ödemede tutar anında müşterinin cüzdanına iade edilir)
- **Süreyi güncelle** — müşterinin gördüğü tahmini teslimat anında kayar
- **Yola çıktı** — durum müşteriye ve takip ekranına iletilir
- Son 24 saatte kapanan siparişler ve iptaller

### Menü & stok
- Kategori ekle/düzenle/sil, **sırala** (müşteri menüsündeki sırayı belirler)
- Ürün ekle/düzenle/sil, fiyat ve kampanyalı eski fiyat
- **Ürün ve kapak fotoğrafı yükleme** — fotoğraf yönetici onayına gider,
  onaylanınca yayına girer; reddedilirse gerekçesi panelde görünür
- **Varyant/opsiyon ağacı düzenleyici**: tekli/çoklu grup, zorunluluk,
  en az/en fazla seçim, seçenek başına fiyat farkı, varsayılan seçim
- **Anlık stok kapatma** — ürün düzeyinde ve **tek malzeme düzeyinde**
  (“Trüf patates tükendi”), kaydet beklemeden

### Mağaza ayarları
- Çalışma saatleri + **gün ortası molası**
- Minimum sepet tutarı, teslimat ücreti, ücretsiz teslimat eşiği
- **Teslimat yarıçapı** — harita üzerinde canlı önizleme
- Tahmini teslimat aralığı, kabul edilen ödeme yöntemleri
- **Yoğunlukta siparişe kapat** ve **otomatik onayı kapat** anahtarları

### Finans & raporlama
- Günlük / haftalık / aylık **ciro grafiği** — net hakediş ve platform
  komisyonu üst üste yığılır, toplamı brüt ciroyu verir
- Net hakediş, brüt ciro, komisyon, ortalama sepet, iptal oranı
- **Haftalık hakediş tablosu** (ödendi / işleniyor / beklemede)
- En çok ciro getiren ürünler
- Grafik yerine **tablo görünümü** (erişilebilirlik)

### Değerlendirmeler
- Puan dağılımı, cevapsız yorum sayacı
- Filtreler: tümü / cevaplanmamış / düşük puan
- **Cevap yazma** — cevap müşteri restoran sayfasında anında görünür

---

## 3 · Kurye Uygulaması (`/kurye`)

Telefonda tek elle, çoğu zaman hareket hâlinde kullanılır: tek sütun,
64 piksel yüksek birincil aksiyon düğmesi, her ekranda görünen mesai
anahtarı. Masaüstünde bile telefon genişliğinde ortalanır.

### Operasyon yönetimi
- **Mesai başlatma / bitirme** — Online/Offline; açık teslimat varken
  mesai kapatılamaz
- **Atanan siparişi kabul veya ret** — teklif **45 saniye** geçerli, kalan
  süre saniye saniye geri sayar
- Reddedilen veya süresi dolan sipariş **anında sıradaki en yakın kuryeye**
  geçer; aynı kuryeye ikinci kez gönderilmez
- **Restorana ve müşteriye navigasyon** — harita üzerinde rota, tek dokunuşla
  harici navigasyon

### Sipariş akışı & performans
- **Aşama bildirimleri:** Restorana vardım → Teslim aldım → Teslim ettim
- “Teslim aldım” siparişi müşteri tarafında **Yolda**'ya, “Teslim ettim”
  **Teslim edildi**'ye çevirir
- **Maskelenmiş numara** ile müşteriyi arama
- **Konum bildirimi** — kuryenin bildirdiği konum müşterinin canlı takip
  haritasını besler (simüle sürüş ya da cihaz GPS'i)
- **Paket başı kazanç, toplam hakediş ve bahşiş takibi** — 14 günlük grafik,
  haftalık hakediş tablosu, son teslimatlar
- **Performans metrikleri:** ortalama teslimat süresi, en hızlı teslimat,
  kabul oranı, ortalama mesafe, puan

---

## 4 · Yönetici Paneli (`/yonetim`)

Masaüstü kontrol masası: sabit koyu yan menü, bekleyen iş sayaçları ve
geniş çalışma alanı. Her manuel işlem iz kaydına yazılır.

### Kullanıcı ve restoran yönetimi
- **Yeni restoran onaylama** — onaylanmayan restoran müşteri uygulamasında
  hiç görünmez (liste, arama ve sayfa 404)
- **Restoran bazlı komisyon oranı** — kaydırıcıyla %0–40, restoranın
  Finans ekranına anında yansır
- **Görsel onayları** — restoranların gönderdiği kapak ve ürün
  fotoğrafları yayındakiyle yan yana; onay ya da gerekçeli ret
- **Kurye aktivasyonu** — onaysız kurye mesaiye başlayamaz; askıya alınan
  kurye derhal mesaiden düşer
- **Kara liste** — engellenen müşterinin oturumu anında geçersiz olur,
  yeniden giriş yapamaz ve sipariş veremez
- **Manuel bakiye yükleme / düşüm** — gerekçeli, iz kayıtlı

### Canlı operasyon ekranı
- Tüm aktif siparişler **harita ve listede anlık**; çevrimiçi kuryeler de
  haritada (teslimatta / boşta ayrımıyla)
- **Gecikme alarmı** — tahmini teslim saatini 5 dk aşan sipariş uyarı,
  15 dk aşan kritik seviye
- **Manuel iptal ve iade** — kısmi iade dâhil, tutar müşterinin cüzdanına
- Son yönetici işlemleri akışı

### Pazarlama ve kampanya yönetimi
- **Global promosyon kodları** — yüzde / tutar / ücretsiz teslimat,
  minimum sepet, üst sınır, ilk siparişe özel, restoran kısıtı
- Yayına alma-kaldırma; yayından kalkan kod ödeme adımında reddedilir
- **Vitrin afişleri** — canlı önizlemeli editör, sıralama, gizleme
- **Push bildirimi** — segment (tümü / aktif / uzaklaşan / yeni) ve bölge
  bazlı hedefleme, gönderim öncesi hedef kitle sayacı, gönderim geçmişi

### Finansal mutabakat ve analitik
- **GMV**, platform net geliri, komisyon geliri, ortalama sepet
- Gelir kırılımı: komisyon + hizmet bedeli + teslimat ücreti − kurye
  ödemeleri − karşılanan indirimler − ödeme geçidi komisyonu
- **Ödeme geçidi raporu** — yöntem bazında hacim, kesinti ve valör
- **Hakediş onay akışı** — `Onay bekliyor → Onaylandı → Ödendi`; durum
  restoran panelinde ve kurye uygulamasında aynı anda görünür

---

## 5 · Mobil Uygulama (`mobile/`)

Expo SDK 57 + React Native. **Müşteri ve kurye** uygulamaları tek projede;
kurye modu Hesabım ekranından açılır ve ayrı oturum kullanır.

### Müşteri
- Keşfet, Ara, Siparişlerim, Hesabım — alt sekmeler
- Restoran + menü, varyantlı ürün seçim yaprağı, not ve adet
- Sepet (tutarlar sunucudan), kampanya kodu, ödeme yöntemi seçimi
- Canlı sipariş takibi: durum çizgisi, harita, kurye kartı
- Değerlendirme: restoran + kurye puanı, cüzdandan bahşiş
- Ekranların altında beliren canlı sepet çubuğu

### Kurye
- Mesai anahtarı ve günlük özet
- 45 saniyelik teklif: ücret, alım/teslim mesafesi, harita, geri sayım
- Aktif teslimat: tek birincil eylem, tam adres, yol tarifi
- Kazanç (günlük kırılım + hakediş defteri) ve Performans

### Paylaşılan çekirdek — `packages/core`

Arayüz kütüphanesinden bağımsız, **web ve mobilin aynı dosyadan okuduğu**
katman: alan modeli, fiyat/kupon hesabı, keşif filtreleri, sepet kuralları,
biçimlendiriciler, API istemcisi ve **tasarım jetonları**.

```
packages/core/src/
  types.ts        cart.ts       pricing.ts
  discovery.ts    utils.ts      constants.ts
  api-client.ts   theme.ts      errors.ts
```

Web `lib/*.ts` üzerinden bu dosyaları yeniden dışa aktarır, mobil
`@sofra/core` adıyla import eder. Bir kuralın iki istemcide ayrışması
mümkün değil. Palet ayrışması da denetleniyor:

```bash
npm run check:theme   # 58 jeton · açık + koyu · web ↔ mobil
```

### Webden farklı olan tek şey taşıma katmanı

| Konu | Web | Mobil |
|---|---|---|
| Kimlik | `httpOnly` çerez | `Bearer` + cihaz güvenli alanı (Keychain / EncryptedSharedPreferences) |
| Canlı veri | Server-Sent Events | Aynı uç noktanın GET karşılığı, arka planda duran yoklama |
| Harita | Leaflet | OpenStreetMap karoları + `react-native-svg` katmanı |
| Kurye konumu | Simüle sürüş | Cihazın gerçek GPS akışı (`expo-location`) |
| Ek yetenek | — | Haptik geri bildirim, cihazın harita uygulamasıyla yol tarifi |

---

## Teknoloji

| Katman | Seçim | Neden |
|---|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) | Sunucu bileşenleri + route handler’lar tek projede |
| Dil | **TypeScript** | Alan modeli mobil tarafa olduğu gibi taşınabilir |
| Stil | **Tailwind CSS v4** | Jeton tabanlı tasarım sistemi, açık/koyu tema |
| Tipografi | **Bricolage Grotesque** + **Geist** | Başlık/fiyat için karakterli, arayüz için nötr aile |
| Durum | **Zustand** (+ persist) | Sepet ve oturumlar sayfa yenilense de korunur |
| Oturum | **jose** (JWT) | Dört rol, dört ayrı çerez + Bearer |
| Harita | **Leaflet + OpenStreetMap** | API anahtarı gerektirmez |
| Gerçek zaman | **SSE** | Müşteri takibi, işletme panosu, kurye panosu, canlı operasyon |
| Ses | **Web Audio API** | Sipariş zili sentezlenir, varlık indirilmez |
| Mobil | **Expo SDK 57** + React Native | Tek kod tabanı, iOS + Android, Expo Go ile anında deneme |
| Mobil yönlendirme | **Expo Router** | Dosya tabanlı — web'deki App Router ile aynı zihinsel model |
| Paylaşım | **`@sofra/core`** | Alan modeli, iş kuralları ve palet tek kaynaktan |

Görseller mutfağa göre renklenen, katmanlı degradelerle üretilir
(`components/ui/food-image.tsx`): kebapçı sıcak kırmızı, sağlıklı mutfak
yeşil, balıkçı mavi olur — renk dekorasyon değil, bilgi taşır. Ağ bağlantısı
gerekmez; gerçek fotoğraf geldiğinde `src` verilmesi yeterli.

---

## Proje yapısı

```
app/
  page.tsx                  Anasayfa (keşif)
  giris/                    Müşteri girişi
  restoran/[slug]/          Restoran + menü
  sepet/  odeme/            Sepet ve checkout
  siparis/[id]/             Canlı takip (+ /degerlendir)
  hesabim/                  Profil · adresler · siparişler · favoriler · cüzdan
  destek/  kampanyalar/     SSS + canlı destek, kampanya listesi
  isletme/                  RESTORAN PANELİ
    giris/  menu/  ayarlar/  finans/  degerlendirmeler/
  kurye/                    KURYE UYGULAMASI
    giris/  kazanc/  performans/
  yonetim/                  YÖNETİCİ PANELİ
    giris/  restoranlar/  kullanicilar/  pazarlama/  finans/
  api/v1/                   Genel API (mobil uygulama da bunu kullanacak)
    vendor/                 İşletme uç noktaları (ayrı oturum)
    courier/                Kurye uç noktaları (ayrı oturum)
    admin/                  Yönetim uç noktaları (ayrı oturum)

lib/
  types.ts                  Alan modeli (framework'ten bağımsız)
  discovery.ts  pricing.ts  Saf iş kuralları — istemci & sunucu ortak
  db/                       Depo + tohum veri + sipariş simülatörü
  services/                 orders · account · auth · support
                            vendor · courier · admin · payouts
  auth/                     session · vendor- · courier- · admin-session
  store/                    Zustand: session · cart · vendor · courier · admin
  vendor/chime.ts           Sipariş zili (Web Audio)

components/                 ui · layout · discovery · restaurant · cart
                            checkout · order · account · support · map
                            vendor/  (restoran paneli)
                            courier/ (kurye uygulaması)
                            admin/   (yönetici paneli)
proxy.ts                    Ağ sınırında oturum kontrolü + API CORS

packages/core/src/          PAYLAŞILAN ÇEKİRDEK — web ve mobil aynı dosya
  types.ts                  Alan modeli
  pricing.ts  discovery.ts  Saf iş kuralları
  cart.ts                   Sepet kuralları
  utils.ts    constants.ts  Biçimlendiriciler ve sabitler
  api-client.ts             Yapılandırılabilir API istemcisi (çerez ↔ Bearer)
  theme.ts                  Tasarım jetonları (palet, ölçek, ritim)

mobile/                     MOBİL UYGULAMA (Expo)
  src/app/                  Expo Router — dosya tabanlı ekranlar
    (musteri)/              Keşfet · Ara · Siparişlerim · Hesabım
    restoran/[slug].tsx     sepet.tsx  odeme.tsx
    siparis/[id].tsx        siparis/[id]/degerlendir.tsx
    kurye/                  Teslimat · Kazanç · Performans (ayrı oturum)
  src/components/           ui · customer · courier · map
  src/lib/                  api · token-store · use-live
  src/store/                session · cart · courier
  src/theme/                Çekirdek paletin React Native karşılığı
```

Mimari ve veri modeli: [`docs/MIMARI.md`](docs/MIMARI.md)
API sözleşmesi: [`docs/API.md`](docs/API.md)
Mobil uygulama: [`mobile/README.md`](mobile/README.md)

---

## Yapılandırma

`.env.local`:

```bash
SOFRA_JWT_SECRET=...   # oturum tokenlarını imzalar (üretimde mutlaka değiştir)
SOFRA_SIM_SPEED=12     # sipariş simülasyonu hız çarpanı
```

`SOFRA_SIM_SPEED=12` → 30 dakikalık bir sipariş ~2,5 dakikada teslim edilir,
böylece tüm yaşam döngüsü demo sırasında izlenebilir. `1` yaparsan gerçek
zamanlı çalışır.

### Veriyi sıfırlama

Restoranlar, menüler, kullanıcılar, siparişler ve yorumlar `/.data/db.json`
dosyasında, restoranların yüklediği fotoğraflar `/.data/uploads` altında
tutulur (ikisi de git’e girmez). Temiz bir başlangıç için:

```bash
rm -rf .data
```

---

## Hepsini birlikte denemek

Dört sekmeyi yan yana aç — dört oturum aynı tarayıcıda birlikte çalışır.

1. **Yönetici:** `/yonetim/giris` · PIN `1234` → *Restoranlar*'da onay
   bekleyen iki başvuruyu gör, *Kullanıcılar → Kuryeler*'de aktivasyon
   bekleyen kuryeyi aktifleştir
2. **Kurye:** `/kurye/giris` → *Elif Şahin* · PIN `1234` → **mesaiyi başlat**
3. **Restoran:** `/isletme/giris` → *Kasap Burger Co.* · PIN `1234` →
   Mağaza'dan **otomatik onayı kapat**, üst bardan **zili aç**
4. **Müşteri:** `/giris` → demo hesabıyla gir → Kasap Burger Co.'dan
   sipariş ver
5. Restoran panelinde zil çalar → **Onayla** → kuryeye 45 sn'lik teklif
   düşer → **Siparişi al** → **Restorana vardım / Teslim aldım / Teslim ettim**
6. Yönetici panelinde siparişi **canlı haritada** izle; gecikirse alarm verir
7. Müşteri **Değerlendir** → puan ver, **bahşiş bırak**
8. Yönetici → **Finans**: GMV ve net gelir işlendi, restoran ve kurye
   hakedişleri kuyruğa düştü → **Onayla** → **Ödendi işaretle**
9. Restoran panelinin ve kurye uygulamasının Finans/Kazanç ekranında aynı
   hakedişin **Ödendi** olduğunu gör

> Kurye uygulaması kapalıysa hiçbir şey durmaz: vardiyada kurye yoksa
> sipariş akışını simülatör tamamlar, böylece müşteri uygulaması tek başına
> da denenebilir.

### Mobil uygulamayı da katmak

Yukarıdaki 2. ve 4. adımları tarayıcı yerine telefondan yap:

```bash
cd mobile && npx expo start     # telefonda Expo Go ile QR'ı okut
```

- **Kurye** telefonda `/kurye` → mesaiyi aç. Artık konum simüle değil,
  telefonun **gerçek GPS'i**; müşterinin takip haritasındaki nokta odur.
- **Müşteri** telefonda sipariş verir, aşama bildirimlerini anında görür.
- İki telefon + iki tarayıcı sekmesi aynı siparişi aynı anda gösterir.

> Uygulama arka plandayken yoklamayı bilerek durdurur (pil). İki ekranı
> aynı anda canlı izlemek için iki ayrı cihaz ya da iki ayrı tarayıcı
> penceresi gerekir.

## Prototip sınırları

| Konu | Şu an | Üretimde |
|---|---|---|
| SMS / e-posta OTP | Kod cevapta `devCode` olarak döner | SMS sağlayıcısı (Netgsm, Twilio) |
| Apple / Google girişi | Sabit profille simüle edilir | Gerçek OAuth + `id_token` doğrulama |
| İşletme girişi | Restoran seçimi + ortak PIN | E-posta + parola + iki adımlı doğrulama |
| Ödeme | Her zaman başarılı kabul edilir | Ödeme geçidi + 3D Secure |
| Veritabanı | JSON dosyası (`lib/db/store.ts`) | PostgreSQL + Prisma/Drizzle |
| Yüklenen fotoğraflar | Yerel klasör (`lib/media/storage.ts`) | Nesne deposu (Vercel Blob, S3) |
| Kurye girişi | Kurye seçimi + ortak PIN | Telefon + OTP, kimlik doğrulama |
| Yönetici girişi | Tek hesap + ortak PIN | Kurumsal SSO veya parola + 2FA, rol bazlı yetki |
| Push bildirimi | Hedef kitle hesaplanır, kayıt tutulur | APNs / FCM sağlayıcısı |
| Kurye konumu | Web'de simüle sürüş; **mobilde gerçek GPS** | Aynı uç nokta, değişiklik gerekmez |
| Mobil kimlik | `Bearer` token cihazın güvenli alanında | Aynı — ek olarak token yenileme (refresh) |
| Mobil canlı veri | Yoklama (RN'de `EventSource` yok) | WebSocket veya push ile uyandırma |
| Mobil harita | OSM karoları, sürüklenmez | Ticari SDK ya da `react-native-maps` (dev build) |
| Mağaza dağıtımı | Expo Go ile denenir | EAS Build + App Store / Play Store |
| Teslimat bölgesi | Merkez + yarıçap | Poligon çizimi |
| Ters coğrafi kodlama | OpenStreetMap Nominatim | Ticari geocoding servisi |

Her biri tek bir modül değiştirilerek gerçeğe bağlanabilecek şekilde
yalıtılmıştır.
