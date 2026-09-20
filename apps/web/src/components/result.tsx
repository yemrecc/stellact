"use client";
/** Karar ekranı — zinciri canlı okur, politikayı uygular, gerekçeyi kanıtla gösterir. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { computeGenome, decide, readSiblings, readWalletFacts, type Decision, type Genome, type Policy, type SettlementFact, type Sibling, type WalletFacts } from "@stellact/dna";
import { CONFIG, fmtUtc } from "@/lib/config";
import { readVault } from "@/lib/vault";
import { NO_AGENT, agentFacts, needsAgentFacts } from "@/lib/agent";
import { DecisionStrip, GenomeCard, Lineage, PolicyPanel } from "@/components/dna";
import { Badge, ClassBadge, Src } from "@/components/ui";
import { CLASS_LABEL, type Task } from "@/lib/tasks";

type Loaded = { genome: Genome; siblings: Sibling[]; settlements: SettlementFact[]; settlementSource: "live" | "snapshot"; decision: Decision; stamp: React.ReactNode };
type Phase = { status: "loading"; step: string } | ({ status: "ready" } & Loaded) | { status: "error"; message: string };

const FIRST_STEP = "Reading the Vault… (Soroban RPC)";

/** Veri yükleme — saf async; setState yok. Adımlar onStep ile bildirilir (react.dev "fetching data" kalıbı). */
async function loadResult(subject: string, policy: Policy, onStep: (s: string) => void): Promise<Loaded> {
  onStep(FIRST_STEP);
  const vault = await readVault(subject);
  const agent = needsAgentFacts(policy) ? await agentFacts(subject) : NO_AGENT;
  let facts: WalletFacts;
  if (subject.startsWith("C")) {
    // Smart account: Horizon'da klasik hesap kaydı yok — köken/yaş genleri şimdilik boş, pozisyon RPC'den.
    facts = { id: subject, network: CONFIG.network, sponsor: null, created_at: null, funder: null, starting_balance: null, last_modified_time: null,
      tx_count: 0, distinct_counterparties: 0, self_payments: 0, trustlines: [], vault: { balance_tusd: vault.balance_tusd, deposited_at: vault.deposited_at }, agent, observed_at: new Date().toISOString() };
  } else {
    onStep("Reading Horizon… origin, trustlines, counterparties");
    facts = await readWalletFacts(subject, CONFIG.network, { balance_tusd: vault.balance_tusd, deposited_at: vault.deposited_at }, agent);
  }
  onStep(facts.sponsor ? "Reading the sponsor cluster…" : "Deciding…");
  const siblings = await readSiblings(facts.sponsor, CONFIG.network);
  const genome = computeGenome(facts, siblings);
  const decision = decide(genome, policy, subject);
  const now = new Date().toISOString();
  return {
    genome, siblings, decision, settlements: agent.settlements, settlementSource: agent.source ?? "live",
    stamp: <><Src label={`Horizon · live · ${fmtUtc(now)}`} /><Src label={`Vault · RPC · ${fmtUtc(now)}`} /></>,
  };
}

export function Result({ task, subject }: { task: Task; subject: string }) {
  const [phase, setPhase] = useState<Phase>({ status: "loading", step: FIRST_STEP });
  const [tick, setTick] = useState(0); // "yeniden sorgula" tetikleyicisi

  useEffect(() => {
    let alive = true;
    loadResult(subject, task.policy, s => { if (alive) setPhase({ status: "loading", step: s }); })
      .then(r => { if (alive) setPhase({ status: "ready", ...r }); })
      .catch(e => { if (alive) setPhase({ status: "error", message: e instanceof Error ? e.message : String(e) }); });
    return () => { alive = false; };
  }, [subject, task.policy, tick]);

  const reload = () => { setPhase({ status: "loading", step: FIRST_STEP }); setTick(t => t + 1); };
  const clusterReason = phase.status === "ready" && phase.decision.reasons.some(r => r.code.startsWith("sponsor_cluster_size"));

  return (
    <div className="stack stack--lg">
      <div className="split">
        <div className="row" style={{ gap: 12 }}>
          <span className="eyebrow">{task.project.name}</span>
          <span style={{ font: "600 15px var(--dna-sans)" }}>{task.title}</span>
          <span className="stamp">validator <span className="mono">{task.action}</span></span>
          <ClassBadge klass={task.verifierClass} />
          <span className="note">{CLASS_LABEL[task.verifierClass]}</span>
        </div>
        <Link href={`/tasks/${task.id}`} className="note" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>← Back to task</Link>
      </div>

      <div className="split">
        <h1 className="h1" style={{ fontSize: "clamp(26px,2.6vw,36px)" }}>Decision</h1>
        <div className="row">
          {phase.status === "ready" ? <span className="srcs">{phase.stamp}</span> : null}
          <button className="btn btn--sm" onClick={reload} disabled={phase.status === "loading"}>Query the chain</button>
        </div>
      </div>

      {phase.status === "loading" && (
        <div className="panel progress">
          <span>{phase.step}</span>
          <span className="stamp">Not a spinner — the step names the source being read.</span>
        </div>
      )}
      {phase.status === "error" && (
        <div className="panel stack" role="alert">
          <span className="err">Horizon unreachable — {phase.message}</span>
          <span className="stamp">Horizon or the RPC may be briefly unavailable; query again.</span>
        </div>
      )}

      {phase.status === "ready" && (
        <div className="stack stack--lg">
          <DecisionStrip d={phase.decision} subject={subject} />

          <div className="cols">
            {clusterReason && phase.genome.origin.sponsor ? (
              <Lineage sponsor={phase.genome.origin.sponsor} siblings={phase.siblings} address={subject} />
            ) : (
              <div className="panel stack">
                <span className="h2" style={{ fontSize: 18 }}>What the chain shows</span>
                <p className="note" style={{ margin: 0 }}>
                  {phase.decision.pass
                    ? "The facts on chain cleared every rule in the policy. An attestation is written, a gene is added to the DNA card, and the reward is paid from the pool once the holding period is over."
                    : "The task action itself may be real; the decision is about the source and the behaviour around it. Every reason carries its code and a link to the evidence."}
                </p>
                <Link href={`/dna/${subject}`} className="note" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Open the DNA card →</Link>
              </div>
            )}

            <div className="stack">
              <div className="panel"><PolicyPanel policy={task.policy} genome={phase.genome} /></div>
              <div className="panel stack">
                <span className="eyebrow">Flag on the DNA card</span>
                <div className="row" style={{ gap: 8 }}>
                  <span className="stamp">counterparty · graph</span>
                  {phase.genome.graph.sponsor_siblings > 10 ? <Badge kind="rejected">{phase.genome.graph.sponsor_siblings} siblings</Badge> : <Badge>clean</Badge>}
                </div>
                <p className="note" style={{ margin: 0 }}>
                  The decision is made in this strip, not on the card; the card carries the fact.
                </p>
              </div>
            </div>
          </div>

          <article className="stack">
            <GenomeCard
              address={subject}
              genome={phase.genome}
              siblings={phase.siblings}
              settlements={phase.settlements}
              settlementSource={phase.settlementSource}
              stamp={phase.stamp}
              role={subject.startsWith("C") ? "Smart account" : phase.genome.agent.x402_settlements > 0 ? "Agent" : phase.genome.graph.sponsor_siblings > 10 ? "Script" : "User"}
            />
          </article>
        </div>
      )}
    </div>
  );
}
