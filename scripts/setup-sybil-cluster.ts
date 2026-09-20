/**
 * Sybil kümesi — ret ekranının gerçek verisi.
 *  SPONSOR bir hesap; N kardeş cüzdanı sponsored reserves ile açar (defterde `sponsor` alanı yapılandırılmış kalır).
 *  Kardeşlerden biri (SCRIPT) "görevi yapar": TUSD trustline (sponsorlu) + 50 TUSD + Vault deposit.
 *  DNA/decide: Horizon `GET /accounts?sponsor=SPONSOR` → 41 → sponsor_cluster_size → ret.
 * İdempotent: SYBIL_SPONSOR_SECRET varsa yeniden üretmez.
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Asset, BASE_FEE, Horizon, Keypair, Networks, Operation, TransactionBuilder, contract } from "@stellar/stellar-sdk";
import { Client as Vault } from "vault";

const HORIZON = "https://horizon-testnet.stellar.org";
const RPC = "https://soroban-testnet.stellar.org";
const ENV = ".env.local";
const N = 41;
const horizon = new Horizon.Server(HORIZON);

const local: Record<string, string> = Object.fromEntries(
  readFileSync(ENV, "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const issuer = Keypair.fromSecret(local.TUSD_ISSUER_SECRET);
const TUSD = new Asset("TUSD", issuer.publicKey());

async function submit(signers: Keypair[], source: Keypair, ops: any[]) {
  const acc = await horizon.loadAccount(source.publicKey());
  const b = new TransactionBuilder(acc, { fee: (Number(BASE_FEE) * 2).toString(), networkPassphrase: Networks.TESTNET });
  for (const op of ops) b.addOperation(op);
  const tx = b.setTimeout(120).build();
  tx.sign(...signers);
  const r = await horizon.submitTransaction(tx);
  return r.hash;
}

async function main() {
  const out: Record<string, string> = { ...local };
  const sponsor = out.SYBIL_SPONSOR_SECRET ? Keypair.fromSecret(out.SYBIL_SPONSOR_SECRET) : Keypair.random();
  out.SYBIL_SPONSOR_SECRET = sponsor.secret(); out.SYBIL_SPONSOR = sponsor.publicKey();
  const fb = await fetch(`https://friendbot.stellar.org?addr=${sponsor.publicKey()}`);
  console.log(`SPONSOR ${sponsor.publicKey()}  ${fb.ok ? "funded" : "exists"}`);

  // kardeşler (deterministik: sponsor secret'ından türet, böylece tekrar çalıştırınca aynı adresler)
  const siblings: Keypair[] = [];
  for (let i = 0; i < N; i++) {
    const seed = createHash("sha256").update(sponsor.secret() + ":" + i).digest();
    siblings.push(Keypair.fromRawEd25519Seed(seed));
  }
  const script = siblings[0];
  out.SYBIL_SCRIPT_SECRET = script.secret(); out.SYBIL_SCRIPT = script.publicKey();

  // hangileri zaten var?
  const existing = new Set<string>();
  for (const s of siblings) { try { await horizon.loadAccount(s.publicKey()); existing.add(s.publicKey()); } catch {} }
  const todo = siblings.filter(s => !existing.has(s.publicKey()));
  console.log(`kardeş: ${N} · mevcut ${existing.size} · açılacak ${todo.length}`);

  // sponsorlu create_account sandviçleri — tx başına ≤19 kardeş (imza limiti 20)
  for (let i = 0; i < todo.length; i += 19) {
    const batch = todo.slice(i, i + 19);
    const ops: any[] = [];
    for (const s of batch) {
      ops.push(Operation.beginSponsoringFutureReserves({ sponsoredId: s.publicKey() }));
      ops.push(Operation.createAccount({ destination: s.publicKey(), startingBalance: "2" }));
      ops.push(Operation.endSponsoringFutureReserves({ source: s.publicKey() }));
    }
    const h = await submit([sponsor, ...batch], sponsor, ops);
    console.log(`  ${batch.length} kardeş açıldı  tx ${h.slice(0, 10)}…`);
  }

  // SCRIPT: sponsorlu TUSD trustline + 50 TUSD
  const scriptAcc = await horizon.loadAccount(script.publicKey());
  const hasTl = scriptAcc.balances.some((b: any) => b.asset_code === "TUSD" && b.asset_issuer === issuer.publicKey());
  if (!hasTl) {
    const h = await submit([sponsor, script], sponsor, [
      Operation.beginSponsoringFutureReserves({ sponsoredId: script.publicKey() }),
      Operation.changeTrust({ asset: TUSD, limit: "1000000", source: script.publicKey() }),
      Operation.endSponsoringFutureReserves({ source: script.publicKey() }),
    ]);
    console.log(`SCRIPT  sponsorlu TUSD trustline  tx ${h.slice(0, 10)}…`);
    const h2 = await submit([issuer], issuer, [Operation.payment({ destination: script.publicKey(), asset: TUSD, amount: "50" })]);
    console.log(`SCRIPT  50 TUSD alındı  tx ${h2.slice(0, 10)}…`);
  }

  // SCRIPT: Vault deposit (görevi "yaptı")
  const vault = new Vault({ contractId: out.VAULT_CONTRACT, networkPassphrase: Networks.TESTNET, rpcUrl: RPC,
    publicKey: script.publicKey(), ...contract.basicNodeSigner(script, Networks.TESTNET) });
  const bal = (await vault.balance({ of: script.publicKey() })).result;
  if (bal === 0n) {
    const tx = await vault.deposit({ from: script.publicKey(), amount: 50n * 10_000_000n });
    const sent = await tx.signAndSend();
    out.SYBIL_SCRIPT_DEPOSIT_TX = sent.getTransactionResponse?.txHash ?? "";
    console.log(`SCRIPT  Vault deposit 50 TUSD  tx ${out.SYBIL_SCRIPT_DEPOSIT_TX.slice(0, 10)}…`);
  } else console.log(`SCRIPT  Vault bakiyesi zaten ${Number(bal) / 1e7} TUSD`);

  // doğrula: Horizon sponsor filtresi
  const page = await horizon.accounts().sponsor(sponsor.publicKey()).limit(200).call();
  console.log(`\nHorizon /accounts?sponsor=${sponsor.publicKey().slice(0, 8)}… → ${page.records.length} hesap`);

  writeFileSync(ENV, Object.entries(out).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  console.log(".env.local güncellendi (SYBIL_*)");
}
main().catch(e => { console.error("HATA:", e?.response?.data?.extras?.result_codes ?? e?.message ?? e); process.exit(1); });
