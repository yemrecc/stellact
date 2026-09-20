/** @stellact/dna dumanlı test — Script (Sybil) ve Kullanıcı cüzdanı, aynı görev, iki karar. */
import { readWalletFacts, readSiblings, computeGenome, decide, POLICIES } from "@stellact/dna";

const cases = [
  { label: "Script (sybil)", id: "GDLC5R7VYWG4XFUL4ACNKBXUZLJ6DQHDCBHBR3KTTHIT5EJKFZVTM6LV", vault: { balance_tusd: 50, deposited_at: 1789883572 } },
  { label: "Kullanıcı",      id: "GCM4VOWSQFOYMR3SPW76JGSJH5KMNFNDDVFUAUML2E2L366B7IV2CHFQ",    vault: { balance_tusd: 50, deposited_at: 1789882682 } },
];
for (const c of cases) {
  const w = await readWalletFacts(c.id, "testnet", c.vault);
  const sib = await readSiblings(w.sponsor, "testnet");
  const g = computeGenome(w, sib);
  const d = decide(g, POLICIES.permissive, c.id);
  console.log(`${c.label.padEnd(15)} sponsor=${w.sponsor ? w.sponsor.slice(0,8)+"…" : "yok"} kardeş=${sib.length} yaş=${g.age.days?.toFixed(2)}g firsts=[${g.firsts.join(",")}]`);
  console.log(`                → ${d.pass ? "GEÇTİ" : "REDDEDİLDİ"} ${d.reasons.map(r => r.code).join(" ; ")}`);
}
