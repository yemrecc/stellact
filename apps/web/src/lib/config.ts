/**
 * Kamuya açık yapılandırma. Değerler apps/web/.env.local'dan (kökte `pnpm web:env` üretir). Gizli anahtar yok.
 *
 * DİKKAT: `NEXT_PUBLIC_*` yalnızca **literal** `process.env.NEXT_PUBLIC_X` erişiminde derleme anında gömülür.
 * `process.env[k]` gibi dinamik erişim sunucuda çalışır ama tarayıcı paketinde `undefined` olur.
 * Bu yüzden aşağıdaki her satır literal — kısaltmayın.
 */
const RAW = {
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
  horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL,
  relayerUrl: process.env.NEXT_PUBLIC_RELAYER_URL,
  vault: process.env.NEXT_PUBLIC_VAULT_CONTRACT,
  tusdSac: process.env.NEXT_PUBLIC_TUSD_SAC,
  tusdIssuer: process.env.NEXT_PUBLIC_TUSD_ISSUER,
  attest: process.env.NEXT_PUBLIC_ATTEST_CONTRACT,
  poaSchema: process.env.NEXT_PUBLIC_POA_SCHEMA,
  readSource: process.env.NEXT_PUBLIC_READ_SOURCE,
  demoGenuine: process.env.NEXT_PUBLIC_DEMO_GENUINE,
  demoScript: process.env.NEXT_PUBLIC_DEMO_SCRIPT,
  demoSponsor: process.env.NEXT_PUBLIC_DEMO_SPONSOR,
  demoSmartAccount: process.env.NEXT_PUBLIC_DEMO_SMART_ACCOUNT,
  demoAgent: process.env.NEXT_PUBLIC_DEMO_AGENT,
  demoApiUrl: process.env.NEXT_PUBLIC_DEMO_API_URL,
} as const;

/** Zorunlu değer eksikse render anında değil, kullanım anında patlasın — sayfa yine de açılır. */
const req = (v: string | undefined, name: string): string => {
  if (!v) throw new Error(`Eksik env: NEXT_PUBLIC_${name} — kök dizinde \`pnpm web:env\` çalıştır`);
  return v;
};

export const CONFIG = {
  network: (RAW.network ?? "testnet") as "testnet" | "mainnet",
  rpcUrl: RAW.rpcUrl ?? "https://soroban-testnet.stellar.org",
  horizonUrl: RAW.horizonUrl ?? "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  relayerUrl: RAW.relayerUrl ?? "https://smart-account-relayer-proxy.sdf-ecosystem.workers.dev",
  get vault() { return req(RAW.vault, "VAULT_CONTRACT"); },
  get tusdSac() { return req(RAW.tusdSac, "TUSD_SAC"); },
  get tusdIssuer() { return req(RAW.tusdIssuer, "TUSD_ISSUER"); },
  get attest() { return req(RAW.attest, "ATTEST_CONTRACT"); },
  get poaSchema() { return req(RAW.poaSchema, "POA_SCHEMA"); },
  get readSource() { return req(RAW.readSource, "READ_SOURCE"); },
  demo: {
    genuine: RAW.demoGenuine ?? "",
    script: RAW.demoScript ?? "",
    sponsor: RAW.demoSponsor ?? "",
    smartAccount: RAW.demoSmartAccount ?? "",
    agent: RAW.demoAgent ?? "",
    /** x402 satıcısı — ajan olgularının (settlement kaydı) okunduğu yer. */
    apiUrl: RAW.demoApiUrl ?? "http://localhost:3001",
  },
  // Smart Account Kit — Protocol 27 testnet deploy'ları (docs/deployments-protocol-27-2026-07-09.md)
  sak: {
    accountWasmHash: "1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a",
    webauthnVerifier: "CC7EKIHQP3TN4CARQDND6CEOY2UXLWWC2X5GHTD5NLAT7BG5GPZIOM3F",
    ed25519Verifier: "CAAVTMCBXEIBPR64EAASKFXERVPYFZA2JYP5A3BG6PESWEFUJX5IHKN4",
  },
  explorer: "https://stellar.expert/explorer/testnet",
} as const;

export const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-6)}` : "—");
export const fmtTusd = (stroops: bigint | number) => (Number(stroops) / 1e7).toLocaleString("tr-TR", { maximumFractionDigits: 7 });
export const fmtUtc = (iso?: string | null) => (iso ? new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—");
