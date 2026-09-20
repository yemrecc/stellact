/**
 * Demo ücretli API — x402 satıcı tarafı (STELLACT ajan katmanı).
 *
 * Senaryo: bir FX/kur veri sağlayıcısı. Üç ücretli uç nokta, farklı fiyatlar.
 * Ödeme TUSD ile (Circle USDC yerine kendi test varlığımız — §0.5), facilitator
 * ücretleri sponsorluyor, yani ajanın XLM'i olmasına gerek yok.
 *
 * Her başarılı settlement JSONL'e yazılır. `x402.settled` ve `query_diversity`
 * doğrulayıcıları bunu okur: RPC'nin olay saklama penceresi ~7 gün, o yüzden
 * kanıtı settlement anında kendimiz kaydediyoruz (§7).
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import express, { type Request, type Response, type NextFunction } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

// ---- env: kök .env.local (tek kaynak) ----
const ROOT_ENV = resolve(import.meta.dirname, "../../../.env.local");
const env: Record<string, string> = existsSync(ROOT_ENV)
  ? Object.fromEntries(readFileSync(ROOT_ENV, "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }))
  : {};
const cfg = (k: string, fallback?: string) => process.env[k] ?? env[k] ?? fallback;

const NETWORK = cfg("X402_NETWORK", "stellar:testnet")!;
const RECIPIENT = cfg("X402_RECIPIENT_PUBLIC");           // G… — TUSD trustline'lı
const ASSET = cfg("TUSD_SAC");                            // C… — SAC, transfer burada çağrılır
const OZ_API_KEY = cfg("OZ_API_KEY");
const FACILITATOR = cfg("FACILITATOR_URL", "https://channels.openzeppelin.com/x402/testnet")!;
const PORT = Number(cfg("DEMO_API_PORT", "3001"));
const LOG = resolve(import.meta.dirname, "../settlements.jsonl");

for (const [k, v] of Object.entries({ X402_RECIPIENT_PUBLIC: RECIPIENT, TUSD_SAC: ASSET })) {
  if (!v) throw new Error(`Eksik env: ${k} — kökte \`pnpm setup:testnet\` ve \`pnpm setup:asset\` çalıştır`);
}

// ---- facilitator ----
// OZ Channels Bearer ister; anahtarsız yedek x402.org (yalnız testnet).
const needsAuth = FACILITATOR.includes("openzeppelin.com");
if (needsAuth && !OZ_API_KEY) throw new Error("OZ_API_KEY gerekli — https://channels.openzeppelin.com/testnet/gen (captcha'sız GET)");
const facilitator = new HTTPFacilitatorClient({
  url: FACILITATOR,
  ...(needsAuth ? {
    createAuthHeaders: async () => {
      const h = { Authorization: `Bearer ${OZ_API_KEY}` };
      return { verify: h, settle: h, supported: h };
    },
  } : {}),
});
const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ExactStellarScheme());

/* Görünürlük: x402 402'yi gövdesiz döndürür, o yüzden doğrulama/mutabakat sonucunu
   kancalardan kendimiz basıyoruz. Bir ödeme reddedilirse sebebini burada görürüz. */
const brief = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "string" && x.length > 120 ? x.slice(0, 120) + "…" : x));
resourceServer.registerExtension({
  key: "stellact-observability",
  hooks: {
    onAfterVerify: async (_d, ctx) => { console.log(`  verify → ${brief(ctx.result)}`); },
    onVerifyFailure: async (_d, ctx) => { console.log(`  verify FAIL → ${brief(ctx)}`); },
    onAfterSettle: async (_d, ctx) => { console.log(`  settle → ${brief((ctx as { result?: unknown }).result ?? ctx)}`); },
    onSettleFailure: async (_d, ctx) => { console.log(`  settle FAIL → ${brief(ctx)}`); },
  },
});

// ---- fiyatlar: TUSD, 7 ondalık, açık taban birimi ----
const TUSD = (whole: number) => ({ amount: String(Math.round(whole * 1e7)), asset: ASSET! });
const route = (price: ReturnType<typeof TUSD>, description: string) => ({
  accepts: { scheme: "exact" as const, price, network: NETWORK, payTo: RECIPIENT! },
  description,
});

const app = express();

// ---- settlement kaydı ----
// Ödemeyi middleware yapar; biz yanıt başlığından kanıtı alıp kalıcı hâle getiriyoruz.
export interface Settlement { ts: string; payer: string; endpoint: string; params_hash: string; tx_hash: string; amount: string; network: string }
const sha8 = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

function recordSettlements(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    const raw = res.getHeader("x-payment-response");
    if (!raw || res.statusCode >= 400) return;
    try {
      const decoded = JSON.parse(Buffer.from(String(raw), "base64").toString("utf8"));
      if (!decoded?.success) return;
      const entry: Settlement = {
        ts: new Date().toISOString(),
        payer: decoded.payer ?? decoded.from ?? "",
        endpoint: req.path,
        params_hash: sha8(JSON.stringify({ p: req.params, q: req.query })),
        tx_hash: decoded.transaction ?? decoded.txHash ?? "",
        amount: decoded.amount ?? "",
        network: decoded.network ?? NETWORK,
      };
      appendFileSync(LOG, JSON.stringify(entry) + "\n");
      console.log(`  ✓ settle ${entry.endpoint} · ${entry.payer.slice(0, 8)}… · tx ${entry.tx_hash.slice(0, 10)}…`);
    } catch (e) {
      console.warn("  ! settlement kaydı çözülemedi:", (e as Error).message, "| ham:", String(raw).slice(0, 80));
    }
  });
  next();
}
/* İstek izi: nohup altında stdout tamponlanabildiği için dosyaya yazıyoruz. */
const TRACE = resolve(import.meta.dirname, "../requests.log");
const trace = (line: string) => { try { appendFileSync(TRACE, `${new Date().toISOString()} ${line}\n`); } catch { /* yoksay */ } };
app.use((req, res, next) => {
  // Ödeme başlığı sürüme göre değişiyor: x402 v2 `PAYMENT-SIGNATURE`, eski istemciler `X-PAYMENT`.
  const payHdrs = Object.entries(req.headers).filter(([k]) => /payment/i.test(k)).map(([k, v]) => `${k}(${String(v).length}b)`);
  trace(`→ ${req.method} ${req.originalUrl}  ${payHdrs.length ? payHdrs.join(" ") : "(ödemesiz)"}`);
  res.on("finish", () => {
    // 402'nin sebebi gövdede değil, PAYMENT-REQUIRED başlığının içinde (base64 JSON).
    let why = "";
    const pr = res.getHeader("payment-required") ?? res.getHeader("x-payment-required");
    if (pr) {
      try {
        const d = JSON.parse(Buffer.from(String(pr), "base64").toString("utf8"));
        why = `  error=${JSON.stringify(d.error ?? d).slice(0, 220)}`;
      } catch { why = "  (başlık çözülemedi)"; }
    }
    trace(`← ${res.statusCode} ${req.originalUrl}${why}`);
  });
  next();
});
app.use(recordSettlements);

app.use(paymentMiddleware({
  "GET /rates/:pair":   route(TUSD(0.001), "Anlık kur — ör. /rates/USDTRY"),
  "GET /signals":       route(TUSD(0.002), "Kur sinyalleri"),
  "GET /history/:pair": route(TUSD(0.003), "Günlük kur geçmişi"),
}, resourceServer));

// ---- ücretli uç noktalar (deterministik demo verisi) ----
const rate = (pair: string) => {
  const seed = Number(BigInt("0x" + createHash("sha256").update(pair).digest("hex").slice(0, 8)));
  return Number((20 + (seed % 2000) / 100).toFixed(4));
};
app.get("/rates/:pair", (req, res) => {
  const pair = req.params.pair.toUpperCase();
  res.json({ pair, rate: rate(pair), asOf: new Date().toISOString(), source: "STELLACT demo" });
});
app.get("/signals", (_req, res) => {
  res.json({ signals: [{ pair: "USDTRY", bias: "neutral" }, { pair: "EURTRY", bias: "up" }], asOf: new Date().toISOString() });
});
app.get("/history/:pair", (req, res) => {
  const pair = req.params.pair.toUpperCase();
  const base = rate(pair);
  const days = Math.min(30, Number(req.query.days ?? 7));
  res.json({ pair, days, series: Array.from({ length: days }, (_, i) => ({ d: i, rate: Number((base * (1 + (i % 5 - 2) / 500)).toFixed(4)) })) });
});

// ---- ücretsiz: doğrulayıcı bunu okur ----
app.get("/settlements", (req, res) => {
  const payer = String(req.query.payer ?? "");
  const all: Settlement[] = existsSync(LOG)
    ? readFileSync(LOG, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l) as Settlement)
    : [];
  const rows = payer ? all.filter(s => s.payer === payer) : all;
  res.json({ count: rows.length, settlements: rows });
});
app.get("/health", (_req, res) => res.json({ ok: true, network: NETWORK, asset: ASSET, payTo: RECIPIENT, facilitator: FACILITATOR }));

app.listen(PORT, () => {
  console.log(`x402 demo API → http://localhost:${PORT}  (${NETWORK})`);
  console.log(`  payTo ${RECIPIENT}  ·  asset ${ASSET}`);
  console.log(`  facilitator ${FACILITATOR}${needsAuth ? " (Bearer)" : " (anahtarsız)"}`);
  console.log(`  ücretli: GET /rates/:pair (0.001) · /signals (0.002) · /history/:pair (0.003) TUSD`);
  console.log(`  ücretsiz: GET /settlements?payer=G… · /health`);
});
