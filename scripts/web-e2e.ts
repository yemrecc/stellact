/**
 * Web istemci doğrulaması — sistem Chrome'u ile headless (indirme yok). WebAuthn hariç her şey:
 * stellar-sdk tarayıcıda, vault bindings, Horizon fetch, @stellact/dna, karar render'ı.
 * Ön koşul: dev server http://localhost:3000 ayakta (pnpm web:dev).
 */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const env: Record<string, string> = Object.fromEntries(readFileSync("apps/web/.env.local", "utf8").split("\n").filter(l => l.includes("=")).map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; }));
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

/** Sayfa içi ek kontroller — metin dışı regresyonlar için (ör. stil yüklenmemiş bileşen). */
type Check = (page: import("playwright-core").Page) => Promise<string | null>;

/** Stil yüklenmezse metin testleri bunu yakalamaz — birincil düğmenin hesaplanan
 *  arka planına ve başlığın yazıtipine bakıyoruz (tasarımın iki taşıyıcı sinyali). */
const styled: Check = async page => {
  const el = page.locator("button.btn--primary, a.btn--primary").first();
  await el.waitFor({ timeout: 10_000 });
  const { bg, head } = await el.evaluate(n => ({
    bg: getComputedStyle(n).backgroundColor,
    head: getComputedStyle(document.querySelector("h1")!).fontFamily,
  }));
  const blank = bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
  if (blank) return `birincil düğme stilsiz: background=${bg}`;
  if (!/Familjen/i.test(head)) return `başlık yazıtipi yüklenmemiş: ${head}`;
  return null;
};

/* Metin beklentileri gerekçe CÜMLESİNE değil, koda ve sabit arayüz metnine bağlanır:
   cümleler ürün diliyle birlikte değişir, kod (`sponsor_cluster_size=41 > 10`) değişmez. */
const cases: { name: string; path: string; expect: string[]; forbid?: string[]; check?: Check; dark?: boolean }[] = [
  { name: "Script → Rejected", path: `/tasks/vault-50/result/${env.NEXT_PUBLIC_DEMO_SCRIPT}`, expect: ["Rejected", "sponsor_cluster_size=41 > 10", "What would make it pass", "Lineage"], forbid: ["Horizon unreachable"] },
  { name: "User → Passed", path: `/tasks/vault-50/result/${env.NEXT_PUBLIC_DEMO_GENUINE}`, expect: ["Passed", "attestation written", "What was actually done"], forbid: ["Rejected", "Horizon unreachable"] },
  { name: "Smart account DNA", path: `/dna/${env.NEXT_PUBLIC_DEMO_SMART_ACCOUNT}`, expect: ["Smart account", "TUSD", "first:vault.deposit"], forbid: ["Horizon unreachable"] },
  // Ajan geni satıcının settlement kaydından gelir — demo API (:3001) ayakta olmalı (pnpm api:dev).
  { name: "Agent DNA → x402 gene", path: `/dna/${env.NEXT_PUBLIC_DEMO_AGENT}`, expect: ["settlements · diversity", "query diversity"], forbid: ["Horizon unreachable"] },
  { name: "Agent task → policy table", path: "/tasks/x402-diversity", expect: ["Query diversity", "query_diversity ≥", "agent"], forbid: ["Horizon unreachable"] },
  { name: "Tasks list", path: "/tasks", expect: ["Deposit at least 50 TUSD", "Pay for 3 different queries", "Class A"], forbid: ["Horizon unreachable"] },
  { name: "Login (kit loads, idle)", path: `/`, expect: ["Create wallet with passkey", "The chain says what your wallet actually did."], forbid: ["Looking for a saved wallet"], check: styled },
];

/** Koyu tema: SDS tema sınıfı ve bizim --dna-* token'larımız aynı sinyali okumalı (brief §9). */
const darkOk: Check = async page => {
  const { ground, ink, btn } = await page.evaluate(() => ({
    ground: getComputedStyle(document.body).backgroundColor,
    ink: getComputedStyle(document.body).color,
    btn: getComputedStyle(document.querySelector("button.btn--primary")!).backgroundColor,
  }));
  if (ground !== "rgb(14, 17, 22)") return `koyu zemin uygulanmadı: ${ground}`;
  if (ink !== "rgb(242, 244, 247)") return `koyu temada metin rengi yanlış: ${ink}`;
  if (btn === "rgba(0, 0, 0, 0)") return `koyu temada buton stilsiz: ${btn}`;
  return null;
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
cases.push({ name: "Login · dark theme", path: "/", expect: ["Create wallet with passkey"], check: darkOk, dark: true });
let failed = 0;
for (const c of cases) {
  const page = await (c.dark ? browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" }) : Promise.resolve(ctx)).then(x => x.newPage());
  const errors: string[] = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
  const t0 = Date.now();
  await page.goto(BASE + c.path, { waitUntil: "domcontentloaded" });
  let ok = true; const notes: string[] = [];
  for (const text of c.expect) {
    try { await page.getByText(text, { exact: false }).first().waitFor({ timeout: 25_000 }); }
    catch { ok = false; notes.push(`bekleniyordu: "${text}"`); }
  }
  const body = await page.locator("body").innerText();
  for (const text of c.forbid ?? []) if (body.includes(text)) { ok = false; notes.push(`olmamalıydı: "${text}"`); }
  if (c.check) {
    try { const problem = await c.check(page); if (problem) { ok = false; notes.push(problem); } }
    catch (e) { ok = false; notes.push("check hatası: " + (e instanceof Error ? e.message : String(e)).slice(0, 120)); }
  }
  const realErrors = errors.filter(e => !/favicon|404 \(Not Found\)/.test(e));
  if (realErrors.length) { ok = false; notes.push(...realErrors.slice(0, 4)); }
  console.log(`${ok ? "✓" : "✗"} ${c.name.padEnd(28)} ${((Date.now() - t0) / 1000).toFixed(1)}s ${notes.length ? "\n    " + notes.join("\n    ") : ""}`);
  if (!ok) failed++;
  const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  await page.screenshot({ path: `${process.env.SHOT_DIR ?? "/tmp"}/e2e-${slug}.png`, fullPage: true });
  await page.close();
}
await browser.close();
console.log(failed ? `\n${failed} senaryo başarısız` : "\nistemci paketi tarayıcıda çalışıyor ✓");
process.exit(failed ? 1 : 0);
