import "server-only";
import postgres from "postgres";

/**
 * Postgres bağlantısı (Supabase).
 *
 * Uygulama veritabanına yalnızca sunucudan, `postgres` rolüyle bağlanır;
 * yetki denetimi servis katmanındadır. Bağlantı Supavisor'ın işlem modlu
 * havuzundan geçer (`POSTGRES_URL`, 6543): her istek kısa bir işlem açar,
 * sunucusuz fonksiyonlar bağlantı sınırına takılmaz. İşlem modunda hazır
 * ifadeler (prepared statement) desteklenmediği için `prepare: false`.
 *
 * Kolon adları otomatik dönüşür: `delivery_fee` ↔ `deliveryFee`. JSON
 * kolonlarının içine dokunulmaz — sipariş anlık görüntüleri olduğu gibi
 * okunur ve yazılır.
 */

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;
/** Hem bağlantıyı hem işlemi kabul eden fonksiyonlar için */
export type Db = Sql | Tx;
/**
 * Kısmi güncellemelerde `sql(changes, keys)` yardımcısına verilen nesne.
 * Değerler sürücünün parametre tipleridir (metin, sayı, tarih, dizi, json).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Changes = Record<string, any>;

function create(): Sql {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.warn("[sofra/db] POSTGRES_URL tanımlı değil — `vercel env pull` çalıştır.");
  }
  return postgres(url ?? "", {
    ssl: "require",
    prepare: false,
    max: Number(process.env.SOFRA_DB_POOL_MAX ?? 5),
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
    transform: {
      column: { from: postgres.toCamel, to: postgres.fromCamel },
      undefined: null,
    },
    types: {
      // Para ve oranlar numeric: JS'de number olarak kullanılır (tutarlar küçük)
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (value: unknown) => String(value),
        parse: (value: string) => Number(value),
      },
      bigint: {
        to: 20,
        from: [20],
        serialize: (value: unknown) => String(value),
        parse: (value: string) => Number(value),
      },
    },
  }) as unknown as Sql;
}

const globalRef = globalThis as unknown as { __sofraSql?: Sql };

/** Tekil bağlantı havuzu (geliştirmede HMR yeniden yüklemelerinde korunur). */
export const sql: Sql = globalRef.__sofraSql ?? (globalRef.__sofraSql = create());

/**
 * JSON kolonuna yazılacak değer. Alan modeli arayüzleri (Address, CartLine…)
 * sürücünün `JSONValue` tipine yapısal olarak uyar ama indeks imzası
 * taşımadığı için TypeScript bunu kendisi çıkaramaz.
 */
export function asJson(value: unknown): postgres.JSONValue {
  return value as postgres.JSONValue;
}

/** Tarih kolonlarını API sözleşmesindeki ISO metnine çevirir. */
export function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** Zorunlu tarih alanları için. */
export function isoRequired(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** Kurye dağıtım turunu hemen çalıştırır (pg_cron'u beklemeden teklif üretir). */
export async function dispatchNow(db: Db = sql): Promise<void> {
  await db`select app_private.dispatch_tick()`;
}
