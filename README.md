# STELLACT

**Your actions become your identity. · Proof of Real Use on Stellar.**

On-chain verification, attestations and DNA for wallets and AI agents on Stellar.
Plan: `../STELLACT_Build_Plan.md` (§0.5 gerçek durum) · Product: `../STELLACT_Platform_v2.md`

## Testnet quick start
```bash
pnpm install
pnpm setup:testnet        # anahtarlar, friendbot, USDC trustline → .env.local (idempotent; reset sonrası tekrar)
pnpm attest:bootstrap     # kendi Attest instance'ımızda şemalar + BLS + delegasyonlu tasdik (ATTEST_OWN_*)
pnpm attest:read [uid]    # bir tasdiki zincirden okur
pnpm setup:asset          # TUSD test varlığı + SAC (Circle faucet yerine)
pnpm setup:sybil          # 41 kardeşli sponsorlu Sybil kümesi (ret ekranının gerçek verisi)
pnpm vault:smoke          # G-hesabından Vault deposit + /decide örnekleri
pnpm smart:smoke          # yazılım passkey → smart account → relayer sponsorlu Vault deposit (tarayıcısız)
pnpm dna:smoke            # @stellact/dna: iki cüzdan, aynı görev, iki karar

# Web
pnpm web:env              # kök .env.local → apps/web/.env.local (yalnız NEXT_PUBLIC_*)
pnpm web:dev              # http://localhost:3000
SHOT_DIR=/tmp pnpm web:e2e   # headless Chrome: 5 senaryo + SDS stil ve koyu tema nöbetçileri
pnpm contracts:test       # Vault (Xcode lisansı: sudo xcodebuild -license accept)
pnpm contracts:build
```

## Rotalar
`/` passkey giriş · `/tasks` · `/tasks/[id]` (tek tıkla yatır) · `/tasks/[id]/result/[subject]` **karar** · `/dna/[address]` · `/index`

## Ne var
- `apps/web` — Next.js 16 (App Router) + Stellar Design System; karar ekranı zinciri canlı okur
- `packages/dna` — `computeGenome` (7 boyut) · `decide` (3 politika şablonu) · Horizon okuyucu. Saf, test edilebilir
- `packages/stellar` — ağ config + doğrulanmış sabitler (USDC, Attest, 8004, SAK, Blend)
- `packages/bindings/{attest-protocol,e8004-identity,e8004-reputation}` — `stellar contract bindings typescript` çıktıları (derlendi)
- `contracts/vault` — Soroban Vault (deposit/withdraw/balance/deposited_at) + testler
- `contracts/vendor/attest_protocol_v2.0.1.wasm` — Attest protokol WASM'ı (GitHub release); testnet instance `CDVWU57S…`
- `scripts/smart-account-smoke.ts` — kit'in `webAuthn` kancası için Node P-256 yazılım authenticator'ı; passkey akışının CI'da koşan hâli
- `scripts/lib/attest-delegation.ts` — `main` düzenli delegasyon mesajı (subject+value hash); `main` derlenip deploy edilince kullanılacak

## Elle yapılacaklar (web-only)
1. Circle faucet → https://faucet.circle.com (REWARD_POOL, X402_RECIPIENT, AGENT — adresler `.env.local`)
2. OZ Channels API key → https://channels.openzeppelin.com/testnet/gen → `OZ_API_KEY`
3. `sudo xcodebuild -license accept`

## İki tuzak (tekrar düşmemek için)
1. **`NEXT_PUBLIC_*` literal okunmalı.** `process.env[k]` sunucuda çalışır, tarayıcı paketinde `undefined` olur — `src/lib/config.ts` bu yüzden her değişkeni tek tek yazar.
2. **SDS tema sınıfı şart.** `--sds-clr-*` token'ları yalnız `.sds-theme-light`/`.sds-theme-dark` altında tanımlı; sınıf yoksa bileşenler çıplak render edilir. `layout.tsx`'te boyama-öncesi inline script hallediyor. `pnpm web:e2e` ikisini de kolluyor.
