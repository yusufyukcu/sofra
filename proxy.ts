import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import {
  VENDOR_COOKIE,
  verifyVendorSession,
} from "@/lib/auth/vendor-session";
import {
  COURIER_COOKIE,
  verifyCourierSession,
} from "@/lib/auth/courier-session";
import {
  ADMIN_COOKIE,
  verifyAdminSession,
} from "@/lib/auth/admin-session";

/**
 * Ağ sınırında oturum kontrolü (Next.js 16 `proxy` sözleşmesi — eski adıyla
 * middleware). Korumalı sayfalara giriş yapmadan gelen istekleri, dönüş
 * adresini koruyarak ilgili giriş ekranına yönlendirir. Böylece istemci
 * tarafındaki yönlendirmeden önce ekranda boş içerik görünmez.
 *
 * Dört rol, dört ayrı çerez: müşteri, işletme, kurye ve yönetici. Biri
 * diğerinin yerine geçemez ve dördü aynı tarayıcıda birlikte açık kalabilir.
 */

const CUSTOMER_PATHS = ["/hesabim", "/odeme"];

/**
 * Mobil uygulamanın web derlemesi farklı bir porttan (Expo: 8081) servis
 * edildiği için API'ye tarayıcıdan çapraz köken istek atar. Native derlemede
 * CORS diye bir şey yok — bu başlıklar yalnızca web önizlemesi içindir ve
 * üretimde kapalıdır; orada izin verilen kökenler açıkça listelenir.
 */
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?$/;

function corsHeaders(origin: string | null): Record<string, string> | null {
  if (process.env.NODE_ENV === "production") return null;
  if (!origin || !DEV_ORIGIN.test(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    // Mobil Bearer kullanıyor; yine de webden çerezli çağrı yapılabilsin.
    "access-control-allow-credentials": "true",
    "access-control-max-age": "86400",
  };
}
const VENDOR_LOGIN = "/isletme/giris";
const COURIER_LOGIN = "/kurye/giris";
const ADMIN_LOGIN = "/yonetim/giris";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* API: çapraz köken istemciler (mobil uygulamanın web derlemesi) */
  if (pathname.startsWith("/api/")) {
    const headers = corsHeaders(request.headers.get("origin"));
    if (!headers) return NextResponse.next();

    // Ön uçuş isteği rota işleyicisine hiç ulaşmasın.
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers });
    }

    const response = NextResponse.next();
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
    return response;
  }

  /* Restoran paneli */
  if (pathname.startsWith("/isletme") && pathname !== VENDOR_LOGIN) {
    const token = request.cookies.get(VENDOR_COOKIE)?.value;
    const claims = token ? await verifyVendorSession(token) : null;
    if (claims) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = VENDOR_LOGIN;
    url.search = "";
    return NextResponse.redirect(url);
  }

  /* Kurye uygulaması */
  if (pathname.startsWith("/kurye") && pathname !== COURIER_LOGIN) {
    const token = request.cookies.get(COURIER_COOKIE)?.value;
    const courierId = token ? await verifyCourierSession(token) : null;
    if (courierId) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = COURIER_LOGIN;
    url.search = "";
    return NextResponse.redirect(url);
  }

  /* Yönetici paneli */
  if (pathname.startsWith("/yonetim") && pathname !== ADMIN_LOGIN) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    const adminId = token ? await verifyAdminSession(token) : null;
    if (adminId) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = ADMIN_LOGIN;
    url.search = "";
    return NextResponse.redirect(url);
  }

  /* Müşteri uygulaması */
  if (CUSTOMER_PATHS.some((path) => pathname.startsWith(path))) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const userId = token ? await verifySession(token) : null;
    if (userId) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = "/giris";
    url.search = `?devam=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/hesabim/:path*",
    "/odeme",
    "/isletme/:path*",
    "/kurye/:path*",
    "/yonetim/:path*",
  ],
};
