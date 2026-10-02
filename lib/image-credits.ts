/**
 * Yemek fotoğraflarının atıfları — Creative Commons lisansının şartı.
 * Fotoğraflar Wikimedia Commons ve Openverse (Flickr) üzerinden seçildi,
 * boyutlandırılıp kırpılarak `public/images/food` altına konuldu.
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
    "title": "Quinoa Salad (140491457)",
    "creator": "J Doll",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Quinoa_Salad_(140491457).jpeg",
    "files": [
      "/images/food/akdeniz-bowl.webp"
    ]
  },
  {
    "title": "Ribeye steak and asparagus",
    "creator": "danielhallpresentsdotcom",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:Ribeye_steak_and_asparagus.jpg",
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
    "title": "Ayvalık tostu in Ankara - 2018",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Ayval%C4%B1k_tostu_in_Ankara_-_2018.jpg",
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
    "title": "Oak-Grilled Filet Mignon @ Jiko - Animal Kingdom Lodge | Disney Food",
    "creator": "JeffChristiansen",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/7256454@N05/5959134033",
    "files": [
      "/images/food/bonfile.webp"
    ]
  },
  {
    "title": "Fudgy Chocolate Brownies with Macadamia Nuts",
    "creator": "Kelly Hunter",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/47149893@N07/15410404930",
    "files": [
      "/images/food/brownie.webp"
    ]
  },
  {
    "title": "Bruschetta at The Bar at MacArthur Place - Sarah Stierch",
    "creator": "Missvain",
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Bruschetta_at_The_Bar_at_MacArthur_Place_-_Sarah_Stierch.jpg",
    "files": [
      "/images/food/bruschetta.webp"
    ]
  },
  {
    "title": "BuddhaBowlLot",
    "creator": "PizzaMan",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:BuddhaBowlLot.jpg",
    "files": [
      "/images/food/buddha-bowl.webp"
    ]
  },
  {
    "title": "Buffalo wings-01",
    "creator": "Clotee Pridgen Allochuku",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Buffalo_wings-01.jpg",
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
    "title": "Cheeseburger",
    "creator": "Renee Comet (photographer)",
    "license": "Public domain",
    "licenseUrl": "",
    "source": "https://commons.wikimedia.org/wiki/File:Cheeseburger.jpg",
    "files": [
      "/images/food/burger-classic.webp",
      "/images/food/banner-burger.webp"
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
    "title": "Caprese-1",
    "creator": "Rainer Zenz",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "http://creativecommons.org/licenses/by-sa/3.0/",
    "source": "https://commons.wikimedia.org/wiki/File:Caprese-1.jpg",
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
    "creator": "stu_spivack",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/35034346243@N01/8712425260",
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
    "title": "Chicken Wing Skewers - close-up - Ayiguli 323 Fast Food AUD2 each",
    "creator": "avlxyz",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/10559879@N00/4407962493",
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
    "title": "Çökertme kebabı (cropped)",
    "creator": "Jwslubbock",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:%C3%87%C3%B6kertme_kebab%C4%B1_(cropped).jpg",
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
    "title": "Meal in Turkey",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Meal_in_Turkey.jpg",
    "files": [
      "/images/food/cover-anneeli.webp"
    ]
  },
  {
    "title": "Hamsi tava and salad",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Hamsi_tava_and_salad.jpg",
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
    "title": "Tchi Kofte from Carousel Restaurant Hollywood July 2022",
    "creator": "Benoît Prieur",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Tchi_Kofte_from_Carousel_Restaurant_Hollywood_July_2022.JPG",
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
    "title": "2019-07-27 Turkish pide with cheese at Istanbul restaurant",
    "creator": "Maksym Kozlenko",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:2019-07-27_Turkish_pide_with_cheese_at_Istanbul_restaurant.jpg",
    "files": [
      "/images/food/cover-pideci.webp"
    ]
  },
  {
    "title": "Kadayıf Taksim (4)",
    "creator": "Benreis",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Kaday%C4%B1f_Taksim_(4).JPG",
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
    "title": "Healthy Vegan Buddha Bowl - 49859044753",
    "creator": "FitTasteTic",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Healthy_Vegan_Buddha_Bowl_-_49859044753.jpg",
    "files": [
      "/images/food/cover-yesilkase.webp"
    ]
  },
  {
    "title": "Deniz börülcesi salatası (glasswort salad)",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Deniz_b%C3%B6r%C3%BClcesi_salatas%C4%B1_(glasswort_salad).jpg",
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
    "title": "Garlic Bread",
    "creator": "mdid",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/58246614@N00/3008052276",
    "files": [
      "/images/food/garlic-bread.webp"
    ]
  },
  {
    "title": "やまだの青汁",
    "creator": "Ugawa",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
    "source": "https://commons.wikimedia.org/wiki/File:%E3%82%84%E3%81%BE%E3%81%A0%E3%81%AE%E9%9D%92%E6%B1%81.jpg",
    "files": [
      "/images/food/green-juice.webp"
    ]
  },
  {
    "title": "Gyoza - Tora",
    "creator": "Francesc Fort",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Gyoza_-_Tora.jpg",
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
    "title": "Carrot cake slice and latte - Saltmarsh Farmhouse & Cafe 2024-12-19",
    "creator": "Andy Li",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Carrot_cake_slice_and_latte_-_Saltmarsh_Farmhouse_%26_Cafe_2024-12-19.jpg",
    "files": [
      "/images/food/havuclu-kek.webp"
    ]
  },
  {
    "title": "Haydari in a square plate",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Haydari_in_a_square_plate.jpg",
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
    "title": "Fried Calamari at Kapp's Pizza Bar & Grill",
    "creator": "pointnshoot",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/18244673@N00/464819704",
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
    "title": "Künefe 20230904",
    "creator": "Basak",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:K%C3%BCnefe_20230904.jpg",
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
    "title": "Menemen in pan",
    "creator": "FakirNL",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Menemen_in_pan.jpg",
    "files": [
      "/images/food/menemen.webp"
    ]
  },
  {
    "title": "Mercimek çorbası in Ankara, Turkey",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Mercimek_%C3%A7orbas%C4%B1_in_Ankara,_Turkey.jpg",
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
    "title": "Blueberry muffin - Cosy Cottage 2025-04-21",
    "creator": "Andy Li",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Blueberry_muffin_-_Cosy_Cottage_2025-04-21.jpg",
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
    "title": "Beer Battered Onion Rings - RV90 - 20241107-133409",
    "creator": "RegionVisitor90",
    "license": "CC0",
    "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
    "source": "https://commons.wikimedia.org/wiki/File:Beer_Battered_Onion_Rings_-_RV90_-_20241107-133409.jpg",
    "files": [
      "/images/food/onion-rings.webp"
    ]
  },
  {
    "title": "orange juice",
    "creator": "Mervi Emilia",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
    "source": "https://www.flickr.com/photos/14394039@N00/5563590861",
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
    "title": "Panna Cotta with Balsamic Strawberries - Mr Wolf",
    "creator": "avlxyz",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/10559879@N00/538270946",
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
    "title": "Liat Portal for Foodie Disorder – Lamb chops with asparagus",
    "creator": "HaJunkiyada",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Liat_Portal_for_Foodie_Disorder_%E2%80%93_Lamb_chops_with_asparagus.jpg",
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
    "title": "Pepperoni Pizza - Pizza e Cucina AUD18 large",
    "creator": "avlxyz",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/10559879@N00/2738662382",
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
    "title": "Chargrilled Vegetable Pizza - Sugo AUD16.90",
    "creator": "avlxyz",
    "license": "CC BY-SA 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
    "source": "https://www.flickr.com/photos/10559879@N00/4602835745",
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
    "title": "Profiteroles with chocolate and caramel sauce, February 2007",
    "creator": "Katy",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Profiteroles_with_chocolate_and_caramel_sauce,_February_2007.jpg",
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
    "title": "Caesar salad (2)",
    "creator": "Geoff Peters from Vancouver, BC, Canada",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Caesar_salad_(2).jpg",
    "files": [
      "/images/food/sezar-salata.webp"
    ]
  },
  {
    "title": "Simit (rectangular)",
    "creator": "E4024",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Simit_(rectangular).jpg",
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
    "title": "DFC 4623 Sweet and savory stir-fried chicken with colorful bell peppers onion…",
    "creator": "PattayaPatrol",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:DFC_4623_Sweet_and_savory_stir-fried_chicken_with_colorful_bell_peppers_onions_and_a_side_salad_-_a_perfect_Thai_comfort_meal_in_Pattaya.jpg",
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
    "title": "Chicken noodles with sauce",
    "creator": "AdhiRajamanickam",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Chicken_noodles_with_sauce.jpg",
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
