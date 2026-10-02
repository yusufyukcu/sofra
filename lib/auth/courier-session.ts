import "server-only";
import { NextResponse } from "next/server";
import { findCourier, findCourierRow } from "../db/queries";
import { DomainError } from "../errors";
import type { Courier } from "../types";
import { claimsFor, ensureAuthUser, mintSession, sessionPayload, signOutRole } from "./roles";

/**
 * Kurye oturumu (Supabase Auth, telefon + doğrulama kodu).
 *
 * Müşteri ve işletme oturumlarından ayrıdır: farklı çerez ve JWT'de farklı
 * rol. Oturum en fazla 12 saat (vardiya).
 */

export async function currentCourier(request?: Request): Promise<Courier | null> {
  const claims = await claimsFor("courier", request);
  if (!claims) return null;
  return findCourier(claims.sid);
}

export async function requireCourier(request?: Request): Promise<Courier> {
  const courier = await currentCourier(request);
  if (!courier) {
    throw new DomainError(
      "courier_unauthorized",
      "Bu işlem için kurye hesabıyla giriş yapmalısın.",
      401
    );
  }
  return courier;
}

/** Kurye hesabının istemciye dönen gösterimi. */
export function publicCourier(courier: Courier) {
  return courier;
}

/** Telefonu doğrulanmış kurye için oturum açar. */
export async function respondWithCourierSession(
  courier: Courier,
  extra: Record<string, unknown> = {}
): Promise<NextResponse> {
  const row = await findCourierRow(courier.id);
  const auth = await ensureAuthUser("courier", courier.id, courier.name, row?.authUserId ?? null);
  const session = await mintSession("courier", auth.email);
  return NextResponse.json({
    ok: true,
    data: { courier: publicCourier(courier), ...sessionPayload(session), ...extra },
  });
}

export async function clearCourierSessionResponse(): Promise<NextResponse> {
  await signOutRole("courier");
  return NextResponse.json({ ok: true, data: { loggedOut: true } });
}
