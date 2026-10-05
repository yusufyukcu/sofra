import { SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden>
        <SearchX className="size-9" strokeWidth={1.8} />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
        Aradığın sayfa mutfakta kalmış
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Bağlantı bozulmuş ya da sayfa kaldırılmış olabilir. Anasayfadan tekrar
        keşfetmeye başlayabilirsin.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center rounded-full bg-brand px-6 font-semibold text-brand-contrast shadow-brand transition-colors hover:bg-brand-hover"
      >
        Anasayfaya dön
      </Link>
    </div>
  );
}
