import type { MenuCategory, Restaurant } from "../types";

/**
 * Tohum verisinin yemek fotoğrafları.
 *
 * Dosyalar `public/images/food/<anahtar>.webp` altında; aynı yemek birden
 * çok restoranda geçiyorsa (ayran, künefe, lahmacun…) tek dosyayı paylaşır.
 * Fotoğraflar Wikimedia Commons ve Openverse'ten (Flickr) seçilen CC
 * lisanslı görsellerdir; yazar ve lisans bilgileri `lib/image-credits.ts`
 * içinde, `/gorsel-kaynaklari` sayfasında listelenir.
 *
 * Satıcının panelden eklediği ürünlerin fotoğrafı yoktur; onlar için
 * mutfağa göre renklenen yer tutucu çizilir (`FoodImage`).
 */

/** Fotoğraf anahtarından site yolunu üretir. */
export const foodPhoto = (key: string) => `/images/food/${key}.webp`;

/** Restoran kapakları */
export const RESTAURANT_PHOTOS: Record<string, string> = {
  rst_kasap: "cover-kasap",
  rst_ustam: "cover-ustam",
  rst_napoli: "cover-napoli",
  rst_tavuk: "cover-tavuk",
  rst_cigkofte: "cover-cigkofte",
  rst_sekerli: "cover-sekerli",
  rst_yesilkase: "cover-yesilkase",
  rst_serpme: "cover-serpme",
  rst_wok: "cover-wok",
  rst_balikci: "cover-balikci",
  rst_anneeli: "cover-anneeli",
  rst_tostcu: "cover-tostcu",
  rst_filtre: "cover-filtre",
  rst_pideci: "cover-pideci",
  rst_bogaz: "cover-bogaz",
  rst_nisantasi: "cover-nisantasi",
};

/** Ürün kimliği → fotoğraf anahtarı */
export const PRODUCT_PHOTOS: Record<string, string> = {
  // Kasap Burger Co.
  kb_p1: "burger-double-cheese",
  kb_p2: "burger-truffle-mushroom",
  kb_p3: "burger-smash-menu",
  kb_b1: "burger-classic",
  kb_b2: "burger-crispy-chicken",
  kb_b3: "burger-vegan",
  kb_b4: "burger-bbq-bacon",
  kb_y1: "fries",
  kb_y2: "onion-rings",
  kb_y3: "cheddar-sauce",
  kb_i1: "cola",
  kb_i2: "ayran",
  kb_i3: "lemonade",
  kb_t1: "brownie",

  // Ustam Kebap Salonu
  uk_p1: "adana-kebap",
  uk_p2: "urfa-kebap",
  uk_p3: "mixed-grill",
  uk_k1: "tavuk-sis",
  uk_k2: "kuzu-sis",
  uk_k3: "beyti",
  uk_k4: "iskender",
  uk_pd1: "pide-kiymali",
  uk_pd2: "pide-kasarli",
  uk_pd3: "lahmacun",
  uk_m1: "ezme",
  uk_m2: "haydari",
  uk_m3: "coban-salata",
  uk_t1: "kunefe",
  uk_t2: "baklava",
  uk_i1: "salgam",
  uk_i2: "ayran",

  // Napoli Pizza Bar
  np_p1: "pizza-margherita",
  np_p2: "pizza-diavola",
  np_p3: "pizza-quattro-formaggi",
  np_z1: "pizza-prosciutto-funghi",
  np_z2: "pizza-vegetariana",
  np_z3: "pizza-tonno",
  np_z4: "pizza-capricciosa",
  np_b1: "bruschetta",
  np_b2: "garlic-bread",
  np_b3: "caprese",
  np_t1: "tiramisu",
  np_t2: "panna-cotta",

  // Tavuk Dünyası Express
  td_m1: "fried-chicken",
  td_m2: "burger-crispy-chicken",
  td_m3: "chicken-wings",
  td_t1: "fried-chicken",
  td_t2: "chicken-tenders",
  td_t3: "buffalo-wings",
  td_y1: "fries",
  td_y2: "coleslaw",
  td_y3: "corn",

  // Çiğköfteci Ali Usta
  ca_c1: "cigkofte",
  ca_c2: "cigkofte-durum",
  ca_c3: "cigkofte-tabak",
  ca_i1: "salgam",
  ca_i2: "ayran",
  ca_i3: "lemonade",

  // Şekerli Rüya Pastanesi
  sr_p1: "cheesecake",
  sr_p2: "trilece",
  sr_p3: "havuclu-kek",
  sr_p4: "profiterol",
  sr_s1: "sutlac",
  sr_s2: "kazandibi",
  sr_s3: "supangle",
  sr_b1: "baklava-fistikli",
  sr_b2: "sobiyet",
  sr_b3: "kunefe",
  sr_i1: "turkish-coffee",
  sr_i2: "filter-coffee",

  // Yeşil Kase
  yk_b1: "buddha-bowl",
  yk_b2: "akdeniz-bowl",
  yk_b3: "poke-bowl",
  yk_s1: "sezar-salata",
  yk_s2: "kinoa-salata",
  yk_i1: "green-juice",
  yk_i2: "beet-juice",
  yk_i3: "protein-smoothie",

  // Serpme Keyfi Kahvaltı
  sk_s1: "serpme-kahvalti",
  sk_s2: "serpme-kahvalti",
  sk_t1: "menemen",
  sk_t2: "kahvalti-tabagi",
  sk_t3: "simit",
  sk_i1: "tea",
  sk_i2: "orange-juice",
  sk_i3: "turkish-coffee",

  // Wok & Roll
  wr_w1: "teriyaki-noodle",
  wr_w2: "pad-thai",
  wr_w3: "kung-pao",
  wr_s1: "california-roll",
  wr_s2: "nigiri",
  wr_s3: "sushi-platter",
  wr_b1: "gyoza",
  wr_b2: "edamame",
  wr_b3: "miso-soup",

  // Balıkçı Mehmet
  bm_b1: "cipura",
  bm_b2: "levrek",
  bm_b3: "hamsi",
  bm_b4: "kalamar",
  bm_m1: "atom",
  bm_m2: "fava",
  bm_m3: "deniz-borulcesi",
  bm_m4: "ahtapot-salata",
  bm_i1: "salgam",
  bm_i2: "maden-suyu",

  // Anne Eli Ev Yemekleri
  ae_g1: "kuru-fasulye",
  ae_g2: "karniyarik",
  ae_g3: "manti",
  ae_g4: "icli-kofte",
  ae_g5: "tavuk-sote",
  ae_c1: "mercimek",
  ae_c2: "ezogelin",
  ae_c3: "iskembe",
  ae_t1: "sutlac",
  ae_t2: "irmik-helvasi",

  // Tostçu Emmi
  te_t1: "tost-karisik",
  te_t2: "tost-kasarli",
  te_t3: "tost-sucuklu",
  te_s1: "ayvalik-tostu",
  te_s2: "chicken-sandwich",
  te_i1: "tea",
  te_i2: "ayran",
  te_i3: "cola",

  // Filtre Kahve Durağı
  fk_s1: "flat-white",
  fk_s2: "filter-coffee",
  fk_s3: "turkish-coffee",
  fk_s4: "latte",
  fk_c1: "iced-latte",
  fk_c2: "cold-brew",
  fk_c3: "frappe",
  fk_a1: "cookie",
  fk_a2: "muffin",
  fk_a3: "cheesecake",

  // Pideci Hacı Baba
  ph_p1: "pide-kusbasili",
  ph_p2: "pide-kiymali",
  ph_p3: "pide-kasarli",
  ph_p4: "pide-karisik",
  ph_l1: "lahmacun",
  ph_l2: "lahmacun",
  ph_y1: "ayran",
  ph_y2: "tursu",
  ph_y3: "kunefe",

  // Boğaz Mantı Evi
  bo_m1: "manti",
  bo_m2: "manti",
  bo_m3: "cokertme",
  bo_c1: "mercimek",
  bo_c2: "yayla",

  // Nişantaşı Steakhouse
  ns_e1: "antrikot",
  ns_e2: "pirzola",
  ns_e3: "bonfile",
  ns_b1: "burrata",
  ns_b2: "karides-guvec",
};

type RestaurantSeed = Omit<Restaurant, "menu"> & { menu: MenuCategory[] };

/** Tohum restoranlarına kapak ve ürün fotoğraflarını işler. */
export function withPhotos<T extends RestaurantSeed>(restaurants: T[]): T[] {
  return restaurants.map((restaurant) => {
    const cover = RESTAURANT_PHOTOS[restaurant.id];
    return {
      ...restaurant,
      image: cover ? foodPhoto(cover) : restaurant.image,
      menu: restaurant.menu.map((category) => ({
        ...category,
        products: category.products.map((product) => {
          const key = PRODUCT_PHOTOS[product.id];
          return key ? { ...product, image: foodPhoto(key) } : product;
        }),
      })),
    };
  });
}
