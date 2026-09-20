import type { Decision, Genome, Policy, Sibling } from "@stellact/dna";
import { CONFIG, fmtUtc, short } from "@/lib/config";
import { AddressLink, Fact, Gene, Pill } from "@/components/ui";

const fmtAge = (days: number | null) => days == null ? "—" : days < 1 ? `${Math.max(1, Math.round(days * 24))} saat` : `${Math.floor(days)} gün`;

export function PolicyPanel({ policy }: { policy: Policy }) {
  const rows: [string, string][] = [
    ["Yatırım", `≥ ${policy.min_deposit_tusd} TUSD`],
    ["Sponsor kümesi", `≤ ${policy.sponsor_cluster_size_gt} hesap`],
    ["Hesap yaşı", policy.account_age_lt_days ? `≥ ${policy.account_age_lt_days} gün` : "şart yok"],
    ["Kendine ödeme oranı", `≤ ${policy.self_payment_ratio_gt}`],
    ["Ayrı karşı taraf", policy.distinct_counterparties_lt ? `≥ ${policy.distinct_counterparties_lt}` : "şart yok"],
    ["Kalıcılık", policy.position_held_days ? `${policy.position_held_days} gün` : "şart yok"],
  ];
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="eyebrow">Görev politikası · proje tanımlı</div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 2, fontSize: 12 }}>
        {rows.map(([k, v]) => (
          <li key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "var(--dna-ink-2)" }}>{k}</span><span className="mono" style={{ color: "var(--dna-ink)" }}>{v}</span>
          </li>
        ))}
        <li style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: "var(--dna-ink-2)" }}>Politika</span><span className="mono">{policy.version} · {policy.name}</span>
        </li>
      </ul>
    </div>
  );
}

export function GenomeCard({ address, genome, siblings, stamp, role, lineageOpen = false }: { address: string; genome: Genome; siblings: Sibling[]; stamp: string; role: string; lineageOpen?: boolean }) {
  const g = genome;
  const clusterFlag = g.graph.sponsor_siblings > 10;
  return (
    <>
      <div className="card__head">
        <div className="card__who"><span className="card__role">{role}</span><Pill>{g.origin.account_type === "C" ? "smart account" : "klasik hesap"}</Pill></div>
        <AddressLink address={address} kind={address.startsWith("C") ? "contract" : "account"} full />
        <div className="stamp">{stamp}</div>
      </div>
      <div className="genes">
        <Gene name="Köken" key_="origin">
          <Fact v={fmtUtc(g.origin.created_at)} k="oluşturuldu" />
          {g.origin.funder ? <Fact v={<AddressLink address={g.origin.funder} />} k={g.origin.sponsor ? "fonlayan = sponsor" : "fonlayan"} /> : null}
          {g.origin.sponsor
            ? <Fact v={<AddressLink address={g.origin.sponsor} />} k="sponsor · rezervleri başkası ödüyor" flag={clusterFlag} />
            : <Fact v="—" k="sponsor yok · rezervleri kendi ödüyor" />}
        </Gene>
        <Gene name="Yaş" key_="age">
          <Fact v={fmtAge(g.age.days)} big />
          <Fact v={String(g.age.tx)} k={`işlem · son ${fmtUtc(g.age.last_active)}`} />
        </Gene>
        <Gene name="Trustline" key_="trustlines">
          <Fact v={String(g.trustlines.count)} k={g.trustlines.codes.join(", ") || "yok"} />
          {g.trustlines.sponsored ? <Fact v={String(g.trustlines.sponsored)} k="trustline'ın rezervi sponsor tarafından ödeniyor" flag /> : null}
        </Gene>
        <Gene name="Pozisyon" key_="positions">
          <Fact v={`${g.positions.vault_tusd} TUSD`} k="Vault'ta" big />
          <Fact v={g.positions.since ? fmtUtc(new Date(g.positions.since * 1000).toISOString()) : "—"} k={`deposited_at · ${g.positions.held_days < 1 ? "< 1 gün tutuldu" : Math.floor(g.positions.held_days) + " gün tutuldu"}`} />
        </Gene>
        <Gene name="Karşı taraf" key_="graph">
          <Fact v={String(g.graph.distinct_counterparties)} k="ayrı karşı taraf" />
          <Fact v={String(g.graph.self_payments)} k="kendine ödeme" />
          <Fact v={String(g.graph.sponsor_siblings)} k="aynı sponsorun açtığı kardeş hesap" flag={clusterFlag} />
        </Gene>
        <Gene name="Tasdik" key_="attestations"><Fact v={String(g.attestations.poa)} k="POA tasdiki" /></Gene>
        <Gene name="Ajan" key_="agent"><Fact v={g.agent.identity_8004 ?? "—"} k={g.agent.identity_8004 ? "8004 kimliği" : "8004 kimliği yok · insan cüzdanı"} /></Gene>
        <Gene name="İlkler" key_="firsts">
          <div className="firsts">{g.firsts.length ? g.firsts.map(f => <Pill key={f} kind="acc">{f}</Pill>) : <Pill>henüz yok</Pill>}</div>
        </Gene>
      </div>
      {siblings.length > 0 && (
        <details className="lineage" open={lineageOpen} style={{ borderTop: "1px solid var(--dna-hair)", padding: "12px 16px" }}>
          <summary style={{ cursor: "pointer", fontFamily: "var(--dna-display)", fontWeight: 600 }}>Soy ağacı · {siblings.length} hesap aynı sponsordan</summary>
          <div className="stamp" style={{ margin: "6px 0 10px" }}>Horizon <code className="mono">/accounts?sponsor={short(g.origin.sponsor)}</code> — yapılandırılmış alan, tahmin değil</div>
          <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid var(--dna-hair)", borderRadius: 4 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--dna-mono)", fontSize: 11 }}>
              <thead><tr><th style={th}>#</th><th style={th}>Hesap</th><th style={th}>Son değişiklik</th></tr></thead>
              <tbody>{siblings.map((s, i) => (
                <tr key={s.id} style={s.id === address ? { background: "var(--dna-accent-wash)" } : undefined}>
                  {/* kısa adres: tam hâli link title'ında — iki sütun da kırpılmadan sığar */}
                  <td style={td}>{i + 1}</td><td style={td}><AddressLink address={s.id} /></td><td style={td}>{fmtUtc(s.created)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}
const th: React.CSSProperties = { textAlign: "left", padding: "6px 10px", borderBottom: "1px solid var(--dna-hair)", fontFamily: "Inter, system-ui", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--dna-ink-3)", position: "sticky", top: 0, background: "var(--dna-surface)" };
const td: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid var(--dna-hair)", whiteSpace: "nowrap" };

export function DecisionStrip({ d, subject }: { d: Decision; subject: string }) {
  return (
    <div className={`decision ${d.pass ? "decision--pass" : "decision--reject"}`} role="status">
      <div className="verdict">
        <span className="verdict__ico" aria-hidden="true">{d.pass ? "✓" : "✕"}</span>
        <span className="verdict__word">{d.pass ? "Geçti" : "Reddedildi"}</span>
        {d.pass ? <Pill kind="good">tasdik yazılır</Pill> : <Pill kind="bad">ödül yok · tasdik yok</Pill>}
        <span className="verdict__meta">policy {d.policy_version} · {d.policy}</span>
      </div>
      <ul className="reasons">
        {d.reasons.map(r => (
          <li key={r.code}><span className="reasons__mark">✕</span><div>{r.text}<code>{r.code}</code>
            {r.evidence ? <span className="reasons__evi">kanıt: <AddressLink address={r.evidence.ref} kind={r.evidence.kind === "tx" ? "tx" : "account"} /> · {r.evidence.label}</span> : null}
          </div></li>
        ))}
        {d.passed.map(r => (
          <li key={r.code}><span className="reasons__mark">✓</span><div>{r.text}<code>{r.code}</code></div></li>
        ))}
      </ul>
      {d.pass ? (
        <div className="stamp">Tasdik → Attest <code className="mono">{short(CONFIG.attest)}</code> · şema <code className="mono">{CONFIG.poaSchema.slice(0, 8)}…</code> · özne <code className="mono">{short(subject)}</code> · imzalayan doğrulayıcı · ücreti platform öder</div>
      ) : (
        <div className="stamp">Görevin kendisi yapılmış — yatırım gerçek. Ret, yatırıma değil kaynağa: başka bir sponsorla açılmış ya da kendi rezervini ödeyen bir hesap geçer.</div>
      )}
    </div>
  );
}
