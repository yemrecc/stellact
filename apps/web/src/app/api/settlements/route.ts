/**
 * Yayınlanan demo için settlement kaydının anlık görüntüsü.
 *
 * Yereldeki satıcı (`apps/demo-api`, :3001) kaydı JSONL'e yazar ve canlı verir.
 * Vercel'de o süreç yok, dosya sistemi de kalıcı değil — bu yüzden gerçek
 * ödemelerin kaydı derleme zamanında buraya gömülür. Uydurma veri DEĞİL:
 * her satırın `tx_hash`'i testnet'te duruyor, stellar.expert'ten doğrulanabilir.
 * `source: "snapshot"` alanı arayüzün bunu canlı diye göstermesini engeller.
 */
import snapshot from "./snapshot.json";

interface Settlement { ts: string; payer: string; endpoint: string; params_hash: string; tx_hash: string; amount: string; network: string }

export async function GET(req: Request) {
  const payer = new URL(req.url).searchParams.get("payer") ?? "";
  const all = snapshot as Settlement[];
  const rows = payer ? all.filter(s => s.payer === payer) : all;
  return Response.json({ count: rows.length, settlements: rows, source: "snapshot" });
}
