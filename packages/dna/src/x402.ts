import type { AgentFacts, SettlementFact } from "./types";

/**
 * Ajan olgularını satıcının settlement kaydından okur.
 *
 * Neden zincirden değil: RPC'nin olay saklama penceresi ~7 gün, oysa DNA kalıcı.
 * Satıcı her başarılı mutabakatı anında JSONL'e yazıyor (`apps/demo-api`) ve
 * ücretsiz `GET /settlements?payer=G…` ile veriyor. `tx_hash` her satırda duruyor,
 * yani kayıt iddia değil — Horizon'dan bağımsız doğrulanabilir.
 */
export async function readAgentFacts(
  sellerUrl: string,
  payer: string,
  identity_8004: string | null = null,
): Promise<AgentFacts> {
  const r = await fetch(`${sellerUrl.replace(/\/$/, "")}/settlements?payer=${encodeURIComponent(payer)}`);
  if (!r.ok) throw new Error(`Satıcı ${r.status} — ${sellerUrl}/settlements`);
  const { settlements } = (await r.json()) as { settlements: SettlementFact[] };
  return { identity_8004, settlements: settlements ?? [] };
}
