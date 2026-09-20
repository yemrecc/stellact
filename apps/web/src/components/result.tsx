"use client";
/** Karar ekranı — brief §6.4. Zinciri okur (Horizon + Vault RPC), genome → decide, gerekçeli sonuç + soy listesi. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@stellar/design-system";
import { computeGenome, decide, readSiblings, readWalletFacts, type Decision, type Genome, type Policy, type Sibling, type WalletFacts } from "@stellact/dna";
import type { Task } from "@/lib/tasks";
import { CONFIG, fmtUtc } from "@/lib/config";
import { readVault } from "@/lib/vault";
import { DecisionStrip, GenomeCard, PolicyPanel } from "@/components/dna";

type Loaded = { genome: Genome; siblings: Sibling[]; decision: Decision; stamp: string };
type Phase = { status: "loading"; step: string } | ({ status: "ready" } & Loaded) | { status: "error"; message: string };

/** Veri yükleme — saf async; setState yok. Adımlar onStep ile bildirilir (react.dev "fetching data" kalıbı). */
async function loadResult(subject: string, policy: Policy, onStep: (s: string) => void): Promise<Loaded> {
  onStep("Vault okunuyor… (Soroban RPC)");
  const vault = await readVault(subject);
  let facts: WalletFacts;
  if (subject.startsWith("C")) {
    // Smart account: Horizon'da klasik hesap kaydı yok — köken/yaş genleri şimdilik boş, pozisyon RPC'den.
    facts = { id: subject, network: CONFIG.network, sponsor: null, created_at: null, funder: null, starting_balance: null, last_modified_time: null,
      tx_count: 0, distinct_counterparties: 0, self_payments: 0, trustlines: [], vault: { balance_tusd: vault.balance_tusd, deposited_at: vault.deposited_at }, observed_at: new Date().toISOString() };
  } else {
    onStep("Horizon okunuyor… köken, trustline, karşı taraflar");
    facts = await readWalletFacts(subject, CONFIG.network, { balance_tusd: vault.balance_tusd, deposited_at: vault.deposited_at });
  }
  onStep(facts.sponsor ? "Sponsor kümesi okunuyor…" : "Karar veriliyor…");
  const siblings = await readSiblings(facts.sponsor, CONFIG.network);
  const genome = computeGenome(facts, siblings);
  const decision = decide(genome, policy, subject);
  return { genome, siblings, decision, stamp: `Horizon + RPC · canlı · ${fmtUtc(new Date().toISOString())}` };
}

export function Result({ task, subject }: { task: Task; subject: string }) {
  const [phase, setPhase] = useState<Phase>({ status: "loading", step: "Vault okunuyor… (Soroban RPC)" });
  const [tick, setTick] = useState(0); // "yeniden sorgula" tetikleyicisi

  useEffect(() => {
    let alive = true;
    loadResult(subject, task.policy, s => { if (alive) setPhase({ status: "loading", step: s }); })
      .then(r => { if (alive) setPhase({ status: "ready", ...r }); })
      .catch(e => { if (alive) setPhase({ status: "error", message: e instanceof Error ? e.message : String(e) }); });
    return () => { alive = false; };
  }, [subject, task.policy, tick]);

  const reload = () => { setPhase({ status: "loading", step: "Vault okunuyor… (Soroban RPC)" }); setTick(t => t + 1); };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow">Karar · {task.project.name}</div>
          <h1 className="h1" style={{ fontSize: 22 }}>{task.title}</h1>
        </div>
        <div className="row"><Button variant="secondary" size="sm" onClick={reload} disabled={phase.status === "loading"}>Zinciri yeniden sorgula</Button><Link href={`/tasks/${task.id}`} className="mono">← görev</Link></div>
      </div>

      {phase.status === "loading" && <div className="panel progress"><span>{phase.step}</span><span className="stamp">Spinner değil, adım: hangi kaynak okunuyor görünür.</span></div>}
      {phase.status === "error" && <div className="panel stack" role="alert"><span className="err">Zincire ulaşılamadı: {phase.message}</span><span className="stamp">Horizon/RPC geçici olarak yanıt vermiyor olabilir; yeniden sorgulayın.</span></div>}

      {phase.status === "ready" && (
        // Karar sağ sütunun başında: kanıt (sol) ve hüküm (sağ) aynı anda, kaydırmadan görünür.
        <div className="grid-2">
          <article className="card">
            <GenomeCard
              address={subject}
              genome={phase.genome}
              siblings={phase.siblings}
              stamp={phase.stamp}
              role={subject.startsWith("C") ? "Smart account" : phase.genome.graph.sponsor_siblings > 10 ? "Script" : "Kullanıcı"}
              lineageOpen={phase.decision.reasons.some(r => r.code.startsWith("sponsor_cluster_size"))}
            />
          </article>
          <div className="stack">
            <article className="card"><DecisionStrip d={phase.decision} subject={subject} /></article>
            <div className="panel"><PolicyPanel policy={task.policy} /></div>
            <div className="panel stack" style={{ gap: 6 }}>
              <div className="eyebrow">Ne oldu</div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--dna-ink-2)" }}>
                {phase.decision.pass
                  ? "Zincirdeki olgular politikanın her kuralını geçti. Tasdik yazılır, DNA kartına gen eklenir; ödül kalıcılık süresi dolunca havuzdan ödenir."
                  : "Görev yapılmış ama kaynak politikayı geçmiyor. Karar olguya dayanır: her gerekçenin yanında kod ve kanıt bağlantısı var."}
              </p>
              <Link href={`/dna/${subject}`} className="mono">DNA kartını aç →</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
