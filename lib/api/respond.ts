import { NextResponse } from "next/server";
import { UnauthorizedError } from "../auth/session";
import { DomainError } from "../errors";

/**
 * Tüm API cevapları aynı zarfı kullanır:
 *   { ok: true, data } | { ok: false, error: { code, message } }
 *
 * Mobil istemci de aynı sözleşmeyi tüketeceği için hata kodları
 * makine tarafından okunabilir, mesajlar ise kullanıcıya gösterilebilir
 * Türkçe metinlerdir.
 */

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  code: string,
  message: string,
  status = 400,
  init?: ResponseInit
) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { ...init, status }
  );
}

/** Route handler gövdesini sarar; beklenmeyen hataları 500'e çevirir. */
export async function handle(
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return fail("unauthorized", err.message, 401);
    }
    if (err instanceof DomainError) {
      return fail(err.code, err.message, err.status);
    }

    // Veritabanı kısıtları son savunma hattıdır: aynı anda gelen iki istek
    // servis kontrolünü birlikte geçerse biri burada durur.
    const pgCode = (err as { code?: unknown })?.code;
    if (pgCode === "23505") {
      return fail("conflict", "Bu kayıt zaten var ya da az önce değişti. Sayfayı yenileyip tekrar dene.", 409);
    }
    if (pgCode === "23514") {
      return fail("constraint_violation", "İşlem bir kuralı ihlal ettiği için yapılamadı.", 409);
    }

    console.error("[sofra/api]", err);
    // Canlıda iç hata ayrıntısı (SQL vb.) istemciye gönderilmez
    const message =
      process.env.NODE_ENV !== "production" && err instanceof Error
        ? err.message
        : "Beklenmeyen bir hata oluştu. Lütfen tekrar dene.";
    return fail("internal_error", message, 500);
  }
}

/** Gövdeyi güvenle JSON olarak okur. */
export async function readJson<T = Record<string, unknown>>(
  request: Request
): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}
