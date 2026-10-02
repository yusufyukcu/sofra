import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../types";
import { findUserById } from "../db/store";

/**
 * Oturum yönetimi.
 *
 * Web istemcisi `httpOnly` çerez kullanır; mobil uygulama aynı token'ı
 * `Authorization: Bearer <token>` başlığıyla gönderir. API her iki kaynağı
 * da kabul ettiği için tek bir backend iki istemciye birden hizmet eder.
 */

export const SESSION_COOKIE = "sofra_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 gün

const secret = new TextEncoder().encode(
  process.env.SOFRA_JWT_SECRET ?? "sofra-dev-secret-degistirilmeli-0123456789"
);

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("sofra")
    .setAudience("sofra-customer")
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifySession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: "sofra",
      audience: "sofra-customer",
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

/** İstekten oturum sahibini çözer. Giriş yoksa `null`. */
export async function currentUser(request?: Request): Promise<User | null> {
  let token: string | null = null;

  if (request) token = bearerToken(request);
  if (!token) {
    const jar = await cookies();
    token = jar.get(SESSION_COOKIE)?.value ?? null;
  }
  if (!token) return null;

  const userId = await verifySession(token);
  if (!userId) return null;

  const user = findUserById(userId);
  // Kara listeye alınan hesabın oturumu geçersizdir
  if (!user || user.blocked) return null;
  return user;
}

/** Route handler'larda kısa devre için: kullanıcı yoksa hata fırlatır. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Bu işlem için giriş yapmalısın.");
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(request?: Request): Promise<User> {
  const user = await currentUser(request);
  if (!user) throw new UnauthorizedError();
  return user;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
  secure: process.env.NODE_ENV === "production",
};

/**
 * Başarılı girişte hem `httpOnly` çerezi kurar (web) hem de `accessToken`
 * döner (mobil). İki istemci de aynı uç noktayı kullanabilir.
 */
export async function respondWithSession(
  user: User,
  extra: Record<string, unknown> = {}
): Promise<NextResponse> {
  const accessToken = await signSession(user.id);
  const response = NextResponse.json({
    ok: true,
    data: { user, accessToken, ...extra },
  });
  response.cookies.set(SESSION_COOKIE, accessToken, sessionCookieOptions);
  return response;
}

export function clearSessionResponse(): NextResponse {
  const response = NextResponse.json({ ok: true, data: { loggedOut: true } });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
