import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proje ana dizini kullanıcı klasörünün altında olduğu için Turbopack'in
  // kök dizini yanlış tahmin etmesini engelliyoruz.
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    // Yalnızca kendi fotoğraflarımız optimize edilir: tohum görselleri
    // (public/images) ve restoranların onaylanan yüklemeleri (/media)
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/media/**", search: "" },
    ],
  },
};

export default nextConfig;
