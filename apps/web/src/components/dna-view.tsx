"use client";
import { useEffect, useState } from "react";
import { Button } from "@stellar/design-system";
import { computeGenome, readSiblings, readWalletFacts, type Genome, type Sibling, type WalletFacts } from "@stellact/dna";
import { CONFIG, fmtUtc } from "@/lib/config";
import { readVault } from "@/lib/vault";
import { agentFacts } from "@/lib/agent";
import { GenomeCard } from "@/components/dna";

type Loaded = { genome: Genome; siblings: Sibling[]; stamp: string };
type Phase = { status: "loading"; step: string } | ({ status: "ready" } & Loaded) | { status: "error"; message: string };

async function loadDna(address: string, onStep: (s: string) => void): Promise<Loaded> {
  onStep("Vault okunuyor… (RPC)");
  const vault = await readVault(address);
  const agent = await agentFacts(address);
  let facts: WalletFacts;
  if (address.startsWith("C")) {
    facts = { id: address, network: CONFIG.network, sponsor: null, created_at: null, funder: null, starting_balance: null, last_modified_time: null, tx_count: 0, distinct_counterparties: 0, self_payments: 0, trustlines: [], vault: { balance_tusd: vault.balance_tusd, deposited_at: vault.deposited_at }, agent, observed_at: new Date().toISOString() };
  } else {
    onStep("Horizon okunuyor…");
    facts = await readWalletFacts(address, CONFIG.network, { balance_tusd: vault.balance_tusd, deposited_at: vault.deposited_at }, agent);
  }
  const siblings = await readSiblings(facts.sponsor, CONFIG.network);
  return { genome: computeGenome(facts, siblings), siblings, stamp: `Horizon + RPC · canlı · ${fmtUtc(new Date().toISOString())}` };
}

export function DnaView({ address }: { address: string }) {
  const [phase, setPhase] = useState<Phase>({ status: "loading", step: "Vault okunuyor… (RPC)" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    loadDna(address, s => { if (alive) setPhase({ status: "loading", step: s }); })
      .then(r => { if (alive) setPhase({ status: "ready", ...r }); })
      .catch(e => { if (alive) setPhase({ status: "error", message: e instanceof Error ? e.message : String(e) }); });
    return () => { alive = false; };
  }, [address, tick]);

  const reload = () => { setPhase({ status: "loading", step: "Vault okunuyor… (RPC)" }); setTick(t => t + 1); };

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div><div className="eyebrow">DNA kartı</div><h1 className="h1" style={{ fontSize: 22 }}>Zincirde ne yaptığın</h1></div>
        <Button variant="secondary" size="sm" onClick={reload} disabled={phase.status === "loading"}>Zinciri sorgula</Button>
      </div>
      {phase.status === "loading" && <div className="panel progress"><span>{phase.step}</span></div>}
      {phase.status === "error" && <div className="panel"><span className="err">Zincire ulaşılamadı: {phase.message}</span></div>}
      {phase.status === "ready" && (
        <article className="card">
          <GenomeCard address={address} genome={phase.genome} siblings={phase.siblings} stamp={phase.stamp} role={address.startsWith("C") ? "Smart account" : "Cüzdan"} />
          <div className="decision" style={{ borderTopColor: "var(--dna-hair)" }}>
            <div className="stamp">Bu kart: <b>gizli</b> (varsayılan). Paylaşım denetimi ve tasdik geni sonraki sprint. DNA olgudur — skor değil; eşikleri görev sahibi koyar.</div>
          </div>
        </article>
      )}
    </div>
  );
}
