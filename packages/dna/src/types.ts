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
  observed_at: string;
}
export interface Sibling { id: string; created: string | null }

/** 7 boyutlu DNA — olgu, skor değil. */
export interface Genome {
  origin: { created_at: string | null; funder: string | null; sponsor: string | null; account_type: "G" | "C"; starting_balance: string | null };
  age: { days: number | null; tx: number; last_active: string | null };
  trustlines: { count: number; sponsored: number; codes: string[] };
  positions: { vault_tusd: number; since: number | null; held_days: number };
  graph: { distinct_counterparties: number; self_payments: number; sponsor_siblings: number };
  attestations: { poa: number };
  agent: { identity_8004: string | null; x402_settlements: number; query_diversity: number | null };
  firsts: string[];
}

export type PolicyName = "conservative" | "balanced" | "permissive";
export interface Policy {
  name: PolicyName | "custom";
  version: string;
  min_deposit_tusd: number;
  sponsor_cluster_size_gt: number;
  account_age_lt_days: number;
  self_payment_ratio_gt: number;
  distinct_counterparties_lt: number;
  position_held_days: number;
}
export interface Reason { code: string; text: string; evidence?: { kind: "account" | "tx"; ref: string; label: string } }
export interface Decision { pass: boolean; reasons: Reason[]; passed: Reason[]; policy: string; policy_version: string; decided_at: string }
