"use client";
/** Giriş — passkey ile cüzdan. Seed phrase yok, XLM yok. Brief §6.1 durumları: idle / prompting / deploying / connected / error. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@stellar/design-system";
import { getKit, restoreWallet, explainError, type WalletState } from "@/lib/kit";
import { AddressLink } from "@/components/ui";

export default function Home() {
  const [state, setState] = useState<WalletState>({ status: "restoring" });

  useEffect(() => {
    restoreWallet().then(setState).catch(e => setState({ status: "error", ...explainError(e) }));
  }, []);

  async function create() {
    try {
      setState({ status: "prompting", action: "create" });
      const kit = await getKit();
      const startedAt = Date.now();
      const p = kit.createWallet("STELLACT", `dna-${Date.now().toString(36)}`, { autoSubmit: true });
      // passkey promptu kapanınca deploy başlar; kit tek Promise döndürdüğü için durumu zamanla yaklaşıyoruz
      const t = setTimeout(() => setState(s => (s.status === "prompting" ? { status: "deploying", startedAt } : s)), 1500);
      const w = await p;
      clearTimeout(t);
      if (!w.submitResult?.success) {
        setState({ status: "error", message: `Cüzdan zincire yazılamadı [${w.submitResult?.error.code}]`, hint: w.submitResult?.error.message });
        return;
      }
      setState({ status: "connected", contractId: w.contractId, credentialId: w.credentialId });
    } catch (e) {
      setState({ status: "error", ...explainError(e) });
    }
  }

  async function connect() {
    try {
      setState({ status: "prompting", action: "connect" });
      const kit = await getKit();
      const c = await kit.connectWallet({ prompt: true });
      setState(c ? { status: "connected", contractId: c.contractId, credentialId: c.credentialId } : { status: "idle" });
    } catch (e) {
      setState({ status: "error", ...explainError(e) });
    }
  }

  async function disconnect() {
    const kit = await getKit();
    await kit.disconnect();
    setState({ status: "idle" });
  }

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <div>
        {/* Slogan nav'da duruyor; H1 zaten onun Türkçesi — aynı ekranda tekrarlamıyoruz. */}
        <h1 className="h1">Stellar&apos;da yaptığın şey, kimliğin.</h1>
        <p className="lede">
          Görev yap, zincir doğrulasın, DNA&apos;n yazılsın. Kelime ezberlemezsin, gas ödemezsin — cüzdanın cihazının kilidiyle açılır.
        </p>
      </div>

      <div className="panel stack">
        {state.status === "restoring" && <div className="progress"><span>Kayıtlı cüzdan aranıyor…</span></div>}

        {(state.status === "idle" || state.status === "error") && (
          <>
            <div className="row">
              <Button variant="primary" size="md" onClick={create}>Passkey ile cüzdan oluştur</Button>
              <Button variant="secondary" size="md" onClick={connect}>Mevcut cüzdanı bağla</Button>
            </div>
            <div className="stamp">Face ID / Touch ID / cihaz PIN&apos;i. Ücreti platform öder; XLM gerekmez.</div>
            {state.status === "error" && (
              <div className="stack" role="alert" style={{ gap: 2 }}>
                <span className="err">{state.message}</span>
                {state.hint ? <span className="stamp">{state.hint}</span> : null}
              </div>
            )}
          </>
        )}

        {state.status === "prompting" && (
          <div className="progress">
            <span>Cihazınız passkey istiyor…</span>
            <span className="stamp">{state.action === "create" ? "Onaylayınca cüzdan zincire yazılır (~10 sn)." : "Onaylayınca cüzdanınız bağlanır."}</span>
          </div>
        )}

        {state.status === "deploying" && (
          <div className="progress">
            <span>Cüzdan zincire yazılıyor…</span>
            <span className="stamp">Relayer ücreti ödüyor · testnet · genellikle 5-15 sn</span>
          </div>
        )}

        {state.status === "connected" && (
          <div className="stack">
            <div className="eyebrow">Bağlı cüzdan · smart account</div>
            <AddressLink address={state.contractId} kind="contract" full />
            <div className="row">
              <Link href="/tasks" className="Button Button--primary Button--md">Görevlere git</Link>
              <Link href={`/dna/${state.contractId}`} className="Button Button--secondary Button--md">DNA kartım</Link>
              <Button variant="tertiary" size="md" onClick={disconnect}>Çıkış</Button>
            </div>
          </div>
        )}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <div className="eyebrow">Nasıl çalışır</div>
        <ol className="steps">
          <li>Bir proje görev tanımlar — örneğin &quot;Vault&apos;a 50 TUSD yatır&quot;.</li>
          <li>Görevi yaparsın; biz zincirin kendi olgularıyla doğrularız: köken, yaş, trustline, pozisyon, sponsor.</li>
          <li>Geçersen tasdik yazılır ve DNA&apos;na gen eklenir. Geçmezsen gerekçesini ve kanıtını görürsün.</li>
        </ol>
      </div>
    </div>
  );
}
