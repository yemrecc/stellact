/**
 * x402 alıcı — ajan ve script, aynı görev, farklı davranış.
 *
 * Görev: "demo API'ye 3 farklı sorguyla öde."
 *   AJAN   → 3 ayrı uç nokta/parametre  → query_diversity 1.00 → geçer
 *   SCRIPT → aynı sorgu 3 kez           → query_diversity 0.33 → reddedilir
 *
 * İkisi de gerçekten ödüyor (TUSD, testnet, facilitator ücreti sponsorluyor).
 * Fark davranışta, ödemede değil — ürünün tezi tam olarak bu.
 *
 * Not: @x402/stellar'ın istemci imzalayıcısı klasik G-hesap bekliyor; ajan
 * ödemesi şimdilik G-hesaptan. Harcama limiti uygulama katmanında (§15).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const local: Record<string, string> = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const NETWORK = "stellar:testnet";
const API = process.env.DEMO_API_URL ?? "http://localhost:3001";

const TUSD_SAC = local.TUSD_SAC;
/** Çağrı başı bütçe, taban birimde (7 ondalık). 0,005 TUSD — en pahalı uç nokta 0,003. */
const MAX_PER_CALL = "50000";

/**
 * Ödeme yapabilen fetch.
 *
 * `spendControls` bir engel değil, ürünün istediği koruma: istemci varsayılan
 * olmayan bir varlıkta (TUSD) kendiliğinden ödeme YAPMAZ — varlık açıkça
 * izinli olmalı ve çağrı başı üst sınırı bulunmalı. Ajan cüzdanının bütçesi
 * burada yaşıyor; sınırı aşan bir fiyat istemci tarafında reddedilir,
 * zincire hiç gitmez.
 */
function payingFetch(secret: string) {
  const signer = createEd25519Signer(secret, NETWORK);
  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: NETWORK, client: new ExactStellarScheme(signer) }],
    spendControls: { allowedAssets: [{ network: NETWORK, asset: TUSD_SAC, maxAmountPerPayment: MAX_PER_CALL }] },
  });
}

async function run(label: string, secret: string, pub: string, paths: string[]) {
  console.log(`\n${label}  ${pub.slice(0, 8)}…`);
  const f = payingFetch(secret);
  const results: { path: string; ok: boolean; note: string }[] = [];
  for (const p of paths) {
    const t0 = Date.now();
    try {
      const r = await f(API + p);
      const raw = await r.text();
      const note = r.ok ? raw.slice(0, 60) : `HTTP ${r.status} · ${raw.slice(0, 220) || "(boş gövde)"} · hdr=${JSON.stringify(Object.fromEntries([...r.headers].filter(([k]) => /x-payment|x402|www-auth/i.test(k)))).slice(0, 200)}`;
      results.push({ path: p, ok: r.ok, note });
      console.log(`  ${r.ok ? "✓" : "✗"} ${p.padEnd(24)} ${((Date.now() - t0) / 1000).toFixed(1)}s  ${note}`);
    } catch (e) {
      results.push({ path: p, ok: false, note: (e as Error).message.slice(0, 80) });
      console.log(`  ✗ ${p.padEnd(24)} ${(e as Error).message.slice(0, 90)}`);
    }
  }
  return results;
}

async function settlementsFor(pub: string) {
  const r = await fetch(`${API}/settlements?payer=${pub}`);
  const { settlements } = await r.json() as { settlements: { endpoint: string; params_hash: string; tx_hash: string }[] };
  const distinct = new Set(settlements.map(s => s.endpoint + ":" + s.params_hash)).size;
  return { total: settlements.length, distinct, diversity: settlements.length ? distinct / settlements.length : 0, settlements };
}

async function main() {
  const agentSecret = local.AGENT_SECRET, agentPub = local.AGENT_PUBLIC;
  const scriptSecret = local.SYBIL_SCRIPT_SECRET, scriptPub = local.SYBIL_SCRIPT;
  if (!agentSecret || !scriptSecret) throw new Error("AGENT_SECRET / SYBIL_SCRIPT_SECRET yok — `pnpm setup:testnet` ve `pnpm setup:sybil`");

  // Ajan: üç ayrı sorgu
  await run("AJAN  (3 farklı sorgu)", agentSecret, agentPub, ["/rates/USDTRY", "/signals", "/history/EURTRY?days=5"]);
  // Script: aynı sorgu üç kez
  await run("SCRIPT (aynı sorgu ×3)", scriptSecret, scriptPub, ["/rates/USDTRY", "/rates/USDTRY", "/rates/USDTRY"]);

  console.log("\n--- query_diversity (doğrulayıcının göreceği) ---");
  for (const [label, pub] of [["AJAN  ", agentPub], ["SCRIPT", scriptPub]] as const) {
    const s = await settlementsFor(pub);
    console.log(`${label}  settlement=${s.total}  ayrı=${s.distinct}  diversity=${s.diversity.toFixed(2)}  → ${s.diversity >= 0.5 ? "geçer" : "REDDEDİLİR (query_diversity < 0.5)"}`);
  }
}
main().catch(e => { console.error("HATA:", e?.message ?? e); if (e?.stack) console.error(e.stack.split("\n").slice(1, 5).join("\n")); process.exit(1); });
