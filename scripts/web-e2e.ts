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

/** SDS token'ları .sds-theme-* sınıfı altında tanımlı; sınıf yoksa bileşenler ÇIPLAK render edilir.
 *  Metin testleri bunu yakalamaz — bu yüzden hesaplanan stile bakıyoruz. */
const sdsStyled: Check = async page => {
  const el = page.locator("button.Button--primary").first();
  await el.waitFor({ timeout: 10_000 });
  const { bg, theme } = await el.evaluate(n => ({
    bg: getComputedStyle(n).backgroundColor,
    theme: document.documentElement.className.match(/sds-theme-\w+/)?.[0] ?? "(tema sınıfı yok)",
  }));
  const blank = bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
  return blank ? `SDS butonu stilsiz: background=${bg}, html=${theme}` : null;
};

const cases: { name: string; path: string; expect: string[]; forbid?: string[]; check?: Check; dark?: boolean }[] = [
  { name: "Script → Reddedildi", path: `/tasks/vault-50/result/${env.NEXT_PUBLIC_DEMO_SCRIPT}`, expect: ["Reddedildi", "sponsor_cluster_size=41 > 10", "Soy ağacı · 41 hesap"], forbid: ["Zincire ulaşılamadı"] },
  { name: "Kullanıcı → Geçti", path: `/tasks/vault-50/result/${env.NEXT_PUBLIC_DEMO_GENUINE}`, expect: ["Geçti", "tasdik yazılır", "sponsor yok"], forbid: ["Reddedildi", "Zincire ulaşılamadı"] },
  { name: "Smart account DNA", path: `/dna/${env.NEXT_PUBLIC_DEMO_SMART_ACCOUNT}`, expect: ["Smart account", "100 TUSD", "first:vault.deposit"], forbid: ["Zincire ulaşılamadı"] },
  // Ajan geni satıcının settlement kaydından gelir — demo API (:3001) ayakta olmalı (pnpm api:dev).
  { name: "Ajan DNA → x402 geni", path: `/dna/${env.NEXT_PUBLIC_DEMO_AGENT}`, expect: ["ücretli çağrı · zincirde mutabık (x402)", "sorgu çeşitliliği"], forbid: ["Zincire ulaşılamadı"] },
  { name: "Giriş (kit yüklenir, idle)", path: `/`, expect: ["Passkey ile cüzdan oluştur"], forbid: ["Kayıtlı cüzdan aranıyor"], check: sdsStyled },
];

/** Koyu tema: SDS tema sınıfı ve bizim --dna-* token'larımız aynı sinyali okumalı (brief §9). */
const darkOk: Check = async page => {
  const { theme, ground, btn } = await page.evaluate(() => ({
    theme: document.documentElement.className.match(/sds-theme-\w+/)?.[0] ?? "(yok)",
    ground: getComputedStyle(document.body).backgroundColor,
    btn: getComputedStyle(document.querySelector("button.Button--primary")!).backgroundColor,
  }));
  if (theme !== "sds-theme-dark") return `koyu temada SDS sınıfı yanlış: ${theme}`;
  if (ground !== "rgb(14, 17, 22)") return `koyu zemin uygulanmadı: ${ground}`;
  if (btn === "rgba(0, 0, 0, 0)") return `koyu temada buton stilsiz: ${btn}`;
  return null;
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
cases.push({ name: "Giriş · koyu tema", path: "/", expect: ["Passkey ile cüzdan oluştur"], check: darkOk, dark: true });
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
