import type {
  Coupon,
  Courier,
  MenuCategory,
  OptionGroup,
  Product,
  ProductOption,
  Restaurant,
} from "../types";
import { withPhotos } from "./seed-photos";

/* ------------------------------------------------------------------ */
/* Kısa yardımcılar — menü ağacını okunur tutmak için                  */
/* ------------------------------------------------------------------ */

/** Seçenek. */
function o(
  id: string,
  name: string,
  priceDelta = 0,
  extra: Partial<ProductOption> = {}
): ProductOption {
  return { id, name, priceDelta, ...extra };
}

/** Tekli seçim grubu (radio) — ör. Boyut, Pişirme derecesi. */
function single(
  id: string,
  name: string,
  options: ProductOption[],
  required = true
): OptionGroup {
  return { id, name, type: "single", required, options };
}

/** Çoklu seçim grubu (checkbox) — ör. Malzemeler, Ekstralar. */
function multi(
  id: string,
  name: string,
  options: ProductOption[],
  maxSelect?: number,
  minSelect = 0
): OptionGroup {
  return {
    id,
    name,
    type: "multi",
    required: minSelect > 0,
    minSelect,
    maxSelect,
    options,
  };
}

function product(
  id: string,
  name: string,
  emoji: string,
  price: number,
  description: string,
  optionGroups: OptionGroup[] = [],
  extra: Partial<Product> = {}
): Product {
  return { id, name, emoji, price, description, optionGroups, ...extra };
}

function category(
  id: string,
  name: string,
  products: Product[],
  description?: string
): MenuCategory {
  return { id, name, products, description };
}

/* ------------------------------------------------------------------ */
/* Tekrar eden opsiyon grupları                                        */
/* ------------------------------------------------------------------ */

const drinkGroup = (prefix: string, upcharge = 0) =>
  single(
    `${prefix}_drink`,
    "İçecek seçimi",
    [
      o(`${prefix}_d1`, "Kola (33 cl)", upcharge, { default: true }),
      o(`${prefix}_d2`, "Kola Zero (33 cl)", upcharge),
      o(`${prefix}_d3`, "Ayran (30 cl)", upcharge),
      o(`${prefix}_d4`, "Şalgam (30 cl)", upcharge),
      o(`${prefix}_d5`, "Su (50 cl)", 0),
      o(`${prefix}_d6`, "Taze sıkma portakal suyu", upcharge + 45),
    ],
    true
  );

const spiceGroup = (prefix: string) =>
  single(
    `${prefix}_spice`,
    "Acı seviyesi",
    [
      o(`${prefix}_s0`, "Acısız", 0, { default: true }),
      o(`${prefix}_s1`, "Az acı", 0),
      o(`${prefix}_s2`, "Orta acı", 0),
      o(`${prefix}_s3`, "Çok acı", 0),
    ],
    true
  );

const cutleryNote = (prefix: string) =>
  multi(`${prefix}_side`, "Yanında ne olsun?", [
    o(`${prefix}_sd1`, "Patates kızartması", 65),
    o(`${prefix}_sd2`, "Soğan halkası", 75),
    o(`${prefix}_sd3`, "Közlenmiş biber", 45),
    o(`${prefix}_sd4`, "Ekstra lavaş", 25),
  ]);

/* ------------------------------------------------------------------ */
/* Menüler                                                             */
/* ------------------------------------------------------------------ */

const burgerMenu: MenuCategory[] = [
  category(
    "kb_populer",
    "Popüler Ürünler",
    [
      product(
        "kb_p1",
        "Kasap Double Cheese",
        "🍔",
        395,
        "2×110 gr dana kasap köfte, çift cheddar, turşu, özel sos, brioche ekmek",
        [
          single("kb_p1_g1", "Boyut", [
            o("kb_p1_g1_o1", "Tek köfte (110 gr)", -70),
            o("kb_p1_g1_o2", "Çift köfte (220 gr)", 0, { default: true }),
            o("kb_p1_g1_o3", "Üçlü köfte (330 gr)", 95),
          ]),
          single("kb_p1_g2", "Pişirme derecesi", [
            o("kb_p1_g2_o1", "Az pişmiş", 0),
            o("kb_p1_g2_o2", "Orta", 0, { default: true }),
            o("kb_p1_g2_o3", "İyi pişmiş", 0),
          ]),
          multi(
            "kb_p1_g3",
            "İstemediklerim",
            [
              o("kb_p1_g3_o1", "Turşu istemiyorum"),
              o("kb_p1_g3_o2", "Soğan istemiyorum"),
              o("kb_p1_g3_o3", "Marul istemiyorum"),
              o("kb_p1_g3_o4", "Özel sos istemiyorum"),
            ]
          ),
          multi("kb_p1_g4", "Ekstra malzemeler", [
            o("kb_p1_g4_o1", "Ekstra cheddar", 45),
            o("kb_p1_g4_o2", "Çıtır bacon", 70),
            o("kb_p1_g4_o3", "Karamelize soğan", 40),
            o("kb_p1_g4_o4", "Jalapeño", 35),
            o("kb_p1_g4_o5", "Trüflü mayonez", 55),
            o("kb_p1_g4_o6", "Çift köfte ekle", 130),
          ]),
        ],
        { popular: true, oldPrice: 460 }
      ),
      product(
        "kb_p2",
        "Truffle Mushroom Burger",
        "🍄",
        430,
        "180 gr dana köfte, sote mantar, trüf yağı, gruyere peyniri",
        [
          single("kb_p2_g1", "Ekmek tercihi", [
            o("kb_p2_g1_o1", "Brioche", 0, { default: true }),
            o("kb_p2_g1_o2", "Susamlı klasik", 0),
            o("kb_p2_g1_o3", "Glutensiz ekmek", 60),
            o("kb_p2_g1_o4", "Ekmeksiz (kase burger)", 0),
          ]),
          multi("kb_p2_g2", "Ekstra malzemeler", [
            o("kb_p2_g2_o1", "Ekstra mantar", 50),
            o("kb_p2_g2_o2", "Trüf mayonez", 55),
            o("kb_p2_g2_o3", "Rukola", 30),
          ]),
        ],
        { popular: true }
      ),
      product(
        "kb_p3",
        "Smash Menü",
        "🍟",
        520,
        "İki smash köfte, patates kızartması ve içecek",
        [
          single("kb_p3_g1", "Patates tercihi", [
            o("kb_p3_g1_o1", "Klasik patates", 0, { default: true }),
            o("kb_p3_g1_o2", "Baharatlı patates", 25),
            o("kb_p3_g1_o3", "Cheddar soslu patates", 60),
            o("kb_p3_g1_o4", "Tatlı patates", 55),
          ]),
          drinkGroup("kb_p3"),
          multi("kb_p3_g3", "Ekstra soslar", [
            o("kb_p3_g3_o1", "Barbekü sos", 20),
            o("kb_p3_g3_o2", "Ranch sos", 20),
            o("kb_p3_g3_o3", "Acı biber sosu", 20),
            o("kb_p3_g3_o4", "Trüflü mayonez", 30),
          ]),
        ],
        { popular: true }
      ),
    ],
    "En çok tercih edilen lezzetlerimiz"
  ),
  category("kb_burger", "Burgerler", [
    product(
      "kb_b1",
      "Klasik Cheeseburger",
      "🍔",
      310,
      "110 gr köfte, cheddar, marul, domates, turşu",
      [
        multi("kb_b1_g1", "Ekstra malzemeler", [
          o("kb_b1_g1_o1", "Ekstra cheddar", 45),
          o("kb_b1_g1_o2", "Bacon", 70),
          o("kb_b1_g1_o3", "Yumurta", 35),
        ]),
      ]
    ),
    product(
      "kb_b2",
      "Tavuklu Crispy Burger",
      "🍗",
      325,
      "Çıtır tavuk göğsü, coleslaw, acı mayonez",
      [spiceGroup("kb_b2")]
    ),
    product(
      "kb_b3",
      "Vegan Bean Burger",
      "🌱",
      295,
      "Nohut ve fasulye köftesi, avokado, vegan mayonez",
      [
        multi("kb_b3_g1", "Ekstra malzemeler", [
          o("kb_b3_g1_o1", "Avokado", 60),
          o("kb_b3_g1_o2", "Vegan cheddar", 50),
        ]),
      ]
    ),
    product(
      "kb_b4",
      "BBQ Bacon Burger",
      "🥓",
      420,
      "160 gr köfte, çıtır bacon, barbekü sos, soğan halkası",
      [],
      { soldOut: true }
    ),
  ]),
  category("kb_yan", "Yan Ürünler", [
    product("kb_y1", "Patates Kızartması", "🍟", 110, "Kalın kesim, deniz tuzlu", [
      single("kb_y1_g1", "Porsiyon", [
        o("kb_y1_g1_o1", "Orta", 0, { default: true }),
        o("kb_y1_g1_o2", "Büyük", 45),
      ]),
    ]),
    product("kb_y2", "Soğan Halkası (8 adet)", "🧅", 130, "Bira hamurunda çıtır"),
    product("kb_y3", "Cheddar Sos", "🧀", 45, "Yanında kullanmak için sıcak cheddar"),
  ]),
  category("kb_icecek", "İçecekler", [
    product("kb_i1", "Kola (33 cl)", "🥤", 65, "Soğuk servis"),
    product("kb_i2", "Ayran (30 cl)", "🥛", 45, "Günlük üretim"),
    product("kb_i3", "Limonata (40 cl)", "🍋", 95, "Taze nane ve limonla"),
  ]),
  category("kb_tatli", "Tatlılar", [
    product("kb_t1", "Brownie", "🍫", 165, "Sıcak servis, yanında dondurma", [
      multi("kb_t1_g1", "Ekstra", [
        o("kb_t1_g1_o1", "Vanilyalı dondurma topu", 60),
        o("kb_t1_g1_o2", "Ekstra çikolata sos", 30),
      ]),
    ]),
  ]),
];

const kebapMenu: MenuCategory[] = [
  category("uk_populer", "Şefin Önerileri", [
    product(
      "uk_p1",
      "Adana Kebap (Porsiyon)",
      "🥙",
      590,
      "El yapımı zırh kıyma, közde pişmiş, yanında bulgur pilavı ve közlenmiş sebze",
      [
        single("uk_p1_g1", "Porsiyon", [
          o("uk_p1_g1_o1", "Yarım porsiyon", -180),
          o("uk_p1_g1_o2", "Tam porsiyon", 0, { default: true }),
          o("uk_p1_g1_o3", "1,5 porsiyon", 250),
        ]),
        spiceGroup("uk_p1"),
        single("uk_p1_g3", "Pilav tercihi", [
          o("uk_p1_g3_o1", "Bulgur pilavı", 0, { default: true }),
          o("uk_p1_g3_o2", "Pirinç pilavı", 0),
          o("uk_p1_g3_o3", "Pilav istemiyorum", -35),
        ]),
        cutleryNote("uk_p1"),
      ],
      { popular: true }
    ),
    product(
      "uk_p2",
      "Urfa Kebap",
      "🍢",
      570,
      "Acısız kıyma kebabı, közlenmiş domates ve biber ile",
      [
        single("uk_p2_g1", "Porsiyon", [
          o("uk_p2_g1_o1", "Yarım porsiyon", -170),
          o("uk_p2_g1_o2", "Tam porsiyon", 0, { default: true }),
        ]),
        cutleryNote("uk_p2"),
      ],
      { popular: true }
    ),
    product(
      "uk_p3",
      "Karışık Izgara (2 Kişilik)",
      "🍖",
      1290,
      "Adana, urfa, tavuk şiş, kuzu şiş, pirzola, kanat",
      [
        multi("uk_p3_g1", "Yanında", [
          o("uk_p3_g1_o1", "Ekstra lavaş (4 adet)", 40),
          o("uk_p3_g1_o2", "Ezme salata", 90),
          o("uk_p3_g1_o3", "Haydari", 85),
          o("uk_p3_g1_o4", "Acılı ezme", 90),
        ]),
        drinkGroup("uk_p3"),
      ],
      { popular: true }
    ),
  ]),
  category("uk_kebap", "Kebaplar", [
    product("uk_k1", "Tavuk Şiş", "🍗", 470, "Marine edilmiş tavuk göğsü", [
      single("uk_k1_g1", "Porsiyon", [
        o("uk_k1_g1_o1", "Yarım", -140),
        o("uk_k1_g1_o2", "Tam", 0, { default: true }),
      ]),
    ]),
    product("uk_k2", "Kuzu Şiş", "🐑", 690, "Kuzu kontrfile parçaları"),
    product("uk_k3", "Beyti Sarma", "🌯", 640, "Yoğurtlu, domates soslu"),
    product("uk_k4", "İskender", "🍛", 660, "Tereyağlı, yoğurtlu, pide üzerinde", [
      single("uk_k4_g1", "Tereyağı", [
        o("uk_k4_g1_o1", "Tereyağlı", 0, { default: true }),
        o("uk_k4_g1_o2", "Tereyağsız", 0),
      ]),
    ]),
  ]),
  category("uk_pide", "Pide & Lahmacun", [
    product("uk_pd1", "Kıymalı Pide", "🫓", 320, "Taş fırında"),
    product("uk_pd2", "Kaşarlı Pide", "🧀", 340, "Bol kaşarlı"),
    product("uk_pd3", "Lahmacun (2 adet)", "🫓", 200, "İnce hamur, zırh kıyma", [
      spiceGroup("uk_pd3"),
    ]),
  ]),
  category("uk_meze", "Mezeler & Salatalar", [
    product("uk_m1", "Ezme Salata", "🥗", 120, "Acılı, közlenmiş"),
    product("uk_m2", "Haydari", "🥣", 115, "Süzme yoğurt, nane"),
    product("uk_m3", "Çoban Salata", "🥒", 130, "Mevsim sebzeleri"),
  ]),
  category("uk_tatli", "Tatlılar", [
    product("uk_t1", "Künefe", "🍯", 290, "Tel kadayıf, antep peyniri", [
      multi("uk_t1_g1", "Ekstra", [
        o("uk_t1_g1_o1", "Kaymak", 70),
        o("uk_t1_g1_o2", "Antep fıstığı", 60),
      ]),
    ]),
    product("uk_t2", "Baklava (4 dilim)", "🥮", 310, "Antep fıstıklı"),
  ]),
  category("uk_icecek", "İçecekler", [
    product("uk_i1", "Şalgam (30 cl)", "🥤", 55, "Acılı / acısız", [
      single("uk_i1_g1", "Acı derecesi", [
        o("uk_i1_g1_o1", "Acısız", 0, { default: true }),
        o("uk_i1_g1_o2", "Acılı", 0),
      ]),
    ]),
    product("uk_i2", "Ayran (30 cl)", "🥛", 45, "Köpüklü"),
  ]),
];

const pizzaMenu: MenuCategory[] = [
  category("np_populer", "Popüler Pizzalar", [
    product(
      "np_p1",
      "Margherita",
      "🍕",
      380,
      "San Marzano domates sos, fior di latte, taze fesleğen",
      [
        single("np_p1_g1", "Boyut", [
          o("np_p1_g1_o1", "Küçük (24 cm)", -90),
          o("np_p1_g1_o2", "Orta (30 cm)", 0, { default: true }),
          o("np_p1_g1_o3", "Büyük (36 cm)", 130),
          o("np_p1_g1_o4", "Aile boy (44 cm)", 260),
        ]),
        single("np_p1_g2", "Hamur", [
          o("np_p1_g2_o1", "İnce hamur", 0, { default: true }),
          o("np_p1_g2_o2", "Kalın hamur", 30),
          o("np_p1_g2_o3", "Glutensiz hamur", 90),
          o("np_p1_g2_o4", "Peynirli kenar", 110),
        ]),
        multi("np_p1_g3", "Ekstra malzemeler", [
          o("np_p1_g3_o1", "Ekstra mozzarella", 70),
          o("np_p1_g3_o2", "Sucuk", 65),
          o("np_p1_g3_o3", "Mantar", 50),
          o("np_p1_g3_o4", "Zeytin", 40),
          o("np_p1_g3_o5", "Rukola", 45),
          o("np_p1_g3_o6", "Parma jambon", 120),
        ]),
      ],
      { popular: true }
    ),
    product(
      "np_p2",
      "Diavola",
      "🌶️",
      455,
      "Acılı salam, mozzarella, kalabria biberi",
      [
        single("np_p2_g1", "Boyut", [
          o("np_p2_g1_o1", "Küçük (24 cm)", -90),
          o("np_p2_g1_o2", "Orta (30 cm)", 0, { default: true }),
          o("np_p2_g1_o3", "Büyük (36 cm)", 130),
        ]),
        spiceGroup("np_p2"),
      ],
      { popular: true }
    ),
    product(
      "np_p3",
      "Quattro Formaggi",
      "🧀",
      490,
      "Mozzarella, gorgonzola, parmesan, taleggio",
      [
        single("np_p3_g1", "Boyut", [
          o("np_p3_g1_o1", "Orta (30 cm)", 0, { default: true }),
          o("np_p3_g1_o2", "Büyük (36 cm)", 130),
        ]),
      ],
      { popular: true, oldPrice: 545 }
    ),
  ]),
  category("np_pizza", "Tüm Pizzalar", [
    product("np_z1", "Prosciutto e Funghi", "🍄", 470, "Jambon ve mantar"),
    product("np_z2", "Vegetariana", "🥦", 410, "Mevsim sebzeleri, közlenmiş biber"),
    product("np_z3", "Tonno e Cipolla", "🐟", 465, "Ton balığı, kırmızı soğan"),
    product("np_z4", "Capricciosa", "🫒", 495, "Jambon, mantar, enginar, zeytin"),
  ]),
  category("np_baslangic", "Başlangıçlar", [
    product("np_b1", "Bruschetta (3 adet)", "🍞", 185, "Domates, fesleğen, zeytinyağı"),
    product("np_b2", "Sarımsaklı Ekmek", "🧄", 145, "Mozzarella ile"),
    product("np_b3", "Caprese Salata", "🥗", 235, "Mozzarella di bufala"),
  ]),
  category("np_tatli", "Tatlılar", [
    product("np_t1", "Tiramisu", "☕", 215, "Mascarpone, espresso"),
    product("np_t2", "Panna Cotta", "🍮", 195, "Orman meyveli"),
  ]),
];

const tavukMenu: MenuCategory[] = [
  category("td_menu", "Menüler", [
    product(
      "td_m1",
      "Çıtır Tavuk Menü (6 parça)",
      "🍗",
      420,
      "6 parça çıtır tavuk, patates, içecek",
      [
        drinkGroup("td_m1"),
        single("td_m1_g2", "Sos tercihi", [
          o("td_m1_g2_o1", "Barbekü", 0, { default: true }),
          o("td_m1_g2_o2", "Ranch", 0),
          o("td_m1_g2_o3", "Bal hardal", 0),
          o("td_m1_g2_o4", "Acı sos", 0),
        ]),
        multi("td_m1_g3", "Ekstra", [
          o("td_m1_g3_o1", "Ekstra 3 parça tavuk", 140),
          o("td_m1_g3_o2", "Coleslaw salata", 55),
          o("td_m1_g3_o3", "Ekstra sos", 25),
        ]),
      ],
      { popular: true }
    ),
    product("td_m2", "Tavuk Burger Menü", "🍔", 340, "Çıtır tavuk burger, patates, içecek", [
      drinkGroup("td_m2"),
    ]),
    product("td_m3", "Kanat Menü (10 adet)", "🔥", 450, "Buffalo kanat, patates, içecek", [
      spiceGroup("td_m3"),
      drinkGroup("td_m3"),
    ]),
  ]),
  category("td_tekil", "Tek Ürünler", [
    product("td_t1", "Çıtır Tavuk (3 parça)", "🍗", 210, "Özel baharatlı panelemiz"),
    product("td_t2", "Tavuk Tenders (5 adet)", "🍤", 230, "Göğüs etinden"),
    product("td_t3", "Buffalo Kanat (6 adet)", "🌶️", 265, "Acılı sos ile", [
      spiceGroup("td_t3"),
    ]),
  ]),
  category("td_yan", "Yan Ürünler", [
    product("td_y1", "Patates Kızartması", "🍟", 105, "Çıtır"),
    product("td_y2", "Coleslaw", "🥗", 65, "Kremalı lahana salatası"),
    product("td_y3", "Mısır", "🌽", 70, "Tereyağlı"),
  ]),
];

const cigkofteMenu: MenuCategory[] = [
  category("ca_cig", "Çiğ Köfteler", [
    product(
      "ca_c1",
      "Çiğ Köfte (Porsiyon)",
      "🌯",
      190,
      "Etsiz, 8 saat yoğrulmuş, yanında marul ve limon",
      [
        single("ca_c1_g1", "Porsiyon", [
          o("ca_c1_g1_o1", "Yarım (250 gr)", -60),
          o("ca_c1_g1_o2", "Tam (500 gr)", 0, { default: true }),
          o("ca_c1_g1_o3", "1 kg", 160),
        ]),
        spiceGroup("ca_c1"),
        multi("ca_c1_g3", "Yanında", [
          o("ca_c1_g3_o1", "Ekstra marul", 25),
          o("ca_c1_g3_o2", "Ekstra limon", 15),
          o("ca_c1_g3_o3", "Nar ekşisi", 20),
          o("ca_c1_g3_o4", "Turşu", 35),
        ]),
      ],
      { popular: true }
    ),
    product(
      "ca_c2",
      "Çiğ Köfte Dürüm",
      "🌯",
      155,
      "Lavaşta, bol yeşillikli",
      [
        spiceGroup("ca_c2"),
        multi("ca_c2_g2", "İçindekiler", [
          o("ca_c2_g2_o1", "Marul", 0, { default: true }),
          o("ca_c2_g2_o2", "Domates", 0, { default: true }),
          o("ca_c2_g2_o3", "Turşu", 0),
          o("ca_c2_g2_o4", "Nar ekşisi", 0, { default: true }),
          o("ca_c2_g2_o5", "Patates kızartması", 30),
        ]),
      ],
      { popular: true }
    ),
    product("ca_c3", "Çiğ Köfte Tabağı (2 Kişilik)", "🍽️", 340, "1 kg çiğ köfte, yeşillik, içecek", [
      drinkGroup("ca_c3"),
    ]),
  ]),
  category("ca_icecek", "İçecekler", [
    product("ca_i1", "Şalgam (30 cl)", "🥤", 50, "Acılı"),
    product("ca_i2", "Ayran (30 cl)", "🥛", 42, "Soğuk"),
    product("ca_i3", "Limonata", "🍋", 80, "Ev yapımı"),
  ]),
];

const tatliMenu: MenuCategory[] = [
  category("sr_pasta", "Pastalar", [
    product(
      "sr_p1",
      "San Sebastian Cheesecake",
      "🍰",
      265,
      "Yanmış cheesecake, dilim",
      [
        single("sr_p1_g1", "Boyut", [
          o("sr_p1_g1_o1", "Dilim", 0, { default: true }),
          o("sr_p1_g1_o2", "Yarım (4 kişilik)", 520),
          o("sr_p1_g1_o3", "Tam (8 kişilik)", 980),
        ]),
        multi("sr_p1_g2", "Üzerine", [
          o("sr_p1_g2_o1", "Frambuaz sos", 45),
          o("sr_p1_g2_o2", "Çikolata sos", 45),
          o("sr_p1_g2_o3", "Antep fıstığı", 65),
        ]),
      ],
      { popular: true }
    ),
    product("sr_p2", "Çikolatalı Trileçe", "🍮", 210, "Karamelli sos ile", [], { popular: true }),
    product("sr_p3", "Havuçlu Kek", "🥕", 195, "Cream cheese kremalı"),
    product("sr_p4", "Profiterol", "🍫", 230, "Sıcak çikolata sos"),
  ]),
  category("sr_sut", "Sütlü Tatlılar", [
    product("sr_s1", "Sütlaç (Fırında)", "🍚", 155, "Tarçınlı"),
    product("sr_s2", "Kazandibi", "🍯", 165, "Klasik"),
    product("sr_s3", "Supangle", "🍫", 175, "Çikolatalı"),
  ]),
  category("sr_serbet", "Şerbetli Tatlılar", [
    product("sr_b1", "Antep Fıstıklı Baklava (6 dilim)", "🥮", 420, "El açması"),
    product("sr_b2", "Şöbiyet (4 dilim)", "🥮", 380, "Kaymaklı"),
    product("sr_b3", "Künefe", "🧀", 280, "Sıcak servis", [], { soldOut: true }),
  ]),
  category("sr_icecek", "İçecekler", [
    product("sr_i1", "Türk Kahvesi", "☕", 95, "Orta şekerli", [
      single("sr_i1_g1", "Şeker", [
        o("sr_i1_g1_o1", "Sade", 0),
        o("sr_i1_g1_o2", "Az şekerli", 0),
        o("sr_i1_g1_o3", "Orta", 0, { default: true }),
        o("sr_i1_g1_o4", "Şekerli", 0),
      ]),
    ]),
    product("sr_i2", "Filtre Kahve", "☕", 110, "Günün çekirdeği"),
  ]),
];

const saglikliMenu: MenuCategory[] = [
  category("yk_bowl", "Bowl'lar", [
    product(
      "yk_b1",
      "Izgara Tavuklu Buddha Bowl",
      "🥗",
      365,
      "Kinoa, avokado, nohut, ızgara tavuk, tahin sos",
      [
        single("yk_b1_g1", "Protein", [
          o("yk_b1_g1_o1", "Izgara tavuk", 0, { default: true }),
          o("yk_b1_g1_o2", "Izgara somon", 145),
          o("yk_b1_g1_o3", "Falafel (vegan)", -25),
          o("yk_b1_g1_o4", "Tofu (vegan)", 0),
        ]),
        single("yk_b1_g2", "Taban", [
          o("yk_b1_g2_o1", "Kinoa", 0, { default: true }),
          o("yk_b1_g2_o2", "Esmer pirinç", 0),
          o("yk_b1_g2_o3", "Bulgur", 0),
          o("yk_b1_g2_o4", "Sadece yeşillik", -20),
        ]),
        multi("yk_b1_g3", "Ekstra malzeme", [
          o("yk_b1_g3_o1", "Avokado", 80),
          o("yk_b1_g3_o2", "Ekstra protein", 130),
          o("yk_b1_g3_o3", "Feta peyniri", 55),
          o("yk_b1_g3_o4", "Çıtır nohut", 40),
        ]),
        single("yk_b1_g4", "Sos", [
          o("yk_b1_g4_o1", "Tahin", 0, { default: true }),
          o("yk_b1_g4_o2", "Balzamik", 0),
          o("yk_b1_g4_o3", "Yoğurtlu dill", 0),
          o("yk_b1_g4_o4", "Sossuz", 0),
        ]),
      ],
      { popular: true }
    ),
    product("yk_b2", "Akdeniz Bowl", "🫒", 330, "Humus, falafel, közlenmiş sebze", [], {
      popular: true,
    }),
    product("yk_b3", "Poke Bowl (Somon)", "🍣", 425, "Somon, edamame, avokado, susam"),
  ]),
  category("yk_salata", "Salatalar", [
    product("yk_s1", "Sezar Salata", "🥬", 295, "Izgara tavuk, parmesan, kruton"),
    product("yk_s2", "Kinoa & Nar Salata", "🌰", 275, "Ceviz, nar, roka"),
  ]),
  category("yk_icecek", "Soğuk Preslenmiş", [
    product("yk_i1", "Yeşil Detoks (33 cl)", "🥤", 145, "Ispanak, elma, zencefil, limon"),
    product("yk_i2", "Pancar & Havuç (33 cl)", "🥕", 135, "Soğuk pres"),
    product("yk_i3", "Protein Smoothie", "🥤", 185, "Muz, fıstık ezmesi, whey", [
      single("yk_i3_g1", "Süt tercihi", [
        o("yk_i3_g1_o1", "İnek sütü", 0, { default: true }),
        o("yk_i3_g1_o2", "Badem sütü", 35),
        o("yk_i3_g1_o3", "Yulaf sütü", 35),
      ]),
    ]),
  ]),
];

const kahvaltiMenu: MenuCategory[] = [
  category("sk_serpme", "Serpme Kahvaltı", [
    product(
      "sk_s1",
      "Serpme Kahvaltı (2 Kişilik)",
      "🍳",
      890,
      "22 çeşit, sınırsız çay, köy ekmeği",
      [
        multi("sk_s1_g1", "Sıcak seçimi", [
          o("sk_s1_g1_o1", "Menemen", 0, { default: true }),
          o("sk_s1_g1_o2", "Sucuklu yumurta", 35),
          o("sk_s1_g1_o3", "Kaygana", 20),
          o("sk_s1_g1_o4", "Sahanda yumurta", 0),
        ], 2, 1),
        multi("sk_s1_g2", "Ekstra", [
          o("sk_s1_g2_o1", "Ekstra kaymak & bal", 120),
          o("sk_s1_g2_o2", "Ekstra köy ekmeği", 40),
          o("sk_s1_g2_o3", "Taze sıkma portakal suyu (2 bardak)", 160),
        ]),
      ],
      { popular: true }
    ),
    product("sk_s2", "Serpme Kahvaltı (4 Kişilik)", "🥐", 1690, "Kalabalık sofralar için"),
  ]),
  category("sk_tek", "Tek Kişilik", [
    product("sk_t1", "Menemen", "🍳", 245, "Sucuklu / sucuksuz", [
      single("sk_t1_g1", "Tercih", [
        o("sk_t1_g1_o1", "Sucuksuz", 0, { default: true }),
        o("sk_t1_g1_o2", "Sucuklu", 55),
        o("sk_t1_g1_o3", "Kaşarlı", 45),
        o("sk_t1_g1_o4", "Sucuklu + kaşarlı", 85),
      ]),
    ]),
    product("sk_t2", "Kahvaltı Tabağı", "🧀", 395, "Tek kişilik, 12 çeşit"),
    product("sk_t3", "Simit & Peynir Tabağı", "🥯", 165, "Çay ile"),
  ]),
  category("sk_icecek", "İçecekler", [
    product("sk_i1", "Demlik Çay (Kişi başı)", "🫖", 60, "Sınırsız"),
    product("sk_i2", "Taze Sıkma Portakal Suyu", "🍊", 95, "33 cl"),
    product("sk_i3", "Türk Kahvesi", "☕", 90, "Orta"),
  ]),
];

const uzakdoguMenu: MenuCategory[] = [
  category("wr_wok", "Wok Yemekleri", [
    product(
      "wr_w1",
      "Tavuklu Teriyaki Noodle",
      "🍜",
      395,
      "Udon, teriyaki sos, sebzeler",
      [
        single("wr_w1_g1", "Noodle tercihi", [
          o("wr_w1_g1_o1", "Udon", 0, { default: true }),
          o("wr_w1_g1_o2", "Ramen", 0),
          o("wr_w1_g1_o3", "Pirinç eriştesi (glutensiz)", 30),
          o("wr_w1_g1_o4", "Jasmine pilav", 0),
        ]),
        single("wr_w1_g2", "Protein", [
          o("wr_w1_g2_o1", "Tavuk", 0, { default: true }),
          o("wr_w1_g2_o2", "Dana", 95),
          o("wr_w1_g2_o3", "Karides", 120),
          o("wr_w1_g2_o4", "Tofu (vegan)", 0),
        ]),
        spiceGroup("wr_w1"),
        multi("wr_w1_g4", "Ekstra", [
          o("wr_w1_g4_o1", "Ekstra sebze", 45),
          o("wr_w1_g4_o2", "Kaju fıstığı", 55),
          o("wr_w1_g4_o3", "Yumurta", 30),
        ]),
      ],
      { popular: true }
    ),
    product("wr_w2", "Pad Thai", "🍤", 415, "Karides, yer fıstığı, tamarind", [
      spiceGroup("wr_w2"),
    ], { popular: true }),
    product("wr_w3", "Kung Pao Tavuk", "🌶️", 385, "Acılı, kaju fıstıklı"),
  ]),
  category("wr_sushi", "Sushi", [
    product("wr_s1", "California Roll (8 parça)", "🍣", 320, "Yengeç, avokado, salatalık"),
    product("wr_s2", "Salmon Nigiri (4 parça)", "🐟", 290, "Taze somon"),
    product("wr_s3", "Sushi Tabağı (16 parça)", "🍱", 720, "Karışık", [], { popular: true }),
  ]),
  category("wr_baslangic", "Başlangıçlar", [
    product("wr_b1", "Gyoza (5 adet)", "🥟", 215, "Tavuklu, buharda"),
    product("wr_b2", "Edamame", "🫛", 145, "Deniz tuzlu"),
    product("wr_b3", "Miso Çorbası", "🍲", 120, "Tofu, wakame"),
  ]),
];

const denizMenu: MenuCategory[] = [
  category("bm_balik", "Günün Balıkları", [
    product(
      "bm_b1",
      "Izgara Çipura",
      "🐟",
      620,
      "Porsiyon, yanında roka ve soğan salatası",
      [
        single("bm_b1_g1", "Pişirme", [
          o("bm_b1_g1_o1", "Izgara", 0, { default: true }),
          o("bm_b1_g1_o2", "Fırında", 0),
          o("bm_b1_g1_o3", "Buğulama", 45),
        ]),
        multi("bm_b1_g2", "Yanında", [
          o("bm_b1_g2_o1", "Zeytinyağlı ot", 110),
          o("bm_b1_g2_o2", "Közlenmiş patlıcan", 120),
          o("bm_b1_g2_o3", "Ekstra roka salata", 75),
        ]),
      ],
      { popular: true }
    ),
    product("bm_b2", "Izgara Levrek", "🐠", 640, "Porsiyon", [], { popular: true }),
    product("bm_b3", "Hamsi Tava (Porsiyon)", "🐟", 380, "Mısır unlu"),
    product("bm_b4", "Kalamar Tava", "🦑", 490, "Tartar sos ile"),
  ]),
  category("bm_meze", "Mezeler", [
    product("bm_m1", "Atom", "🌶️", 165, "Acılı yoğurt mezesi"),
    product("bm_m2", "Fava", "🫘", 155, "Dereotlu"),
    product("bm_m3", "Deniz Börülcesi", "🌿", 150, "Zeytinyağlı"),
    product("bm_m4", "Ahtapot Salata", "🐙", 320, "Limonlu"),
  ]),
  category("bm_icecek", "İçecekler", [
    product("bm_i1", "Şalgam", "🥤", 55, "Acılı"),
    product("bm_i2", "Maden Suyu", "💧", 45, "Sade / limonlu", [
      single("bm_i2_g1", "Aroma", [
        o("bm_i2_g1_o1", "Sade", 0, { default: true }),
        o("bm_i2_g1_o2", "Limonlu", 0),
        o("bm_i2_g1_o3", "Elmalı", 0),
      ]),
    ]),
  ]),
];

const evYemekleriMenu: MenuCategory[] = [
  category("ae_gunun", "Günün Yemekleri", [
    product("ae_g1", "Etli Kuru Fasulye + Pilav", "🍲", 285, "Tereyağlı pilav ile", [
      multi("ae_g1_g1", "Yanında", [
        o("ae_g1_g1_o1", "Turşu", 35),
        o("ae_g1_g1_o2", "Cacık", 55),
        o("ae_g1_g1_o3", "Ekstra pilav", 45),
      ]),
    ], { popular: true }),
    product("ae_g2", "Karnıyarık", "🍆", 295, "Pilav ile", [], { popular: true }),
    product("ae_g3", "Mantı (Porsiyon)", "🥟", 315, "Yoğurtlu, tereyağlı", [
      single("ae_g3_g1", "Sos", [
        o("ae_g3_g1_o1", "Yoğurtlu + salçalı", 0, { default: true }),
        o("ae_g3_g1_o2", "Sadece tereyağlı", 0),
        o("ae_g3_g1_o3", "Yoğurtsuz", 0),
      ]),
    ], { popular: true }),
    product("ae_g4", "İçli Köfte (3 adet)", "🥟", 265, "El yapımı"),
    product("ae_g5", "Tavuk Sote", "🍗", 275, "Pilav ile"),
  ]),
  category("ae_corba", "Çorbalar", [
    product("ae_c1", "Mercimek Çorbası", "🍜", 110, "Limonlu"),
    product("ae_c2", "Ezogelin Çorbası", "🥣", 115, "Naneli"),
    product("ae_c3", "İşkembe Çorbası", "🍲", 145, "Sarımsaklı"),
  ]),
  category("ae_tatli", "Tatlılar", [
    product("ae_t1", "Ev Yapımı Sütlaç", "🍚", 130, "Fırında"),
    product("ae_t2", "İrmik Helvası", "🍮", 125, "Dondurma ile", [
      multi("ae_t2_g1", "Ekstra", [o("ae_t2_g1_o1", "Vanilyalı dondurma", 55)]),
    ]),
  ]),
];

const tostMenu: MenuCategory[] = [
  category("te_tost", "Tostlar", [
    product(
      "te_t1",
      "Karışık Tost",
      "🥪",
      165,
      "Kaşar, sucuk, salam, domates",
      [
        single("te_t1_g1", "Ekmek", [
          o("te_t1_g1_o1", "Tost ekmeği", 0, { default: true }),
          o("te_t1_g1_o2", "Bazlama", 25),
          o("te_t1_g1_o3", "Kaşarlı bazlama", 50),
        ]),
        multi("te_t1_g2", "Ekstra malzeme", [
          o("te_t1_g2_o1", "Ekstra kaşar", 40),
          o("te_t1_g2_o2", "Sucuk", 45),
          o("te_t1_g2_o3", "Turşu", 20),
          o("te_t1_g2_o4", "Ketçap-mayonez", 15),
        ]),
      ],
      { popular: true }
    ),
    product("te_t2", "Kaşarlı Tost", "🧀", 130, "Bol kaşarlı", [], { popular: true }),
    product("te_t3", "Kaşarlı Sucuklu Tost", "🌭", 155, "Klasik"),
  ]),
  category("te_sandvic", "Sandviçler", [
    product("te_s1", "Ayvalık Tostu", "🥖", 215, "Sucuk, kaşar, turşu, rus salatası"),
    product("te_s2", "Tavuklu Sandviç", "🥙", 195, "Izgara tavuk, marul"),
  ]),
  category("te_icecek", "İçecekler", [
    product("te_i1", "Çay", "🫖", 35, "Demlik"),
    product("te_i2", "Ayran", "🥛", 40, "30 cl"),
    product("te_i3", "Soğuk Kola", "🥤", 60, "33 cl"),
  ]),
];

const kahveMenu: MenuCategory[] = [
  category("fk_sicak", "Sıcak Kahveler", [
    product(
      "fk_s1",
      "Flat White",
      "☕",
      145,
      "Çift shot espresso, mikroköpük süt",
      [
        single("fk_s1_g1", "Boyut", [
          o("fk_s1_g1_o1", "Small (24 cl)", 0, { default: true }),
          o("fk_s1_g1_o2", "Medium (35 cl)", 30),
          o("fk_s1_g1_o3", "Large (47 cl)", 55),
        ]),
        single("fk_s1_g2", "Süt tercihi", [
          o("fk_s1_g2_o1", "Tam yağlı", 0, { default: true }),
          o("fk_s1_g2_o2", "Yarım yağlı", 0),
          o("fk_s1_g2_o3", "Laktozsuz", 25),
          o("fk_s1_g2_o4", "Badem sütü", 35),
          o("fk_s1_g2_o5", "Yulaf sütü", 35),
        ]),
        multi("fk_s1_g3", "Ekstra", [
          o("fk_s1_g3_o1", "Ekstra shot", 40),
          o("fk_s1_g3_o2", "Vanilya şurubu", 30),
          o("fk_s1_g3_o3", "Karamel şurubu", 30),
          o("fk_s1_g3_o4", "Fındık şurubu", 30),
        ]),
      ],
      { popular: true }
    ),
    product("fk_s2", "Filtre Kahve", "☕", 120, "Günün çekirdeği, V60", [], { popular: true }),
    product("fk_s3", "Türk Kahvesi", "☕", 95, "Bakır cezvede"),
    product("fk_s4", "Latte", "🥛", 150, "Çift shot"),
  ]),
  category("fk_soguk", "Soğuk Kahveler", [
    product("fk_c1", "Ice Latte", "🧊", 160, "Soğuk süt, çift shot"),
    product("fk_c2", "Cold Brew", "🧊", 175, "18 saat demleme", [], { popular: true }),
    product("fk_c3", "Frappe", "🥤", 185, "Buzlu, köpüklü"),
  ]),
  category("fk_atistir", "Atıştırmalıklar", [
    product("fk_a1", "Cookie", "🍪", 95, "Çift çikolatalı"),
    product("fk_a2", "Muffin", "🧁", 110, "Yaban mersinli"),
    product("fk_a3", "Cheesecake Dilim", "🍰", 195, "San Sebastian"),
  ]),
];

const pideMenu: MenuCategory[] = [
  category("ph_pide", "Pideler", [
    product(
      "ph_p1",
      "Kuşbaşılı Kaşarlı Pide",
      "🫓",
      420,
      "Taş fırında, tereyağlı",
      [
        single("ph_p1_g1", "Boyut", [
          o("ph_p1_g1_o1", "Normal", 0, { default: true }),
          o("ph_p1_g1_o2", "Büyük (1,5 kat)", 160),
        ]),
        multi("ph_p1_g2", "Ekstra", [
          o("ph_p1_g2_o1", "Ekstra kaşar", 70),
          o("ph_p1_g2_o2", "Yumurta", 35),
          o("ph_p1_g2_o3", "Sucuk", 60),
        ]),
      ],
      { popular: true }
    ),
    product("ph_p2", "Kıymalı Pide", "🫓", 330, "Zırh kıyma", [], { popular: true }),
    product("ph_p3", "Kaşarlı Pide", "🧀", 345, "Bol kaşar"),
    product("ph_p4", "Karışık Pide", "🍕", 410, "Kıyma, kaşar, sucuk, yumurta"),
  ]),
  category("ph_lahmacun", "Lahmacun", [
    product("ph_l1", "Lahmacun (1 adet)", "🫓", 105, "İnce hamur", [spiceGroup("ph_l1")]),
    product("ph_l2", "Lahmacun (5 adet)", "🫓", 480, "Aile boyu paket"),
  ]),
  category("ph_yan", "Yanında", [
    product("ph_y1", "Ayran (30 cl)", "🥛", 42, "Köpüklü"),
    product("ph_y2", "Turşu", "🥒", 55, "Karışık"),
    product("ph_y3", "Künefe", "🍯", 270, "Sıcak servis"),
  ]),
];

const mantiMenu: MenuCategory[] = [
  category("bo_manti", "Mantılar", [
    product("bo_m1", "Kayseri Mantısı", "🥟", 320, "El açması, yoğurtlu", [
      single("bo_m1_g1", "Porsiyon", [
        o("bo_m1_g1_o1", "Tek kişilik", 0, { default: true }),
        o("bo_m1_g1_o2", "İki kişilik", 230),
      ]),
    ], { popular: true }),
    product("bo_m2", "Kaşarlı Mantı", "🧀", 350, "Fırınlanmış"),
    product("bo_m3", "Çökertme Kebabı", "🍢", 520, "Kibrit patates üzerinde", [], { popular: true }),
  ]),
  category("bo_corba", "Çorbalar", [
    product("bo_c1", "Mercimek", "🍜", 115, "Limonlu"),
    product("bo_c2", "Yayla Çorbası", "🥣", 125, "Naneli"),
  ]),
];

const steakMenu: MenuCategory[] = [
  category("ns_et", "Etler", [
    product(
      "ns_e1",
      "Dry Aged Antrikot (350 gr)",
      "🥩",
      1450,
      "28 gün dinlendirilmiş, yanında patates püresi",
      [
        single("ns_e1_g1", "Pişirme derecesi", [
          o("ns_e1_g1_o1", "Rare", 0),
          o("ns_e1_g1_o2", "Medium rare", 0, { default: true }),
          o("ns_e1_g1_o3", "Medium", 0),
          o("ns_e1_g1_o4", "Well done", 0),
        ]),
        multi("ns_e1_g2", "Yanında", [
          o("ns_e1_g2_o1", "Trüflü patates püresi", 160),
          o("ns_e1_g2_o2", "Izgara sebze", 140),
          o("ns_e1_g2_o3", "Kemik iliği", 220),
        ]),
      ],
      { popular: true }
    ),
    product("ns_e2", "Kuzu Pirzola (4 adet)", "🍖", 1180, "Biberiyeli"),
    product("ns_e3", "Bonfile (250 gr)", "🥩", 1320, "Mantar sos ile"),
  ]),
  category("ns_baslangic", "Başlangıçlar", [
    product("ns_b1", "Burrata", "🧀", 420, "Domates ve fesleğen ile"),
    product("ns_b2", "Karides Güveç", "🦐", 480, "Fırında"),
  ]),
];

/* ------------------------------------------------------------------ */
/* Restoranlar                                                         */
/* ------------------------------------------------------------------ */

type RestaurantSeed = Omit<Restaurant, "menu"> & { menu: MenuCategory[] };

export const RESTAURANTS: RestaurantSeed[] = withPhotos([
  {
    id: "rst_kasap",
    slug: "kasap-burger-co",
    name: "Kasap Burger Co.",
    emoji: "🍔",
    coverSeed: "kasap-burger",
    tags: ["burger"],
    description:
      "Günlük çekilen dana kasap köfte, ev yapımı brioche ekmek ve elde kesilmiş patates.",
    rating: 4.7,
    ratingCount: 3184,
    etaMin: 25,
    etaMax: 35,
    minBasket: 300,
    deliveryFee: 39.9,
    freeDeliveryOver: 500,
    location: { lat: 40.9819, lng: 29.0265 },
    district: "Moda, Kadıköy",
    deliveryRadiusKm: 6,
    workingHours: { open: "11:00", close: "23:30" },
    approvalStatus: "approved",
    joinedAt: new Date("2024-03-11T09:00:00.000Z").toISOString(),
    commissionRate: 0.12,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "platform",
    paymentMethods: [
      "online_card",
      "wallet",
      "meal_card",
      "card_on_delivery",
      "cash_on_delivery",
    ],
    badges: ["Hızlı teslimat", "Çok satan"],
    menu: burgerMenu,
  },
  {
    id: "rst_ustam",
    slug: "ustam-kebap-salonu",
    name: "Ustam Kebap Salonu",
    emoji: "🥙",
    coverSeed: "ustam-kebap",
    tags: ["kebap", "pide"],
    description:
      "40 yıllık usta elinden zırh kıyma Adana, odun ateşinde kuzu şiş ve günlük baklava.",
    rating: 4.6,
    ratingCount: 5290,
    etaMin: 35,
    etaMax: 50,
    minBasket: 400,
    deliveryFee: 49.9,
    freeDeliveryOver: 700,
    location: { lat: 40.9908, lng: 29.0294 },
    district: "Caferağa, Kadıköy",
    deliveryRadiusKm: 8,
    workingHours: { open: "11:00", close: "23:00" },
    approvalStatus: "approved",
    joinedAt: new Date("2023-09-02T09:00:00.000Z").toISOString(),
    commissionRate: 0.14,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "platform",
    paymentMethods: [
      "online_card",
      "wallet",
      "meal_card",
      "card_on_delivery",
      "cash_on_delivery",
    ],
    badges: ["Ustanın seçimi"],
    menu: kebapMenu,
  },
  {
    id: "rst_napoli",
    slug: "napoli-pizza-bar",
    name: "Napoli Pizza Bar",
    emoji: "🍕",
    coverSeed: "napoli-pizza",
    tags: ["pizza"],
    description:
      "İtalyan taş fırınında 90 saniyede pişen, 48 saat mayalanmış hamur.",
    rating: 4.5,
    ratingCount: 1876,
    etaMin: 30,
    etaMax: 45,
    minBasket: 350,
    deliveryFee: 44.9,
    freeDeliveryOver: 600,
    location: { lat: 40.9877, lng: 29.0247 },
    district: "Caferağa, Kadıköy",
    deliveryRadiusKm: 6.5,
    workingHours: { open: "12:00", close: "23:45" },
    approvalStatus: "approved",
    joinedAt: new Date("2024-06-18T09:00:00.000Z").toISOString(),
    commissionRate: 0.13,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "vendor",
    paymentMethods: ["online_card", "wallet", "card_on_delivery", "cash_on_delivery"],
    badges: ["Taş fırın"],
    menu: pizzaMenu,
  },
  {
    id: "rst_tavuk",
    slug: "tavuk-dunyasi-express",
    name: "Tavuk Dünyası Express",
    emoji: "🍗",
    coverSeed: "tavuk-express",
    tags: ["tavuk", "burger"],
    description: "Çıtır tavuk, buffalo kanat ve menüler. 25 dakikada kapında.",
    rating: 4.3,
    ratingCount: 942,
    etaMin: 20,
    etaMax: 30,
    minBasket: 250,
    deliveryFee: 34.9,
    freeDeliveryOver: 450,
    location: { lat: 40.9931, lng: 29.1268 },
    district: "Ataşehir",
    deliveryRadiusKm: 7,
    workingHours: { open: "10:30", close: "01:00" },
    approvalStatus: "approved",
    joinedAt: new Date("2025-01-27T09:00:00.000Z").toISOString(),
    commissionRate: 0.11,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "platform",
    paymentMethods: [
      "online_card",
      "wallet",
      "meal_card",
      "card_on_delivery",
      "cash_on_delivery",
    ],
    badges: ["Hızlı teslimat"],
    menu: tavukMenu,
  },
  {
    id: "rst_cigkofte",
    slug: "cigkofteci-ali-usta",
    name: "Çiğköfteci Ali Usta",
    emoji: "🌯",
    coverSeed: "ali-usta",
    tags: ["cigkofte"],
    description: "Etsiz çiğ köfte, 8 saat yoğrulmuş. Nar ekşisi ve bol yeşillikle.",
    rating: 4.4,
    ratingCount: 2210,
    etaMin: 20,
    etaMax: 30,
    minBasket: 180,
    deliveryFee: 29.9,
    freeDeliveryOver: 300,
    location: { lat: 40.9895, lng: 29.0311 },
    district: "Rasimpaşa, Kadıköy",
    deliveryRadiusKm: 5,
    workingHours: { open: "10:00", close: "23:00" },
    approvalStatus: "approved",
    joinedAt: new Date("2024-11-05T09:00:00.000Z").toISOString(),
    commissionRate: 0.1,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "vendor",
    paymentMethods: ["online_card", "wallet", "cash_on_delivery", "meal_card"],
    badges: ["Ekonomik"],
    menu: cigkofteMenu,
  },
  {
    id: "rst_sekerli",
    slug: "sekerli-ruya-pastanesi",
    name: "Şekerli Rüya Pastanesi",
    emoji: "🍰",
    coverSeed: "sekerli-ruya",
    tags: ["tatli", "kahve"],
    description: "San Sebastian, trileçe, el açması baklava ve sütlü tatlılar.",
    rating: 4.8,
    ratingCount: 4102,
    etaMin: 25,
    etaMax: 40,
    minBasket: 220,
    deliveryFee: 34.9,
    freeDeliveryOver: 400,
    location: { lat: 40.9805, lng: 29.0288 },
    district: "Moda, Kadıköy",
    deliveryRadiusKm: 7,
    workingHours: { open: "09:00", close: "22:30" },
    approvalStatus: "approved",
    joinedAt: new Date("2023-05-14T09:00:00.000Z").toISOString(),
    commissionRate: 0.15,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "platform",
    paymentMethods: ["online_card", "wallet", "meal_card", "card_on_delivery"],
    badges: ["Puanı yüksek", "Çok satan"],
    menu: tatliMenu,
  },
  {
    id: "rst_yesilkase",
    slug: "yesil-kase",
    name: "Yeşil Kase",
    emoji: "🥗",
    coverSeed: "yesil-kase",
    tags: ["saglikli"],
    description: "Kalori değerleri etiketli bowl'lar, soğuk pres meyve suları.",
    rating: 4.6,
    ratingCount: 1355,
    etaMin: 25,
    etaMax: 35,
    minBasket: 280,
    deliveryFee: 39.9,
    freeDeliveryOver: 500,
    location: { lat: 40.9702, lng: 29.0967 },
    district: "Kozyatağı, Kadıköy",
    deliveryRadiusKm: 8,
    workingHours: { open: "08:30", close: "21:30" },
    approvalStatus: "approved",
    joinedAt: new Date("2025-04-09T09:00:00.000Z").toISOString(),
    commissionRate: 0.14,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "platform",
    paymentMethods: ["online_card", "wallet", "meal_card", "card_on_delivery"],
    badges: ["Sağlıklı seçim"],
    menu: saglikliMenu,
  },
  {
    id: "rst_serpme",
    slug: "serpme-keyfi-kahvalti",
    name: "Serpme Keyfi Kahvaltı",
    emoji: "🍳",
    coverSeed: "serpme-keyfi",
    tags: ["kahvalti"],
    description: "Köy ürünleri, 22 çeşit serpme kahvaltı ve sınırsız çay.",
    rating: 4.5,
    ratingCount: 1688,
    etaMin: 35,
    etaMax: 50,
    minBasket: 400,
    deliveryFee: 49.9,
    freeDeliveryOver: 900,
    location: { lat: 41.0231, lng: 29.0156 },
    district: "Üsküdar",
    deliveryRadiusKm: 9,
    workingHours: { open: "07:30", close: "15:00" },
    breakHours: { start: "11:30", end: "12:00" },
    approvalStatus: "approved",
    joinedAt: new Date("2024-08-21T09:00:00.000Z").toISOString(),
    commissionRate: 0.13,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "vendor",
    paymentMethods: ["online_card", "wallet", "card_on_delivery", "cash_on_delivery"],
    badges: ["Kahvaltı"],
    menu: kahvaltiMenu,
  },
  {
    id: "rst_wok",
    slug: "wok-and-roll",
    name: "Wok & Roll",
    emoji: "🍜",
    coverSeed: "wok-and-roll",
    tags: ["uzakdogu", "deniz"],
    description: "Wok tavada hazırlanan noodle'lar, günlük sushi ve bao.",
    rating: 4.4,
    ratingCount: 1120,
    etaMin: 30,
    etaMax: 45,
    minBasket: 350,
    deliveryFee: 44.9,
    freeDeliveryOver: 650,
    location: { lat: 40.9948, lng: 29.1195 },
    district: "Ataşehir",
    deliveryRadiusKm: 8,
    workingHours: { open: "11:30", close: "23:00" },
    approvalStatus: "approved",
    joinedAt: new Date("2025-02-16T09:00:00.000Z").toISOString(),
    commissionRate: 0.14,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "platform",
    paymentMethods: ["online_card", "wallet", "meal_card", "card_on_delivery"],
    badges: [],
    menu: uzakdoguMenu,
  },
  {
    id: "rst_balikci",
    slug: "balikci-mehmet",
    name: "Balıkçı Mehmet",
    emoji: "🐟",
    coverSeed: "balikci-mehmet",
    tags: ["deniz"],
    description: "Günlük tezgâhtan balık, zeytinyağlı mezeler, Moda sahilinde.",
    rating: 4.7,
    ratingCount: 2874,
    etaMin: 35,
    etaMax: 50,
    minBasket: 500,
    deliveryFee: 54.9,
    freeDeliveryOver: 900,
    location: { lat: 40.9768, lng: 29.0242 },
    district: "Moda, Kadıköy",
    deliveryRadiusKm: 6,
    workingHours: { open: "12:00", close: "23:00" },
    approvalStatus: "approved",
    joinedAt: new Date("2023-12-01T09:00:00.000Z").toISOString(),
    commissionRate: 0.16,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "vendor",
    paymentMethods: ["online_card", "wallet", "card_on_delivery", "cash_on_delivery"],
    badges: ["Puanı yüksek"],
    menu: denizMenu,
  },
  {
    id: "rst_anneeli",
    slug: "anne-eli-ev-yemekleri",
    name: "Anne Eli Ev Yemekleri",
    emoji: "🍲",
    coverSeed: "anne-eli",
    tags: ["evyemekleri"],
    description: "Her gün taze pişen ev yemekleri, çorbalar ve el açması mantı.",
    rating: 4.5,
    ratingCount: 3620,
    etaMin: 25,
    etaMax: 40,
    minBasket: 240,
    deliveryFee: 32.9,
    freeDeliveryOver: 400,
    location: { lat: 40.9748, lng: 29.0595 },
    district: "Göztepe, Kadıköy",
    deliveryRadiusKm: 7,
    workingHours: { open: "10:00", close: "21:00" },
    approvalStatus: "approved",
    joinedAt: new Date("2024-01-30T09:00:00.000Z").toISOString(),
    commissionRate: 0.11,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "platform",
    paymentMethods: [
      "online_card",
      "wallet",
      "meal_card",
      "card_on_delivery",
      "cash_on_delivery",
    ],
    badges: ["Ekonomik", "Çok satan"],
    menu: evYemekleriMenu,
  },
  {
    id: "rst_tostcu",
    slug: "tostcu-emmi",
    name: "Tostçu Emmi",
    emoji: "🥪",
    coverSeed: "tostcu-emmi",
    tags: ["tost"],
    description: "Ayvalık tostu, bazlama tost ve çay. Öğrencinin kurtarıcısı.",
    rating: 4.2,
    ratingCount: 780,
    etaMin: 15,
    etaMax: 25,
    minBasket: 150,
    deliveryFee: 24.9,
    freeDeliveryOver: 250,
    location: { lat: 40.9921, lng: 29.0255 },
    district: "Caferağa, Kadıköy",
    deliveryRadiusKm: 4,
    workingHours: { open: "08:00", close: "02:00" },
    approvalStatus: "approved",
    joinedAt: new Date("2025-06-03T09:00:00.000Z").toISOString(),
    commissionRate: 0.1,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "vendor",
    paymentMethods: ["online_card", "wallet", "cash_on_delivery"],
    badges: ["Hızlı teslimat", "Ekonomik"],
    menu: tostMenu,
  },
  {
    id: "rst_filtre",
    slug: "filtre-kahve-duragi",
    name: "Filtre Kahve Durağı",
    emoji: "☕",
    coverSeed: "filtre-kahve",
    tags: ["kahve", "tatli"],
    description: "Kendi kavurduğumuz çekirdekler, V60 ve cold brew.",
    rating: 4.8,
    ratingCount: 2240,
    etaMin: 20,
    etaMax: 30,
    minBasket: 180,
    deliveryFee: 27.9,
    freeDeliveryOver: 300,
    location: { lat: 40.9812, lng: 29.0229 },
    district: "Moda, Kadıköy",
    deliveryRadiusKm: 5,
    workingHours: { open: "08:00", close: "21:00" },
    approvalStatus: "approved",
    joinedAt: new Date("2024-04-12T09:00:00.000Z").toISOString(),
    commissionRate: 0.12,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "platform",
    paymentMethods: ["online_card", "wallet", "meal_card", "card_on_delivery"],
    badges: ["Puanı yüksek"],
    menu: kahveMenu,
  },
  {
    id: "rst_pideci",
    slug: "pideci-haci-baba",
    name: "Pideci Hacı Baba",
    emoji: "🫓",
    coverSeed: "haci-baba",
    tags: ["pide", "kebap"],
    description: "Taş fırında kapalı pide, lahmacun ve künefe.",
    rating: 4.3,
    ratingCount: 1490,
    etaMin: 30,
    etaMax: 45,
    minBasket: 300,
    deliveryFee: 39.9,
    freeDeliveryOver: 550,
    location: { lat: 41.0198, lng: 29.0184 },
    district: "Üsküdar",
    deliveryRadiusKm: 8,
    workingHours: { open: "11:00", close: "23:00" },
    approvalStatus: "approved",
    joinedAt: new Date("2025-08-25T09:00:00.000Z").toISOString(),
    commissionRate: 0.13,
    temporarilyClosed: true,
    autoAccept: true,
    courierMode: "platform",
    paymentMethods: ["online_card", "wallet", "card_on_delivery", "cash_on_delivery"],
    badges: [],
    menu: pideMenu,
  },
  {
    id: "rst_bogaz",
    slug: "bogaz-manti-evi",
    name: "Boğaz Mantı Evi",
    emoji: "🥟",
    coverSeed: "bogaz-manti",
    tags: ["evyemekleri"],
    description: "El açması Kayseri mantısı ve çökertme kebabı.",
    rating: 4.6,
    ratingCount: 980,
    etaMin: 30,
    etaMax: 45,
    minBasket: 320,
    deliveryFee: 44.9,
    freeDeliveryOver: 600,
    location: { lat: 41.0432, lng: 29.0089 },
    district: "Beşiktaş",
    deliveryRadiusKm: 5,
    workingHours: { open: "11:00", close: "22:30" },
    approvalStatus: "pending",
    joinedAt: new Date("2026-09-14T09:00:00.000Z").toISOString(),
    commissionRate: 0.14,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "platform",
    paymentMethods: ["online_card", "wallet", "meal_card", "card_on_delivery"],
    badges: [],
    menu: mantiMenu,
  },
  {
    id: "rst_nisantasi",
    slug: "nisantasi-steakhouse",
    name: "Nişantaşı Steakhouse",
    emoji: "🥩",
    coverSeed: "nisantasi-steak",
    tags: ["evyemekleri", "deniz"],
    description: "Dry aged etler, kuzu pirzola ve zengin başlangıçlar.",
    rating: 4.9,
    ratingCount: 1640,
    etaMin: 40,
    etaMax: 60,
    minBasket: 900,
    deliveryFee: 79.9,
    freeDeliveryOver: null,
    location: { lat: 41.0511, lng: 28.9932 },
    district: "Şişli",
    deliveryRadiusKm: 5,
    workingHours: { open: "12:00", close: "00:00" },
    approvalStatus: "pending",
    joinedAt: new Date("2026-09-22T09:00:00.000Z").toISOString(),
    commissionRate: 0.18,
    temporarilyClosed: false,
    autoAccept: true,
    courierMode: "vendor",
    paymentMethods: ["online_card", "wallet", "card_on_delivery"],
    badges: ["Puanı yüksek", "Premium"],
    menu: steakMenu,
  },
]);

/* ------------------------------------------------------------------ */
/* Kuponlar                                                            */
/* ------------------------------------------------------------------ */

const FAR_FUTURE = new Date("2027-12-31T23:59:59.000Z").toISOString();

export const COUPONS: Coupon[] = [
  {
    code: "YENI150",
    type: "amount",
    value: 150,
    title: "İlk siparişe 150 ₺",
    description: "250 ₺ ve üzeri ilk siparişinde geçerlidir.",
    minSubtotal: 250,
    restaurantIds: null,
    firstOrderOnly: true,
    expiresAt: FAR_FUTURE,
    active: true,
    createdAt: new Date("2026-08-01T09:00:00.000Z").toISOString(),
  },
  {
    code: "BEDAVAYOL",
    type: "free_delivery",
    value: 0,
    title: "Teslimat ücreti bizden",
    description: "200 ₺ üzeri siparişlerde teslimat ücreti alınmaz.",
    minSubtotal: 200,
    restaurantIds: null,
    expiresAt: FAR_FUTURE,
    active: true,
    createdAt: new Date("2026-08-01T09:00:00.000Z").toISOString(),
  },
  {
    code: "BURGER25",
    type: "percent",
    value: 25,
    title: "Burgerlerde %25 indirim",
    description: "Kasap Burger Co. ve Tavuk Dünyası'nda geçerli, en fazla 200 ₺.",
    minSubtotal: 300,
    maxDiscount: 200,
    restaurantIds: ["rst_kasap", "rst_tavuk"],
    expiresAt: FAR_FUTURE,
    active: true,
    createdAt: new Date("2026-08-01T09:00:00.000Z").toISOString(),
  },
  {
    code: "SAGLIK80",
    type: "amount",
    value: 80,
    title: "Sağlıklı mutfaklarda 80 ₺",
    description: "Yeşil Kase siparişlerinde 300 ₺ üzeri geçerli.",
    minSubtotal: 300,
    restaurantIds: ["rst_yesilkase"],
    expiresAt: FAR_FUTURE,
    active: true,
    createdAt: new Date("2026-08-01T09:00:00.000Z").toISOString(),
  },
  {
    code: "SOFRA10",
    type: "percent",
    value: 10,
    title: "Tüm siparişlerde %10",
    description: "Minimum 200 ₺ sepet tutarı, en fazla 120 ₺ indirim.",
    minSubtotal: 200,
    maxDiscount: 120,
    restaurantIds: null,
    expiresAt: FAR_FUTURE,
    active: true,
    createdAt: new Date("2026-08-01T09:00:00.000Z").toISOString(),
  },
  {
    code: "GECMIS",
    type: "amount",
    value: 100,
    title: "Süresi dolmuş kampanya",
    description: "Bu kod artık geçerli değil (hata durumunu denemek için).",
    minSubtotal: 0,
    restaurantIds: null,
    expiresAt: new Date("2024-01-01T00:00:00.000Z").toISOString(),
    active: true,
    createdAt: new Date("2026-08-01T09:00:00.000Z").toISOString(),
  },
];

/* ------------------------------------------------------------------ */
/* Kurye havuzu (Platform kuryesi modeli)                              */
/* ------------------------------------------------------------------ */

/** Prototipte tüm kuryelerin PIN'i aynı; üretimde kurye kendi belirler. */
export const COURIER_PIN = "1234";

export const COURIERS: Courier[] = [
  {
    id: "crr_1",
    name: "Mert Kaya",
    emoji: "🧑‍✈️",
    vehicle: "moto",
    rating: 4.9,
    maskedPhone: "0850 000 14 02",
    phone: "5321110001",
    online: false,
    point: { lat: 40.9885, lng: 29.0281 },
    homePoint: { lat: 40.9885, lng: 29.0281 },
    ratingSum: 1323,
    ratingCount: 270,
    totalDeliveries: 284,
    status: "active",
    createdAt: new Date("2025-11-04T09:00:00.000Z").toISOString(),
  },
  {
    id: "crr_2",
    name: "Elif Şahin",
    emoji: "👩‍✈️",
    vehicle: "moto",
    rating: 4.8,
    maskedPhone: "0850 000 14 07",
    phone: "5321110002",
    online: false,
    point: { lat: 40.9822, lng: 29.0247 },
    homePoint: { lat: 40.9822, lng: 29.0247 },
    ratingSum: 936,
    ratingCount: 195,
    totalDeliveries: 203,
    status: "active",
    createdAt: new Date("2026-01-12T09:00:00.000Z").toISOString(),
  },
  {
    id: "crr_3",
    name: "Burak Tuna",
    emoji: "🧑‍🔧",
    vehicle: "bisiklet",
    rating: 4.7,
    maskedPhone: "0850 000 14 11",
    phone: "5321110003",
    online: false,
    point: { lat: 40.9931, lng: 29.0304 },
    homePoint: { lat: 40.9931, lng: 29.0304 },
    ratingSum: 517,
    ratingCount: 110,
    totalDeliveries: 118,
    status: "active",
    createdAt: new Date("2026-04-02T09:00:00.000Z").toISOString(),
  },
  {
    id: "crr_4",
    name: "Deniz Arslan",
    emoji: "🧑‍🚀",
    vehicle: "moto",
    rating: 4.9,
    maskedPhone: "0850 000 14 19",
    phone: "5321110004",
    online: false,
    point: { lat: 40.9762, lng: 29.0298 },
    homePoint: { lat: 40.9762, lng: 29.0298 },
    ratingSum: 1421,
    ratingCount: 290,
    totalDeliveries: 301,
    status: "active",
    createdAt: new Date("2025-08-19T09:00:00.000Z").toISOString(),
  },
  {
    id: "crr_5",
    name: "Selin Yıldız",
    emoji: "👩‍🔧",
    vehicle: "araba",
    rating: 4.6,
    maskedPhone: "0850 000 14 24",
    phone: "5321110005",
    online: false,
    point: { lat: 41.0201, lng: 29.0162 },
    homePoint: { lat: 41.0201, lng: 29.0162 },
    ratingSum: 378,
    ratingCount: 82,
    totalDeliveries: 89,
    status: "pending",
    createdAt: new Date("2026-06-23T09:00:00.000Z").toISOString(),
  },
];

/* ------------------------------------------------------------------ */
/* Demo kullanıcı — hızlı giriş için                                   */
/* ------------------------------------------------------------------ */

export const DEMO_USER = {
  id: "usr_demo",
  name: "Yusuf Eren",
  phone: "5551112233",
  email: "demo@sofra.app",
  avatarEmoji: "🧑",
  walletBalance: 450,
};

export const DEMO_ADDRESS = {
  id: "adr_demo",
  label: "ev" as const,
  title: "Evim",
  line1: "Caferağa Mah. Moda Cad. No:42",
  district: "Kadıköy",
  city: "İstanbul",
  buildingNo: "42",
  floor: "3",
  apartmentNo: "7",
  directions: "Zile 2 kez basın, kapı kodu 1907",
  point: { lat: 40.9872, lng: 29.0263 },
};

export const DEMO_CARDS = [
  {
    id: "crd_1",
    brand: "visa" as const,
    last4: "4242",
    holder: "YUSUF EREN",
    expiry: "08/29",
    nickname: "Maaş kartım",
  },
  {
    id: "crd_2",
    brand: "mastercard" as const,
    last4: "8810",
    holder: "YUSUF EREN",
    expiry: "02/28",
    nickname: "Bonus",
  },
];

/* ------------------------------------------------------------------ */
/* Restoran paneli hesapları                                           */
/* ------------------------------------------------------------------ */

/**
 * Her restoran için bir işletme hesabı. Prototipte PIN düz metin ve
 * hepsinde aynı; üretimde restoran sahibi kendi belirler ve hash'lenir.
 */
export const VENDOR_PIN = "1234";

export function vendorSeed() {
  return RESTAURANTS.map((restaurant, index) => ({
    id: `vnd_${index + 1}`,
    restaurantId: restaurant.id,
    name: `${restaurant.name} — İşletme`,
    email: `${restaurant.slug}@sofra.app`,
    pin: VENDOR_PIN,
    createdAt: new Date().toISOString(),
  }));
}

/* ------------------------------------------------------------------ */
/* Yönetici hesabı (Superadmin)                                        */
/* ------------------------------------------------------------------ */

/** Prototip PIN'i; üretimde parola + iki adımlı doğrulama olur. */
export const ADMIN_PIN = "1234";

export function adminSeed() {
  return [
    {
      id: "adm_1",
      name: "Platform Yöneticisi",
      email: "yonetim@sofra.app",
      pin: ADMIN_PIN,
      createdAt: new Date("2023-01-01T09:00:00.000Z").toISOString(),
    },
  ];
}
