import { readAgentFacts, type AgentFacts, type Policy } from "@stellact/dna";
import { CONFIG } from "@/lib/config";

export const NO_AGENT: AgentFacts = { identity_8004: null, settlements: [], source: "live" };

/** Politikanın ajan boyutuna bakıp bakmadığı. Bakmıyorsa satıcıya hiç gitmeyiz. */
export const needsAgentFacts = (p: Policy) => p.min_x402_settlements > 0 || p.query_diversity_lt > 0;

/**
 * Ajan olguları x402 satıcısının settlement kaydından gelir (ücretsiz, salt-okunur uç).
 * Satıcı kapalıysa DNA'nın kalanı yine okunur — ajan geni boş görünür, sayfa patlamaz.
 */
export async function agentFacts(address: string): Promise<AgentFacts> {
  try { return await readAgentFacts(CONFIG.demo.apiUrl, address); }
  catch { return NO_AGENT; }
}
