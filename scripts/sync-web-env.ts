/** Kök .env.local → apps/web/.env.local (yalnız kamuya açık değerler, NEXT_PUBLIC_*). Gizli anahtar taşınmaz. */
import { readFileSync, writeFileSync } from "node:fs";
const root: Record<string, string> = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n")
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const pub: Record<string, string> = {
  NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
  NEXT_PUBLIC_RPC_URL: "https://soroban-testnet.stellar.org",
  NEXT_PUBLIC_HORIZON_URL: "https://horizon-testnet.stellar.org",
  NEXT_PUBLIC_RELAYER_URL: "https://smart-account-relayer-proxy.sdf-ecosystem.workers.dev",
  NEXT_PUBLIC_VAULT_CONTRACT: root.VAULT_CONTRACT,
  NEXT_PUBLIC_TUSD_SAC: root.TUSD_SAC,
  NEXT_PUBLIC_TUSD_ISSUER: root.TUSD_ISSUER,
  NEXT_PUBLIC_ATTEST_CONTRACT: root.ATTEST_OWN_CONTRACT,
  NEXT_PUBLIC_POA_SCHEMA: root.ATTEST_OWN_SCHEMA_POA,
  NEXT_PUBLIC_READ_SOURCE: root.DEPLOYER_PUBLIC,      // salt-okuma simülasyonları için kaynak hesap
  NEXT_PUBLIC_DEMO_GENUINE: root.DEPLOYER_PUBLIC,
  NEXT_PUBLIC_DEMO_SCRIPT: root.SYBIL_SCRIPT,
  NEXT_PUBLIC_DEMO_SPONSOR: root.SYBIL_SPONSOR,
  NEXT_PUBLIC_DEMO_SMART_ACCOUNT: root.SA_CONTRACT,
};
const missing = Object.entries(pub).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) { console.error("Eksik:", missing.join(", ")); process.exit(1); }
writeFileSync("apps/web/.env.local", Object.entries(pub).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
console.log(`apps/web/.env.local yazıldı (${Object.keys(pub).length} anahtar)`);
