/**
 * Vault dumanlı test — `vault.deposit` ve `position.held` doğrulayıcılarının gerçek kod yolu.
 *  1. deposit(DEPLOYER, 50 TUSD)  — kullanıcı imzalar
 *  2. balance / deposited_at oku  — Sınıf A doğrulama (cross-contract okuma, güven gerekmez)
 *  3. position.held(days) kararını hesapla
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Keypair, Networks, contract } from "@stellar/stellar-sdk";
import { Client as Vault } from "vault";

const local: Record<string, string> = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const RPC = "https://soroban-testnet.stellar.org";
const deployer = Keypair.fromSecret(local.DEPLOYER_SECRET);
const AMOUNT = 50n * 10_000_000n;   // 50 TUSD (7 ondalık)

const vault = new Vault({
  contractId: local.VAULT_CONTRACT,
  networkPassphrase: Networks.TESTNET,
  rpcUrl: RPC,
  publicKey: deployer.publicKey(),
  ...contract.basicNodeSigner(deployer, Networks.TESTNET),
});

const fmt = (v: bigint) => (Number(v) / 1e7).toLocaleString("tr-TR", { maximumFractionDigits: 7 });

async function main() {
  const before = (await vault.balance({ of: deployer.publicKey() })).result;
  console.log("önce   balance:", fmt(before), "TUSD");

  console.log(`\ndeposit(${fmt(AMOUNT)} TUSD) gönderiliyor…`);
  const tx = await vault.deposit({ from: deployer.publicKey(), amount: AMOUNT });
  const sent = await tx.signAndSend();
  console.log("  tx:", sent.getTransactionResponse?.txHash ?? sent.sendTransactionResponse?.hash ?? "(gönderildi)");

  const after = (await vault.balance({ of: deployer.publicKey() })).result;
  const since = (await vault.deposited_at({ of: deployer.publicKey() })).result;
  console.log("\nsonra  balance:", fmt(after), "TUSD");
  console.log("       deposited_at:", since.toString(), "→", new Date(Number(since) * 1000).toISOString());

  // --- position.held doğrulayıcısının kararı ---
  const now = BigInt(Math.floor(Date.now() / 1000));
  const heldSec = since === 0n ? 0n : now - since;
  const check = (minAmount: bigint, days: number) => {
    const okAmount = after >= minAmount;
    const okDays = since !== 0n && heldSec >= BigInt(days * 86400);
    const reasons: string[] = [];
    if (!okAmount) reasons.push(`balance_lt_min: ${fmt(after)} < ${fmt(minAmount)}`);
    if (!okDays) reasons.push(`not_held_long_enough: ${Number(heldSec)}s < ${days * 86400}s`);
    return { pass: okAmount && okDays, reasons };
  };
  console.log("\n--- /decide örnekleri (Sınıf A, zincirden okundu) ---");
  console.log("vault.deposit(min 50):      ", JSON.stringify(check(AMOUNT, 0)));
  console.log("position.held(min 50, 7g):  ", JSON.stringify(check(AMOUNT, 7)));
  console.log("position.held(min 1000, 7g):", JSON.stringify(check(1000n * 10_000_000n, 7)));
}
main().catch(e => { console.error("HATA:", e?.message ?? e); process.exit(1); });
