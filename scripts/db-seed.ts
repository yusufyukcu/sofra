/**
 * Tohum verisi.
 *
 *   npm run db:seed            boş veritabanını doldurur
 *   npm run db:seed -- --reset tüm uygulama tablolarını boşaltıp yeniden doldurur
 *
 * Katalog (restoranlar, menüler, kuponlar, afişler, kuryeler) ve demo
 * hesapları yazar. İşletme ve yönetici hesapları Supabase Auth'ta e-posta +
 * parola ile açılır. Parola README'de durmaz: `SOFRA_DEMO_PASSWORD` yoksa
 * rastgele üretilir ve yalnızca yerel `.env.development.local` dosyasına
 * yazılır. Müşteri ve kurye Auth kullanıcıları ilk girişte oluşur.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import {
  COUPONS,
  COURIERS,
  DEMO_ADDRESS,
  DEMO_CARDS,
  DEMO_USER,
  RESTAURANTS,
} from "../lib/db/seed";
import { BANNERS } from "../packages/core/src/constants";

const RESET = process.argv.includes("--reset");

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} tanımlı değil. \`vercel env pull\` çalıştırdın mı?`);
    process.exit(1);
  }
  return value;
}

const sql = postgres(env("POSTGRES_URL_NON_POOLING"), {
  ssl: "require",
  max: 1,
  onnotice: () => {},
});

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ------------------------------------------------------------------ */
/* Demo parolası                                                       */
/* ------------------------------------------------------------------ */

function demoPassword(): string {
  const existing = process.env.SOFRA_DEMO_PASSWORD;
  if (existing) return existing;

  const password = `Sofra-${randomBytes(9).toString("base64url")}`;
  const file = path.join(process.cwd(), ".env.development.local");
  const prefix = existsSync(file) && !readFileSync(file, "utf8").endsWith("\n") ? "\n" : "";
  appendFileSync(
    file,
    `${prefix}\n# İşletme ve yönetici demo hesaplarının parolası (db:seed üretti)\nSOFRA_DEMO_PASSWORD=${password}\n`
  );
  console.log("Demo parolası üretildi ve .env.development.local dosyasına yazıldı.");
  return password;
}

/* ------------------------------------------------------------------ */
/* Supabase Auth hesapları                                             */
/* ------------------------------------------------------------------ */

async function upsertAuthUser(input: {
  email: string;
  password: string;
  name: string;
  appMetadata: Record<string, string>;
}): Promise<string> {
  const [existing] = await sql<{ id: string }[]>`
    select id from auth.users where lower(email) = lower(${input.email})
  `;

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: input.password,
      app_metadata: input.appMetadata,
      user_metadata: { name: input.name },
      email_confirm: true,
    });
    if (error) throw new Error(`${input.email}: ${error.message}`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: input.appMetadata,
    user_metadata: { name: input.name },
  });
  if (error || !data.user) throw new Error(`${input.email}: ${error?.message}`);
  return data.user.id;
}

/* ------------------------------------------------------------------ */
/* Tohum yorumları                                                     */
/* ------------------------------------------------------------------ */

function seededReviews() {
  const templates: [number, string][] = [
    [5, "Sıcacık geldi, porsiyonlar bol. Kesinlikle tekrar sipariş vereceğim."],
    [5, "Tam zamanında teslim edildi, paketleme çok özenliydi."],
    [4, "Lezzet güzeldi ama biraz geç geldi. Yine de memnunum."],
    [5, "Fiyat performans olarak bölgedeki en iyi seçenek."],
    [4, "Sos ekstra istemiştim, unutulmamış. Teşekkürler."],
    [3, "Ürünler iyiydi fakat içecek eksik gelmişti, destek hızlı çözdü."],
    [5, "Ailecek çok beğendik, porsiyonlar cömert."],
    [4, "Kurye çok nazikti, temassız teslimat talebime uydu."],
  ];
  const names = [
    "Ayşe K.", "Mehmet D.", "Zeynep A.", "Can B.", "Elif T.",
    "Ozan Y.", "Selin M.", "Emre Ş.", "Büşra N.", "Kerem O.",
  ];
  const rows: {
    id: string;
    restaurantId: string;
    userName: string;
    score: number;
    comment: string;
    at: Date;
    reply: string | null;
    repliedAt: Date | null;
  }[] = [];

  RESTAURANTS.forEach((restaurant, ri) => {
    const count = 4 + (ri % 3);
    for (let i = 0; i < count; i++) {
      const [score, comment] = templates[(ri * 3 + i) % templates.length];
      const at = new Date(Date.now() - (i + 1) * 86_400_000 * (1 + (ri % 4)));
      rows.push({
        id: `rev_${restaurant.id}_${i}`,
        restaurantId: restaurant.id,
        userName: names[(ri * 2 + i) % names.length],
        score,
        comment,
        at,
        reply: i === 0 ? "Değerlendirmeniz için teşekkür ederiz, yine bekleriz! 🧡" : null,
        repliedAt: i === 0 ? new Date(at.getTime() + 3_600_000) : null,
      });
    }
  });
  return rows;
}

/* ------------------------------------------------------------------ */

async function main() {
  const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from public.restaurants`;
  if (count > 0 && !RESET) {
    console.log(
      `Veritabanında zaten ${count} restoran var. Sıfırlayıp yeniden doldurmak için: npm run db:seed -- --reset`
    );
    return;
  }

  // Ürün kimlikleri artık tek tabloda: çakışma varsa yazmadan dur
  const productIds = RESTAURANTS.flatMap((r) => r.menu.flatMap((c) => c.products.map((p) => p.id)));
  const duplicates = productIds.filter((id, i) => productIds.indexOf(id) !== i);
  if (duplicates.length) {
    throw new Error(`Tohumda yinelenen ürün kimlikleri: ${[...new Set(duplicates)].join(", ")}`);
  }

  const password = demoPassword();
  const simSpeed = Number(process.env.SOFRA_SIM_SPEED ?? 12) || 12;

  await sql.begin(async (tx) => {
    if (RESET) {
      const tables = await tx<{ tablename: string }[]>`
        select tablename from pg_tables where schemaname = 'public'
      `;
      await tx.unsafe(
        `truncate ${tables.map((t) => `public."${t.tablename}"`).join(", ")} restart identity cascade`
      );
      console.log("Tablolar boşaltıldı.");
    }

    /* Ayarlar */
    // Değerler JSON olarak yazılır (sim_speed sayı, metin değil)
    await tx`
      insert into public.app_settings (key, value) values
        ('demo_mode', ${tx.json(true)}),
        ('sim_speed', ${tx.json(simSpeed)})
    `;

    /* Restoranlar, kategoriler, ürünler */
    const featured = new Map([
      ["rst_kasap", 1],
      ["rst_sekerli", 2],
      ["rst_ustam", 3],
    ]);

    for (const r of RESTAURANTS) {
      await tx`
        insert into public.restaurants (
          id, slug, name, emoji, cover_seed, image, tags, description,
          rating, rating_sum, rating_count, eta_min, eta_max, min_basket, delivery_fee,
          free_delivery_over, lat, lng, district, delivery_radius_km, working_hours,
          break_hours, commission_rate, approval_status, joined_at, temporarily_closed,
          auto_accept, courier_mode, payment_methods, badges, featured_rank
        ) values (
          ${r.id}, ${r.slug}, ${r.name}, ${r.emoji}, ${r.coverSeed}, ${r.image ?? null},
          ${r.tags}, ${r.description}, ${r.rating}, ${Math.round(r.rating * r.ratingCount * 10) / 10},
          ${r.ratingCount}, ${r.etaMin}, ${r.etaMax}, ${r.minBasket}, ${r.deliveryFee},
          ${r.freeDeliveryOver}, ${r.location.lat}, ${r.location.lng}, ${r.district},
          ${r.deliveryRadiusKm}, ${tx.json(r.workingHours)},
          ${r.breakHours ? tx.json(r.breakHours) : null}, ${r.commissionRate}, ${r.approvalStatus},
          ${r.joinedAt}, ${r.temporarilyClosed}, ${r.autoAccept}, ${r.courierMode},
          ${r.paymentMethods}, ${r.badges}, ${featured.get(r.id) ?? null}
        )
      `;

      for (const [ci, category] of r.menu.entries()) {
        await tx`
          insert into public.menu_categories (id, restaurant_id, name, description, position)
          values (${category.id}, ${r.id}, ${category.name}, ${category.description ?? null}, ${ci})
        `;
        for (const [pi, p] of category.products.entries()) {
          await tx`
            insert into public.products (
              id, restaurant_id, category_id, name, description, emoji, image, price,
              old_price, sold_out, popular, option_groups, position
            ) values (
              ${p.id}, ${r.id}, ${category.id}, ${p.name}, ${p.description}, ${p.emoji},
              ${p.image ?? null}, ${p.price}, ${p.oldPrice ?? null}, ${Boolean(p.soldOut)},
              ${Boolean(p.popular)}, ${tx.json(p.optionGroups as unknown as postgres.JSONValue)}, ${pi}
            )
          `;
        }
      }
    }

    /* Kuryeler */
    for (const c of COURIERS) {
      await tx`
        insert into public.couriers (
          id, name, emoji, vehicle, phone, masked_phone, rating, rating_sum, rating_count,
          total_deliveries, online, lat, lng, home_lat, home_lng, status, created_at
        ) values (
          ${c.id}, ${c.name}, ${c.emoji}, ${c.vehicle}, ${c.phone}, ${c.maskedPhone}, ${c.rating},
          ${c.ratingSum}, ${c.ratingCount}, ${c.totalDeliveries}, false, ${c.point.lat},
          ${c.point.lng}, ${c.homePoint.lat}, ${c.homePoint.lng}, ${c.status}, ${c.createdAt}
        )
      `;
    }

    /* Kuponlar ve afişler */
    for (const c of COUPONS) {
      await tx`
        insert into public.coupons (
          code, type, value, title, description, min_subtotal, max_discount,
          restaurant_ids, first_order_only, expires_at, active, created_at
        ) values (
          ${c.code}, ${c.type}, ${c.value}, ${c.title}, ${c.description}, ${c.minSubtotal},
          ${c.maxDiscount ?? null}, ${c.restaurantIds}, ${Boolean(c.firstOrderOnly)},
          ${c.expiresAt}, ${c.active}, ${c.createdAt}
        )
      `;
    }
    for (const [i, b] of BANNERS.entries()) {
      await tx`
        insert into public.banners (id, title, subtitle, code, emoji, image, gradient, href, active, position)
        values (${b.id}, ${b.title}, ${b.subtitle}, ${b.code ?? null}, ${b.emoji}, ${b.image ?? null},
                ${b.gradient}, ${b.href}, ${b.active}, ${i})
      `;
    }

    /* Yorumlar */
    for (const review of seededReviews()) {
      await tx`
        insert into public.reviews (id, restaurant_id, user_name, score, comment, at, reply, replied_at)
        values (${review.id}, ${review.restaurantId}, ${review.userName}, ${review.score},
                ${review.comment}, ${review.at}, ${review.reply}, ${review.repliedAt})
      `;
    }

    /* Demo müşteri */
    await tx`
      insert into public.profiles (id, name, phone, email, avatar_emoji, providers, wallet_balance)
      values (${DEMO_USER.id}, ${DEMO_USER.name}, ${DEMO_USER.phone}, ${DEMO_USER.email},
              ${DEMO_USER.avatarEmoji}, ${["phone", "email"]}, ${DEMO_USER.walletBalance})
    `;
    await tx`
      insert into public.wallet_transactions (user_id, amount, balance_after, type, label)
      values (${DEMO_USER.id}, ${DEMO_USER.walletBalance}, ${DEMO_USER.walletBalance},
              'admin_credit', 'Açılış bakiyesi (demo hesap)')
    `;
    await tx`
      insert into public.addresses (
        id, user_id, label, title, line1, district, city, directions, building_no, floor,
        apartment_no, contact_name, contact_phone, lat, lng, is_default
      ) values (
        ${DEMO_ADDRESS.id}, ${DEMO_USER.id}, ${DEMO_ADDRESS.label}, ${DEMO_ADDRESS.title},
        ${DEMO_ADDRESS.line1}, ${DEMO_ADDRESS.district}, ${DEMO_ADDRESS.city},
        ${DEMO_ADDRESS.directions}, ${DEMO_ADDRESS.buildingNo}, ${DEMO_ADDRESS.floor},
        ${DEMO_ADDRESS.apartmentNo}, ${DEMO_USER.name}, ${DEMO_USER.phone},
        ${DEMO_ADDRESS.point.lat}, ${DEMO_ADDRESS.point.lng}, true
      )
    `;
    await tx`update public.profiles set default_address_id = ${DEMO_ADDRESS.id} where id = ${DEMO_USER.id}`;
    for (const restaurantId of ["rst_kasap", "rst_sekerli"]) {
      await tx`insert into public.favorites (user_id, restaurant_id) values (${DEMO_USER.id}, ${restaurantId})`;
    }
    for (const card of DEMO_CARDS) {
      await tx`
        insert into public.saved_cards (id, user_id, brand, last4, holder, expiry, nickname)
        values (${card.id}, ${DEMO_USER.id}, ${card.brand}, ${card.last4}, ${card.holder},
                ${card.expiry}, ${card.nickname})
      `;
    }

    /* İşletme hesapları ve yönetici (Auth bağlantısı aşağıda) */
    for (const [index, r] of RESTAURANTS.entries()) {
      await tx`
        insert into public.vendor_members (id, restaurant_id, name, email, role)
        values (${`vnd_${index + 1}`}, ${r.id}, ${`${r.name} — İşletme`}, ${`${r.slug}@sofra.app`}, 'owner')
      `;
    }
    await tx`
      insert into public.admins (id, name, email, created_at)
      values ('adm_1', 'Platform Yöneticisi', 'yonetim@sofra.app', '2023-01-01T09:00:00Z')
    `;
  });
  console.log(
    `Katalog yazıldı: ${RESTAURANTS.length} restoran, ${productIds.length} ürün, ` +
      `${COURIERS.length} kurye, ${COUPONS.length} kupon, ${BANNERS.length} afiş.`
  );

  /* Supabase Auth: işletme ve yönetici hesapları (e-posta + parola) */
  const vendors = await sql<{ id: string; restaurantId: string; name: string; email: string }[]>`
    select id, restaurant_id as "restaurantId", name, email from public.vendor_members order by id
  `;
  for (const vendor of vendors) {
    const authUserId = await upsertAuthUser({
      email: vendor.email,
      password,
      name: vendor.name,
      appMetadata: { role: "vendor", sid: vendor.id, rid: vendor.restaurantId },
    });
    await sql`update public.vendor_members set auth_user_id = ${authUserId} where id = ${vendor.id}`;
  }

  const adminAuthId = await upsertAuthUser({
    email: "yonetim@sofra.app",
    password,
    name: "Platform Yöneticisi",
    appMetadata: { role: "admin", sid: "adm_1" },
  });
  await sql`update public.admins set auth_user_id = ${adminAuthId} where id = 'adm_1'`;

  console.log(`Auth hesapları hazır: ${vendors.length} işletme + 1 yönetici.`);
  console.log("Giriş e-postaları: <restoran-slug>@sofra.app ve yonetim@sofra.app");
}

main()
  .catch((err) => {
    console.error("\nTohumlama başarısız:", err.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
