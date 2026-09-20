import Link from "next/link";
import { TASKS, CLASS_LABEL } from "@/lib/tasks";
import { Pill } from "@/components/ui";

export default function TasksPage() {
  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Görevler · testnet</div>
        <h1 className="h1" style={{ fontSize: 26 }}>Yap, doğrulansın, DNA&apos;na yazılsın.</h1>
        <p className="lede">Her görev bir doğrulayıcıya bağlı; sınıfı, kimin neyi kontrol ettiğini söyler.</p>
      </div>
      <div className="grid-2">
        {TASKS.map(t => (
          <article key={t.id} className="panel stack" style={{ gap: 8 }}>
            <div className="eyebrow">{t.project.name}</div>
            <h2 style={{ margin: 0, fontFamily: "var(--dna-display)", fontWeight: 600, fontSize: 18 }}>{t.title}</h2>
            <div className="row" style={{ fontSize: 12 }}><Pill kind="acc">Sınıf {t.verifierClass}</Pill><span className="stamp">{CLASS_LABEL[t.verifierClass]}</span></div>
            <div className="row" style={{ fontSize: 13 }}>
              <span><b>{t.reward.amount_tusd} TUSD</b> ödül</span>
              <span className="stamp">{t.reward.persistence_days} gün kalıcılık şartı</span>
              <span className="stamp">bitiş {t.ends_at.slice(0, 10)}</span>
            </div>
            <div><Link href={`/tasks/${t.id}`} className="Button Button--primary Button--md">Görevi aç</Link></div>
          </article>
        ))}
        <div className="panel stack" style={{ gap: 6, borderStyle: "dashed" }}>
          <div className="eyebrow">Proje misin?</div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--dna-ink-2)" }}>Görev tanımla, havuzu fonla, gerçek kullanıcı kazan. Proje paneli sonraki sprint — şimdilik demo görev.</p>
        </div>
      </div>
    </div>
  );
}
