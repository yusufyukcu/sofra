import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="text-6xl" aria-hidden>
        🍕
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
        className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand px-5 font-semibold text-brand-contrast transition-colors hover:bg-brand-hover"
      >
        Anasayfaya dön
      </Link>
    </div>
  );
}
