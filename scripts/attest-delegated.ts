/**
 * Delegasyonlu tasdik — ürünün gerçek yazma yolu.
 *  Otorite (VERIFIER): mesajı BLS ile off-chain imzalar.  Gönderen (DEPLOYER): zincire yazar, ücreti öder.
 *  Kullanıcı hiçbir şey imzalamaz, XLM tutmaz.  Akış: README "Delegated Attestation Flow".
 */
import "dotenv/config";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { Keypair, Networks, TransactionBuilder, rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { signDelegated, attestMessageHash } from "./lib/attest-delegation.js";
const require = createRequire(import.meta.url);
const attest = require("@attestprotocol/stellar-sdk");
const { StellarAttestationClient } = attest;

const RPC = "https://soroban-testnet.stellar.org";
const CONTRACT = "CA2QET2KOUGAECEVYQEQT3SLDDZRUMAQHI7MMDTFVJY62WTHUTERAUCD";
const server = new rpc.Server(RPC);
const local: Record<string, string> = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter(l => l.includes("=")).map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }));
const deployer = Keypair.fromSecret(local.DEPLOYER_SECRET);
const verifier = Keypair.fromSecret(local.VERIFIER_SECRET);
const blsPriv = Buffer.from(local.VERIFIER_BLS_PRIVATE, "hex");
const blsPub  = Buffer.from(local.VERIFIER_BLS_PUBLIC, "hex");
const subject = process.argv[2] ?? local.AGENT_PUBLIC;   // örnek özne: AGENT hesabı

const json = (v: unknown) => JSON.stringify(v, (_k, x) => typeof x === "bigint" ? x.toString() : (x instanceof Uint8Array ? Buffer.from(x).toString("hex") : x), 2);
const signerFor = (kp: Keypair) => ({ signTransaction: async (x: string) => { const tx = TransactionBuilder.fromXDR(x, Networks.TESTNET); tx.sign(kp); return tx.toXDR(); } });
const client = (pub: string) => new StellarAttestationClient({ rpcUrl: RPC, network: "testnet", publicKey: pub, contractId: CONTRACT });
async function waitForTx(hash: string) { for (let i = 0; i < 60; i++) { const r: any = await server.getTransaction(hash); if (r.status === "SUCCESS") return r; if (r.status === "FAILED") throw new Error("tx FAILED " + hash); await new Promise(res => setTimeout(res, 1500)); } throw new Error("timeout " + hash); }
const retval = (r: any) => r?.result ?? (r?.simulation?.result?.retval ? scValToNative(r.simulation.result.retval) : undefined);

async function main() {
  const authority = client(verifier.publicKey());
  const submitter = client(deployer.publicKey());

  const value = JSON.stringify({ action: "agent.identity", task_id: "t-deleg-0", evidence: "delegated-smoke", class: "B",
    verifier: verifier.publicKey(), observed_at: Math.floor(Date.now() / 1000), policy_version: "v0" });
  // SDK yardımcısı: snake_case istek üretir, nonce'u kontrattan çeker (get_attester_nonce)
  const request = await attest.createDelegatedAttestationRequest(authority.getClientInstance(), {
    schemaUid: Buffer.from(local.ATTEST_SCHEMA_POA, "hex"),
    subject,
    attester: verifier.publicKey(),
    value,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    expirationTime: Math.floor(Date.now() / 1000) + 30 * 86400,
  });
  console.log("request → nonce", String(request.nonce), "| deadline", String(request.deadline));
  // SDK'nın createAttestMessage'ı kontratla uyumsuz (bkz. lib/attest-delegation.ts) → mesajı kendimiz kuruyoruz
  console.log("mesaj hash →", attestMessageHash(request).toString("hex").slice(0, 16) + "…");
  const signature: Buffer = signDelegated(request, blsPriv);
  console.log("BLS imza →", signature.length, "bayt");

  const delegated = { ...request, signature }; // BLS pub kontratta kayıtlı; istekte taşınmaz
  const res = await submitter.attestByDelegation(delegated, { signer: signerFor(deployer) });
  const hash = res?.hash ?? res?.txHash; if (!hash) throw new Error("hash yok: " + json(res).slice(0, 400));
  const tx = await waitForTx(hash);
  const uid = tx.returnValue ? Buffer.from(scValToNative(tx.returnValue)).toString("hex") : "(returnValue yok)";
  console.log("attestByDelegation → SUCCESS, tx", hash.slice(0, 10) + "…", "uid", uid);

  if (uid.length === 64) {
    const a = retval(await submitter.getAttestation(Buffer.from(uid, "hex")));
    const o: any = {}; for (const [k, v] of Object.entries(a ?? {})) o[k] = v instanceof Uint8Array ? Buffer.from(v).toString("hex") : typeof v === "bigint" ? v.toString() : v;
    console.log("zincirdeki tasdik → attester:", o.attester, "| subject:", o.subject, "| value:", String(o.value).slice(0, 80) + "…");
    const out = { ...local, DELEGATED_ATTESTATION_UID: uid, DELEGATED_ATTESTATION_TX: hash };
    writeFileSync(".env.local", Object.entries(out).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  }
}
main().catch(e => { console.error("HATA:", e?.message ?? e); if (e?.stack) console.error(e.stack.split("\n").slice(1, 5).join("\n")); process.exit(1); });
