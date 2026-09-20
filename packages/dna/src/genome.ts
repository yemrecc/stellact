import type { Genome, Sibling, WalletFacts } from "./types";

const daysSince = (iso: string | null, now = Date.now()) => iso ? (now - new Date(iso).getTime()) / 864e5 : null;

/**
 * Kaç ödeme geriye bakılır. Çeşitlilik ömür boyu değil **yakın davranış** ölçüsüdür:
 * bir yıl düzgün çalışıp sonra spam'e dönen ajan, ömür boyu ortalamanın arkasına saklanamasın.
 */
export const DIVERSITY_WINDOW = 10;

/**
 * Ajan genleri. `query_diversity` = son `window` ödemedeki ayrı (uç nokta + parametre)
 * sayısı / o penceredeki ödeme sayısı. Ajan farklı şeyler sorar (→ ~1.00), script aynı şeyi
 * tekrarlar (→ 1/n). Ölçülen davranış, ödeme değil: ikisi de gerçekten ödüyor.
 */
function agentGenes(w: WalletFacts, window: number): Genome["agent"] {
  const all = w.agent.settlements;
  const recent = all.slice(-window);
  const distinct = new Set(recent.map(x => `${x.endpoint}:${x.params_hash}`)).size;
  return {
    identity_8004: w.agent.identity_8004,
    x402_settlements: all.length,
    query_diversity: recent.length ? distinct / recent.length : null,
    query_diversity_window: window,
    x402_last_tx: all.length ? all[all.length - 1].tx_hash : null,
  };
}

/** Olgulardan DNA. Saf fonksiyon — test edilebilir, ağ yok. */
export function computeGenome(w: WalletFacts, siblings: Sibling[], now = Date.now(), diversityWindow = DIVERSITY_WINDOW): Genome {
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
    agent: agentGenes(w, diversityWindow),
    firsts,
  };
}
