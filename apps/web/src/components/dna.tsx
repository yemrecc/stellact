import { POLICIES, type Decision, type Genome, type Policy, type SettlementFact, type Sibling } from "@stellact/dna";
import { CONFIG, fmtUtc, short } from "@/lib/config";
import { AddressLink, Badge, Fact, Gene, Pill } from "@/components/ui";

const fmtAge = (days: number | null) =>
  days == null ? "—"
    : days < 1 / 24 ? `${Math.max(1, Math.round(days * 1440))} minutes`
    : days < 1 ? `${Math.round(days * 24)} hours`
    : days < 60 ? `${Math.floor(days)} days`
    : `${Math.floor(days / 30)} months`;

const acct = (a: string) => `${CONFIG.explorer}/account/${a}`;
const ctr = (a: string) => `${CONFIG.explorer}/contract/${a}`;

/* ---------------------------------------------------------------- DNA kartı */

export function GenomeCard({ address, genome, siblings, settlements = [], stamp, role }: {
  address: string; genome: Genome; siblings: Sibling[]; settlements?: SettlementFact[]; stamp: React.ReactNode; role: string;
}) {
  const g = genome;
  const clusterFlag = g.graph.sponsor_siblings > 10;
  const isContract = address.startsWith("C");
  const link = isContract ? ctr(address) : acct(address);
  const div = g.agent.query_diversity;

  return (
    <section className="card">
      <div className="card__head">
        <span className="h2">DNA card</span>
        <span className="stamp">7 genes · fixed order · every fact linked to the chain</span>
      </div>
      <div className="genes">
        <Gene name="Origin" key_="origin" evidence={[{ href: link, label: isContract ? "contract" : "account" }]}>
          <Fact v={fmtUtc(g.origin.created_at)} k="created" />
          {g.origin.funder ? <Fact v={<AddressLink address={g.origin.funder} />} k="funded by" /> : null}
          <Fact
            v={g.origin.sponsor ? <AddressLink address={g.origin.sponsor} /> : "none"}
            k={g.origin.sponsor ? "sponsor · reserves paid by someone else" : "sponsor"}
            flag={clusterFlag}
          />
          <Fact v={g.origin.account_type} k={`account type · ${isContract ? "smart account" : "classic account"}`} />
        </Gene>

        <Gene name="Age" key_="age" featured={fmtAge(g.age.days)} evidence={[{ href: link, label: "transactions" }]}>
          <Fact v={String(g.age.tx)} k={g.age.tx === 1 ? "transaction" : "transactions"} />
          <Fact v={fmtUtc(g.age.last_active)} k="last activity" />
        </Gene>

        <Gene
          name="Trustline" key_="trustlines"
          empty={g.trustlines.count === 0 ? "no trustlines yet" : undefined}
          evidence={g.trustlines.count ? [{ href: ctr(CONFIG.tusdSac), label: "TUSD SAC" }] : []}
        >
          {g.trustlines.count ? (
            <>
              <Fact v={String(g.trustlines.count)} k={g.trustlines.count === 1 ? "trustline" : "trustlines"} />
              <Fact v={g.trustlines.codes.join(" · ")} k={g.trustlines.codes.length === 1 ? "asset" : "assets"} />
              <Fact v={String(g.trustlines.sponsored)} k="sponsored" flag={g.trustlines.sponsored > 0} />
            </>
          ) : null}
        </Gene>

        <Gene
          name="Position" key_="positions"
          featured={g.positions.vault_tusd > 0 ? `${g.positions.vault_tusd.toFixed(7)} TUSD` : undefined}
          empty={g.positions.vault_tusd > 0 ? undefined : "Vault · Blend — no positions"}
          evidence={g.positions.vault_tusd > 0 ? [{ href: ctr(CONFIG.vault), label: "Vault" }] : []}
        >
          {g.positions.vault_tusd > 0 ? (
            <>
              <Fact v="Vault" k={`contract ${short(CONFIG.vault)}`} />
              <Fact v={g.positions.since ? fmtUtc(new Date(g.positions.since * 1000).toISOString()) : "—"} k="deposited_at" />
              <Fact
                v={g.positions.held_days < 1 ? `${Math.max(1, Math.round(g.positions.held_days * 1440))} min` : `${Math.floor(g.positions.held_days)} days`}
                k="held uninterrupted"
              />
            </>
          ) : null}
        </Gene>

        <Gene name="Counterparty" key_="graph" evidence={[{ href: link, label: "transactions" }]}>
          <Fact v={String(g.graph.distinct_counterparties)} k={g.graph.distinct_counterparties === 1 ? "distinct counterparty" : "distinct counterparties"} />
          <Fact v={ratio(g.graph.self_payments, g.graph.distinct_counterparties)} k="self-payment ratio" />
          <Fact v={String(g.graph.sponsor_siblings)} k="sibling accounts from the same sponsor" flag={clusterFlag} />
        </Gene>

        <Gene
          name="Attestation" key_="attestations"
          empty={g.attestations.poa === 0 ? "written by the first task you pass" : undefined}
          evidence={g.attestations.poa ? [{ href: ctr(CONFIG.attest), label: `Attest ${short(CONFIG.attest)}` }] : []}
        >
          {g.attestations.poa ? <Fact v={String(g.attestations.poa)} k="POA attestations" /> : null}
        </Gene>

        <Gene
          name="Agent" key_="agent"
          featured={g.agent.x402_settlements > 0 ? `${g.agent.x402_settlements} settlements · diversity ${div === null ? "—" : div.toFixed(2)}` : undefined}
          empty={g.agent.x402_settlements === 0 && !g.agent.identity_8004 ? "not an agent" : undefined}
          evidence={g.agent.x402_last_tx ? [{ href: `${CONFIG.explorer}/tx/${g.agent.x402_last_tx}`, label: "last x402 payment" }] : []}
          sub={settlements.length ? {
            head: ["time", "endpoint", "amount"],
            rows: settlements.slice(-g.agent.query_diversity_window).map(s =>
              [s.ts.slice(11, 16) + " UTC", s.endpoint, `${(Number(s.amount) / 1e7).toFixed(7)} TUSD`] as [string, string, string]),
          } : undefined}
          subNote={settlements.length
            ? `Query diversity runs 0–1: distinct endpoints ÷ total queries, over the last ${g.agent.query_diversity_window} paid calls. A script repeating one query scores low and is rejected under the agent policy (≥ 0.5).`
            : undefined}
        >
          {g.agent.identity_8004 ? <Fact v={g.agent.identity_8004} k="8004 identity" /> : null}
          {g.agent.x402_settlements > 0 ? (
            <Fact
              v={div === null ? "—" : div.toFixed(2)}
              k={`query diversity · last ${g.agent.query_diversity_window} paid calls`}
              flag={div !== null && div < 0.5}
            />
          ) : null}
        </Gene>

        <Gene name="Firsts" key_="firsts">
          <span className="firsts">
            {g.firsts.length
              ? g.firsts.map(f => <Pill key={f}>{f}</Pill>)
              : <span className="note">No Firsts yet. Firsts are written automatically; no monetary value, status only.</span>}
          </span>
        </Gene>
      </div>
      <div className="split hair-top" style={{ marginTop: 4 }}>
        <span className="note">{role} · {siblings.length ? `${siblings.length} accounts share this sponsor` : "no sponsor cluster"}</span>
        <span className="srcs">{stamp}</span>
      </div>
    </section>
  );
}

const ratio = (self: number, others: number) => {
  const total = self + others;
  return total ? (self / total).toFixed(2) : "0.00";
};

/* ------------------------------------------------------------ karar şeridi */

/** Kararın tamamı: hüküm, ret gerekçeleri, gerçekten yapılan iş, geçmek için gereken. */
export function DecisionStrip({ d, subject }: { d: Decision; subject: string }) {
  return (
    <section className={`decision ${d.pass ? "decision--pass" : "decision--fail"}`} role="status">
      <div className="cols" style={{ padding: "clamp(20px,2.4vw,32px)", gap: "clamp(20px,3vw,44px)" }}>
        <div className="stack stack--lg">
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Decision · policy {d.policy_version} {d.policy}</div>
            <div className={`verdict verdict--${d.pass ? "pass" : "fail"}`}>
              <span className="verdict__ico" aria-hidden="true">{d.pass ? "✓" : "✕"}</span>
              <span className="verdict__word">{d.pass ? "Passed" : "Rejected"}</span>
            </div>
          </div>
          <div className="row">
            {d.pass
              ? <><Badge kind="passed">attestation written</Badge><Badge kind="rewarded">reward released</Badge></>
              : <><Badge>no reward</Badge><Badge>no attestation</Badge></>}
          </div>
          <div className="stamp">decided {fmtUtc(d.decided_at)} · validator {short(CONFIG.readSource)}</div>
          {d.pass ? (
            <div className="note hair-top">
              Attestation → Attest <span className="mono">{short(CONFIG.attest)}</span> · schema <span className="mono">{CONFIG.poaSchema.slice(0, 8)}…</span> ·
              subject <span className="mono">{short(subject)}</span> · signed by the validator, fee paid by the platform.
            </div>
          ) : null}
        </div>

        <div className="stack stack--lg" style={{ minWidth: 0 }}>
          {d.reasons.length > 0 && (
            <div>
              <div className="split" style={{ marginBottom: 14 }}>
                <span className="eyebrow">Reasons</span>
                <span className="stamp">{d.reasons.length} {d.reasons.length === 1 ? "item" : "items"}</span>
              </div>
              <ol className="reasons">
                {d.reasons.map((r, i) => (
                  <li key={r.code}>
                    <span className="reasons__n">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <p className="reasons__t">{r.text}</p>
                      <span className="code">{r.code}</span>
                      {r.evidence ? (
                        <div className="reasons__ev">
                          <span>evidence:</span>
                          <AddressLink address={r.evidence.ref} kind={r.evidence.kind === "tx" ? "tx" : "account"} sm />
                          <span>{r.evidence.label}</span>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {d.passed.length > 0 && (
            <div className={d.reasons.length ? "hair-top" : ""}>
              <div className="eyebrow" style={{ marginBottom: 14 }}>What was actually done</div>
              <ol className="reasons">
                {d.passed.map(r => (
                  <li key={r.code}>
                    <span className="reasons__n" style={{ color: "var(--dna-good)" }}>✓</span>
                    <div>
                      <p className="reasons__t" style={{ fontWeight: 400 }}>{r.text}</p>
                      <span className="code">{r.code}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {!d.pass && (
            <div className="wash">
              <div className="eyebrow" style={{ marginBottom: 8 }}>What would make it pass</div>
              <p className="note" style={{ margin: 0 }}>{howToPass(d)}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Ret gerekçesinden çıkarılan somut yol — genel öğüt değil, bu cüzdana özgü. */
function howToPass(d: Decision): string {
  const codes = d.reasons.map(r => r.code);
  const parts: string[] = [];
  if (codes.some(c => c.startsWith("sponsor_cluster_size")))
    parts.push("The same task passes from an account opened by a different sponsor — or with no sponsor at all.");
  if (codes.some(c => c.startsWith("query_diversity")))
    parts.push("Ask the API different questions: distinct endpoints or distinct parameters, not the same call repeated.");
  if (codes.some(c => c.startsWith("x402_settlements")))
    parts.push("Complete more paid calls; only settled payments count.");
  if (codes.some(c => c.startsWith("vault_balance")))
    parts.push("Raise the Vault position above the threshold.");
  if (codes.some(c => c.startsWith("position_held_days")))
    parts.push("Leave the position untouched until the holding period is over.");
  if (codes.some(c => c.startsWith("account_age")))
    parts.push("The account needs more history behind it.");
  if (!parts.length) parts.push("Meet the thresholds in the task policy; each one is listed with the value in force.");
  return parts.join(" ");
}

/* ------------------------------------------------------------ politika */

interface RuleRow { name: string; key: string; enabled: boolean; verdict: "ok" | "no" | "off"; value: string }

/** Politikayı genomla karşılaştırır: her kural için yürürlükteki eşik ve sonuç. */
function rules(policy: Policy, g?: Genome): RuleRow[] {
  const row = (name: string, key: string, enabled: boolean, ok: boolean | null, value: string): RuleRow =>
    ({ name, key, enabled, verdict: !enabled || ok === null ? "off" : ok ? "ok" : "no", value });
  const div = g?.agent.query_diversity ?? null;
  return [
    row("Deposit", `vault.deposit ≥ ${policy.min_deposit_tusd} TUSD`, policy.min_deposit_tusd > 0,
      g ? g.positions.vault_tusd >= policy.min_deposit_tusd : null,
      g ? g.positions.vault_tusd.toFixed(7) : "—"),
    row("Sponsor cluster", `sponsor_cluster_size ≤ ${policy.sponsor_cluster_size_gt}`, true,
      g ? g.graph.sponsor_siblings <= policy.sponsor_cluster_size_gt : null,
      g ? String(g.graph.sponsor_siblings) : "—"),
    row("Account age", `account_age ≥ ${policy.account_age_lt_days} days`, policy.account_age_lt_days > 0,
      g && g.age.days !== null ? g.age.days >= policy.account_age_lt_days : null,
      g && g.age.days !== null ? fmtAge(g.age.days) : "—"),
    row("Self-payment ratio", `self_payment_ratio ≤ ${policy.self_payment_ratio_gt}`, true,
      g ? Number(ratio(g.graph.self_payments, g.graph.distinct_counterparties)) <= policy.self_payment_ratio_gt : null,
      g ? ratio(g.graph.self_payments, g.graph.distinct_counterparties) : "—"),
    row("Distinct counterparties", `distinct_counterparties ≥ ${policy.distinct_counterparties_lt}`, policy.distinct_counterparties_lt > 0,
      g ? g.graph.distinct_counterparties >= policy.distinct_counterparties_lt : null,
      g ? String(g.graph.distinct_counterparties) : "—"),
    row("Position must be held", `position_held ≥ ${policy.position_held_days} days`, policy.position_held_days > 0,
      g ? g.positions.held_days >= policy.position_held_days : null,
      g ? `${Math.floor(g.positions.held_days)} days` : "—"),
    row("Paid calls (x402)", `x402_settlements ≥ ${policy.min_x402_settlements}`, policy.min_x402_settlements > 0,
      g ? g.agent.x402_settlements >= policy.min_x402_settlements : null,
      g ? String(g.agent.x402_settlements) : "—"),
    row("Query diversity", `query_diversity ≥ ${policy.query_diversity_lt}`, policy.query_diversity_lt > 0,
      div === null ? false : div >= policy.query_diversity_lt,
      div === null ? "—" : div.toFixed(2)),
  ];
}

/** Sonuç ekranının yanındaki özet: yalnız yürürlükteki kurallar, sonuçlarıyla. */
export function PolicyPanel({ policy, genome }: { policy: Policy; genome?: Genome }) {
  return (
    <div className="stack">
      <div className="split">
        <span className="h2" style={{ fontSize: 18 }}>Task policy</span>
        <span className="stamp">{policy.version} {policy.name}</span>
      </div>
      <p className="note" style={{ margin: 0 }}>The project sets the thresholds; the reasoning is ours.</p>
      <table className="rules">
        <tbody>
          {rules(policy, genome).map(r => (
            <tr key={r.name}>
              <td>{r.name}<span className="rules__k">{r.key}</span></td>
              <td className={r.verdict === "ok" ? "rules__ok" : r.verdict === "no" ? "rules__no" : "rules__off"}>
                {!r.enabled ? "— not required" : r.verdict === "ok" ? `✓ ${r.value}` : r.verdict === "no" ? `✕ ${r.value}` : r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Karşılaştırma tablosunun satırları — eşik doğrudan politika alanından, metin ayrıştırmadan. */
const THRESHOLDS: { name: string; key: string; of: (p: Policy) => number; unit?: string }[] = [
  { name: "Deposit", key: "vault.deposit ≥", of: p => p.min_deposit_tusd, unit: "TUSD" },
  { name: "Sponsor cluster", key: "sponsor_cluster_size ≤", of: p => p.sponsor_cluster_size_gt },
  { name: "Account age", key: "account_age ≥", of: p => p.account_age_lt_days, unit: "days" },
  { name: "Self-payment ratio", key: "self_payment_ratio ≤", of: p => p.self_payment_ratio_gt },
  { name: "Distinct counterparties", key: "distinct_counterparties ≥", of: p => p.distinct_counterparties_lt },
  { name: "Position must be held", key: "position_held ≥", of: p => p.position_held_days, unit: "days" },
  { name: "Paid calls (x402)", key: "x402_settlements ≥", of: p => p.min_x402_settlements },
  { name: "Query diversity", key: "query_diversity ≥", of: p => p.query_diversity_lt },
];
const TEMPLATES = [POLICIES.conservative, POLICIES.balanced, POLICIES.permissive, POLICIES.agent];
/** 0 = kural kapalı; tabloda sayı yerine bunu yazıyoruz ki "0 eşik" sanılmasın. */
const cell = (v: number, unit?: string) => (v === 0 ? "—" : unit ? `${v} ${unit}` : String(v));

/** Görev ekranındaki tam tablo: bu görevin değerleri, şablonların yanında. */
export function PolicyTable({ policy }: { policy: Policy }) {
  return (
    <div className="stack">
      <div className="split">
        <span className="h2" style={{ fontSize: 18 }}>Task policy</span>
        <span className="stamp">{policy.version} · template {policy.name} · set by the project</span>
      </div>
      <p className="note" style={{ margin: 0 }}>
        The thresholds are the project&apos;s; the reasoning is ours. The values in force for this task are in the first column, with the templates alongside for comparison.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="rules">
          <thead>
            <tr>
              <th>Rule</th>
              <th style={{ textAlign: "right" }}>This task</th>
              {TEMPLATES.map(t => <th key={t.name} style={{ textAlign: "right" }}>{t.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {THRESHOLDS.map(t => (
              <tr key={t.name}>
                <td>{t.name}<span className="rules__k">{t.key}</span></td>
                <td style={{ fontWeight: 600, color: "var(--dna-ink)" }}>{cell(t.of(policy), t.unit)}</td>
                {TEMPLATES.map(tpl => (
                  <td key={tpl.name} style={{ color: "var(--dna-ink-2)" }}>{cell(t.of(tpl), t.unit)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ soy ağacı */

/**
 * Sponsor kümesi. Grafik, listenin söylediğini tek bakışta gösterir:
 * ortada sponsor, çevresinde aynı anda açılmış hesaplar, mavi olan bu cüzdan.
 */
export function Lineage({ sponsor, siblings, address }: { sponsor: string; siblings: Sibling[]; address: string }) {
  const R = 150, C = 190;
  const pts = siblings.map((s, i) => {
    const a = (i / siblings.length) * Math.PI * 2 - Math.PI / 2;
    return { ...s, x: C + R * Math.cos(a), y: C + R * Math.sin(a), me: s.id === address };
  });
  return (
    <div className="panel stack">
      <div className="split">
        <span className="h2" style={{ fontSize: 18 }}>Lineage</span>
        <span className="stamp">{siblings.length} accounts · one sponsor</span>
      </div>
      <p className="note" style={{ margin: 0 }}>
        Horizon <span className="mono">/accounts?sponsor={short(sponsor)}</span> — a structured ledger field, not an inference.
      </p>
      <svg viewBox={`0 0 ${C * 2} ${C * 2}`} width="100%" style={{ maxWidth: 380, margin: "0 auto", display: "block" }} role="img"
           aria-label={`${siblings.length} accounts opened by the same sponsor`}>
        {pts.map(p => (
          <line key={`l${p.id}`} x1={C} y1={C} x2={p.x} y2={p.y}
                stroke={p.me ? "var(--dna-accent)" : "var(--dna-hair-2)"} strokeWidth={p.me ? 2 : 1} />
        ))}
        {pts.map(p => (
          <circle key={p.id} cx={p.x} cy={p.y} r={p.me ? 7 : 4.5}
                  fill={p.me ? "var(--dna-accent)" : "var(--dna-ink-3)"}>
            <title>{p.id}{p.created ? ` · ${fmtUtc(p.created)}` : ""}</title>
          </circle>
        ))}
        <circle cx={C} cy={C} r={13} fill="var(--dna-ink)" />
        <text x={C} y={C + 34} textAnchor="middle" fill="var(--dna-ink-3)" style={{ font: "11px var(--dna-mono)" }}>{short(sponsor)}</text>
      </svg>
      <div className="row" style={{ gap: 18, fontSize: 13, color: "var(--dna-ink-2)" }}>
        <span className="row" style={{ gap: 6 }}><svg width="10" height="10"><circle cx="5" cy="5" r="5" fill="var(--dna-ink)" /></svg>sponsor</span>
        <span className="row" style={{ gap: 6 }}><svg width="10" height="10"><circle cx="5" cy="5" r="5" fill="var(--dna-accent)" /></svg>this wallet</span>
        <span className="row" style={{ gap: 6 }}><svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="var(--dna-ink-3)" /></svg>{siblings.length - 1} sibling accounts</span>
      </div>
    </div>
  );
}
