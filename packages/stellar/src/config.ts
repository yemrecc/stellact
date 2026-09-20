import { Networks } from "@stellar/stellar-sdk";

export type NetworkName = "testnet" | "mainnet";

export interface NetworkConfig {
  name: NetworkName;
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  friendbotUrl: string | null;
  caip2: string; // x402 / MPP için
}

const requireEnv = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`Eksik env: ${k}`);
  return v;
};

// Tembel: yalnız seçilen ağın env'i okunur — testnet, mainnet RPC olmadan çalışır.
const configs: Record<NetworkName, () => NetworkConfig> = {
  testnet: () => ({
    name: "testnet",
    rpcUrl: process.env.TESTNET_RPC ?? "https://soroban-testnet.stellar.org",
    horizonUrl: process.env.TESTNET_HORIZON ?? "https://horizon-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
    friendbotUrl: "https://friendbot.stellar.org",
    caip2: "stellar:testnet",
  }),
  mainnet: () => ({
    name: "mainnet",
    rpcUrl: requireEnv("MAINNET_RPC"),
    horizonUrl: process.env.MAINNET_HORIZON ?? "https://horizon.stellar.org",
    networkPassphrase: Networks.PUBLIC,
    friendbotUrl: null,
    caip2: "stellar:pubnet",
  }),
};

export const getNetwork = (name: NetworkName = (process.env.STELLAR_NETWORK as NetworkName) ?? "testnet") =>
  configs[name]();
