import type { Genome, Sibling, WalletFacts } from "./types";

const daysSince = (iso: string | null, now = Date.now()) => iso ? (now - new Date(iso).getTime()) / 864e5 : null;

/** Olgulardan DNA. Saf fonksiyon — test edilebilir, ağ yok. */
export function computeGenome(w: WalletFacts, siblings: Sibling[], now = Date.now()): Genome {
  const held = w.vault.deposited_at ? Math.max(0, (now / 1000 - w.vault.deposited_at) / 86400) : 0;
  const firsts: string[] = [];
  if (w.vault.balance_tusd >= 50) firsts.push("first:vault.deposit");
  if (w.trustlines.length) firsts.push("first:trustline.created");
  return {
    origin: { created_at: w.created_at, funder: w.funder, sponsor: w.sponsor, account_type: w.id.startsWith("C") ? "C" : "G", starting_balance: w.starting_balance },
    age: { days: daysSince(w.created_at, now), tx: w.tx_count, last_active: w.last_modified_time },
    trustlines: { count: w.trustlines.length, sponsored: w.trustlines.filter(t => t.sponsor).length, codes: w.trustlines.map(t => t.code) },
    positions: { vault_tusd: w.vault.balance_tusd, since: w.vault.deposited_at, held_days: held },
    graph: { distinct_counterparties: w.distinct_counterparties, self_payments: w.self_payments, sponsor_siblings: w.sponsor ? siblings.length : 0 },
    attestations: { poa: 0 },
    agent: { identity_8004: null, x402_settlements: 0, query_diversity: null },
    firsts,
  };
}
