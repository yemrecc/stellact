import type { Metadata } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, IBM_Plex_Mono, Inconsolata, Inter } from "next/font/google";
import "@stellar/design-system/build/styles.min.css";
import "./globals.css";
import { NetBadge } from "@/components/ui";

/* Kendi sunucumuzdan servis edilir (dış istek yok, layout shift yok).
   latin-ext Türkçe için şart: ğ ş ı İ ç ö ü. */
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });
const inconsolata = Inconsolata({ subsets: ["latin", "latin-ext"], weight: ["500"], variable: "--font-inconsolata", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], variable: "--font-bricolage", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin", "latin-ext"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "STELLACT",
  description: "Your actions become your identity. Proof of Real Use on Stellar.",
};

/* SDS'in renk token'ları (--sds-clr-*) YALNIZCA .sds-theme-light / .sds-theme-dark altında tanımlı;
   :root'ta hiç yok. Sınıf konmazsa her var(--sds-clr-*) tanımsız kalır ve bileşenler çıplak render edilir.
   Bu script boyamadan önce çalışır (flash yok) ve bizim --dna-* token'larımızla aynı sinyali okur. */
const SDS_THEME = `(function(){try{
  var t = localStorage.getItem("theme");
  var dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  var r = document.documentElement;
  r.classList.add(dark ? "sds-theme-dark" : "sds-theme-light");
  if (t) r.dataset.theme = t;
} catch (e) { document.documentElement.classList.add("sds-theme-light"); }})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: yukarıdaki script <html>'e tema sınıfını hydration'dan ÖNCE ekler (kasıtlı fark).
    <html lang="tr" suppressHydrationWarning className={`${inter.variable} ${inconsolata.variable} ${bricolage.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SDS_THEME }} />
      </head>
      <body>
        <header className="dna-nav">
          <Link href="/" className="dna-nav__brand">
            STELLACT<span className="dna-nav__tag">Proof of Real Use on Stellar</span>
          </Link>
          <nav className="dna-nav__links" aria-label="Ana">
            <Link href="/tasks">Görevler</Link>
            <Link href="/index">Index</Link>
            <Link href="/dna">DNA&apos;m</Link>
          </nav>
          <NetBadge />
        </header>
        <main className="dna-main">{children}</main>
      </body>
    </html>
  );
}
