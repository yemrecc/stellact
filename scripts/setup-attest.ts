/**
 * Attest Protocol v2 (testnet) kurulumu — Kapı 1 çekirdeği.
 *  1. POA ve INDEX şemalarını kaydet (DEPLOYER imzalar, şema sahibi)
 *  2. VERIFIER için BLS anahtar çifti üret + zincire kaydet (delegasyon otoritesi)
 *  3. Dumanlı test: VERIFIER doğrudan bir tasdik yazar, geri okur
 * İdempotent: .env.local'daki değerler yeniden üretilmez. ATTEST_POA_TX varsa şema o işlemden geri kazanılır.
 * Notlar (doğrulandı): SDK'nın ESM build'i Node 25'te kırık → CJS (createRequire).
 *   signer.signTransaction(xdr) → Promise<string> (imzalı XDR). SDK gönderir ama onay beklemez → waitForTx.
 */
import "dotenv/config";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { Keypair, Networks, TransactionBuilder, rpc, scValToNative } from "@stellar/stellar-sdk";

const require = createRequire(import.meta.url);
const attest = require("@attestprotocol/stellar-sdk");
const { StellarAttestationClient } = attest;

const RPC = process.env.TESTNET_RPC ?? "https://soroban-testnet.stellar.org";
const CONTRACT = process.env.ATTEST_CONTRACT_TESTNET ?? "CA2QET2KOUGAECEVYQEQT3SLDDZRUMAQHI7MMDTFVJY62WTHUTERAUCD";
const ENV_LOCAL = ".env.local";
const server = new rpc.Server(RPC);

const local: Record<string, string> = Object.fromEntries(
  readFileSync(ENV_LOCAL, "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const deployer = Keypair.fromSecret(local.DEPLOYER_SECRET);
const verifier = Keypair.fromSecret(local.VERIFIER_SECRET);

const json = (v: unknown) => JSON.stringify(v, (_k, x) =>
  typeof x === "bigint" ? x.toString()
  : Buffer.isBuffer(x) || x instanceof Uint8Array ? Buffer.from(x).toString("hex")
  : (x && x.type === "Buffer" && Array.isArray(x.data)) ? Buffer.from(x.data).toString("hex")
  : x, 2);

const signerFor = (kp: Keypair) => ({
  signTransaction: async (xdr: string) => { const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET); tx.sign(kp); return tx.toXDR(); },
});
const client = (pub: string) => new StellarAttestationClient({ rpcUrl: RPC, network: "testnet", publicKey: pub, contractId: CONTRACT });

async function waitForTx(hash: string, timeoutMs = 90_000) {
  const t0 = Date.now();
  for (;;) {
    const r: any = await server.getTransaction(hash);
    if (r.status === "SUCCESS") return r;
    if (r.status === "FAILED") throw new Error(`tx FAILED ${hash}: ${json(r.resultXdr ?? "").slice(0, 200)}`);
    if (Date.now() - t0 > timeoutMs) throw new Error(`tx timeout ${hash}`);
    await new Promise(res => setTimeout(res, 1500));
  }
}
const txHash = (res: any): string => { const h = res?.hash ?? res?.txHash ?? res?.transactionHash; if (!h) throw new Error("tx hash yok: " + json(res).slice(0, 300)); return h; };
async function bytes32From(hash: string): Promise<string> {
  const tx = await waitForTx(hash);
  const sv = tx.returnValue; if (!sv) throw new Error("returnValue yok: " + hash);
  return Buffer.from(scValToNative(sv)).toString("hex");
}

const POA_DEF   = "action:string,task_id:string,evidence:string,class:string,verifier:string,observed_at:u64,policy_version:string";
const INDEX_DEF = "index_run:string,computed_at:u64,sha256:string,method_commit:string";

async function main() {
  const out: Record<string, string> = { ...local };
  const cd = client(deployer.publicKey());

  // 1) Şemalar
  if (!out.ATTEST_SCHEMA_POA) {
    const hash = out.ATTEST_POA_TX ?? txHash(await cd.createSchema({ definition: POA_DEF, revocable: true, options: { signer: signerFor(deployer) } }));
    out.ATTEST_SCHEMA_POA = await bytes32From(hash); out.ATTEST_SCHEMA_POA_DEF = POA_DEF; out.ATTEST_POA_TX = hash;
  }
  if (!out.ATTEST_SCHEMA_INDEX) {
    const hash = txHash(await cd.createSchema({ definition: INDEX_DEF, revocable: false, options: { signer: signerFor(deployer) } }));
    out.ATTEST_SCHEMA_INDEX = await bytes32From(hash); out.ATTEST_INDEX_TX = hash;
  }
  console.log("POA   schema uid:", out.ATTEST_SCHEMA_POA, "(tx", out.ATTEST_POA_TX.slice(0, 8) + "…)");
  console.log("INDEX schema uid:", out.ATTEST_SCHEMA_INDEX);
  const schema = await cd.getSchema(Buffer.from(out.ATTEST_SCHEMA_POA, "hex")).catch((e: Error) => ({ error: e.message }));
  console.log("getSchema(POA) →", json(schema?.result?.retval ? scValToNative(schema.result.retval) : schema).slice(0, 400));

  // 2) BLS (VERIFIER)
  const cv = client(verifier.publicKey());
  if (!out.VERIFIER_BLS_PRIVATE) {
    const keys = await cv.generateBlsKeys();
    const res = await cv.registerBlsKey(Buffer.from(keys.publicKey), { signer: signerFor(verifier) });
    await waitForTx(txHash(res));
    out.VERIFIER_BLS_PRIVATE = Buffer.from(keys.privateKey).toString("hex");
    out.VERIFIER_BLS_PUBLIC  = Buffer.from(keys.publicKey).toString("hex");
    console.log("registerBlsKey → onaylandı (pub", keys.publicKey.length, "bayt)");
  }
  const bls = await cv.getBlsKey(verifier.publicKey()).catch((e: Error) => ({ error: e.message }));
  console.log("getBlsKey(VERIFIER) →", json(bls?.result?.retval ? scValToNative(bls.result.retval) : bls).slice(0, 300));

  // 3) Dumanlı test — doğrudan tasdik
  if (!out.SMOKE_ATTESTATION_UID) {
    const value = JSON.stringify({ action: "smoke.test", task_id: "t0", evidence: "setup-attest", class: "A",
      verifier: verifier.publicKey(), observed_at: Math.floor(Date.now() / 1000), policy_version: "v0" });
    const res = await cv.attest({ schemaUid: Buffer.from(out.ATTEST_SCHEMA_POA, "hex"), value, subject: deployer.publicKey(), options: { signer: signerFor(verifier) } });
    out.SMOKE_ATTESTATION_UID = await bytes32From(txHash(res)); out.SMOKE_ATTESTATION_TX = txHash(res);
  }
  console.log("smoke attestation uid:", out.SMOKE_ATTESTATION_UID);
  const a = await cv.getAttestation(Buffer.from(out.SMOKE_ATTESTATION_UID, "hex")).catch((e: Error) => ({ error: e.message }));
  console.log("getAttestation →", json(a?.result?.retval ? scValToNative(a.result.retval) : a).slice(0, 900));

  writeFileSync(ENV_LOCAL, Object.entries(out).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  console.log("\n.env.local güncellendi.");
}
main().catch(e => { console.error("HATA:", e?.message ?? e); if (e?.stack) console.error(e.stack.split("\n").slice(1, 6).join("\n")); process.exit(1); });
