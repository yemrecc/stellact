/**
 * Smart account (passkey) uçtan uca — tarayıcısız.
 *
 *  Kit'in `webAuthn` kancasına Node'da çalışan bir YAZILIM AUTHENTICATOR'ı takıyoruz:
 *  P-256 anahtar üretir, kayıt yanıtı (raw 65 bayt public key) ve assertion (DER imza) döndürür.
 *  Kit'in kendi kontrol ettiği şeyler (utils/wallet-provenance.js): raw 0x04‖x‖y anahtar,
 *  clientDataJSON.type/challenge/origin, authenticatorData = sha256(rpId)‖flags(UP|UV)‖counter,
 *  ECDSA-SHA256 over authenticatorData‖sha256(clientDataJSON), DER → kit low-S'e çevirir.
 *
 *  Akış:  createWallet (paylaşımlı deployer + SDF relayer proxy öder)
 *      →  C-adresine TUSD (SAC transfer, DEPLOYER'dan)
 *      →  kit.executeAndSubmit(VAULT, "deposit", [C, 50 TUSD])  — passkey imzalar, relayer öder
 *      →  Vault.balance / deposited_at doğrula
 *  Tarayıcıda tek fark: webAuthn kancası yerine gerçek WebAuthn (Face ID). Kod yolu aynı.
 */
import "dotenv/config";
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign as nodeSign, type KeyObject } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Address, Keypair, Networks, contract, nativeToScVal, rpc } from "@stellar/stellar-sdk";
import { SmartAccountKit, MemoryStorage } from "smart-account-kit";
import { Client as Vault } from "vault";

// ---------- env ----------
const ENV = ".env.local";
const local: Record<string, string> = Object.fromEntries(
  readFileSync(ENV, "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const save = (kv: Record<string, string>) => {
  let s = readFileSync(ENV, "utf8");
  for (const [k, v] of Object.entries(kv)) { const re = new RegExp("^" + k + "=.*$", "m"); s = re.test(s) ? s.replace(re, `${k}=${v}`) : s + (s.endsWith("\n") ? "" : "\n") + `${k}=${v}\n`; }
  writeFileSync(ENV, s);
};

const RPC = "https://soroban-testnet.stellar.org";
const RELAYER = "https://smart-account-relayer-proxy.sdf-ecosystem.workers.dev";
const RP_ID = "dna.local";
const ORIGIN = "https://dna.local";
const SAK = {
  accountWasmHash: "1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a",
  webauthnVerifier: "CC7EKIHQP3TN4CARQDND6CEOY2UXLWWC2X5GHTD5NLAT7BG5GPZIOM3F",
  ed25519Verifier: "CAAVTMCBXEIBPR64EAASKFXERVPYFZA2JYP5A3BG6PESWEFUJX5IHKN4",
};
const VAULT = local.VAULT_CONTRACT, TUSD_SAC = local.TUSD_SAC;
const deployer = Keypair.fromSecret(local.DEPLOYER_SECRET);

// ---------- yazılım passkey ----------
const b64u = (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64url");
const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest();

class SoftPasskey {
  priv: KeyObject; pubRaw: Buffer; credentialId: string; counter = 0;
  constructor(pkcs8B64?: string, credentialId?: string) {
    if (pkcs8B64) { this.priv = createPrivateKey({ key: Buffer.from(pkcs8B64, "base64"), format: "der", type: "pkcs8" }); }
    else { this.priv = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey; }
    const spki = createPublicKey(this.priv).export({ format: "der", type: "spki" }) as Buffer;
    this.pubRaw = spki.subarray(-65);                              // SPKI DER'in son 65 baytı = 0x04‖x‖y
    if (this.pubRaw[0] !== 0x04 || this.pubRaw.length !== 65) throw new Error("P-256 raw key çıkarılamadı");
    this.credentialId = credentialId ?? b64u(randomBytes(32));
  }
  export() { return { pkcs8: this.priv.export({ format: "der", type: "pkcs8" }).toString("base64"), credentialId: this.credentialId }; }
  authData(): Buffer { const c = Buffer.alloc(4); c.writeUInt32BE(++this.counter); return Buffer.concat([sha256(RP_ID), Buffer.from([0x05]), c]); } // UP|UV
  clientData(type: "webauthn.create" | "webauthn.get", challenge: string) {
    return Buffer.from(JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false }));
  }
  // kit.webAuthn arayüzü
  startRegistration = async ({ optionsJSON }: { optionsJSON: any }) => {
    if (optionsJSON.rp?.id && optionsJSON.rp.id !== RP_ID) throw new Error("rpId uyuşmuyor: " + optionsJSON.rp.id);
    const cd = this.clientData("webauthn.create", optionsJSON.challenge);
    return {
      id: this.credentialId, rawId: this.credentialId, type: "public-key" as const,
      response: { clientDataJSON: b64u(cd), attestationObject: "", authenticatorData: b64u(this.authData()),
                  publicKey: b64u(this.pubRaw), publicKeyAlgorithm: -7, transports: ["internal" as const] },
      clientExtensionResults: {}, authenticatorAttachment: "platform" as const,
    };
  };
  startAuthentication = async ({ optionsJSON }: { optionsJSON: any }) => {
    const allow = optionsJSON.allowCredentials?.map((c: any) => c.id);
    if (allow?.length && !allow.includes(this.credentialId)) throw new Error("allowCredentials bu passkey'i içermiyor");
    const cd = this.clientData("webauthn.get", optionsJSON.challenge);
    const ad = this.authData();
    const der = nodeSign("sha256", Buffer.concat([ad, sha256(cd)]), { key: this.priv, dsaEncoding: "der" });
    return {
      id: this.credentialId, rawId: this.credentialId, type: "public-key" as const,
      response: { authenticatorData: b64u(ad), clientDataJSON: b64u(cd), signature: b64u(der), userHandle: undefined },
      clientExtensionResults: {}, authenticatorAttachment: "platform" as const,
    };
  };
}
// ---------- yardımcılar ----------
const server = new rpc.Server(RPC);
const fmt = (v: bigint) => (Number(v) / 1e7).toLocaleString("tr-TR", { maximumFractionDigits: 7 });
const res = (r: any) => r?.success ? `✓ ${r.hash}` : `✗ [${r?.error?.code}] ${r?.error?.message}${r?.error?.contractErrorName ? " (" + r.error.contractErrorName + ")" : ""}`;

async function fundWithTusd(to: string, amount: bigint) {
  const sac = await contract.Client.from({ contractId: TUSD_SAC, rpcUrl: RPC, networkPassphrase: Networks.TESTNET,
    publicKey: deployer.publicKey(), ...contract.basicNodeSigner(deployer, Networks.TESTNET) });
  const tx = await (sac as any).transfer({ from: deployer.publicKey(), to, amount });
  const sent = await tx.signAndSend();
  return sent.getTransactionResponse?.txHash as string;
}
async function sacBalance(of: string): Promise<bigint> {
  const sac = await contract.Client.from({ contractId: TUSD_SAC, rpcUrl: RPC, networkPassphrase: Networks.TESTNET, publicKey: deployer.publicKey() });
  return (await (sac as any).balance({ id: of })).result as bigint;
}

// ---------- ana akış ----------
async function main() {
  const passkey = local.SA_PASSKEY_PKCS8 ? new SoftPasskey(local.SA_PASSKEY_PKCS8, local.SA_PASSKEY_CREDENTIAL_ID) : new SoftPasskey();
  console.log("passkey  credentialId:", passkey.credentialId.slice(0, 12) + "… · pub:", passkey.pubRaw.toString("hex").slice(0, 12) + "…", local.SA_PASSKEY_PKCS8 ? "(kayıtlı)" : "(yeni)");

  const kit = new SmartAccountKit({
    rpcUrl: RPC, networkPassphrase: Networks.TESTNET,
    accountWasmHash: SAK.accountWasmHash, webauthnVerifierAddress: SAK.webauthnVerifier, ed25519VerifierAddress: SAK.ed25519Verifier,
    relayerUrl: RELAYER, storage: new MemoryStorage(),
    rpId: RP_ID, rpName: "STELLACT", allowedOrigins: [ORIGIN],
    webAuthn: { startRegistration: passkey.startRegistration, startAuthentication: passkey.startAuthentication },
  });

  // 1) cüzdan: var olanı bağla ya da yarat
  let contractId = local.SA_CONTRACT;
  if (contractId) {
    const c = await kit.connectWallet({ credentialId: passkey.credentialId, contractId });
    console.log("connectWallet →", c ? "bağlandı " + c.contractId : "bağlanamadı");
    if (!c) contractId = "";
  }
  if (!contractId) {
    console.log("\ncreateWallet (paylaşımlı deployer, relayer öder)…");
    const t0 = Date.now();
    const w = await kit.createWallet("STELLACT", "smoke@dna.local", { autoSubmit: true });
    console.log("  deploy:", res(w.submitResult), `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    if (!w.submitResult?.success) { console.error("createWallet başarısız — çıkılıyor"); process.exit(1); }
    contractId = w.contractId;
    save({ SA_CONTRACT: contractId, SA_PASSKEY_CREDENTIAL_ID: passkey.credentialId, SA_PASSKEY_PKCS8: passkey.export().pkcs8 });
  }
  console.log("smart account (C):", contractId);

  // 2) TUSD fonla (contract adresi trustline'sız SAC bakiyesi tutar)
  let bal = await sacBalance(contractId);
  if (bal < 50n * 10_000_000n) {
    const h = await fundWithTusd(contractId, 100n * 10_000_000n);
    bal = await sacBalance(contractId);
    console.log("TUSD fonlandı → C bakiyesi", fmt(bal), "TUSD · tx", h?.slice(0, 10) + "…");
  } else console.log("C TUSD bakiyesi:", fmt(bal), "TUSD");

  // 3) Vault.deposit — smart account aracılığıyla, passkey imzalı, relayer sponsorlu
  const vaultRead = new Vault({ contractId: VAULT, networkPassphrase: Networks.TESTNET, rpcUrl: RPC, publicKey: deployer.publicKey() });
  const before = (await vaultRead.balance({ of: contractId })).result;
  console.log("\nVault.deposit(C, 50 TUSD) → executeAndSubmit …");
  const t1 = Date.now();
  const r = await kit.executeAndSubmit(VAULT, "deposit", [
    new Address(contractId).toScVal(),
    nativeToScVal(50n * 10_000_000n, { type: "i128" }),
  ]);
  console.log("  sonuç:", res(r), `(${((Date.now() - t1) / 1000).toFixed(1)}s)`);
  if (!r.success) process.exit(1);

  // 4) doğrula
  const after = (await vaultRead.balance({ of: contractId })).result;
  const since = (await vaultRead.deposited_at({ of: contractId })).result;
  console.log("\nVault.balance(C):", fmt(before), "→", fmt(after), "TUSD");
  console.log("Vault.deposited_at(C):", since.toString(), "→", new Date(Number(since) * 1000).toISOString());
  save({ SA_DEPOSIT_TX: r.hash });
  console.log("\nKAPI: passkey (yazılım) → smart account → sponsorlu Vault deposit → zincirde ✓");
}
main().catch(e => { console.error("HATA:", e?.message ?? e); if (e?.stack) console.error(e.stack.split("\n").slice(1, 6).join("\n")); process.exit(1); });
