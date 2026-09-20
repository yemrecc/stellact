/** Vault okuma (Sınıf A doğrulama: kontrattan okunur, güven gerekmez). Tarayıcı ve sunucuda çalışır. */
import { Client as Vault } from "vault";
import { CONFIG } from "./config";

export interface VaultPosition { balance_tusd: number; deposited_at: number | null; balance_raw: bigint }

const client = () =>
  new Vault({ contractId: CONFIG.vault, networkPassphrase: CONFIG.networkPassphrase, rpcUrl: CONFIG.rpcUrl, publicKey: CONFIG.readSource });

export async function readVault(of: string): Promise<VaultPosition> {
  const v = client();
  const [bal, since] = await Promise.all([v.balance({ of }), v.deposited_at({ of })]);
  const raw = bal.result as bigint;
  const s = Number(since.result as bigint);
  return { balance_raw: raw, balance_tusd: Number(raw) / 1e7, deposited_at: s > 0 ? s : null };
}
