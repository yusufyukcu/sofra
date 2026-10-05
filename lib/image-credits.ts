/**
 * Yemek fotoğraflarının atıfları — Creative Commons lisansının şartı.
 * Fotoğraflar Wikimedia Commons ve Openverse (Flickr, Rawpixel) üzerinden
 * seçildi; boyutlandırılıp kırpıldı, hepsine aynı renk işlemesi uygulandı
 * (sıcaklık, doygunluk, kontrast, yerel kontrast, keskinlik, hafif vinyet)
 * ve `public/images/food` altına konuldu.
 * `/gorsel-kaynaklari` sayfası bu listeyi gösterir.
 */

export interface ImageCredit {
  /** Özgün başlık */
  title: string;
  creator: string;
  /** Kısa lisans adı, ör. "CC BY-SA 4.0" */
  license: string;
  licenseUrl: string;
  /** Özgün fotoğraf sayfası */
  source: string;
  /** Bu fotoğraftan üretilen dosyalar */
  files: string[];
}

export const IMAGE_CREDITS: ImageCredit[] = [
  {
    "title": "Adana kebab",
    "creator": "Anatolianpride",
    "license": "Public domain",
    "licenseUrl": "",
    "source": "https://commons.wikimedia.org/wiki/File:Adana_kebab.jpg",
    "files": [
      "/images/food/adana-kebap.webp"
    ]
  },
  {
    "title": "Baby Octopus Salad",
    "creator": "Craig Hatfield",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/83684294@N00/3647189361",
    "files": [
      "/images/food/ahtapot-salata.webp"
    ]
  },
  {
    "title": "Fried grain bowl from NQ (think it was a mixture of amaranth and quinoa)",
    "creator": "wonderyort",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/11112304@N00/5003784809",
    "files": [
      "/images/food/akdeniz-bowl.webp"
    ]
  },
  {
    "title": "Ribeye Steak",
    "creator": "naotakem",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/12832970@N00/5095540074",
    "files": [
      "/images/food/antrikot.webp"
    ]
  },
  {
    "title": "Turkish Meze Plate",
    "creator": "No machine-readable author provided. Gokhan assumed (based on copyright claims).",
    "license": "Public domain",
    "licenseUrl": "",
    "source": "https://commons.wikimedia.org/wiki/File:Turkish_Meze_Plate.jpg",
    "files": [
      "/images/food/atom.webp"
    ]
  },
  {
    "title": "Ayran in a beer glass",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Ayran_in_a_beer_glass.jpg",
    "files": [
      "/images/food/ayran.webp"
    ]
  },
  {
    "title": "Mozarella and Tomato Toasted Sandwich",
    "creator": "avlxyz",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/10559879@N00/564790685",
    "files": [
      "/images/food/ayvalik-tostu.webp"
    ]
  },
  {
    "title": "Pistachio Baklava from Sarigerme, Turkey (49070918302)",
    "creator": "dronepicr",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Pistachio_Baklava_from_Sarigerme,_Turkey_(49070918302).jpg",
    "files": [
      "/images/food/baklava-fistikli.webp"
    ]
  },
  {
    "title": "Baklava - Turkish special, 80-ply",
    "creator": "Kultigin",
    "license": "Public domain",
    "licenseUrl": "",
    "source": "https://commons.wikimedia.org/wiki/File:Baklava_-_Turkish_special,_80-ply.JPEG",
    "files": [
      "/images/food/baklava.webp"
    ]
  },
  {
    "title": "Burger",
    "creator": "DBduo Photography",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/61926883@N00/2890901257",
    "files": [
      "/images/food/banner-burger.webp"
    ]
  },
  {
    "title": "Baklava 2",
    "creator": "Challiyan",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Baklava_2.jpg",
    "files": [
      "/images/food/banner-dessert.webp"
    ]
  },
  {
    "title": "Wood Fired Pizza",
    "creator": "https://oakwoodfirepizza.com/",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Wood_Fired_Pizza.jpg",
    "files": [
      "/images/food/banner-first.webp"
    ]
  },
  {
    "title": "Lula kebab 2",
    "creator": "Lesya Dolyk",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Lula_kebab_2.jpg",
    "files": [
      "/images/food/banner-free.webp"
    ]
  },
  {
    "title": "Healthy Gnocchi Buddha Bowl - 49859901207",
    "creator": "FitTasteTic",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Healthy_Gnocchi_Buddha_Bowl_-_49859901207.jpg",
    "files": [
      "/images/food/banner-healthy.webp"
    ]
  },
  {
    "title": "Beetroot juice homemade",
    "creator": "Dhivya Bharathi Official",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Beetroot_juice_homemade.jpg",
    "files": [
      "/images/food/beet-juice.webp"
    ]
  },
  {
    "title": "Beyti plate",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Beyti_plate.jpg",
    "files": [
      "/images/food/beyti.webp"
    ]
  },
  {
    "title": "Beef Tenderloin - Guillaume at Bennelong - By Julia",
    "creator": "avlxyz",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/10559879@N00/3646086909",
    "files": [
      "/images/food/bonfile.webp"
    ]
  },
  {
    "title": "brownies...yawn...boooring",
    "creator": "jeffreyw",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/7927684@N03/4448807631",
    "files": [
      "/images/food/brownie.webp"
    ]
  },
  {
    "title": "Bruschetta [243/366]",
    "creator": "timsackton",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/43581314@N08/7906679222",
    "files": [
      "/images/food/bruschetta.webp"
    ]
  },
  {
    "title": "Receta de buddha bowl",
    "creator": "Mumumío",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/66491748@N05/41695870932",
    "files": [
      "/images/food/buddha-bowl.webp"
    ]
  },
  {
    "title": "garlic parmesan buffalo wings",
    "creator": "ginnerobot",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/78011127@N00/4399553931",
    "files": [
      "/images/food/buffalo-wings.webp"
    ]
  },
  {
    "title": "Chili's Bacon Cheeseburger",
    "creator": "Clotee Pridgen Allochuku",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/44846110@N07/15385863072",
    "files": [
      "/images/food/burger-bbq-bacon.webp"
    ]
  },
  {
    "title": "Burger",
    "creator": "mdid",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/58246614@N00/5615767469",
    "files": [
      "/images/food/burger-classic.webp"
    ]
  },
  {
    "title": "Crispy-Chicken-Burger",
    "creator": "ccnull.de Bilddatenbank",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/115225894@N07/54380260364",
    "files": [
      "/images/food/burger-crispy-chicken.webp"
    ]
  },
  {
    "title": "shake shack double cheeseburger",
    "creator": "goodiesfirst",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/49215102@N00/3864013408",
    "files": [
      "/images/food/burger-double-cheese.webp"
    ]
  },
  {
    "title": "Moroccan Lamb Burger, Snack Fries - Grill'd QV AUD11.50, AUD3.30",
    "creator": "avlxyz",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/10559879@N00/4635442152",
    "files": [
      "/images/food/burger-smash-menu.webp"
    ]
  },
  {
    "title": "Mmm... mushroom burger",
    "creator": "jeffreyw",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/7927684@N03/6869257214",
    "files": [
      "/images/food/burger-truffle-mushroom.webp"
    ]
  },
  {
    "title": "Veggie Burger KCI 1517",
    "creator": "kurmanstaff",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/62558987@N07/11740453525",
    "files": [
      "/images/food/burger-vegan.webp"
    ]
  },
  {
    "title": "Burrata - Nanninella",
    "creator": "Andy Li",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Burrata_-_Nanninella.jpg",
    "files": [
      "/images/food/burrata.webp"
    ]
  },
  {
    "title": "California Rolls",
    "creator": "Mk2010",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:California_Rolls.JPG",
    "files": [
      "/images/food/california-roll.webp"
    ]
  },
  {
    "title": "Caprese Salad with Blue Bay Goat Suluguni Cheese",
    "creator": "avlxyz",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/10559879@N00/3042662667",
    "files": [
      "/images/food/caprese.webp"
    ]
  },
  {
    "title": "2021-03-13 15 40 15 An open small container of Tostitos Medium Nacho Cheese D…",
    "creator": "Famartin",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:2021-03-13_15_40_15_An_open_small_container_of_Tostitos_Medium_Nacho_Cheese_Dip_in_the_Franklin_Farm_section_of_Oak_Hill,_Fairfax_County,_Virginia.jpg",
    "files": [
      "/images/food/cheddar-sauce.webp"
    ]
  },
  {
    "title": "2023.02.15 Basque Burnt Cheesecake, Washington, DC USA 046 52209",
    "creator": "tedeytan",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/22526649@N03/52736608539",
    "files": [
      "/images/food/cheesecake.webp"
    ]
  },
  {
    "title": "chicken sandwich",
    "creator": "ginnerobot",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/78011127@N00/3499123837",
    "files": [
      "/images/food/chicken-sandwich.webp"
    ]
  },
  {
    "title": "Crispy Chicken Strips - FotoosVanRobin",
    "creator": "FotoosVanRobin from Netherlands",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Crispy_Chicken_Strips_-_FotoosVanRobin.jpg",
    "files": [
      "/images/food/chicken-tenders.webp"
    ]
  },
  {
    "title": "Caribbean Jerk Buffalo Wings",
    "creator": "larryjh1234",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/83886716@N00/13897004465",
    "files": [
      "/images/food/chicken-wings.webp"
    ]
  },
  {
    "title": "Wrapped Lahmacun",
    "creator": "Garrett Ziegler",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Wrapped_Lahmacun.jpg",
    "files": [
      "/images/food/cigkofte-durum.webp"
    ]
  },
  {
    "title": "Tchi keufté (cuisine arménienne) en mai 2022",
    "creator": "Benoît Prieur",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Tchi_keuft%C3%A9_(cuisine_arm%C3%A9nienne)_en_mai_2022.jpg",
    "files": [
      "/images/food/cigkofte-tabak.webp"
    ]
  },
  {
    "title": "Turkish çiğ köfte",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Turkish_%C3%A7i%C4%9F_k%C3%B6fte.jpg",
    "files": [
      "/images/food/cigkofte.webp"
    ]
  },
  {
    "title": "Grilled Japanese sea bream",
    "creator": "T.Tseng",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Grilled_Japanese_sea_bream.jpg",
    "files": [
      "/images/food/cipura.webp"
    ]
  },
  {
    "title": "Amanida turca",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Amanida_turca.jpg",
    "files": [
      "/images/food/coban-salata.webp"
    ]
  },
  {
    "title": "Cokertme Beef Short Rib - Megan's Clapham Old Town",
    "creator": "Haydn Blackey",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/54549113@N00/52688799812",
    "files": [
      "/images/food/cokertme.webp"
    ]
  },
  {
    "title": "Keeping It Cool",
    "creator": "Andrew The Professor",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/45419723@N02/14512245048",
    "files": [
      "/images/food/cola.webp"
    ]
  },
  {
    "title": "cold brew coffee",
    "creator": "shalommama",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/77516069@N05/13610569685",
    "files": [
      "/images/food/cold-brew.webp"
    ]
  },
  {
    "title": "Bowl'o'Coleslaw modified",
    "creator": "",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Bowl%27o%27Coleslaw_modified.jpg",
    "files": [
      "/images/food/coleslaw.webp"
    ]
  },
  {
    "title": "Browned butter chocolate chip cookies",
    "creator": "grongar",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/70757891@N00/7133349441",
    "files": [
      "/images/food/cookie.webp"
    ]
  },
  {
    "title": "Corn on the Cob [193/366]",
    "creator": "timsackton",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/43581314@N08/7559623962",
    "files": [
      "/images/food/corn.webp"
    ]
  },
  {
    "title": "turkish food forevah!",
    "creator": "roland",
    "license": "CC0 1.0",
    "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    "source": "https://www.flickr.com/photos/35034347371@N01/16706724454",
    "files": [
      "/images/food/cover-anneeli.webp"
    ]
  },
  {
    "title": "Grilled Fish, Ristorante Atrium, Palaca Cindro, Diocletian's Palace, Split, Croatia",
    "creator": "brownpau",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/44124483743@N01/7176159319",
    "files": [
      "/images/food/cover-balikci.webp"
    ]
  },
  {
    "title": "Manti 20100213 009",
    "creator": "Sterilgutassistentin",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Manti_20100213_009.JPG",
    "files": [
      "/images/food/cover-bogaz.webp"
    ]
  },
  {
    "title": "Cig Kofte",
    "creator": "leyla.a",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/53532723@N00/6196471300",
    "files": [
      "/images/food/cover-cigkofte.webp"
    ]
  },
  {
    "title": "Flat white coffee at Highdown Gardens, Worthing, West Sussex, England",
    "creator": "Acabashi",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Flat_white_coffee_at_Highdown_Gardens,_Worthing,_West_Sussex,_England.jpg",
    "files": [
      "/images/food/cover-filtre.webp"
    ]
  },
  {
    "title": "Burger and fries on a wooden plate",
    "creator": "Pattaya Patrol",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Burger_and_fries_on_a_wooden_plate.jpg",
    "files": [
      "/images/food/cover-kasap.webp"
    ]
  },
  {
    "title": "Wood fired pizza oven on Svalbard",
    "creator": "Bernt Rostad",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/67975030@N00/16897721540",
    "files": [
      "/images/food/cover-napoli.webp"
    ]
  },
  {
    "title": "Grilled grass-fed ribeye steak",
    "creator": "SaucyGlo",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/67238971@N04/6893013551",
    "files": [
      "/images/food/cover-nisantasi.webp"
    ]
  },
  {
    "title": "Pide",
    "creator": "secretlondon123",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/25834786@N03/7062430307",
    "files": [
      "/images/food/cover-pideci.webp"
    ]
  },
  {
    "title": "Cake Dessert",
    "creator": "JESHOOTS.com",
    "license": "CC0 1.0",
    "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    "source": "https://stocksnap.io/photo/cake-dessert-BE2C443638",
    "files": [
      "/images/food/cover-sekerli.webp"
    ]
  },
  {
    "title": "Breakfast in Turkey",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Breakfast_in_Turkey.jpg",
    "files": [
      "/images/food/cover-serpme.webp"
    ]
  },
  {
    "title": "Chicken tenders and french fries - June 2023 - Sarah Stierch",
    "creator": "Missvain",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Chicken_tenders_and_french_fries_-_June_2023_-_Sarah_Stierch.jpg",
    "files": [
      "/images/food/cover-tavuk.webp"
    ]
  },
  {
    "title": "Sausage & veggies toasted sandwich - Potatoast 2025-12-30",
    "creator": "Andy Li",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Sausage_%26_veggies_toasted_sandwich_-_Potatoast_2025-12-30.jpg",
    "files": [
      "/images/food/cover-tostcu.webp"
    ]
  },
  {
    "title": "Summertime and the grilling is easy",
    "creator": "Samer Farha",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/46944656@N00/155147995",
    "files": [
      "/images/food/cover-ustam.webp"
    ]
  },
  {
    "title": "Sushi Platter in Portugal",
    "creator": "RL0919",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Sushi_Platter_in_Portugal.png",
    "files": [
      "/images/food/cover-wok.webp"
    ]
  },
  {
    "title": "Free healthy salad cubed salmon",
    "creator": "Bilinmiyor",
    "license": "CC0 1.0",
    "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    "source": "https://www.rawpixel.com/image/5928181/photo-image-public-domain-plant-food",
    "files": [
      "/images/food/cover-yesilkase.webp"
    ]
  },
  {
    "title": "Fresh Samphire",
    "creator": "Denna Jones",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/95267793@N00/2732304307",
    "files": [
      "/images/food/deniz-borulcesi.webp"
    ]
  },
  {
    "title": "Edamame on a bamboo bowl by yomi955",
    "creator": "yomi955",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Edamame_on_a_bamboo_bowl_by_yomi955.jpg",
    "files": [
      "/images/food/edamame.webp"
    ]
  },
  {
    "title": "Acılı Ezme",
    "creator": "Garrett Ziegler",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Ac%C4%B1l%C4%B1_Ezme.jpg",
    "files": [
      "/images/food/ezme.webp"
    ]
  },
  {
    "title": "Ezogelin soup",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Ezogelin_soup.jpg",
    "files": [
      "/images/food/ezogelin.webp"
    ]
  },
  {
    "title": "Fava amb carxofa",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Fava_amb_carxofa.jpg",
    "files": [
      "/images/food/fava.webp"
    ]
  },
  {
    "title": "Filter coffee",
    "creator": "illustir",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/12505664@N00/10533616393",
    "files": [
      "/images/food/filter-coffee.webp"
    ]
  },
  {
    "title": "Flat white coffee at Patch Cafe in Richmond",
    "creator": "ultrakml",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/34948727@N00/17364920932",
    "files": [
      "/images/food/flat-white.webp"
    ]
  },
  {
    "title": "Frappe - coffee milkshake with whipped cream and chocolate (KETO, LCHF, Low C…",
    "creator": "Ewelina Podrez-Siama",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Frappe_-_coffee_milkshake_with_whipped_cream_and_chocolate_(KETO,_LCHF,_Low_Carb,_Gluten_free,_FIT)_-_52774791604.jpg",
    "files": [
      "/images/food/frappe.webp"
    ]
  },
  {
    "title": "Fried Chicken (Unsplash)",
    "creator": "Brian Chan tigerrulezzz",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Fried_Chicken_(Unsplash).jpg",
    "files": [
      "/images/food/fried-chicken.webp"
    ]
  },
  {
    "title": "french fries",
    "creator": "stu_spivack",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/35034346243@N01/2932206250",
    "files": [
      "/images/food/fries.webp"
    ]
  },
  {
    "title": "Christina's Garlic Bread",
    "creator": "avlxyz",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/10559879@N00/815661431",
    "files": [
      "/images/food/garlic-bread.webp"
    ]
  },
  {
    "title": "Breville's Green Juice Fave Juice",
    "creator": "Breville USA",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/38102750@N06/8804036525",
    "files": [
      "/images/food/green-juice.webp"
    ]
  },
  {
    "title": "Chicken and prawn gyoza wiith chickpea, lemongrass and coriander - Momotaro Rahmen",
    "creator": "avlxyz",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/10559879@N00/2620981136",
    "files": [
      "/images/food/gyoza.webp"
    ]
  },
  {
    "title": "Hamsi tava and red onions",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Hamsi_tava_and_red_onions.jpg",
    "files": [
      "/images/food/hamsi.webp"
    ]
  },
  {
    "title": "Carrot Cake",
    "creator": "feserc",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/42602676@N00/4991062521",
    "files": [
      "/images/food/havuclu-kek.webp"
    ]
  },
  {
    "title": "Yogurt Dip made 1/4 cup",
    "creator": "U.S. Department of Agriculture",
    "license": "CC0 1.0",
    "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
    "source": "https://www.rawpixel.com/image/8735059/photo-image-public-domain-food",
    "files": [
      "/images/food/haydari.webp"
    ]
  },
  {
    "title": "Iced Latte Preparation",
    "creator": "kadluba",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/38235150@N00/14384718764",
    "files": [
      "/images/food/iced-latte.webp"
    ]
  },
  {
    "title": "Suriye'ye ait içli köfte",
    "creator": "Yemekta",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Suriye%27ye_ait_i%C3%A7li_k%C3%B6fte.jpg",
    "files": [
      "/images/food/icli-kofte.webp"
    ]
  },
  {
    "title": "Dondurmalı irmik helvası 2",
    "creator": "Satirdan kahraman",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Dondurmal%C4%B1_irmik_helvas%C4%B1_2.jpg",
    "files": [
      "/images/food/irmik-helvasi.webp"
    ]
  },
  {
    "title": "Tripe soup in Ankara",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Tripe_soup_in_Ankara.jpg",
    "files": [
      "/images/food/iskembe.webp"
    ]
  },
  {
    "title": "İskender kebap",
    "creator": "Adriao",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:%C4%B0skender_kebap.JPG",
    "files": [
      "/images/food/iskender.webp"
    ]
  },
  {
    "title": "Sucuklu yumurta, Turkish sunday breakfast",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Sucuklu_yumurta,_Turkish_sunday_breakfast.jpg",
    "files": [
      "/images/food/kahvalti-tabagi.webp"
    ]
  },
  {
    "title": "Fried Calamari Rings",
    "creator": "coolmikeol",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/44094498@N03/6632175159",
    "files": [
      "/images/food/kalamar.webp"
    ]
  },
  {
    "title": "Kiremitte karides",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Kiremitte_karides.jpg",
    "files": [
      "/images/food/karides-guvec.webp"
    ]
  },
  {
    "title": "Karnıyarık - Lunch at Yanyali Fehmi Lokantasi (6421044715)",
    "creator": "William Neuheisel from DC, US",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Karn%C4%B1yar%C4%B1k_-_Lunch_at_Yanyali_Fehmi_Lokantasi_(6421044715).jpg",
    "files": [
      "/images/food/karniyarik.webp"
    ]
  },
  {
    "title": "",
    "creator": "ampersandyslexia",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/88916555@N00/6258047317",
    "files": [
      "/images/food/kazandibi.webp"
    ]
  },
  {
    "title": "savory quinoa salad",
    "creator": "gamene",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/12670507@N02/4743169618",
    "files": [
      "/images/food/kinoa-salata.webp"
    ]
  },
  {
    "title": "Kunefe",
    "creator": "Sudharsan.Narayanan",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/42119274@N08/8031644882",
    "files": [
      "/images/food/kunefe.webp"
    ]
  },
  {
    "title": "May's Garden Restaurant, Ottawa - Kung Pao Chicken",
    "creator": "C John Thompson",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/71266843@N03/6454330343",
    "files": [
      "/images/food/kung-pao.webp"
    ]
  },
  {
    "title": "Kuru fasulye, Ispir tipi",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Kuru_fasulye,_Ispir_tipi.jpg",
    "files": [
      "/images/food/kuru-fasulye.webp"
    ]
  },
  {
    "title": "Lamb shish kebab - Ankara",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Lamb_shish_kebab_-_Ankara.jpg",
    "files": [
      "/images/food/kuzu-sis.webp"
    ]
  },
  {
    "title": "Acılı Lahmacun",
    "creator": "Garrett Ziegler",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Ac%C4%B1l%C4%B1_Lahmacun.jpg",
    "files": [
      "/images/food/lahmacun.webp"
    ]
  },
  {
    "title": "Latte art",
    "creator": "Mortefot from Flickr",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Latte_art.jpg",
    "files": [
      "/images/food/latte.webp"
    ]
  },
  {
    "title": "Lemonade 2",
    "creator": "Shisma",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Lemonade_2.jpg",
    "files": [
      "/images/food/lemonade.webp"
    ]
  },
  {
    "title": "GOC Wheathampstead Xmas 2013 061: Grilled sea bass",
    "creator": "Peter O'Connor aka anemoneprojectors",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/58414938@N00/11476849023",
    "files": [
      "/images/food/levrek.webp"
    ]
  },
  {
    "title": "Water Pouring Over Glass of Ice",
    "creator": "StockPhotosforFree.com",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/79249118@N05/7190209429",
    "files": [
      "/images/food/maden-suyu.webp"
    ]
  },
  {
    "title": "Mantı",
    "creator": "Nérostrateur",
    "license": "CC BY 2.5",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.5",
    "source": "https://commons.wikimedia.org/wiki/File:Mant%C4%B1.jpg",
    "files": [
      "/images/food/manti.webp"
    ]
  },
  {
    "title": "breakfast: menemen",
    "creator": "Paul Keller",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/18259771@N00/5153426633",
    "files": [
      "/images/food/menemen.webp"
    ]
  },
  {
    "title": "Red Lentil Soup - Creamy",
    "creator": "bobjudge",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/8286199@N08/3210281474",
    "files": [
      "/images/food/mercimek.webp"
    ]
  },
  {
    "title": "Miso Soup 001",
    "creator": "Ocdp",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Miso_Soup_001.jpg",
    "files": [
      "/images/food/miso-soup.webp"
    ]
  },
  {
    "title": "Iraqi Mixed Grill Platter with Traditional Accompaniments",
    "creator": "Abdulsalam Al Dabbagh",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Iraqi_Mixed_Grill_Platter_with_Traditional_Accompaniments.jpg",
    "files": [
      "/images/food/mixed-grill.webp"
    ]
  },
  {
    "title": "Muffin - IMG_0246",
    "creator": "Nicola since 1972",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/15216811@N06/5398771984",
    "files": [
      "/images/food/muffin.webp"
    ]
  },
  {
    "title": "Nigiri Sushi (26478725732)",
    "creator": "Tim Reckmann from Hamm, Deutschland",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Nigiri_Sushi_(26478725732).jpg",
    "files": [
      "/images/food/nigiri.webp"
    ]
  },
  {
    "title": "Mmm... onion rings and shrimp",
    "creator": "jeffreyw",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/7927684@N03/7713056594",
    "files": [
      "/images/food/onion-rings.webp"
    ]
  },
  {
    "title": "Orange Juice",
    "creator": "Yu. Samoilov",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/110751683@N02/13638538444",
    "files": [
      "/images/food/orange-juice.webp"
    ]
  },
  {
    "title": "Phat Thai kung Chang Khien street stall",
    "creator": "Takeaway",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Phat_Thai_kung_Chang_Khien_street_stall.jpg",
    "files": [
      "/images/food/pad-thai.webp"
    ]
  },
  {
    "title": "greek yogurt panna cotta",
    "creator": "stu_spivack",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/35034346243@N01/84610490",
    "files": [
      "/images/food/panna-cotta.webp"
    ]
  },
  {
    "title": "Pastirmali pide",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Pastirmali_pide.jpg",
    "files": [
      "/images/food/pide-karisik.webp"
    ]
  },
  {
    "title": "Kaşarlı pide",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Ka%C5%9Farl%C4%B1_pide.jpg",
    "files": [
      "/images/food/pide-kasarli.webp"
    ]
  },
  {
    "title": "Nazilli-kiymali-pide-20240417 175435",
    "creator": "Erdalkara",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Nazilli-kiymali-pide-20240417_175435.jpg",
    "files": [
      "/images/food/pide-kiymali.webp"
    ]
  },
  {
    "title": "Pide (kuşbaşı etli)",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Pide_(ku%C5%9Fba%C5%9F%C4%B1_etli).jpg",
    "files": [
      "/images/food/pide-kusbasili.webp"
    ]
  },
  {
    "title": "Herb-Brined Lamb Chops",
    "creator": "manguzmo",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/55711655@N08/5674634678",
    "files": [
      "/images/food/pirzola.webp"
    ]
  },
  {
    "title": "Pizza capricciosa",
    "creator": "Phil Whitehouse from London, United Kingdom",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Pizza_capricciosa.jpg",
    "files": [
      "/images/food/pizza-capricciosa.webp"
    ]
  },
  {
    "title": "Pepperoni Pizza",
    "creator": "Happy Tummy",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/29198474@N05/15471774628",
    "files": [
      "/images/food/pizza-diavola.webp"
    ]
  },
  {
    "title": "Pizza-napoletana",
    "creator": "Fabryx98",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Pizza-napoletana.jpg",
    "files": [
      "/images/food/pizza-margherita.webp"
    ]
  },
  {
    "title": "Pizza capricciosa, Munich",
    "creator": "Gerda Arendt",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Pizza_capricciosa,_Munich.jpg",
    "files": [
      "/images/food/pizza-prosciutto-funghi.webp"
    ]
  },
  {
    "title": "Four Cheese Pizza - Giant Steps Winery AUD22",
    "creator": "avlxyz",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/10559879@N00/4166168538",
    "files": [
      "/images/food/pizza-quattro-formaggi.webp"
    ]
  },
  {
    "title": "Domino's Pizza - Magarita + tuna & mushroom",
    "creator": "emrank",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/15622795@N05/3413907349",
    "files": [
      "/images/food/pizza-tonno.webp"
    ]
  },
  {
    "title": "Dodo Pizza Vegetables Grill SMM",
    "creator": "dodopizzastory",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/133117136@N05/51940415610",
    "files": [
      "/images/food/pizza-vegetariana.webp"
    ]
  },
  {
    "title": "Poke Bowl",
    "creator": "Mike Saechang",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/7390466@N06/7193749724",
    "files": [
      "/images/food/poke-bowl.webp"
    ]
  },
  {
    "title": "Profiteroles",
    "creator": "ralph and jenny",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/92269745@N00/16412094846",
    "files": [
      "/images/food/profiterol.webp"
    ]
  },
  {
    "title": "Mango Banana Smoothie",
    "creator": "Irma Sakul",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Mango_Banana_Smoothie.jpg",
    "files": [
      "/images/food/protein-smoothie.webp"
    ]
  },
  {
    "title": "Yeni3",
    "creator": "Anatolianpride",
    "license": "Public domain",
    "licenseUrl": "",
    "source": "https://commons.wikimedia.org/wiki/File:Yeni3.jpg",
    "files": [
      "/images/food/salgam.webp"
    ]
  },
  {
    "title": "Turkish breakfast",
    "creator": "pocketcultures",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/32371858@N03/5164256214",
    "files": [
      "/images/food/serpme-kahvalti.webp"
    ]
  },
  {
    "title": "Caesar Salad & Grilled Shrimps",
    "creator": "Prayitno / Thank you for (12 millions +) view",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/34128007@N04/19461199606",
    "files": [
      "/images/food/sezar-salata.webp"
    ]
  },
  {
    "title": "Istanbul - Simit",
    "creator": "drivoit",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/28395560@N06/4000871434",
    "files": [
      "/images/food/simit.webp"
    ]
  },
  {
    "title": "Şöbiyet Baklava",
    "creator": "Garrett Ziegler",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:%C5%9E%C3%B6biyet_Baklava.jpg",
    "files": [
      "/images/food/sobiyet.webp"
    ]
  },
  {
    "title": "Supangle (cake inside)",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Supangle_(cake_inside).jpg",
    "files": [
      "/images/food/supangle.webp"
    ]
  },
  {
    "title": "Sushi platter",
    "creator": "chidorian from Japan",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Sushi_platter.jpg",
    "files": [
      "/images/food/sushi-platter.webp"
    ]
  },
  {
    "title": "Fırında Sütlaç",
    "creator": "İnci Mercan",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/53190938@N06/7715635904",
    "files": [
      "/images/food/sutlac.webp"
    ]
  },
  {
    "title": "Shish taouk",
    "creator": "The original uploader was Basel15 at English Wikipedia.",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/",
    "source": "https://commons.wikimedia.org/wiki/File:Shish_taouk.jpg",
    "files": [
      "/images/food/tavuk-sis.webp"
    ]
  },
  {
    "title": "Chicken Stir-Fry",
    "creator": "Rusty Clark ~ 100K Photos",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/23206546@N04/8320024006",
    "files": [
      "/images/food/tavuk-sote.webp"
    ]
  },
  {
    "title": "Turkish tea2",
    "creator": "henribergius",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Turkish_tea2.jpg",
    "files": [
      "/images/food/tea.webp"
    ]
  },
  {
    "title": "Singapore Noodles - Global Vegetarian AUD9.80",
    "creator": "avlxyz",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/10559879@N00/4091977889",
    "files": [
      "/images/food/teriyaki-noodle.webp"
    ]
  },
  {
    "title": "Classic Italian Tiramisu-3 (29989504485)",
    "creator": "Sharon Chen from Austin, United States",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Classic_Italian_Tiramisu-3_(29989504485).jpg",
    "files": [
      "/images/food/tiramisu.webp"
    ]
  },
  {
    "title": "Toasted sandwich",
    "creator": "No machine-readable author provided. Husky assumed (based on copyright claims).",
    "license": "Public domain",
    "licenseUrl": "",
    "source": "https://commons.wikimedia.org/wiki/File:Toasted_sandwich.jpg",
    "files": [
      "/images/food/tost-karisik.webp"
    ]
  },
  {
    "title": "Grilled cheese sandwich with sweet potato puree on a wood table next to a per…",
    "creator": "PersonalCreations.com",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/127294011@N07/16038437228",
    "files": [
      "/images/food/tost-kasarli.webp"
    ]
  },
  {
    "title": "Ham & cheese toasted sandwich - Potatoast 2026-05-02",
    "creator": "Andy Li",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Ham_%26_cheese_toasted_sandwich_-_Potatoast_2026-05-02.jpg",
    "files": [
      "/images/food/tost-sucuklu.webp"
    ]
  },
  {
    "title": "Tres leches cake, Germany",
    "creator": "Struppig taucher",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Tres_leches_cake,_Germany.jpg",
    "files": [
      "/images/food/trilece.webp"
    ]
  },
  {
    "title": "Turkish coffee",
    "creator": "WordRidden",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/97844767@N00/14245350315",
    "files": [
      "/images/food/turkish-coffee.webp"
    ]
  },
  {
    "title": "Istanbul :: Çukurcuma :: Nefis Turşu ve Şalgam Suyu Bardakta Verili",
    "creator": "tomislavmedak",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/11932978@N00/4993003701",
    "files": [
      "/images/food/tursu.webp"
    ]
  },
  {
    "title": "Adana Kebap at Öz Urfa",
    "creator": "In Memoriam: chrisbulle",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/67726656@N00/1117796325",
    "files": [
      "/images/food/urfa-kebap.webp"
    ]
  },
  {
    "title": "Yayla soup (Turkish cuisine)",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Yayla_soup_(Turkish_cuisine).jpg",
    "files": [
      "/images/food/yayla.webp"
    ]
  }
];
