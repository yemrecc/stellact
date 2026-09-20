import type { Metadata } from "next";
import Link from "next/link";
import { Familjen_Grotesk, Fragment_Mono } from "next/font/google";
import "./globals.css";
import { NavLinks, NetBadge } from "@/components/ui";

/* Tasarımın seçimi: başlık Familjen Grotesk, veri Fragment Mono, gövde sistem yazıtipi.
   İkisi de kendi sunucumuzdan servis edilir — dış istek yok, layout shift yok. */
const familjen = Familjen_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-familjen", display: "swap" });
const fragment = Fragment_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-fragment", display: "swap" });

export const metadata: Metadata = {
  title: "STELLACT",
  description: "Your actions become your identity. Proof of Real Use on Stellar.",
};

/* Tema: varsayılan olarak sistemi izler (globals.css'teki prefers-color-scheme).
   Kullanıcı açıkça bir tema seçtiyse onu boyamadan ÖNCE uygular — flash olmaz.
   Stellar Design System bileşenleri artık kullanılmıyor (tasarım kendi kontrollerini
   getiriyor), o yüzden .sds-theme-* sınıfına ve SDS stil sayfasına gerek kalmadı. */
const THEME = `(function(){try{
  var t = localStorage.getItem("theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch (e) {}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: yukarıdaki script <html>'e tema sınıfını hydration'dan ÖNCE ekler (kasıtlı fark).
    <html lang="en" suppressHydrationWarning className={`${familjen.variable} ${fragment.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body>
        <header className="dna-nav">
          <div className="dna-nav__in">
            <Link href="/" className="dna-nav__brand">STELLACT</Link>
            <NavLinks />
            <div className="dna-nav__end"><NetBadge /></div>
          </div>
        </header>
        <main className="dna-main">{children}</main>
      </body>
    </html>
  );
}
