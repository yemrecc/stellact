import type { Sibling, VaultPosition, WalletFacts } from "./types";

const HORIZON: Record<"testnet" | "mainnet", string> = { testnet: "https://horizon-testnet.stellar.org", mainnet: "https://horizon.stellar.org" };

async function j(u: string) { const r = await fetch(u); if (!r.ok) throw new Error(`Horizon ${r.status} ${u}`); return r.json(); }

/** Horizon'dan bir hesabın DNA olgularını okur. Vault pozisyonu dışarıdan verilir (RPC). */
export async function readWalletFacts(id: string, network: "testnet" | "mainnet", vault: VaultPosition = { balance_tusd: 0, deposited_at: null }): Promise<WalletFacts> {
  const H = HORIZON[network];
  const [acc, ops, pays, txs] = await Promise.all([
    j(`${H}/accounts/${id}`),
    j(`${H}/accounts/${id}/operations?order=asc&limit=1`),
    j(`${H}/accounts/${id}/payments?limit=200`),
    j(`${H}/accounts/${id}/transactions?limit=200`),
  ]);
  const first = ops._embedded.records[0] ?? {};
  const cps = new Set<string>(); let self = 0;
  for (const p of pays._embedded.records) { const o = p.from === id ? p.to : p.from; if (!o) continue; if (o === id) self++; else cps.add(o); }
  return {
    id, network,
    sponsor: acc.sponsor ?? null,
    created_at: first.created_at ?? null,
    funder: first.funder ?? first.source_account ?? null,
    starting_balance: first.starting_balance ?? null,
    last_modified_time: acc.last_modified_time ?? null,
    tx_count: txs._embedded.records.length,
    distinct_counterparties: cps.size,
    self_payments: self,
    trustlines: acc.balances.filter((b: any) => b.asset_type !== "native").map((b: any) => ({ code: b.asset_code, issuer: b.asset_issuer, balance: b.balance, sponsor: b.sponsor ?? null })),
    vault,
    observed_at: new Date().toISOString(),
  };
}

/** Aynı sponsorun açtığı hesaplar — Sybil kümesinin yapılandırılmış kaynağı. */
export async function readSiblings(sponsor: string | null, network: "testnet" | "mainnet"): Promise<Sibling[]> {
  if (!sponsor) return [];
  const p = await j(`${HORIZON[network]}/accounts?sponsor=${sponsor}&limit=200`);
  return p._embedded.records.map((r: any) => ({ id: r.id, created: r.last_modified_time ?? null }));
}
