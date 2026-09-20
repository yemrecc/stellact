import "dotenv/config";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
const require = createRequire(import.meta.url);
const { StellarAttestationClient } = require("@attestprotocol/stellar-sdk");
const local: Record<string,string> = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)]}));
const uid = process.argv[2] ?? local.SMOKE_ATTESTATION_UID;
const c = new StellarAttestationClient({ rpcUrl: "https://soroban-testnet.stellar.org", network: "testnet", publicKey: local.DEPLOYER_PUBLIC, contractId: local.ATTEST_CONTRACT_TESTNET ?? "CA2QET2KOUGAECEVYQEQT3SLDDZRUMAQHI7MMDTFVJY62WTHUTERAUCD" });
const r: any = await c.getAttestation(Buffer.from(uid, "hex"));
const native: any = r?.result ?? (r?.simulation?.result?.retval ? scValToNative(r.simulation.result.retval) : undefined);
if (!native) { console.log("sonuç şekli:", Object.keys(r ?? {}).join(", ")); process.exit(1); }
const out: any = {};
for (const [k, v] of Object.entries(native as Record<string, unknown>)) out[k] = v instanceof Uint8Array ? Buffer.from(v).toString("hex") : typeof v === "bigint" ? v.toString() : v;
if (typeof out.value === "string") { try { out.value = JSON.parse(out.value); } catch {} }
console.log(JSON.stringify(out, (_k, v) => typeof v === "bigint" ? v.toString() : (v && v.type === "Buffer" && Array.isArray(v.data)) ? Buffer.from(v.data).toString("hex") : v instanceof Uint8Array ? Buffer.from(v).toString("hex") : v, 2));
