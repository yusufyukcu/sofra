# Testler

## Birim testi

```bash
npm run test:unit
```

`tests/unit/api-client.test.mts` — ortak API istemcisinin oturum yenileme
davranışı: 401 → yenileme token'ıyla yeni erişim token'ı → isteği bir kez
tekrarla; yenileme reddedilirse oturum düşer, sonsuz döngü olmaz.

## Uçtan uca testler

Gerçek API'ye, Supabase veritabanına ve Realtime'a karşı çalışır.

```bash
npm run dev            # ayrı terminalde (varsayılan http://localhost:3000)
npm run test:e2e       # hepsi, sırayla (~9 dk)
npm run test:e2e -- realtime yonetici    # yalnızca adı eşleşenler
BASE=http://localhost:3100 npm run test:e2e   # başka adres
```

| Dosya | Kapsam |
|---|---|
| `01-genel` | Dört rolün girişi (yanlış parola, rol karışması, kurye OTP), Bearer + yenileme, korumalı sayfalar, onaysız restoranın gizliliği, kurye teklif akışı, sipariş hataları #1–#6 (kurye kilitlenmesi, kuryesiz ilerleme, hakediş kaybı, iade üst sınırı, puan güncellemesi, onay kontrolü), kapıda ödeme tahsilatı, destek kuyruğu, push → bildirim kutusu |
| `02-demo-simulasyon` | Mesaide kurye yokken siparişin simülasyonla teslimi (demo modunu ve mesaideki kuryeleri kendisi ayarlar) |
| `03-isletme-basvuru` | Başvuru → yönetici onayı → kurulum bağlantısı → parola → giriş; kara liste oturumu anında düşürür |
| `04-realtime-kanallar` | Rol başına Realtime token'ı, kanal yetkileri (başkasının kanalı reddedilir), sipariş/teklif/konum olaylarının doğru ekranlara gitmesi, değişmeyen konumun yayın üretmemesi |
| `05-isletme-paneli` | Poligon teslimat bölgesi (liste ve sipariş kontrolü), ayar doğrulamaları, tükendi gizleme, sipariş geçmişi süzgeçleri |
| `06-yonetici-paneli` | Sipariş arama, kısmi/tam iade sınırları, canlı destek konsolu (müşteri Realtime ile anında görür), demo modu anahtarı (ayarı eski hâline getirir) |
| `07-kart-bildirim-arama` | Test kartları ve doğrulamalar, reddedilen kart (402), bildirim tetikleyicisi + Realtime + okundu, push aboneliği ve gönderim kuyruğu, maskeli arama (gizlilik, oturum tekrar kullanımı, iptalle kapanma) |
| `08-realtime-istemci` | `lib/realtime.ts` modülünün kendisi: kanal paylaşımı, hızlı bırak-yeniden-abone ol, aynı bağlantıda ikinci kanal, yetkisiz kanal, token önbelleği |
| `09-gercek-dagitim` | Demo varsayılan kapalı, giriş ekranında demo düğmesi yok, anasayfa başvuru afişi; konumu bayat kuryeye teklif yok, konum gelince teklif, gerçek kurye üstlenir (simüle kurye yok), sinyali kesilen kurye mesaiden düşer |

**Veriye etkisi:** testler sipariş, iade, test kartı, destek konuşması,
başvuru ve yeni test müşterileri yazar; restoran ayarlarını değiştirip geri
alır. Geliştirme veritabanında çalıştır. Temiz demo verisine dönmek için:

```bash
npm run db:seed -- --reset
```

**Kod sınırı:** aynı telefona 15 dakikada en fazla 5 doğrulama kodu
gönderilir. Testler kurye numaralarını (532 111 00 01–04) paylaştırır;
kısa sürede art arda çok kez çalıştırırsan `otp_rate_limited` görebilirsin.

**Ortam:** `/auth/demo` yalnızca geliştirme ortamında (ya da demo
modunda) çalıştığı için testleri geliştirme sunucusuna (`npm run dev`)
karşı koştur.
