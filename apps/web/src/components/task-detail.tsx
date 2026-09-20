"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import type { Task } from "@/lib/tasks";
import { CLASS_LABEL } from "@/lib/tasks";
import { CONFIG, fmtTusd, short } from "@/lib/config";
import { getKit, restoreWallet, explainError, type WalletState } from "@/lib/kit";
import { readVault } from "@/lib/vault";
import { PolicyTable } from "@/components/dna";
import { AddressLink, Badge, ClassBadge, Src } from "@/components/ui";

type Step = "idle" | "signing" | "submitting" | "done" | "error";

export function TaskDetail({ task }: { task: Task }) {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletState>({ status: "restoring" });
  const [vaultBal, setVaultBal] = useState<number | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [msg, setMsg] = useState<{ text: string; hint?: string } | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    restoreWallet().then(async w => {
      setWallet(w);
      if (w.status === "connected") setVaultBal((await readVault(w.contractId)).balance_tusd);
    }).catch(e => setWallet({ status: "error", ...explainError(e) }));
  }, []);

  const min = task.params.min_tusd ?? 50;
  const isAgentTask = task.actor === "agent";

  async function deposit() {
    if (wallet.status !== "connected") return;
    setMsg(null); setStep("signing");
    try {
      const kit = await getKit();
      const t = setTimeout(() => setStep(s => (s === "signing" ? "submitting" : s)), 1500);
      const r = await kit.executeAndSubmit(CONFIG.vault, "deposit", [
        new Address(wallet.contractId).toScVal(),
        nativeToScVal(BigInt(min) * 10_000_000n, { type: "i128" }),
      ]);
      clearTimeout(t);
      if (!r.success) {
        const name = "contractErrorName" in r.error ? String((r.error as { contractErrorName?: string }).contractErrorName ?? "") : "";
        setStep("error");
        setMsg({
          text: `The deposit could not be written to the chain [${r.error.code}]${name ? " · " + name : ""}`,
          hint: /balance|insufficient|10\b/i.test(r.error.message) ? "The smart account does not hold enough TUSD. The demo wallet needs to be funded first." : r.error.message,
        });
        return;
      }
      setTxHash(r.hash);
      setVaultBal((await readVault(wallet.contractId)).balance_tusd);
      setStep("done");
    } catch (e) {
      setStep("error"); setMsg({ text: "The deposit did not complete", ...explainError(e) });
    }
  }

  const alreadyDone = (vaultBal ?? 0) >= min;
  const connected = wallet.status === "connected";

  return (
    <div className="stack stack--lg">
      <div className="split">
        <span className="note">
          <Link href="/tasks" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Tasks</Link> / {task.project.name} / {task.title}
        </span>
        <Src label={`RPC · snapshot · ${new Date().toISOString().slice(11, 16)} UTC`} />
      </div>

      <div className="cols">
        <div className="stack stack--lg">
          <section className="card stack">
            <div className="split">
              <span className="row" style={{ gap: 10 }}>
                <span className="eyebrow">{task.project.name}</span>
                {isAgentTask ? <Badge kind="solid">agent</Badge> : <Badge kind={connected ? "taken" : "open"}>{connected ? "taken · awaiting action" : "open"}</Badge>}
              </span>
              <span className="stamp">Vault {short(CONFIG.vault)}</span>
            </div>
            <h1 className="h1" style={{ fontSize: "clamp(24px,2.4vw,34px)" }}>{task.title}</h1>
            <div className="row" style={{ gap: 10 }}>
              <span className="stamp">validator <span className="mono">{task.action}</span></span>
              <ClassBadge klass={task.verifierClass} />
              <span className="note">{CLASS_LABEL[task.verifierClass]}</span>
            </div>
            <p className="note" style={{ margin: 0, maxWidth: "62ch" }}>{task.description}</p>
            <div className="hair-top" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 16 }}>
              <div><div className="eyebrow">Reward</div><div className="featured" style={{ fontSize: 20 }}>{fmtTusd(BigInt(task.reward.amount_tusd) * 10_000_000n)}</div><div className="note">TUSD · {task.reward.persistence_days ? `after holding ${task.reward.persistence_days} days` : "immediately"}</div></div>
              <div><div className="eyebrow">Slots</div><div className="featured" style={{ fontSize: 20 }}>{task.max_claims - task.claimed} / {task.max_claims}</div><div className="note">left</div></div>
              <div><div className="eyebrow">Ends</div><div className="featured" style={{ fontSize: 20 }}>{task.ends_at.slice(0, 10)}</div><div className="note">23:59 UTC</div></div>
            </div>
          </section>

          <section className="card"><PolicyTable policy={task.policy} /></section>

          <section className="card stack">
            <div className="split"><span className="h2" style={{ fontSize: 18 }}>Steps</span></div>
            {isAgentTask ? (
              <ol className="steps">
                <li className="done"><span className="steps__n" aria-hidden="true">1</span><div><div className="steps__t">The agent takes the task over MCP</div><div className="note">The MCP server lands in the next sprint; today the agent is driven by <span className="mono">pnpm agent:x402</span>.</div></div></li>
                <li className="now"><span className="steps__n" aria-hidden="true">2</span><div><div className="steps__t">It pays for {task.params.queries ?? 3} different queries via x402</div><div className="note">Real TUSD, settled on chain. The facilitator pays the fee, so the agent needs no XLM.</div></div></li>
                <li><span className="steps__n" aria-hidden="true">3</span><div><div className="steps__t">The validator reads the settlements and decides</div><div className="note">Paying is not enough — <span className="mono">query_diversity</span> separates an agent from a script.</div></div></li>
              </ol>
            ) : (
              <ol className="steps">
                <li className={connected ? "done" : "now"}><span className="steps__n" aria-hidden="true">{connected ? "✓" : "1"}</span><div><div className="steps__t">Take the task</div><div className="note">{connected ? <>One slot reserved · <AddressLink address={wallet.contractId} kind="contract" sm /></> : "Connect a wallet to reserve a slot."}</div></div></li>
                <li className={connected && !alreadyDone ? "now" : alreadyDone ? "done" : "next"}>
                  <span className="steps__n" aria-hidden="true">{alreadyDone ? "✓" : "2"}</span>
                  <div>
                    <div className="steps__t">Do the action</div>
                    <div className="note">A Vault deposit is a single transaction: if a trustline is needed it opens sponsored, and the platform pays the fee. You sign with your passkey.</div>
                    {wallet.status === "restoring" && <div className="progress" style={{ marginTop: 10 }}><span>Looking for a wallet…</span></div>}
                    {(wallet.status === "idle" || wallet.status === "error") && (
                      <div className="stack" style={{ gap: 6, marginTop: 10 }}>
                        <button className="btn btn--primary btn--sm" onClick={() => router.push("/")}>Connect a wallet first</button>
                        {wallet.status === "error" ? <span className="err">{wallet.message}</span> : null}
                      </div>
                    )}
                    {connected && !alreadyDone && step !== "done" && (
                      <div className="stack" style={{ gap: 8, marginTop: 10 }}>
                        <button className="btn btn--primary btn--stack" onClick={deposit} disabled={step === "signing" || step === "submitting"}>
                          <b>One-click deposit · {fmtTusd(BigInt(min) * 10_000_000n)} TUSD</b>
                          <small>→ Vault {short(CONFIG.vault)} · sponsored · no gas</small>
                        </button>
                        <span className="note">You can deposit from your own wallet instead; the validator only looks at the chain.</span>
                      </div>
                    )}
                    {step === "signing" && <div className="progress" style={{ marginTop: 10 }}><span>Your device is asking for the passkey…</span></div>}
                    {step === "submitting" && <div className="progress" style={{ marginTop: 10 }}><span>Writing to the chain…</span><span className="stamp">Vault.deposit · relayer sponsored · ~10-20 s</span></div>}
                    {step === "error" && msg && <div className="stack" style={{ gap: 2, marginTop: 10 }} role="alert"><span className="err">{msg.text}</span>{msg.hint ? <span className="stamp">{msg.hint}</span> : null}</div>}
                    {txHash ? <div className="note" style={{ marginTop: 10 }}>deposited · <AddressLink address={txHash} kind="tx" sm /></div> : null}
                  </div>
                </li>
                <li className={alreadyDone || step === "done" ? "now" : "next"}>
                  <span className="steps__n" aria-hidden="true">3</span>
                  <div>
                    <div className="steps__t">Verify what I did</div>
                    <div className="note">Unlocks once the deposit is visible on chain (~5 s). The validator reads Horizon and the Vault, then applies the policy.</div>
                    {(alreadyDone || step === "done") && connected && (
                      <div style={{ marginTop: 10 }}>
                        <button className="btn btn--sm" onClick={() => router.push(`/tasks/${task.id}/result/${wallet.contractId}`)}>Verify what I did</button>
                      </div>
                    )}
                  </div>
                </li>
              </ol>
            )}
          </section>
        </div>

        <div className="stack">
          <div className="panel stack">
            <span className="h2" style={{ fontSize: 18 }}>Reward pool</span>
            <div className="featured">{fmtTusd(BigInt(task.reward.amount_tusd * (task.max_claims - task.claimed)) * 10_000_000n)}</div>
            <table className="rules">
              <tbody>
                <tr><td>Funded</td><td>{fmtTusd(BigInt(task.reward.amount_tusd * task.max_claims) * 10_000_000n)}</td></tr>
                <tr><td>Reserved (tasks taken)</td><td>{fmtTusd(BigInt(task.reward.amount_tusd * task.claimed) * 10_000_000n)}</td></tr>
                <tr><td>Paid out</td><td>0.0000000</td></tr>
              </tbody>
            </table>
            <span className="note">The pool is a demo balance; on-chain escrow lands with the project panel.</span>
          </div>

          <div className="panel stack">
            <span className="h2" style={{ fontSize: 18 }}>Validator</span>
            <div className="row" style={{ gap: 8 }}><span className="mono">{task.action}</span><ClassBadge klass={task.verifierClass} /></div>
            <p className="note" style={{ margin: 0 }}>
              {task.verifierClass === "A"
                ? <>Reads the Vault contract directly: <span className="mono">balance</span>, <span className="mono">deposited_at</span>. No signature needed, and anyone can recompute the result.</>
                : <>Reads the settlement record kept by the seller; every row carries its <span className="mono">tx_hash</span>, so the result can be recomputed against Horizon.</>}
            </p>
            <span className="note">Attestations are written by <AddressLink address={CONFIG.readSource} sm /> to Attest <AddressLink address={CONFIG.attest} kind="contract" sm />.</span>
          </div>

          <div className="panel stack">
            <span className="eyebrow">See a real decision</span>
            {isAgentTask ? (
              <>
                <Link className="note" href={`/tasks/${task.id}/result/${CONFIG.demo.agent}`} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Agent · 3 different queries →</Link>
                <Link className="note" href={`/tasks/${task.id}/result/${CONFIG.demo.script}`} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Script · the same query ×3 →</Link>
              </>
            ) : (
              <>
                <Link className="note" href={`/tasks/${task.id}/result/${CONFIG.demo.genuine}`} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>User wallet →</Link>
                <Link className="note" href={`/tasks/${task.id}/result/${CONFIG.demo.script}`} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Script · sponsor with 41 siblings →</Link>
                {CONFIG.demo.smartAccount ? <Link className="note" href={`/tasks/${task.id}/result/${CONFIG.demo.smartAccount}`} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Smart account · software passkey →</Link> : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
