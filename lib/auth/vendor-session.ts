import "server-only";
import { NextResponse } from "next/server";
import type { Session } from "@supabase/supabase-js";
import { findRestaurant, findVendorMember } from "../db/queries";
import { DomainError } from "../errors";
import type { Restaurant, VendorAccount } from "../types";
import { claimsFor, passwordSignIn, sessionPayload, signOutRole } from "./roles";

/**
 * Restoran paneli oturumu (Supabase Auth, e-posta + parola).
 *
 * Müşteri oturumundan tamamen ayrıdır: farklı çerez ve JWT'de farklı rol.
 * Her işletme fonksiyonu oturumdaki restoranla sınırlanır; gövdeden gelen
 * bir restoran kimliğine güvenilmez. Oturum en fazla 12 saat (vardiya).
 */

export interface VendorSession {
  vendor: VendorAccount;
  restaurant: Restaurant;
}

/** İstekten işletme oturumunu çözer. Giriş yoksa `null`. */
export async function currentVendor(request?: Request): Promise<VendorSession | null> {
  const claims = await claimsFor("vendor", request);
  if (!claims) return null;

  const vendor = await findVendorMember(claims.sid);
  if (!vendor || (claims.rid && claims.rid !== vendor.restaurantId)) return null;
  const restaurant = await findRestaurant(vendor.restaurantId);
  if (!restaurant) return null;
  return { vendor, restaurant };
}

export async function requireVendor(request?: Request): Promise<VendorSession> {
  const session = await currentVendor(request);
  if (!session) {
    throw new DomainError(
      "vendor_unauthorized",
      "Bu işlem için işletme hesabıyla giriş yapmalısın.",
      401
    );
  }
  return session;
}

/** E-posta + parolayla işletme girişi. */
export async function vendorPasswordLogin(
  email: string,
  password: string
): Promise<VendorSession & { session: Session }> {
  const { session, claims } = await passwordSignIn("vendor", email, password);
  const vendor = await findVendorMember(claims.sid);
  const restaurant = vendor ? await findRestaurant(vendor.restaurantId) : null;
  if (!vendor || !restaurant) {
    await signOutRole("vendor");
    throw new DomainError("vendor_not_found", "Bu hesaba bağlı bir restoran bulunamadı.", 404);
  }
  return { vendor, restaurant, session };
}

export function vendorSessionResponse(
  vendor: VendorAccount,
  restaurant: Restaurant,
  session: Session,
  extra: Record<string, unknown> = {}
): NextResponse {
  return NextResponse.json({
    ok: true,
    data: {
      vendor: { id: vendor.id, name: vendor.name, email: vendor.email },
      restaurant,
      ...sessionPayload(session),
      ...extra,
    },
  });
}

export async function clearVendorSessionResponse(): Promise<NextResponse> {
  await signOutRole("vendor");
  return NextResponse.json({ ok: true, data: { loggedOut: true } });
}
