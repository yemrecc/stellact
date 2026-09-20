# STELLACT

**Your actions become your identity. · Proof of Real Use on Stellar.**

Projects define tasks. Wallets and AI agents do them. STELLACT reads the chain,
decides *passed* or *rejected* with a reason and a link to the evidence, and writes
what passed as an on-chain attestation plus a gene on the wallet's DNA card.

Running on Stellar **testnet**. This is a hackathon build, not a production system.

---

## Why the decision is hard to fake

A Sybil script and a real user can perform the same action. What separates them is
not the action but its **origin** and the **behaviour around it** — and on Stellar both
are structured ledger fields, not inferences:

- **Origin.** `BeginSponsoringFutureReserves` means the sponsor is a real column in the
  ledger, so `GET /accounts?sponsor=…` returns the cluster directly. A wallet funded by a
  sponsor that opened 40 others in one batch is visible without heuristics.
- **Behaviour.** An agent that pays for three API calls via x402 is indistinguishable from a
  script that pays for the same call three times — until you look at *what* was asked.
  `query_diversity` is distinct endpoints ÷ total queries over the last N settled payments.

Both wallets below genuinely paid. Only one passes:

```
AGENT    6 settlements  diversity 0.83 (last 10)  → PASSED
SCRIPT   6 settlements  diversity 0.17 (last 10)  → REJECTED
   ✕ sponsor_cluster_size=41 > 10     evidence: sponsor account GBO35QUV…
   ✕ query_diversity=0.17 < 0.5       evidence: last payment 868b1f97…
```

---

## Quick start (testnet)

```bash
pnpm install
pnpm setup:testnet        # keys, friendbot, USDC trustlines → .env.local (idempotent)
pnpm setup:asset          # TUSD test asset + SAC (Circle's faucet has a captcha)
pnpm attest:bootstrap     # schemas + BLS key + a delegated attestation on our own Attest instance
pnpm setup:sybil          # a sponsored cluster of 41 siblings — real data behind the rejection screen

pnpm web:env              # root .env.local → apps/web/.env.local (NEXT_PUBLIC_* only)
pnpm web:dev              # http://localhost:3000
pnpm api:dev              # x402 seller on :3001 (the agent screens read its settlement log)
```

`.env.local` is gitignored and holds every secret and live contract id. If it is lost, or
testnet resets, re-run the four setup commands above in order.

**Checks**

```bash
pnpm typecheck            # packages, scripts and the demo API
pnpm web:e2e              # 8 scenarios in headless Chrome (system Chrome, no download)
pnpm contracts:test       # Vault unit tests
pnpm dna:smoke            # two wallets, one task, two decisions
pnpm agent:x402           # agent vs script, real payments, real verdict
```

`pnpm web:e2e` needs `pnpm web:dev` running, and the agent scenario also needs `pnpm api:dev`.

---

## Routes

| Route | What it does |
|---|---|
| `/` | Passkey sign-in — no seed phrase, no gas |
| `/tasks` · `/tasks/[id]` | Task list and detail, with the policy table |
| `/tasks/[id]/result/[subject]` | **The decision** — verdict, reasons, evidence, lineage |
| `/dna/[address]` | The DNA card: 7 genes, every fact linked to the chain |
| `/index` | Verified Usage Index — distinct real users, not TVL |

---

## Layout

| Path | What lives there |
|---|---|
| `apps/web` | Next.js 16 (App Router). The decision screen reads Horizon and Soroban RPC live |
| `apps/demo-api` | x402 seller: three TUSD-priced routes, its own in-process facilitator |
| `packages/dna` | `computeGenome` (7 genes) · `decide` (4 policy templates) · Horizon and seller readers. Pure, no framework |
| `packages/stellar` | Network config and verified constants (USDC, Attest, 8004, SAK, Blend) |
| `packages/bindings/*` | `stellar contract bindings typescript` output for Attest and ERC-8004 |
| `contracts/vault` | Soroban Vault — `deposit` / `withdraw` / `balance` / `deposited_at` |
| `scripts/` | Testnet setup, smoke tests, the x402 agent, the e2e runner |

`packages/dna` is the whole product in one place: the genome is a set of facts, the policy is
a set of thresholds someone else chose, and `decide()` is the only thing that joins them.
The web app and the scripts call the same function, so a rejection reads identically in both.

---

## Notable pieces

- **Passkey wallets.** `smart-account-kit` with WebAuthn. `pnpm smart:smoke` proves the whole
  flow headlessly by plugging a Node P-256 software authenticator into the kit's `webAuthn` hook —
  the only difference in a browser is that the authenticator is real.
- **Attestations.** Attest Protocol v2, our own deployed instance, BLS12-381 delegated
  attestations so the user never signs the attestation about themselves.
- **x402 with no XLM.** The seller runs its own in-process facilitator, which both submits the
  transaction and pays for it via fee bump. The paying agent needs no XLM at all —
  on chain, `source_account = fee_account = facilitator`.

## Two traps worth remembering

1. **`NEXT_PUBLIC_*` must be read as a literal.** `process.env[k]` works on the server and is
   `undefined` in the browser bundle. `src/lib/config.ts` spells out every variable for this reason.
2. **Kill the dev API by port, not by pattern.** `pkill -f 'demo-api/src/server'` matches nothing,
   because the process cwd is `apps/demo-api` and its command line only says `src/server.ts`.
   Use `kill $(lsof -nP -tiTCP:3001 -sTCP:LISTEN)`. A stale server will mislead you for hours.

## Not built yet

MCP server (agents take tasks over MCP), ERC-8004 registration, the project panel,
and writing attestations from the browser. The task steps say so on screen rather than
offering buttons that do nothing.
