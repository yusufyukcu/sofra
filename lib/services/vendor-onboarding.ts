import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "../db/client";
import { DomainError } from "../errors";
import { isTestMode, sendMessage } from "../messaging";
import { supabaseAdmin } from "../supabase/admin";

/**
 * Onaylanan işletmenin panel hesabı.
 *
 * Başvuru onaylanınca işletmenin e-postasıyla bir Supabase Auth hesabı
 * açılır (rastgele geçici parolayla, kimse bilmez) ve tek kullanımlık,
 * 7 gün geçerli bir kurulum bağlantısı üretilir. İşletme bu bağlantıdan
 * kendi parolasını belirleyip panele girer. Bağlantının yalnızca özeti
 * saklanır; e-posta sağlayıcısı bağlı değilken (test modu) bağlantı
 * yönetici paneline gösterilir.
 */

const INVITE_TTL_DAYS = 7;
const MIN_PASSWORD = 8;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface VendorInvite {
  email: string;
  setupPath: string;
  expiresAt: string;
  /** E-posta gönderilmediyse (test modu) yönetici bağlantıyı işletmeye iletmeli */
  delivered: boolean;
}

export async function provisionVendorAccount(memberId: string): Promise<VendorInvite> {
  const [member] = await sql<{ id: string; restaurantId: string; name: string; email: string; authUserId: string | null }[]>`
    select id, restaurant_id, name, email, auth_user_id from public.vendor_members where id = ${memberId}
  `;
  if (!member) throw new DomainError("vendor_not_found", "İşletme hesabı bulunamadı.", 404);

  const admin = supabaseAdmin();
  const appMetadata = { role: "vendor", sid: member.id, rid: member.restaurantId };
  const tempPassword = randomBytes(24).toString("base64url");

  let authUserId = member.authUserId;
  if (!authUserId) {
    const [existing] = await sql<{ id: string }[]>`
      select id::text from auth.users where lower(email) = lower(${member.email})
    `;
    if (existing) {
      authUserId = existing.id;
      await admin.auth.admin.updateUserById(authUserId, { app_metadata: appMetadata });
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: member.email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: appMetadata,
        user_metadata: { name: member.name },
      });
      if (error || !data.user) throw new Error(`İşletme hesabı açılamadı: ${error?.message}`);
      authUserId = data.user.id;
    }
    await sql`update public.vendor_members set auth_user_id = ${authUserId} where id = ${member.id}`;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  await sql`
    insert into public.vendor_invites (token_hash, vendor_member_id, expires_at)
    values (${hashToken(token)}, ${member.id}, ${expiresAt})
  `;

  const setupPath = `/isletme-kurulum?anahtar=${token}`;
  const delivery = await sendMessage(
    "email",
    member.email,
    `Başvurun onaylandı. Panel parolanı belirlemek için: ${setupPath} (bağlantı ${INVITE_TTL_DAYS} gün geçerli)`,
    "Sofra işletme panelin hazır"
  );

  return {
    email: member.email,
    setupPath,
    expiresAt: expiresAt.toISOString(),
    delivered: delivery.delivered,
  };
}

interface InviteRow {
  tokenHash: string;
  vendorMemberId: string;
  expiresAt: Date;
  usedAt: Date | null;
  email: string;
  authUserId: string | null;
  restaurantName: string;
}

async function findInvite(token: string): Promise<InviteRow> {
  const [row] = await sql<InviteRow[]>`
    select i.token_hash, i.vendor_member_id, i.expires_at, i.used_at, m.email, m.auth_user_id,
           r.name as restaurant_name
      from public.vendor_invites i
      join public.vendor_members m on m.id = i.vendor_member_id
      join public.restaurants r on r.id = m.restaurant_id
     where i.token_hash = ${hashToken(token ?? "")}
  `;
  if (!row) throw new DomainError("invite_not_found", "Kurulum bağlantısı geçersiz.", 404);
  if (row.usedAt) throw new DomainError("invite_used", "Bu kurulum bağlantısı zaten kullanıldı. Panele e-posta ve parolanla gir.");
  if (row.expiresAt.getTime() < Date.now()) {
    throw new DomainError("invite_expired", "Kurulum bağlantısının süresi doldu. Platform ekibinden yeni bağlantı iste.");
  }
  return row;
}

export async function inviteInfo(token: string): Promise<{ email: string; restaurantName: string; expiresAt: string }> {
  const row = await findInvite(token);
  return { email: row.email, restaurantName: row.restaurantName, expiresAt: row.expiresAt.toISOString() };
}

/** Parolayı belirler ve bağlantıyı tüketir. Ardından normal girişle oturum açılır. */
export async function completeInvite(token: string, password: string): Promise<{ email: string }> {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    throw new DomainError("weak_password", `Parola en az ${MIN_PASSWORD} karakter olmalı.`);
  }
  const row = await findInvite(token);
  if (!row.authUserId) throw new DomainError("vendor_not_ready", "İşletme hesabı henüz hazır değil.");

  const { error } = await supabaseAdmin().auth.admin.updateUserById(row.authUserId, { password });
  if (error) throw new DomainError("password_rejected", `Parola kabul edilmedi: ${error.message}`);

  await sql`update public.vendor_invites set used_at = now() where token_hash = ${row.tokenHash}`;
  return { email: row.email };
}

/** Test modunda kurulum bağlantısı ekranda gösterilebilir mi. */
export function inviteLinksVisible(): boolean {
  return isTestMode("email");
}
