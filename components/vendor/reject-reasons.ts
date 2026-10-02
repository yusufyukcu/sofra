/**
 * Reddetme nedenleri — istemci tarafinda da gosterildigi icin sunucudaki
 * `lib/services/vendor.ts` listesinden ayri, saf bir modulde tutuluyor
 * (servis dosyasi node bagimliliklari tasiyor).
 */
export const REJECT_REASONS = [
  "Ürünlerden biri tükendi",
  "Mutfak çok yoğun",
  "Kapanış saatine çok az kaldı",
  "Adres teslimat bölgemizin dışında",
  "Teknik bir sorun yaşıyoruz",
];
