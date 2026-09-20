"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@stellar/design-system";
import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import type { Task } from "@/lib/tasks";
import { CLASS_LABEL } from "@/lib/tasks";
import { CONFIG, fmtTusd } from "@/lib/config";
import { getKit, restoreWallet, explainError, type WalletState } from "@/lib/kit";
import { readVault } from "@/lib/vault";
import { PolicyPanel } from "@/components/dna";
import { AddressLink, Pill } from "@/components/ui";

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
        setMsg({ text: `Yatırım zincire yazılamadı [${r.error.code}]${name ? " · " + name : ""}`, hint: /balance|insufficient|10\b/i.test(r.error.message) ? "Smart account'ta yeterli TUSD yok. Demo için TUSD gönderilmesi gerekir." : r.error.message });
        return;
      }
      setTxHash(r.hash);
      setVaultBal((await readVault(wallet.contractId)).balance_tusd);
      setStep("done");
    } catch (e) {
      setStep("error"); setMsg({ text: "Yatırım tamamlanamadı", ...explainError(e) });
    }
  }

  const alreadyDone = (vaultBal ?? 0) >= min;

  return (
    <div className="grid-2">
      <div className="stack">
        <div className="panel stack">
          <div className="eyebrow">Görev · {task.project.name}</div>
          <h1 className="h1" style={{ fontSize: 24 }}>{task.title}</h1>
          <p style={{ margin: 0, color: "var(--dna-ink-2)" }}>{task.description}</p>
          <div className="row" style={{ fontSize: 12 }}>
            <Pill kind="acc">Sınıf {task.verifierClass}</Pill><span className="stamp">{CLASS_LABEL[task.verifierClass]}</span>
          </div>
          <div className="mono">doğrulayıcı <code>{task.action}</code> · Vault <AddressLink address={CONFIG.vault} kind="contract" /> · TUSD <AddressLink address={CONFIG.tusdSac} kind="contract" /></div>
          <div className="row" style={{ fontSize: 13 }}>
            <span><b>Ödül</b> {task.reward.amount_tusd} TUSD</span>
            <span className="stamp">{task.reward.persistence_days} gün tuttuktan sonra ödenir</span>
          </div>
        </div>

        <div className="panel stack">
          <div className="eyebrow">Adımlar</div>
          <ol className="steps">
            <li className={wallet.status !== "connected" ? "now" : ""}>Cüzdanını bağla {wallet.status === "connected" ? "✓" : ""}</li>
            <li className={wallet.status === "connected" && !alreadyDone ? "now" : ""}>Vault&apos;a {min} TUSD yatır {alreadyDone ? "✓" : ""}</li>
            <li className={alreadyDone ? "now" : ""}>Doğrulat — zincir okunur, karar verilir</li>
          </ol>

          {wallet.status === "restoring" && <div className="progress"><span>Cüzdan aranıyor…</span></div>}
          {(wallet.status === "idle" || wallet.status === "error") && (
            <div className="stack" style={{ gap: 6 }}>
              <Button variant="primary" size="md" onClick={() => router.push("/")}>Önce cüzdanını bağla</Button>
              {wallet.status === "error" ? <span className="err">{wallet.message}</span> : null}
            </div>
          )}
          {wallet.status === "connected" && (
            <div className="stack">
              <div className="mono">bağlı: <AddressLink address={wallet.contractId} kind="contract" /> · Vault bakiyesi {vaultBal == null ? "…" : `${vaultBal} TUSD`}</div>
              {!alreadyDone && step !== "done" && (
                <div className="row">
                  <Button variant="primary" size="md" onClick={deposit} isLoading={step === "signing" || step === "submitting"} disabled={step === "signing" || step === "submitting"}>
                    Tek tıkla {min} TUSD yatır
                  </Button>
                  <span className="stamp">Passkey ile imzalarsın; ücreti platform öder.</span>
                </div>
              )}
              {step === "signing" && <div className="progress"><span>Cihazınız passkey istiyor…</span></div>}
              {step === "submitting" && <div className="progress"><span>Zincire yazılıyor…</span><span className="stamp">Vault.deposit · relayer sponsorlu · ~10-20 sn</span></div>}
              {step === "error" && msg && <div className="stack" style={{ gap: 2 }} role="alert"><span className="err">{msg.text}</span>{msg.hint ? <span className="stamp">{msg.hint}</span> : null}</div>}
              {(step === "done" || alreadyDone) && (
                <div className="stack" style={{ gap: 6 }}>
                  {txHash ? <div className="mono">yatırıldı · <AddressLink address={txHash} kind="tx" /></div> : null}
                  <Button variant="success" size="md" onClick={() => router.push(`/tasks/${task.id}/result/${wallet.contractId}`)}>Yaptım, doğrula</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="stack">
        <div className="panel"><PolicyPanel policy={task.policy} /></div>
        <div className="panel stack" style={{ gap: 6 }}>
          <div className="eyebrow">Demo cüzdanları · aynı görevi başkası nasıl geçti / geçemedi</div>
          <div className="mono">Kullanıcı → <a href={`/tasks/${task.id}/result/${CONFIG.demo.genuine}`}>sonucu gör</a></div>
          <div className="mono">Script (41 kardeşli sponsor) → <a href={`/tasks/${task.id}/result/${CONFIG.demo.script}`}>sonucu gör</a></div>
          {CONFIG.demo.smartAccount ? <div className="mono">Smart account (yazılım passkey) → <a href={`/tasks/${task.id}/result/${CONFIG.demo.smartAccount}`}>sonucu gör</a></div> : null}
          <div className="stamp">Ödül {fmtTusd(BigInt(task.reward.amount_tusd) * 10_000_000n)} TUSD · kontenjan {task.max_claims}</div>
        </div>
      </div>
    </div>
  );
}
