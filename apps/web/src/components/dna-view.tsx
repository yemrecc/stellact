"use client";
import { useEffect, useState } from "react";
import { computeGenome, readSiblings, readWalletFacts, type Genome, type SettlementFact, type Sibling, type WalletFacts } from "@stellact/dna";
import { CONFIG, fmtUtc } from "@/lib/config";
import { readVault } from "@/lib/vault";
import { agentFacts } from "@/lib/agent";
import { GenomeCard, Lineage } from "@/components/dna";
import { AddressLink, Badge, NetBadge, Src } from "@/components/ui";

type Loaded = { genome: Genome; siblings: Sibling[]; settlements: SettlementFact[]; stamp: React.ReactNode };
type Phase = { status: "loading"; step: string } | ({ status: "ready" } & Loaded) | { status: "error"; message: string };

const FIRST_STEP = "Reading the Vault… (RPC)";

async function loadDna(address: string, onStep: (s: string) => void): Promise<Loaded> {
  onStep(FIRST_STEP);
  const vault = await readVault(address);
  const agent = await agentFacts(address);
  let facts: WalletFacts;
  if (address.startsWith("C")) {
    facts = { id: address, network: CONFIG.network, sponsor: null, created_at: null, funder: null, starting_balance: null, last_modified_time: null, tx_count: 0, distinct_counterparties: 0, self_payments: 0, trustlines: [], vault: { balance_tusd: vault.balance_tusd, deposited_at: vault.deposited_at }, agent, observed_at: new Date().toISOString() };
  } else {
    onStep("Reading Horizon…");
    facts = await readWalletFacts(address, CONFIG.network, { balance_tusd: vault.balance_tusd, deposited_at: vault.deposited_at }, agent);
  }
  const siblings = await readSiblings(facts.sponsor, CONFIG.network);
  const now = new Date().toISOString();
  return { genome: computeGenome(facts, siblings), siblings, settlements: agent.settlements, stamp: <Src label={`Horizon + RPC · live · ${fmtUtc(now)}`} /> };
}

export function DnaView({ address }: { address: string }) {
  const [phase, setPhase] = useState<Phase>({ status: "loading", step: FIRST_STEP });
  const [tick, setTick] = useState(0);
  /** Kart varsayılan olarak gizli. Paylaşım kullanıcının kararı — Index'e bireysel cüzdan hiç girmez. */
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let alive = true;
    loadDna(address, s => { if (alive) setPhase({ status: "loading", step: s }); })
      .then(r => { if (alive) setPhase({ status: "ready", ...r }); })
      .catch(e => { if (alive) setPhase({ status: "error", message: e instanceof Error ? e.message : String(e) }); });
    return () => { alive = false; };
  }, [address, tick]);

  const reload = () => { setPhase({ status: "loading", step: FIRST_STEP }); setTick(t => t + 1); };
  const isAgent = phase.status === "ready" && phase.genome.agent.x402_settlements > 0;
  const role = address.startsWith("C") ? "Smart account" : isAgent ? "Agent" : "User";

  return (
    <div className="stack stack--lg">
      <div className="split">
        <div className="row" style={{ gap: 10 }}>
          <Badge kind="solid">{role}</Badge>
          <NetBadge />
          {isAgent ? <Badge>MCP · x402</Badge> : null}
        </div>
        <div className="row">
          {phase.status === "ready" ? <span className="srcs">{phase.stamp}</span> : null}
          <button className="btn btn--sm" onClick={reload} disabled={phase.status === "loading"}>Query the chain</button>
        </div>
      </div>

      <AddressLink address={address} kind={address.startsWith("C") ? "contract" : "account"} full />

      <div className="row hair-top">
        <span className="note">This card:</span>
        <span className="seg">
          <button aria-pressed={!shared} onClick={() => setShared(false)}>Private</button>
          <button aria-pressed={shared} onClick={() => setShared(true)}>Public</button>
        </span>
        <span className="note">
          {shared
            ? "Public: anyone with the link can see this card. No individual wallet ever enters the Index."
            : "Private: only you can see this card. No individual wallet ever enters the Index."}
        </span>
      </div>

      {phase.status === "loading" && <div className="panel progress"><span>{phase.step}</span></div>}
      {phase.status === "error" && <div className="panel"><span className="err">Horizon unreachable — {phase.message}</span></div>}

      {phase.status === "ready" && (
        <>
          <GenomeCard address={address} genome={phase.genome} siblings={phase.siblings} settlements={phase.settlements} stamp={phase.stamp} role={role} />
          {phase.genome.origin.sponsor && phase.siblings.length > 1 ? (
            <Lineage sponsor={phase.genome.origin.sponsor} siblings={phase.siblings} address={address} />
          ) : null}
          <p className="note">
            DNA is a fact, not a score — the thresholds belong to whoever sets the task. Sharing is off by default and attestation writing from the web lands in the next sprint.
          </p>
        </>
      )}
    </div>
  );
}
