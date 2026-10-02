import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { findAdminById } from "../db/store";
import { DomainError } from "../errors";
import type { AdminAccount } from "../types";

/**
 * Yönetici oturumu (Superadmin).
 *
 * Dördüncü ve son oturum türü. Diğer üçünden ayrı çerez ve `audience`
 * kullanır; müşteri, işletme veya kurye token'ı yönetim uç noktalarında
 * geçersizdir. Süre bilinçli olarak kısa tutuldu.
 */

export const ADMIN_COOKIE = "sofra_admin";
export const ADMIN_MAX_AGE = 60 * 60 * 4; // 4 saat

const secret = new TextEncoder().encode(
  process.env.SOFRA_JWT_SECRET ?? "sofra-dev-secret-degistirilmeli-0123456789"
);

export async function signAdminSession(adminId: string): Promise<string> {
  return new SignJWT({ sub: adminId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("sofra")
    .setAudience("sofra-admin")
    .setExpirationTime(`${ADMIN_MAX_AGE}s`)
    .sign(secret);
}

export async function verifyAdminSession(
  token: string
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: "sofra",
      audience: "sofra-admin",
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

export async function currentAdmin(
  request?: Request
): Promise<AdminAccount | null> {
  let token: string | null = null;

  if (request) token = bearerToken(request);
  if (!token) {
    const jar = await cookies();
    token = jar.get(ADMIN_COOKIE)?.value ?? null;
  }
  if (!token) return null;

  const adminId = await verifyAdminSession(token);
  if (!adminId) return null;
  return findAdminById(adminId) ?? null;
}

export async function requireAdmin(request?: Request): Promise<AdminAccount> {
  const admin = await currentAdmin(request);
  if (!admin) {
    throw new DomainError(
      "admin_unauthorized",
      "Bu işlem için yönetici hesabıyla giriş yapmalısın.",
      401
    );
  }
  return admin;
}

export const adminCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: ADMIN_MAX_AGE,
  secure: process.env.NODE_ENV === "production",
};

export function publicAdmin(admin: AdminAccount) {
  const { pin: _pin, ...rest } = admin;
  return rest;
}

export async function respondWithAdminSession(
  admin: AdminAccount,
  extra: Record<string, unknown> = {}
): Promise<NextResponse> {
  const accessToken = await signAdminSession(admin.id);
  const response = NextResponse.json({
    ok: true,
    data: { admin: publicAdmin(admin), accessToken, ...extra },
  });
  response.cookies.set(ADMIN_COOKIE, accessToken, adminCookieOptions);
  return response;
}

export function clearAdminSessionResponse(): NextResponse {
  const response = NextResponse.json({ ok: true, data: { loggedOut: true } });
  response.cookies.set(ADMIN_COOKIE, "", { ...adminCookieOptions, maxAge: 0 });
  return response;
}
