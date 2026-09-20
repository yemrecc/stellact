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
  if (typeof window === "undefined") throw new Error("getKit runs in the browser only");
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
  if (/NotAllowedError|not allowed|cancel/i.test(msg)) return { message: "The passkey request was cancelled", hint: "Try again and confirm your device lock (Face ID / Touch ID / PIN)." };
  if (/NotSupportedError|not supported|WebAuthn/i.test(msg)) return { message: "This browser or device does not support passkeys", hint: "A current Safari, Chrome or Edge is required, over HTTPS or localhost." };
  if (/SecurityError|origin|rpId/i.test(msg)) return { message: "A passkey cannot be created for this page address", hint: "The page must be opened over localhost or HTTPS." };
  return { message: msg };
}
