import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { findCourier } from "../db/store";
import { DomainError } from "../errors";
import type { Courier } from "../types";

/**
 * Kurye oturumu.
 *
 * Müşteri ve işletme oturumlarından tamamen ayrıdır: farklı çerez, farklı
 * `audience`. Üç rol aynı tarayıcıda birlikte açık kalabilir — demo
 * sırasında üç sekmeyi yan yana açıp akışı uçtan uca izlemek için gerekli.
 */

export const COURIER_COOKIE = "sofra_courier";
export const COURIER_MAX_AGE = 60 * 60 * 12; // 12 saat — vardiya süresi

const secret = new TextEncoder().encode(
  process.env.SOFRA_JWT_SECRET ?? "sofra-dev-secret-degistirilmeli-0123456789"
);

export async function signCourierSession(courierId: string): Promise<string> {
  return new SignJWT({ sub: courierId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("sofra")
    .setAudience("sofra-courier")
    .setExpirationTime(`${COURIER_MAX_AGE}s`)
    .sign(secret);
}

export async function verifyCourierSession(
  token: string
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: "sofra",
      audience: "sofra-courier",
    });
    return typeof payload.sub === "string" ? payload.sub : null;
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

export async function currentCourier(
  request?: Request
): Promise<Courier | null> {
  let token: string | null = null;

  if (request) token = bearerToken(request);
  if (!token) {
    const jar = await cookies();
    token = jar.get(COURIER_COOKIE)?.value ?? null;
  }
  if (!token) return null;

  const courierId = await verifyCourierSession(token);
  if (!courierId) return null;
  return findCourier(courierId) ?? null;
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

export const courierCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: COURIER_MAX_AGE,
  secure: process.env.NODE_ENV === "production",
};

/** Kurye hesabının istemciye dönen güvenli gösterimi (PIN hariç). */
export function publicCourier(courier: Courier) {
  const { pin: _pin, ...rest } = courier;
  return rest;
}

export async function respondWithCourierSession(
  courier: Courier,
  extra: Record<string, unknown> = {}
): Promise<NextResponse> {
  const accessToken = await signCourierSession(courier.id);
  const response = NextResponse.json({
    ok: true,
    data: { courier: publicCourier(courier), accessToken, ...extra },
  });
  response.cookies.set(COURIER_COOKIE, accessToken, courierCookieOptions);
  return response;
}

export function clearCourierSessionResponse(): NextResponse {
  const response = NextResponse.json({ ok: true, data: { loggedOut: true } });
  response.cookies.set(COURIER_COOKIE, "", {
    ...courierCookieOptions,
    maxAge: 0,
  });
  return response;
}
