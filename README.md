# Stellar DNA — Proof of Real Use

On-chain verification, attestations and DNA for wallets and AI agents on Stellar.
Plan: `../Stellar_DNA_Build_Plan.md` (§0.5 gerçek durum) · Product: `../Stellar_DNA_Platform_v2.md`

## Testnet quick start
```bash
pnpm install
pnpm setup:testnet        # anahtarlar, friendbot, USDC trustline → .env.local (idempotent; reset sonrası tekrar)
pnpm attest:bootstrap     # kendi Attest instance'ımızda şemalar + BLS + delegasyonlu tasdik (ATTEST_OWN_*)
pnpm attest:read [uid]    # bir tasdiki zincirden okur
pnpm contracts:test       # Vault (Xcode lisansı: sudo xcodebuild -license accept)
pnpm contracts:build
```

## Ne var
- `packages/stellar` — ağ config + doğrulanmış sabitler (USDC, Attest, 8004, SAK, Blend)
- `packages/bindings/{attest-protocol,e8004-identity,e8004-reputation}` — `stellar contract bindings typescript` çıktıları (derlendi)
- `contracts/vault` — Soroban Vault (deposit/withdraw/balance/deposited_at) + testler
- `contracts/vendor/attest_protocol_v2.0.1.wasm` — Attest protokol WASM'ı (GitHub release); testnet instance `CDVWU57S…`
- `scripts/lib/attest-delegation.ts` — `main` düzenli delegasyon mesajı (subject+value hash); `main` derlenip deploy edilince kullanılacak

## Elle yapılacaklar (web-only)
1. Circle faucet → https://faucet.circle.com (REWARD_POOL, X402_RECIPIENT, AGENT — adresler `.env.local`)
2. OZ Channels API key → https://channels.openzeppelin.com/testnet/gen → `OZ_API_KEY`
3. `sudo xcodebuild -license accept`
