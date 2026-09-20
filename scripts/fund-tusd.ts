/**
 * Test hesaplarına TUSD yükler. Bakiye biten hesabı tazelemek için:
 *   pnpm fund:tusd AGENT 100
 *   pnpm fund:tusd SYBIL_SCRIPT 100
 * Rol adı .env.local'daki `<ROL>_PUBLIC` ya da `<ROL>` anahtarından çözülür.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Asset, BASE_FEE, Horizon, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const local: Record<string, string> = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const role = process.argv[2] ?? "AGENT";
const amount = process.argv[3] ?? "100";
const dest = local[`${role}_PUBLIC`] ?? local[role];
if (!dest) throw new Error(`${role} için adres yok (.env.local'da ${role}_PUBLIC veya ${role})`);

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const issuer = Keypair.fromSecret(local.TUSD_ISSUER_SECRET);
const asset = new Asset("TUSD", issuer.publicKey());

const acc = await horizon.loadAccount(issuer.publicKey());
const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.payment({ destination: dest, asset, amount }))
  .setTimeout(60).build();
tx.sign(issuer);
const r = await horizon.submitTransaction(tx);
console.log(`${role} (${dest.slice(0, 8)}…) ← ${amount} TUSD · tx ${r.hash.slice(0, 12)}…`);
