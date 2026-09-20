import { CONFIG, short } from "@/lib/config";
import { Badge, Src } from "@/components/ui";

/** Index v0 — testnet, `computed`. Sıra ve güven etiketi AYRI sütun (brief §5.6). Mainnet hesaplaması sonraki sprint. */
const RANKED = [
  { rank: 1, project: "Vault-demo", owner: "Sava · testnet", category: "Vault", users: 2, delta: "new · first release", trust: "computed" as const, contract: CONFIG.vault },
];
/** Mainnet projeleri listede ama SIRASIZ: hesaplama yapılmadan sıra vermek yanıltıcı olur. */
const WAITING = [
  { project: "Blend", category: "Lending" },
  { project: "Aquarius", category: "AMM" },
  { project: "Soroswap", category: "DEX" },
  { project: "DeFindex", category: "Yield" },
];

export default function IndexPage() {
  return (
    <div className="stack stack--lg">
      <div className="split">
        <div className="stack" style={{ gap: 8, maxWidth: "56ch" }}>
          <h1 className="h1" style={{ fontSize: "clamp(28px,3vw,42px)" }}>Verified Usage Index</h1>
          <p className="lede">
            Not TVL — we count <span style={{ color: "var(--dna-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>distinct real users</span>,
            computed from verified tasks and the chain&apos;s own facts. No individual wallets, only projects.
          </p>
        </div>
        <div className="stack" style={{ gap: 4, textAlign: "right" }}>
          <span className="stamp">release #1 · testnet</span>
          <span className="stamp">source: RPC snapshot + Attest {short(CONFIG.attest)}</span>
        </div>
      </div>

      <div className="split">
        <Src label="30 days" />
        <span className="stamp">{RANKED.length} ranked project · {WAITING.length} mainnet projects waiting</span>
      </div>

      <div className="card card--flush" style={{ overflowX: "auto" }}>
        <table className="rules" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              {["Rank", "Project", "Category", "Real users · 30 days", "30 days change", "Trust label"].map(h => (
                <th key={h} style={{ padding: "14px 16px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RANKED.map(r => (
              <tr key={r.project}>
                <td style={{ padding: "16px", fontFamily: "var(--dna-mono)", fontSize: 18 }}>{r.rank}</td>
                <td style={{ padding: "16px" }}>{r.project}<span className="rules__k">{r.owner} · {short(r.contract)}</span></td>
                <td style={{ padding: "16px" }}>{r.category}</td>
                <td style={{ padding: "16px", fontFamily: "var(--dna-mono)", fontSize: 18, textAlign: "left" }}>{r.users}</td>
                <td style={{ padding: "16px", textAlign: "left" }}><span className="stamp">{r.delta}</span></td>
                <td style={{ padding: "16px", textAlign: "left" }}><Badge>{r.trust}</Badge></td>
              </tr>
            ))}
            <tr>
              <td colSpan={6} style={{ padding: "10px 16px", background: "var(--dna-surface-2)" }}>
                <span className="eyebrow">Mainnet · awaiting first release · not ranked</span>
              </td>
            </tr>
            {WAITING.map(w => (
              <tr key={w.project}>
                <td style={{ padding: "16px", color: "var(--dna-ink-3)" }}>—</td>
                <td style={{ padding: "16px" }}>{w.project}<span className="rules__k">mainnet</span></td>
                <td style={{ padding: "16px" }}>{w.category}</td>
                <td style={{ padding: "16px", color: "var(--dna-ink-3)", textAlign: "left" }}>—</td>
                <td style={{ padding: "16px", color: "var(--dna-ink-3)", textAlign: "left" }}>—</td>
                <td style={{ padding: "16px", textAlign: "left" }}><span className="note">not computed</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="split">
        <span className="note">
          <span className="code">computed</span> = computed from the chain · <span className="code">attested</span> = from verified tasks (attestations)
        </span>
        <span className="note">Rank follows the real-user count alone; the trust label does not affect it.</span>
      </div>
      <div className="stamp">The computation hash for this release is not on chain yet (Attest, INDEX schema) — v0. Methodology is open source.</div>
    </div>
  );
}
