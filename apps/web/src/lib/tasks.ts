import { POLICIES, type Policy } from "@stellact/dna";

export type VerifierClass = "A" | "B" | "C";
export interface Task {
  id: string;
  project: { id: string; name: string };
  title: string;
  action: "vault.deposit" | "position.held" | "trustline.created" | "x402.settled";
  verifierClass: VerifierClass;
  params: { min_tusd?: number; days?: number };
  policy: Policy;
  reward: { amount_tusd: number; persistence_days: number };
  max_claims: number;
  ends_at: string;
  description: string;
}

export const CLASS_LABEL: Record<VerifierClass, string> = {
  A: "kontrattan okunur, güven gerekmez",
  B: "geçmişten okunur, doğrulayıcı imzalar",
  C: "anchor onaylar",
};

/** v1: statik görevler. Görev motoru (DB + proje paneli) sonraki sprint. */
export const TASKS: Task[] = [
  {
    id: "vault-50",
    project: { id: "sava-demo", name: "Sava (demo)" },
    title: "Vault'a en az 50 TUSD yatır",
    action: "vault.deposit",
    verifierClass: "A",
    params: { min_tusd: 50 },
    policy: POLICIES.permissive,
    reward: { amount_tusd: 10, persistence_days: 7 },
    max_claims: 100,
    ends_at: "2026-10-31T00:00:00Z",
    description: "Tasarruf uygulaması Sava, gerçek kullanıcı arıyor. Vault'a yatır; 7 gün tutunca ödül havuzdan ödenir.",
  },
];

export const findTask = (id: string) => TASKS.find(t => t.id === id) ?? null;
