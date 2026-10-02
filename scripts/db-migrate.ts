/**
 * Migrasyon çalıştırıcı.
 *
 *   npm run db:migrate
 *
 * `supabase/migrations/*.sql` dosyalarını sırayla, her birini kendi
 * işleminde uygular. Uygulananlar Supabase CLI ile aynı tabloda
 * (`supabase_migrations.schema_migrations`) tutulur; ileride `supabase db
 * push` kullanılırsa aynı dosyaları tekrar çalıştırmaz.
 *
 * Çok ifadeli SQL için havuzsuz (oturum modlu) bağlantı kullanılır.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error("POSTGRES_URL_NON_POOLING tanımlı değil. `vercel env pull` çalıştırdın mı?");
  process.exit(1);
}

const dir = path.join(process.cwd(), "supabase", "migrations");
const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });

async function main() {
  await sql.unsafe(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `);

  const applied = new Set(
    (await sql<{ version: string }[]>`select version from supabase_migrations.schema_migrations`).map(
      (r) => r.version
    )
  );

  const files = readdirSync(dir)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .sort();

  let count = 0;
  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    if (applied.has(version)) continue;

    const body = readFileSync(path.join(dir, file), "utf8");
    process.stdout.write(`→ ${file} … `);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`
        insert into supabase_migrations.schema_migrations (version, statements, name)
        values (${version}, ${[body]}, ${rest.join("_")})
      `;
    });
    console.log("tamam");
    count += 1;
  }

  console.log(count ? `${count} migrasyon uygulandı.` : "Veritabanı güncel, uygulanacak migrasyon yok.");
}

main()
  .catch((err) => {
    console.error("\nMigrasyon başarısız:", err.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
