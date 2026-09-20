/**
 * Test varlığı: TUSD (7 ondalık, klasik asset + SAC).
 * Circle faucet captcha'lı ve script'lenemez; TUSD onun yerine geçer — Vault, trustline ve SAC
 * doğrulayıcıları için yeterli. Gerçek Circle USDC gelince ikisi yan yana kullanılabilir.
 * İdempotent: .env.local'daki TUSD_* değerleri varsa yeniden üretmez.
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { Asset, BASE_FEE, Horizon, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const HORIZON = process.env.TESTNET_HORIZON ?? "https://horizon-testnet.stellar.org";
const ENV = ".env.local";
const CODE = "TUSD";
const AMOUNT = "100000";           // her alıcıya
const horizon = new Horizon.Server(HORIZON);

const local: Record<string, string> = Object.fromEntries(
  readFileSync(ENV, "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const RECIPIENTS = ["DEPLOYER", "REWARD_POOL", "X402_RECIPIENT", "AGENT"] as const;

async function fund(pub: string) {
  const r = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(pub)}`);
  return r.ok ? "funded" : "exists";
}
async function submit(kp: Keypair, build: (b: TransactionBuilder) => TransactionBuilder) {
  const acc = await horizon.loadAccount(kp.publicKey());
  const tx = build(new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })).setTimeout(90).build();
  tx.sign(kp);
  return horizon.submitTransaction(tx);
}
const balanceOf = async (pub: string, asset: Asset) => {
  const acc = await horizon.loadAccount(pub);
  const b = acc.balances.find((x: any) => x.asset_code === asset.getCode() && x.asset_issuer === asset.getIssuer());
  return b ? (b as any).balance : null;
};

async function main() {
  const out: Record<string, string> = { ...local };

  const issuer = out.TUSD_ISSUER_SECRET ? Keypair.fromSecret(out.TUSD_ISSUER_SECRET) : Keypair.random();
  out.TUSD_ISSUER_SECRET = issuer.secret();
  out.TUSD_ISSUER = issuer.publicKey();
  console.log(`ISSUER ${issuer.publicKey()}  ${await fund(issuer.publicKey())}`);

  const asset = new Asset(CODE, issuer.publicKey());

  for (const role of RECIPIENTS) {
    const kp = Keypair.fromSecret(local[`${role}_SECRET`]);
    const have = await balanceOf(kp.publicKey(), asset);
    if (have === null) {
      await submit(kp, b => b.addOperation(Operation.changeTrust({ asset, limit: "1000000" })));
      console.log(`${role.padEnd(15)} trustline eklendi`);
    }
    if (have === null || Number(have) < 1) {
      await submit(issuer, b => b.addOperation(Operation.payment({ destination: kp.publicKey(), asset, amount: AMOUNT })));
      console.log(`${role.padEnd(15)} ${AMOUNT} ${CODE} gönderildi`);
    } else {
      console.log(`${role.padEnd(15)} bakiye ${have} ${CODE} — atlandı`);
    }
  }

  out.TUSD_ASSET = `${CODE}:${issuer.publicKey()}`;
  writeFileSync(ENV, Object.entries(out).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  console.log(`\n${CODE} hazır. SAC deploy için:`);
  console.log(`  stellar contract asset deploy --asset ${CODE}:${issuer.publicKey()} --source-account cli-ops --network testnet`);
}
main().catch(e => { console.error("HATA:", e?.response?.data?.extras?.result_codes ?? e?.message ?? e); process.exit(1); });
