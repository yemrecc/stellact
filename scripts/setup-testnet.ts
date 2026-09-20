/**
 * Hafta 1 / Gün 1 — testnet hesap kurulumu (idempotent; testnet sıfırlanınca tekrar çalıştır).
 *  1. Anahtarları üret ya da .env.local'dan oku
 *  2. Friendbot ile fonla
 *  3. USDC trustline (REWARD_POOL, X402_RECIPIENT, AGENT)
 *  4. .env.local yaz; elle yapılacak adımları listele (Circle faucet, OZ key)
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Asset, BASE_FEE, Horizon, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const HORIZON = process.env.TESTNET_HORIZON ?? "https://horizon-testnet.stellar.org";
const FRIENDBOT = "https://friendbot.stellar.org";
const USDC_ISSUER = process.env.USDC_TESTNET_ISSUER ?? "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC = new Asset("USDC", USDC_ISSUER);
const ENV_LOCAL = ".env.local";

// X402_FACILITATOR: kendi x402 facilitator'ımızın imzalayıcısı — işlemi gönderir ve
// fee-bump ile ücreti öder, böylece ödeyen ajanın XLM'i olmasına gerek kalmaz.
// Yalnız XLM tutar; ödeme varlığında trustline'a ihtiyacı yok.
const ROLES = ["DEPLOYER", "VERIFIER", "REWARD_POOL", "X402_RECIPIENT", "AGENT", "X402_FACILITATOR"] as const;
const NEEDS_USDC: readonly (typeof ROLES)[number][] = ["REWARD_POOL", "X402_RECIPIENT", "AGENT"];

const horizon = new Horizon.Server(HORIZON);

function loadLocal(): Record<string, string> {
  if (!existsSync(ENV_LOCAL)) return {};
  return Object.fromEntries(
    readFileSync(ENV_LOCAL, "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
}

async function fund(pub: string) {
  const r = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(pub)}`);
  if (r.ok) return "funded";
  const txt = await r.text();
  if (txt.includes("createAccountAlreadyExist") || r.status === 400) return "exists";
  throw new Error(`friendbot ${r.status}: ${txt.slice(0, 200)}`);
}

async function hasTrustline(pub: string) {
  const acc = await horizon.loadAccount(pub);
  return acc.balances.some(b => "asset_code" in b && b.asset_code === "USDC" && (b as any).asset_issuer === USDC_ISSUER);
}

async function addTrustline(kp: Keypair) {
  const acc = await horizon.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(60).build();
  tx.sign(kp);
  await horizon.submitTransaction(tx);
}

async function main() {
  const local = loadLocal();
  const out: Record<string, string> = { ...local };
  const kps: Record<string, Keypair> = {};

  for (const role of ROLES) {
    const key = `${role}_SECRET`;
    const kp = local[key] ? Keypair.fromSecret(local[key]) : Keypair.random();
    kps[role] = kp; out[key] = kp.secret(); out[`${role}_PUBLIC`] = kp.publicKey();
    const status = await fund(kp.publicKey());
    console.log(`${role.padEnd(15)} ${kp.publicKey()}  ${status}`);
  }

  for (const role of NEEDS_USDC) {
    const kp = kps[role];
    if (await hasTrustline(kp.publicKey())) { console.log(`${role.padEnd(15)} USDC trustline var`); continue; }
    await addTrustline(kp);
    console.log(`${role.padEnd(15)} USDC trustline eklendi`);
  }

  writeFileSync(ENV_LOCAL, Object.entries(out).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  console.log(`\n.env.local yazıldı (${Object.keys(out).length} anahtar).`);
  console.log(`\nELLE YAPILACAKLAR (web-only):`);
  console.log(`  1. Circle faucet → https://faucet.circle.com  (Stellar testnet USDC)`);
  for (const role of NEEDS_USDC) console.log(`       ${role}: ${kps[role].publicKey()}`);
  console.log(`  2. OZ Channels API key → https://channels.openzeppelin.com/testnet/gen  → OZ_API_KEY`);
  console.log(`  3. sudo xcodebuild -license accept  (Rust build için)`);
}

main().catch(e => { console.error(e); process.exit(1); });
