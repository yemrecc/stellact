import { POLICIES, type Policy } from "@stellact/dna";

export type VerifierClass = "A" | "B" | "C";
/** Kim yapar: insan cüzdanı tarayıcıdan, ajan MCP üzerinden. */
export type Actor = "human" | "agent";
export interface Task {
  id: string;
  project: { id: string; name: string };
  title: string;
  action: "vault.deposit" | "position.held" | "trustline.created" | "x402.settled";
  verifierClass: VerifierClass;
  actor: Actor;
  params: { min_tusd?: number; days?: number; queries?: number };
  policy: Policy;
  reward: { amount_tusd: number; persistence_days: number };
  max_claims: number;
  claimed: number;
  ends_at: string;
  description: string;
}

export const CLASS_LABEL: Record<VerifierClass, string> = {
  A: "read from the contract, no trust needed",
  B: "read from history, signed by the validator",
  C: "approved by an anchor",
};

/** v1: statik görevler. Görev motoru (DB + proje paneli) sonraki sprint. */
export const TASKS: Task[] = [
  {
    id: "vault-50",
    project: { id: "sava-demo", name: "Sava (demo)" },
    title: "Deposit at least 50 TUSD into the Vault",
    action: "vault.deposit",
    verifierClass: "A",
    actor: "human",
    params: { min_tusd: 50 },
    policy: POLICIES.permissive,
    reward: { amount_tusd: 10, persistence_days: 7 },
    max_claims: 100,
    claimed: 3,
    ends_at: "2026-10-31T00:00:00Z",
    description: "Sava, a savings app, is looking for real users. Deposit into the Vault; hold it for 7 days and the reward is paid from the pool.",
  },
  {
    id: "x402-diversity",
    project: { id: "sava-demo", name: "Sava (demo)" },
    title: "Pay for 3 different queries on the demo API via x402",
    action: "x402.settled",
    verifierClass: "B",
    actor: "agent",
    params: { queries: 3 },
    policy: POLICIES.agent,
    reward: { amount_tusd: 5, persistence_days: 0 },
    max_claims: 50,
    claimed: 2,
    ends_at: "2026-10-31T00:00:00Z",
    description: "An agent task. Paying is not enough — the queries have to differ. A script that repeats one query pays just as much and is still rejected.",
  },
];

export const findTask = (id: string) => TASKS.find(t => t.id === id) ?? null;
