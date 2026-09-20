"use client";
/** Giriş — passkey ile cüzdan. Seed phrase yok, XLM yok. Durumlar: idle / prompting / deploying / connected / error. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { getKit, restoreWallet, explainError, type WalletState } from "@/lib/kit";
import { AddressLink } from "@/components/ui";

const STATE_LABEL: Record<string, string> = {
  restoring: "looking for a wallet",
  idle: "passkey · 10 s",
  prompting: "passkey requested",
  deploying: "writing to chain",
  connected: "connected",
  error: "error",
};

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
        setState({ status: "error", message: `The wallet could not be written to the chain [${w.submitResult?.error.code}]`, hint: w.submitResult?.error.message });
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
    <div className="cols">
      <div className="stack stack--lg">
        <h1 className="h1">The chain says what your wallet actually did.</h1>
        <p className="lede">
          Projects define tasks, you do them, and the system reads the chain to decide: passed or rejected.
          Every action that passes is written to the chain as an attestation and onto your DNA card.
        </p>
        <div className="hair-top stack">
          <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: "10px 14px", color: "var(--dna-ink-2)" }}>
            <span className="stamp" style={{ paddingTop: 2 }}>01</span>
            <span><span style={{ color: "var(--dna-ink)" }}>No gas.</span> The platform covers transaction fees and trustlines open sponsored.</span>
            <span className="stamp" style={{ paddingTop: 2 }}>02</span>
            <span><span style={{ color: "var(--dna-ink)" }}>No seed phrase.</span> Your wallet is bound to your device passkey.</span>
            <span className="stamp" style={{ paddingTop: 2 }}>03</span>
            <span><span style={{ color: "var(--dna-ink)" }}>No blank slate.</span> If you already have on-chain history, it shows on your DNA card the first time you open it.</span>
          </div>
        </div>
        <div className="stamp">network testnet · wallet is a C-address (Soroban smart wallet) · source is open</div>
      </div>

      <section className="card stack stack--lg">
        <div className="split">
          <span className="h2">Start</span>
          <span className="stamp">{STATE_LABEL[state.status]}</span>
        </div>

        {state.status === "restoring" && <div className="progress"><span>Looking for a saved wallet…</span></div>}

        {(state.status === "idle" || state.status === "error") && (
          <>
            <button className="btn btn--primary btn--stack" onClick={create}>
              <b>Create wallet with passkey</b>
              <small>Face ID · Touch ID · device lock · ~10 seconds</small>
            </button>
            <button className="btn" onClick={connect}>Connect existing wallet</button>
            <div className="note hair-top">
              A wallet is created on your device and written to the chain by the platform. We never hold your keys, and you never pay gas.
            </div>
            {state.status === "error" && (
              <div className="stack" role="alert" style={{ gap: 2 }}>
                <span className="err">{state.message}</span>
                {state.hint ? <span className="stamp">{state.hint}</span> : null}
              </div>
            )}
          </>
        )}

        {state.status === "prompting" && (
          <div className="stack">
            <div className="panel row" style={{ borderColor: "var(--dna-ink)", gap: 12, flexWrap: "nowrap" }}>
              <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: "50%", border: "2px solid var(--dna-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "700 15px var(--dna-sans)", flex: "none" }}>·</span>
              <div>
                <div style={{ font: "600 15px var(--dna-sans)" }}>Waiting for your device</div>
                <div className="note">
                  {state.action === "create"
                    ? "The browser prompt is open — confirm with Face ID or your device lock."
                    : "Confirm to connect the wallet already on this device."}
                </div>
              </div>
            </div>
            <div className="note">Nothing is written to the chain at this step.</div>
          </div>
        )}

        {state.status === "deploying" && (
          <div className="stack">
            <div className="split"><span style={{ font: "600 15px var(--dna-sans)" }}>Writing your wallet to the chain</span><span className="stamp">≈ 10 s</span></div>
            <ul className="steps">
              <li className="done"><span className="steps__n" aria-hidden="true">✓</span><div><div className="steps__t">Passkey created</div><div className="note">stored on your device · WebAuthn</div></div></li>
              <li className="now"><span className="steps__n" aria-hidden="true">2</span><div><div className="steps__t">Deploying the smart wallet contract</div><div className="note">the relayer pays the fee · Soroban RPC</div></div></li>
              <li className="next"><span className="steps__n" aria-hidden="true">3</span><div><div className="steps__t">DNA card to be prepared</div><div className="note">Horizon</div></div></li>
            </ul>
          </div>
        )}

        {state.status === "connected" && (
          <div className="stack">
            <div className="eyebrow">Connected wallet · smart account</div>
            <AddressLink address={state.contractId} kind="contract" full />
            <div className="row">
              <Link href="/tasks" className="btn btn--primary">Go to tasks</Link>
              <Link href={`/dna/${state.contractId}`} className="btn">My DNA card</Link>
              <button className="btn" onClick={disconnect}>Sign out</button>
            </div>
          </div>
        )}

        <div className="note hair-top">
          You can look around without a wallet: <Link href="/tasks" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Tasks</Link> ·{" "}
          <Link href="/index" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Index</Link>
        </div>
      </section>
    </div>
  );
}
