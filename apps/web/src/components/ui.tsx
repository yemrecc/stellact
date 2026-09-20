"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONFIG, short } from "@/lib/config";

const NAV = [
  { href: "/tasks", label: "Tasks" },
  { href: "/usage-index", label: "Index" },
  { href: "/dna", label: "My DNA" },
] as const;

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="dna-nav__links" aria-label="Main">
      {NAV.map(n => (
        <Link key={n.href} href={n.href} aria-current={path === n.href || path.startsWith(n.href + "/") ? "page" : undefined}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

/** Ağ rozeti — veri gösteren her ekranda. Mainnet'in noktası dolu (spec §5.8). */
export function NetBadge() {
  const main = CONFIG.network === "mainnet";
  return <span className={`net${main ? " net--main" : ""}`}><i aria-hidden="true" />{CONFIG.network}</span>;
}

/** Veri damgası: ne zaman, nereden. Boş nokta = yeniden okunuyor. */
export function Src({ label, waiting }: { label: string; waiting?: boolean }) {
  return <span className={`src${waiting ? " src--wait" : ""}`}><i aria-hidden="true" />{label}</span>;
}

export function AddressLink({ address, kind = "account", full = false, sm = false }: { address: string; kind?: "account" | "tx" | "contract"; full?: boolean; sm?: boolean }) {
  const path = kind === "tx" ? `tx/${address}` : kind === "contract" ? `contract/${address}` : `account/${address}`;
  return (
    <a className={`addr${sm ? " addr--sm" : ""}`} href={`${CONFIG.explorer}/${path}`} target="_blank" rel="noopener noreferrer" title={address}>
      {full ? address : short(address)}
    </a>
  );
}

type BadgeKind = "open" | "taken" | "verifying" | "passed" | "rejected" | "rewarded" | "cancelled" | "solid";
/** Görev durumu. Renk YALNIZ passed/rejected'ta; kalan beş durum nötr (spec §5.4). */
export function Badge({ kind, children }: { kind?: BadgeKind; children: React.ReactNode }) {
  const mark = kind === "passed" ? "✓" : kind === "rejected" ? "✕" : null;
  return (
    <span className={`badge${kind ? ` badge--${kind}` : ""}`}>
      {mark ? <span aria-hidden="true" style={{ fontWeight: 700 }}>{mark}</span> : null}
      {kind === "rewarded" ? <i aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Doğrulayıcı sınıfı — A: kontrattan okunur, B: geçmişten, C: anchor onaylı (spec §8). */
export function ClassBadge({ klass }: { klass: "A" | "B" | "C" }) {
  return <span className="klass">Class {klass}</span>;
}

/** İlkler: otomatik yazılır, parasal değeri yok, yalnız durum bildirir. */
export function Pill({ children, title }: { children: React.ReactNode; title?: string }) {
  return <span className="pill" title={title}><i aria-hidden="true" />{children}</span>;
}

export function Fact({ v, k, flag }: { v: React.ReactNode; k?: React.ReactNode; flag?: boolean }) {
  return (
    <span className="fact">
      <span className="fact__v">{v}</span>
      {k ? <span className={`fact__k${flag ? " fact__k--flag" : ""}`}>{k}</span> : null}
    </span>
  );
}

/**
 * Bir gen satırı: etiket · olgular · zincire giden kanıt bağlantıları.
 * `featured` satırın tek büyük sayısıdır; `empty` olgu yokluğunu gerekçesiyle gösterir.
 */
export function Gene({ name, key_, featured, empty, evidence, sub, subNote, children }: {
  name: string; key_: string;
  featured?: React.ReactNode;
  empty?: string;
  evidence?: { href: string; label: string }[];
  /** Genin dökümü — ör. ajanın ödediği çağrılar. Başlık satırı sabit üç sütun. */
  sub?: { head: [string, string, string]; rows: [string, string, string][] };
  subNote?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="gene">
      <div className="gene__g"><span className="eyebrow">{name}</span><small>{key_}</small></div>
      <div className="gene__body">
        {featured ? <div className="featured">{featured}</div> : null}
        {empty ? <div className="empty-fact"><span aria-hidden="true">—</span><span className="note">{empty}</span></div> : null}
        {children ? <div className="facts">{children}</div> : null}
        {sub && sub.rows.length ? (
          <>
            <div className="subtable">
              <div className="subtable__h">{sub.head.map(h => <span key={h}>{h}</span>)}</div>
              {sub.rows.map((r, i) => (
                <div className="subtable__r" key={i}>{r.map((c, j) => <span key={j}>{c}</span>)}</div>
              ))}
            </div>
            {subNote ? <span className="note">{subNote}</span> : null}
          </>
        ) : null}
      </div>
      <div className="gene__ev">
        {(evidence ?? []).map(e => (
          <a key={e.label} href={e.href} target="_blank" rel="noopener noreferrer">{e.label} ↗</a>
        ))}
      </div>
    </div>
  );
}
