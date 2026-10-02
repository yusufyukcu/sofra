import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { findRestaurant, findVendorMember } from "../db/queries";
import { DomainError } from "../errors";
import type { Restaurant, VendorAccount } from "../types";

/**
 * Restoran paneli oturumu.
 *
 * Müşteri oturumundan tamamen ayrıdır: farklı çerez, farklı `audience`.
 * Böylece bir müşteri token'ı işletme uç noktalarında kullanılamaz ve
 * aynı tarayıcıda hem müşteri hem işletme oturumu açık kalabilir
 * (restoran sahibi kendi uygulamasından sipariş verebilsin diye).
 */

export const VENDOR_COOKIE = "sofra_vendor";
export const VENDOR_MAX_AGE = 60 * 60 * 12; // 12 saat — vardiya süresi

const secret = new TextEncoder().encode(
  process.env.SOFRA_JWT_SECRET ?? "sofra-dev-secret-degistirilmeli-0123456789"
);

export interface VendorSession {
  vendor: VendorAccount;
  restaurant: Restaurant;
}

export async function signVendorSession(
  vendorId: string,
  restaurantId: string
): Promise<string> {
  return new SignJWT({ sub: vendorId, rid: restaurantId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("sofra")
    .setAudience("sofra-vendor")
    .setExpirationTime(`${VENDOR_MAX_AGE}s`)
    .sign(secret);
}

export async function verifyVendorSession(
  token: string
): Promise<{ vendorId: string; restaurantId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: "sofra",
      audience: "sofra-vendor",
    });
    if (typeof payload.sub !== "string" || typeof payload.rid !== "string") {
      return null;
    }
    return { vendorId: payload.sub, restaurantId: payload.rid };
  } catch {
    return null;
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value.trim();
}

/** İstekten işletme oturumunu çözer. Giriş yoksa `null`. */
export async function currentVendor(
  request?: Request
): Promise<VendorSession | null> {
  let token: string | null = null;

  if (request) token = bearerToken(request);
  if (!token) {
    const jar = await cookies();
    token = jar.get(VENDOR_COOKIE)?.value ?? null;
  }
  if (!token) return null;

  const claims = await verifyVendorSession(token);
  if (!claims) return null;

  const vendor = await findVendorMember(claims.vendorId);
  const restaurant = await findRestaurant(claims.restaurantId);
  if (!vendor || !restaurant || vendor.restaurantId !== restaurant.id) {
    return null;
  }

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

export const vendorCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: VENDOR_MAX_AGE,
  secure: process.env.NODE_ENV === "production",
};

export async function respondWithVendorSession(
  vendor: VendorAccount,
  restaurant: Restaurant,
  extra: Record<string, unknown> = {}
): Promise<NextResponse> {
  const accessToken = await signVendorSession(vendor.id, restaurant.id);
  const response = NextResponse.json({
    ok: true,
    data: {
      vendor: { id: vendor.id, name: vendor.name, email: vendor.email },
      restaurant,
      accessToken,
      ...extra,
    },
  });
  response.cookies.set(VENDOR_COOKIE, accessToken, vendorCookieOptions);
  return response;
}

export function clearVendorSessionResponse(): NextResponse {
  const response = NextResponse.json({ ok: true, data: { loggedOut: true } });
  response.cookies.set(VENDOR_COOKIE, "", { ...vendorCookieOptions, maxAge: 0 });
  return response;
}
