import "server-only";
import { NextResponse } from "next/server";
import type { Session } from "@supabase/supabase-js";
import { findAdmin } from "../db/queries";
import { DomainError } from "../errors";
import type { AdminAccount } from "../types";
import { claimsFor, passwordSignIn, sessionPayload, signOutRole } from "./roles";

/**
 * Yönetici oturumu (Supabase Auth, e-posta + parola).
 *
 * Diğer üç rolden ayrı çerez ve JWT rolü. Süre bilinçli olarak kısa:
 * girişten 4 saat sonra yeniden giriş istenir.
 */

export async function currentAdmin(request?: Request): Promise<AdminAccount | null> {
  const claims = await claimsFor("admin", request);
  if (!claims) return null;
  return findAdmin(claims.sid);
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

export function publicAdmin(admin: AdminAccount) {
  return admin;
}

export async function adminPasswordLogin(
  email: string,
  password: string
): Promise<{ admin: AdminAccount; session: Session }> {
  const { session, claims } = await passwordSignIn("admin", email, password);
  const admin = await findAdmin(claims.sid);
  if (!admin) {
    await signOutRole("admin");
    throw new DomainError("admin_not_found", "Yönetici kaydı bulunamadı.", 404);
  }
  return { admin, session };
}

export function adminSessionResponse(admin: AdminAccount, session: Session): NextResponse {
  return NextResponse.json({
    ok: true,
    data: { admin: publicAdmin(admin), ...sessionPayload(session) },
  });
}

export async function clearAdminSessionResponse(): Promise<NextResponse> {
  await signOutRole("admin");
  return NextResponse.json({ ok: true, data: { loggedOut: true } });
}
