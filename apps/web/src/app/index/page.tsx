import { CONFIG, short } from "@/lib/config";
import { Pill } from "@/components/ui";

/** Index v0 — testnet, `computed`. Sıra ve güven etiketi AYRI sütun (brief §5.6). Mainnet hesaplaması sonraki sprint. */
const ROWS = [
  { rank: 1, project: "Vault (demo)", category: "Savings", users: 2, delta: "+2", trust: "computed" as const, contract: CONFIG.vault },
];

export default function IndexPage() {
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <div>
        <div className="eyebrow">Verified Usage Index · testnet · v0</div>
        <h1 className="h1" style={{ fontSize: 26 }}>Gerçekten ne kullanılıyor</h1>
        <p className="lede">TVL değil, ayrı gerçek kullanıcı. Sıra kullanıcı sayısına göre; güven etiketi doğrulama derinliğine göre — ikisi ayrı sütun, ücretli yerleşim yok.</p>
      </div>
      <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>{["Sıra", "Proje", "Kategori", "Gerçek kullanıcı (30g)", "Değişim", "Güven etiketi"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {ROWS.map(r => (
              <tr key={r.project}>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{r.rank}</td>
                <td style={td}>{r.project} <span className="mono">{short(r.contract)}</span></td>
                <td style={td}>{r.category}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{r.users}</td>
                <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>{r.delta}</td>
                <td style={td}><Pill>{r.trust}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stamp">Bu yayının hesaplama hash&apos;i zincire yazılacak (Attest, INDEX şeması) — v0&apos;da henüz değil. Metodoloji açık kaynak.</div>
    </div>
  );
}
const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", borderBottom: "1px solid var(--dna-hair)", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--dna-ink-3)", fontWeight: 600, whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid var(--dna-hair)", whiteSpace: "nowrap" };
