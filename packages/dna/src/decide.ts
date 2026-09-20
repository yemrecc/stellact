import type { Decision, Genome, Policy, PolicyName, Reason } from "./types";

/** Görev politikası şablonları — eşikler projenin, gerekçe bizim. */
export const POLICIES: Record<PolicyName, Policy> = {
  conservative: { name: "conservative", version: "v0.1", min_deposit_tusd: 50, sponsor_cluster_size_gt: 3,  account_age_lt_days: 30, self_payment_ratio_gt: 0.2, distinct_counterparties_lt: 5, position_held_days: 7, min_x402_settlements: 0, query_diversity_lt: 0 },
  balanced:     { name: "balanced",     version: "v0.1", min_deposit_tusd: 50, sponsor_cluster_size_gt: 10, account_age_lt_days: 7,  self_payment_ratio_gt: 0.5, distinct_counterparties_lt: 2, position_held_days: 7, min_x402_settlements: 0, query_diversity_lt: 0 },
  permissive:   { name: "permissive",   version: "v0.1", min_deposit_tusd: 50, sponsor_cluster_size_gt: 10, account_age_lt_days: 0,  self_payment_ratio_gt: 0.8, distinct_counterparties_lt: 0, position_held_days: 0, min_x402_settlements: 0, query_diversity_lt: 0 },
  // Ajan görevi: cüzdan eşikleri kapalı (ajanın Vault pozisyonu olması beklenmez),
  // ölçülen şey ücretli çağrının gerçekliği ve sorgu çeşitliliği.
  agent:        { name: "agent",        version: "v0.1", min_deposit_tusd: 0,  sponsor_cluster_size_gt: 10, account_age_lt_days: 0,  self_payment_ratio_gt: 0.8, distinct_counterparties_lt: 0, position_held_days: 0, min_x402_settlements: 3, query_diversity_lt: 0.5 },
};

/** Gerekçeli karar. Ret asla tek başına kod değil: insan cümlesi + kod + kanıt. */
export function decide(g: Genome, policy: Policy, subject: string, now = new Date()): Decision {
  const reasons: Reason[] = [];
  const passed: Reason[] = [];
  const bal = g.positions.vault_tusd;

  if (policy.min_deposit_tusd > 0) {
    if (bal < policy.min_deposit_tusd)
      reasons.push({ code: `vault_balance_lt_min: ${bal} < ${policy.min_deposit_tusd}`, text: "The deposit is below the threshold", evidence: { kind: "account", ref: subject, label: "account" } });
    else passed.push({ code: `vault_balance=${bal}`, text: `Vault balance is at least ${policy.min_deposit_tusd} TUSD` });
  }

  if (g.graph.sponsor_siblings > policy.sponsor_cluster_size_gt)
    reasons.push({ code: `sponsor_cluster_size=${g.graph.sponsor_siblings} > ${policy.sponsor_cluster_size_gt}`,
      text: `The sponsor that opened this account opened ${g.graph.sponsor_siblings - 1} more; the cluster is ${g.graph.sponsor_siblings} accounts from one source.`,
      evidence: g.origin.sponsor ? { kind: "account", ref: g.origin.sponsor, label: "sponsor account" } : undefined });
  else passed.push({ code: `sponsor_cluster_size=${g.graph.sponsor_siblings} ≤ ${policy.sponsor_cluster_size_gt}`, text: "Sponsor cluster is below the threshold" });

  if (policy.account_age_lt_days > 0 && g.age.days !== null && g.age.days < policy.account_age_lt_days)
    reasons.push({ code: `account_age_lt_days: ${g.age.days.toFixed(2)} < ${policy.account_age_lt_days}`, text: "The account is too new" });

  const total = g.graph.distinct_counterparties + g.graph.self_payments;
  const selfRatio = total ? g.graph.self_payments / total : 0;
  if (selfRatio > policy.self_payment_ratio_gt)
    reasons.push({ code: `self_payment_ratio=${selfRatio.toFixed(2)} > ${policy.self_payment_ratio_gt}`, text: "Most payments go back to the same wallet" });

  if (policy.distinct_counterparties_lt > 0 && g.graph.distinct_counterparties < policy.distinct_counterparties_lt)
    reasons.push({ code: `distinct_counterparties=${g.graph.distinct_counterparties} < ${policy.distinct_counterparties_lt}`, text: "Not enough distinct counterparties" });

  if (policy.position_held_days > 0 && g.positions.held_days < policy.position_held_days)
    reasons.push({ code: `position_held_days=${g.positions.held_days.toFixed(2)} < ${policy.position_held_days}`, text: `The position has not been held for ${policy.position_held_days} days yet` });

  // --- ajan boyutu: ödeme gerçek mi, davranış otomasyon deseni mi ---
  const tx = g.agent.x402_last_tx;
  const txEvidence = tx ? ({ kind: "tx", ref: tx, label: "last payment" } as const) : undefined;

  if (policy.min_x402_settlements > 0) {
    if (g.agent.x402_settlements < policy.min_x402_settlements)
      reasons.push({ code: `x402_settlements=${g.agent.x402_settlements} < ${policy.min_x402_settlements}`,
        text: `The task requires ${policy.min_x402_settlements} paid calls settled on chain`, evidence: txEvidence });
    else passed.push({ code: `x402_settlements=${g.agent.x402_settlements}`, text: "Paid calls are settled on chain", evidence: txEvidence });
  }

  if (policy.query_diversity_lt > 0) {
    const d = g.agent.query_diversity;
    if (d === null)
      reasons.push({ code: "query_diversity=null", text: "There are no paid calls to measure" });
    else if (d < policy.query_diversity_lt)
      reasons.push({ code: `query_diversity=${d.toFixed(2)} < ${policy.query_diversity_lt}`,
        text: `${Math.round((1 - d) * 100)}% of the last ${g.agent.query_diversity_window} calls are the same query repeated — the payment is real, the behaviour is an automation pattern`, evidence: txEvidence });
    else
      passed.push({ code: `query_diversity=${d.toFixed(2)} ≥ ${policy.query_diversity_lt}`, text: "Each call is a distinct question", evidence: txEvidence });
  }

  return { pass: reasons.length === 0, reasons, passed, policy: policy.name, policy_version: policy.version, decided_at: now.toISOString() };
}
