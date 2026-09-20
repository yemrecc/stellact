/**
 * Kendi Attest instance'ımızı (ATTEST_OWN_CONTRACT, v2.0.1 WASM) hazırlar ve delegasyonu uçtan uca doğrular.
 *  1. POA + INDEX şemaları (DEPLOYER)   2. VERIFIER BLS anahtarı   3. Delegasyonlu tasdik (VERIFIER imzalar, DEPLOYER öder)
 * Mesaj düzeni: önce SDK'nın createAttestMessage'ı (v2.0.1 ile aynı), geçmezse main düzeni (lib/attest-delegation.ts).
 * İdempotent: OWN_* değerleri .env.local'da varsa atlanır.
 */
import "dotenv/config";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { Keypair, Networks, TransactionBuilder, rpc, scValToNative } from "@stellar/stellar-sdk";
import { signDelegated } from "./lib/attest-delegation.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { Address, xdr } from "@stellar/stellar-sdk";
const require = createRequire(import.meta.url);
const attest = require("@attestprotocol/stellar-sdk");
const { StellarAttestationClient } = attest;

const RPC = "https://soroban-testnet.stellar.org"; const server = new rpc.Server(RPC);
const ENV = ".env.local";
const local: Record<string, string> = Object.fromEntries(readFileSync(ENV, "utf8").split("\n").filter(l => l.includes("=")).map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }));
const CONTRACT = process.env.ATTEST_OWN_CONTRACT ?? local.ATTEST_OWN_CONTRACT; if (!CONTRACT) throw new Error("ATTEST_OWN_CONTRACT yok");
const deployer = Keypair.fromSecret(local.DEPLOYER_SECRET), verifier = Keypair.fromSecret(local.VERIFIER_SECRET);
const blsPriv = Buffer.from(local.VERIFIER_BLS_PRIVATE, "hex"), blsPub = Buffer.from(local.VERIFIER_BLS_PUBLIC, "hex");
const signerFor = (kp: Keypair) => ({ signTransaction: async (x: string) => { const tx = TransactionBuilder.fromXDR(x, Networks.TESTNET); tx.sign(kp); return tx.toXDR(); } });
const client = (pub: string) => new StellarAttestationClient({ rpcUrl: RPC, network: "testnet", publicKey: pub, contractId: CONTRACT });
async function waitForTx(hash: string) { for (let i = 0; i < 60; i++) { const r: any = await server.getTransaction(hash); if (r.status === "SUCCESS") return r; if (r.status === "FAILED") throw new Error("tx FAILED " + hash); await new Promise(res => setTimeout(res, 1500)); } throw new Error("timeout " + hash); }
const txHash = (res: any) => { const h = res?.hash ?? res?.txHash; if (!h) throw new Error("hash yok: " + JSON.stringify(res).slice(0, 200)); return h as string; };
const bytes32 = async (hash: string) => Buffer.from(scValToNative((await waitForTx(hash)).returnValue)).toString("hex");
const errCode = (e: any) => String(e?.message ?? e).match(/Error\(Contract, #\d+\)/)?.[0] ?? String(e?.message ?? e).split("\n")[0].slice(0, 100);
const POA_DEF = "action:string,task_id:string,evidence:string,class:string,verifier:string,observed_at:u64,policy_version:string";
const INDEX_DEF = "index_run:string,computed_at:u64,sha256:string,method_commit:string";

async function main() {
  const out: Record<string, string> = { ...local };
  const cd = client(deployer.publicKey()), cv = client(verifier.publicKey());
  console.log("contract:", CONTRACT);
  if (!out.ATTEST_OWN_SCHEMA_POA)   { const h = txHash(await cd.createSchema({ definition: POA_DEF, revocable: true, options: { signer: signerFor(deployer) } })); out.ATTEST_OWN_SCHEMA_POA = await bytes32(h); }
  if (!out.ATTEST_OWN_SCHEMA_INDEX) { const h = txHash(await cd.createSchema({ definition: INDEX_DEF, revocable: false, options: { signer: signerFor(deployer) } })); out.ATTEST_OWN_SCHEMA_INDEX = await bytes32(h); }
  console.log("POA schema:", out.ATTEST_OWN_SCHEMA_POA); console.log("INDEX schema:", out.ATTEST_OWN_SCHEMA_INDEX);
  if (!out.ATTEST_OWN_BLS_REGISTERED) { await waitForTx(txHash(await cv.registerBlsKey(blsPub, { signer: signerFor(verifier) }))); out.ATTEST_OWN_BLS_REGISTERED = "1"; console.log("BLS anahtarı kaydedildi"); }
  writeFileSync(ENV, Object.entries(out).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");

  // Delegasyon
  const now = Math.floor(Date.now() / 1000);
  const req: any = await attest.createDelegatedAttestationRequest(cv.getClientInstance(), {
    schemaUid: Buffer.from(out.ATTEST_OWN_SCHEMA_POA, "hex"), subject: local.AGENT_PUBLIC, attester: verifier.publicKey(),
    value: JSON.stringify({ action: "agent.identity", task_id: "t-boot", evidence: "own-instance", class: "B", verifier: verifier.publicKey(), observed_at: now, policy_version: "v0" }),
    deadline: BigInt(now + 3600), expirationTime: now + 30 * 86400 });
  console.log("nonce:", String(req.nonce));
  const dst: Buffer = await cv.getAttestDST();
  const layouts: [string, () => Buffer][] = [
    ["sdk-v2.0.1 (value_len)", () => attest.signHashedMessage(cv.createAttestMessage(req, dst), blsPriv)],
    ["main (subject+value hash)", () => signDelegated(req, blsPriv)],
  ];
  for (const [name, mk] of layouts) {
    const sig = mk();
    try {
      const res: any = await cd.attestByDelegation({ ...req, signature: sig }, { signer: signerFor(deployer), simulate: true });
      const sim = res?.simulation ?? res; if (sim && rpc.Api.isSimulationError(sim)) { console.log("✗", name, "→", String(sim.error).match(/#\d+/)?.[0]); continue; }
      console.log("✓ simülasyon geçti:", name);
      const hash = txHash(await cd.attestByDelegation({ ...req, signature: sig }, { signer: signerFor(deployer) })); await waitForTx(hash);
      // attest_by_delegation Result<()> döndürür → UID = keccak256(XDR(schema_uid) ‖ XDR(subject) ‖ nonce_be)  (utils.rs v2.0.1)
      const nb = Buffer.alloc(8); nb.writeBigUInt64BE(BigInt(req.nonce));
      const uid = Buffer.from(keccak_256(Buffer.concat([xdr.ScVal.scvBytes(Buffer.from(req.schema_uid)).toXDR(), new Address(req.subject).toScVal().toXDR(), nb]))).toString("hex");
      const a: any = (await cd.getAttestation(Buffer.from(uid, "hex")))?.result;
      console.log("DELEGASYON SUCCESS → uid:", uid); console.log("  on-chain subject:", a?.subject, "| attester:", a?.attester, "| subject≠attester:", a?.subject !== a?.attester);
      out.ATTEST_OWN_MESSAGE_LAYOUT = name; out.ATTEST_OWN_DELEGATED_UID = uid;
      writeFileSync(ENV, Object.entries(out).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
      return;
    } catch (e) { console.log("✗", name, "→", errCode(e)); }
  }
  console.log("Hiçbir düzen geçmedi.");
}
main().catch(e => { console.error("HATA:", e?.message ?? e); process.exit(1); });
