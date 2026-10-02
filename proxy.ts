import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  roleCookieOptions,
  supabasePublishableKey,
  supabaseUrl,
  toAuthClaims,
  withinMaxAge,
  type Role,
} from "@/lib/supabase/config";

/**
 * Ağ sınırı (Next.js 16 `proxy`, eski adıyla middleware).
 *
 * Korumalı sayfalara gelen istekte rolün Supabase oturumunu doğrular;
 * süresi dolan erişim token'ını yenileyip çereze yazar. Oturum yoksa ya
 * da rolün süre sınırı aşıldıysa (yönetici 4 saat, işletme/kurye 12 saat)
 * ilgili giriş ekranına yönlendirir. Dört rolün oturumu ayrı çerezlerde
 * durur ve aynı tarayıcıda birlikte açık kalabilir.
 *
 * Bu yalnızca iyimser bir ön kontroldür: her API ucu yetkiyi ayrıca denetler.
 */

interface Area {
  prefix: string;
  role: Role;
  login: string;
  /** Girişten sonra geri dönülecek adres giriş ekranına taşınsın mı */
  keepNext?: boolean;
}

const AREAS: Area[] = [
  { prefix: "/isletme", role: "vendor", login: "/isletme/giris" },
  { prefix: "/kurye", role: "courier", login: "/kurye/giris" },
  { prefix: "/yonetim", role: "admin", login: "/yonetim/giris" },
  { prefix: "/hesabim", role: "customer", login: "/giris", keepNext: true },
  { prefix: "/odeme", role: "customer", login: "/giris", keepNext: true },
];

function areaFor(pathname: string): Area | undefined {
  return AREAS.find((a) => pathname === a.prefix || pathname.startsWith(`${a.prefix}/`));
}

/**
 * Mobil uygulamanın web derlemesi farklı bir porttan (Expo: 8081) servis
 * edildiği için API'ye tarayıcıdan çapraz köken istek atar. Native derlemede
 * CORS yoktur — bu başlıklar yalnızca geliştirmede açılır.
 */
const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?$/;

function corsHeaders(origin: string | null): Record<string, string> | null {
  if (process.env.NODE_ENV === "production") return null;
  if (!origin || !DEV_ORIGIN.test(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-allow-credentials": "true",
    "access-control-max-age": "86400",
  };
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  /* API: çapraz köken istemciler (mobil uygulamanın web derlemesi) */
  if (pathname.startsWith("/api/")) {
    const headers = corsHeaders(request.headers.get("origin"));
    if (!headers) return NextResponse.next();
    if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers });
    const response = NextResponse.next();
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  }

  const area = areaFor(pathname);
  if (!area || pathname === area.login) return NextResponse.next();

  /* Rolün oturumunu doğrula; yenilenen token çerezlere yazılır */
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookieOptions: roleCookieOptions(area.role),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  let valid = false;
  try {
    const { data } = await supabase.auth.getClaims();
    const claims = toAuthClaims(data?.claims);
    valid = Boolean(claims && claims.role === area.role && withinMaxAge(claims));
  } catch {
    valid = false;
  }
  if (valid) return response;

  const url = request.nextUrl.clone();
  url.pathname = area.login;
  url.search = area.keepNext ? `?devam=${encodeURIComponent(pathname + search)}` : "";
  const redirect = NextResponse.redirect(url);
  // Oturum yenileme ya da temizleme çerezleri yönlendirmede de taşınsın
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
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
