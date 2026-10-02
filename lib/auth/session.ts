import "server-only";
import { NextResponse } from "next/server";
import type { User } from "../types";
import { findProfileRow, findUser } from "../db/queries";
import { claimsFor, ensureAuthUser, mintSession, sessionPayload, signOutRole } from "./roles";

/**
 * Müşteri oturumu (Supabase Auth).
 *
 * Web istemcisi `httpOnly` çerez kullanır; mobil uygulama aynı erişim
 * token'ını `Authorization: Bearer` başlığıyla gönderir. Kara listedeki
 * hesabın oturumu her istekte geçersiz sayılır.
 */

/** İstekten oturum sahibini çözer. Giriş yoksa `null`. */
export async function currentUser(request?: Request): Promise<User | null> {
  const claims = await claimsFor("customer", request);
  if (!claims) return null;
  const user = await findUser(claims.sid);
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

/**
 * Doğrulanmış müşteri için Supabase oturumu açar: web için çerez yazılır,
 * mobil için erişim ve yenileme token'ları cevapta döner.
 */
export async function respondWithSession(
  user: User,
  extra: Record<string, unknown> = {}
): Promise<NextResponse> {
  const profile = await findProfileRow(user.id);
  const auth = await ensureAuthUser("customer", user.id, user.name, profile?.authUserId ?? null);
  const session = await mintSession("customer", auth.email);
  return NextResponse.json({
    ok: true,
    data: { user, ...sessionPayload(session), ...extra },
  });
}

export async function clearSessionResponse(): Promise<NextResponse> {
  await signOutRole("customer");
  return NextResponse.json({ ok: true, data: { loggedOut: true } });
}
