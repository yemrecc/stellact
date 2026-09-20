import type { Decision, Genome, Policy, PolicyName, Reason } from "./types";

/** Görev politikası şablonları — eşikler projenin, gerekçe bizim. */
export const POLICIES: Record<PolicyName, Policy> = {
  conservative: { name: "conservative", version: "v0.1", min_deposit_tusd: 50, sponsor_cluster_size_gt: 3,  account_age_lt_days: 30, self_payment_ratio_gt: 0.2, distinct_counterparties_lt: 5, position_held_days: 7 },
  balanced:     { name: "balanced",     version: "v0.1", min_deposit_tusd: 50, sponsor_cluster_size_gt: 10, account_age_lt_days: 7,  self_payment_ratio_gt: 0.5, distinct_counterparties_lt: 2, position_held_days: 7 },
  permissive:   { name: "permissive",   version: "v0.1", min_deposit_tusd: 50, sponsor_cluster_size_gt: 10, account_age_lt_days: 0,  self_payment_ratio_gt: 0.8, distinct_counterparties_lt: 0, position_held_days: 0 },
};

/** Gerekçeli karar. Ret asla tek başına kod değil: insan cümlesi + kod + kanıt. */
export function decide(g: Genome, policy: Policy, subject: string, now = new Date()): Decision {
  const reasons: Reason[] = [];
  const passed: Reason[] = [];
  const bal = g.positions.vault_tusd;

  if (bal < policy.min_deposit_tusd)
    reasons.push({ code: `vault_balance_lt_min: ${bal} < ${policy.min_deposit_tusd}`, text: "Yatırım eşiğin altında", evidence: { kind: "account", ref: subject, label: "hesap" } });
  else passed.push({ code: `vault_balance=${bal}`, text: `Vault bakiyesi ≥ ${policy.min_deposit_tusd} TUSD` });

  if (g.graph.sponsor_siblings > policy.sponsor_cluster_size_gt)
    reasons.push({ code: `sponsor_cluster_size=${g.graph.sponsor_siblings} > ${policy.sponsor_cluster_size_gt}`,
      text: `Bu hesabı açan sponsor aynı anda ${g.graph.sponsor_siblings} hesap daha açmış — tek kaynaktan çoğaltılmış cüzdan deseni`,
      evidence: g.origin.sponsor ? { kind: "account", ref: g.origin.sponsor, label: "sponsor hesabı" } : undefined });
  else passed.push({ code: `sponsor_cluster_size=${g.graph.sponsor_siblings} ≤ ${policy.sponsor_cluster_size_gt}`, text: "Sponsor kümesi eşiğin altında" });

  if (policy.account_age_lt_days > 0 && g.age.days !== null && g.age.days < policy.account_age_lt_days)
    reasons.push({ code: `account_age_lt_days: ${g.age.days.toFixed(2)} < ${policy.account_age_lt_days}`, text: "Hesap çok yeni" });

  const total = g.graph.distinct_counterparties + g.graph.self_payments;
  const selfRatio = total ? g.graph.self_payments / total : 0;
  if (selfRatio > policy.self_payment_ratio_gt)
    reasons.push({ code: `self_payment_ratio=${selfRatio.toFixed(2)} > ${policy.self_payment_ratio_gt}`, text: "Ödemelerin çoğu kendine" });

  if (policy.distinct_counterparties_lt > 0 && g.graph.distinct_counterparties < policy.distinct_counterparties_lt)
    reasons.push({ code: `distinct_counterparties=${g.graph.distinct_counterparties} < ${policy.distinct_counterparties_lt}`, text: "Yeterli ayrı karşı taraf yok" });

  if (policy.position_held_days > 0 && g.positions.held_days < policy.position_held_days)
    reasons.push({ code: `position_held_days=${g.positions.held_days.toFixed(2)} < ${policy.position_held_days}`, text: `Pozisyon henüz ${policy.position_held_days} gün tutulmadı` });

  return { pass: reasons.length === 0, reasons, passed, policy: policy.name, policy_version: policy.version, decided_at: now.toISOString() };
}
