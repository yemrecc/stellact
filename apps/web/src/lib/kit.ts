"use client";
/**
 * Smart Account Kit — tarayıcı tekil örneği.
 * Tembel yüklenir (SSR'da import edilmez): kit WebAuthn ve IndexedDB'ye dokunur.
 * webAuthn override YOK → gerçek WebAuthn (@simplewebauthn/browser). Node testindeki yazılım passkey ile aynı kod yolu.
 */
import type { SmartAccountKit } from "smart-account-kit";
import { CONFIG } from "./config";

let kitPromise: Promise<SmartAccountKit> | null = null;

export function getKit(): Promise<SmartAccountKit> {
  if (typeof window === "undefined") throw new Error("getKit yalnız tarayıcıda");
  if (!kitPromise) {
    kitPromise = import("smart-account-kit").then(({ SmartAccountKit, IndexedDBStorage }) =>
      new SmartAccountKit({
        rpcUrl: CONFIG.rpcUrl,
        networkPassphrase: CONFIG.networkPassphrase,
        accountWasmHash: CONFIG.sak.accountWasmHash,
        webauthnVerifierAddress: CONFIG.sak.webauthnVerifier,
        ed25519VerifierAddress: CONFIG.sak.ed25519Verifier,
        relayerUrl: CONFIG.relayerUrl,
        storage: new IndexedDBStorage(),
        rpId: window.location.hostname,
        rpName: "STELLACT",
      }),
    );
  }
  return kitPromise;
}

export type WalletState =
  | { status: "idle" }
  | { status: "restoring" }
  | { status: "prompting"; action: "create" | "connect" }
  | { status: "deploying"; startedAt: number }
  | { status: "connected"; contractId: string; credentialId?: string }
  | { status: "error"; message: string; hint?: string };

/** Sayfa yüklenince sessiz geri yükleme. */
export async function restoreWallet(): Promise<WalletState> {
  const kit = await getKit();
  const c = await kit.connectWallet();
  return c ? { status: "connected", contractId: c.contractId, credentialId: c.credentialId } : { status: "idle" };
}

export function explainError(e: unknown): { message: string; hint?: string } {
  const msg = e instanceof Error ? e.message : String(e);
  if (/NotAllowedError|not allowed|cancel/i.test(msg)) return { message: "Passkey isteği iptal edildi.", hint: "Tekrar deneyin; cihaz kilidinizi (Face ID / Touch ID / PIN) onaylayın." };
  if (/NotSupportedError|not supported|WebAuthn/i.test(msg)) return { message: "Bu tarayıcı veya cihaz passkey desteklemiyor.", hint: "Güncel Safari, Chrome veya Edge; HTTPS ya da localhost gerekir." };
  if (/SecurityError|origin|rpId/i.test(msg)) return { message: "Passkey bu adres için oluşturulamıyor.", hint: "Sayfa localhost veya HTTPS üzerinden açılmalı." };
  return { message: msg };
}
