/** Zincirden okunan ham olgular — bir cüzdan için. Kaynak: Horizon (+ Vault için RPC). */
export interface Trustline { code: string; issuer: string; balance: string; sponsor: string | null }
export interface VaultPosition { balance_tusd: number; deposited_at: number | null; tx?: string | null }
export interface WalletFacts {
  id: string;
  network: "testnet" | "mainnet";
  sponsor: string | null;
  created_at: string | null;
  funder: string | null;
  starting_balance: string | null;
  last_modified_time: string | null;
  tx_count: number;
  distinct_counterparties: number;
  self_payments: number;
  trustlines: Trustline[];
  vault: VaultPosition;
  agent: AgentFacts;
  observed_at: string;
}
export interface Sibling { id: string; created: string | null }

/** Satıcının kaydettiği tek bir x402 mutabakatı. `tx_hash` bunu Horizon'dan doğrulanabilir kılar. */
export interface SettlementFact { ts: string; endpoint: string; params_hash: string; tx_hash: string; amount: string }
/** Ajan olguları — cüzdanın Horizon'da görünmeyen, ajan olarak yaptıkları. */
export interface AgentFacts {
  identity_8004: string | null;
  settlements: SettlementFact[];
  /** Canlı satıcıdan mı, gömülü kayıttan mı geldiği. Arayüz ikisini aynı göstermez. */
  source?: "live" | "snapshot";
}

/** 7 boyutlu DNA — olgu, skor değil. */
export interface Genome {
  origin: { created_at: string | null; funder: string | null; sponsor: string | null; account_type: "G" | "C"; starting_balance: string | null };
  age: { days: number | null; tx: number; last_active: string | null };
  trustlines: { count: number; sponsored: number; codes: string[] };
  positions: { vault_tusd: number; since: number | null; held_days: number };
  graph: { distinct_counterparties: number; self_payments: number; sponsor_siblings: number };
  attestations: { poa: number };
  agent: {
    identity_8004: string | null;
    /** Toplam mutabık ücretli çağrı. */
    x402_settlements: number;
    /** Son `query_diversity_window` ödemede ayrı sorgu oranı. Olgu kendi penceresini taşır. */
    query_diversity: number | null;
    query_diversity_window: number;
    x402_last_tx: string | null;
  };
  firsts: string[];
}

export type PolicyName = "conservative" | "balanced" | "permissive" | "agent";
export interface Policy {
  name: PolicyName | "custom";
  version: string;
  min_deposit_tusd: number;
  sponsor_cluster_size_gt: number;
  account_age_lt_days: number;
  self_payment_ratio_gt: number;
  distinct_counterparties_lt: number;
  position_held_days: number;
  /** 0 = kontrol kapalı. Ajan görevleri için; cüzdan görevlerinde 0. */
  min_x402_settlements: number;
  /** 0 = kontrol kapalı. Ayrı sorgu / toplam sorgu oranının alt sınırı. */
  query_diversity_lt: number;
}
export interface Reason { code: string; text: string; evidence?: { kind: "account" | "tx"; ref: string; label: string } }
export interface Decision { pass: boolean; reasons: Reason[]; passed: Reason[]; policy: string; policy_version: string; decided_at: string }
