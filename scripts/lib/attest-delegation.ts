/**
 * Attest Protocol v2 — delegasyonlu tasdik mesajı, kontratla birebir.
 * Kaynak: contracts/stellar/protocol/src/instructions/delegation.rs + crypto.rs (main, 2026-09-20)
 *
 *   message = DST ‖ schema_uid(32) ‖ sha256(XDR(subject)) ‖ nonce(8,BE) ‖ deadline(8,BE) ‖ [exp(8,BE)] ‖ sha256(XDR(value))
 *   hash    = sha256(message)                       → 32 bayt
 *   verify  = hash_to_g1(hash, "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_"), pk∈G2 (192B), sig∈G1 (96B)
 *
 * SDK 2.0.2'nin createAttestMessage'ı bayat (subject hash yok, value yerine uzunluk) → InvalidSignature (#21).
 * noble'ı SDK'nın KENDİ bağımlılığından yüklüyoruz ki nokta tipi signHashedMessage ile aynı örnekten gelsin.
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { Address, xdr } from "@stellar/stellar-sdk";

const require = createRequire(import.meta.url);
const attest = require("@attestprotocol/stellar-sdk");
const sdkRequire = createRequire(require.resolve("@attestprotocol/stellar-sdk"));
let bls: any;
try { bls = sdkRequire("@noble/curves/bls12-381.js").bls12_381; } catch { bls = sdkRequire("@noble/curves/bls12-381").bls12_381; }

export const ATTEST_DST = Buffer.from("ATTEST_PROTOCOL_V1_DELEGATED");
const sha256 = (b: Uint8Array): Buffer => createHash("sha256").update(b).digest();
const u64be = (n: bigint | number): Buffer => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; };

export interface DelegatedReq {
  schema_uid: Uint8Array; subject: string; attester: string; value: string;
  nonce: bigint; deadline: bigint; expiration_time?: bigint | number | null;
}

/** delegation.rs::create_attestation_message ile birebir */
export function attestMessageHash(r: DelegatedReq): Buffer {
  const parts: Buffer[] = [
    ATTEST_DST,
    Buffer.from(r.schema_uid),
    sha256(new Address(r.subject).toScVal().toXDR()),   // request.subject.to_xdr(env) → ScVal(Address) XDR
    u64be(r.nonce),
    u64be(r.deadline),
  ];
  if (r.expiration_time !== undefined && r.expiration_time !== null) parts.push(u64be(r.expiration_time));
  parts.push(sha256(xdr.ScVal.scvString(r.value).toXDR())); // request.value.to_xdr(env) → ScVal(String) XDR
  return sha256(Buffer.concat(parts));
}

/** hash → G1 noktası (noble varsayılan DST = kontratın DST'si) → 96 bayt uncompressed imza */
export function signDelegated(r: DelegatedReq, blsPriv: Uint8Array): Buffer {
  const point = bls.shortSignatures.hash(attestMessageHash(r));
  return attest.signHashedMessage(point, blsPriv);
}
