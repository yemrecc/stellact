import Link from "next/link";
import { TASKS, CLASS_LABEL } from "@/lib/tasks";
import { Badge, ClassBadge, Src } from "@/components/ui";
import { fmtTusd } from "@/lib/config";

export default function TasksPage() {
  const open = TASKS.length;
  const projects = new Set(TASKS.map(t => t.project.id)).size;
  return (
    <div className="stack stack--lg">
      <div className="split">
        <div className="stack" style={{ gap: 8 }}>
          <h1 className="h1" style={{ fontSize: "clamp(28px,3vw,42px)" }}>Tasks</h1>
          <p className="lede">Tasks defined by projects and verified from the chain. The decision is passed or rejected, and the reasoning is backed by evidence.</p>
        </div>
        <Src label={`RPC · snapshot · ${new Date().toISOString().slice(11, 16)} UTC`} />
      </div>

      <div className="split">
        <span className="stamp">{TASKS.length} tasks · {open} open · {projects} project</span>
      </div>

      <div className="cols cols--even">
        {TASKS.map(t => (
          <article key={t.id} className="card stack">
            <div className="split">
              <span className="eyebrow">{t.project.name}</span>
              <span className="row" style={{ gap: 6 }}>
                {t.actor === "agent" ? <Badge kind="solid">agent</Badge> : null}
                <Badge kind="open">open</Badge>
              </span>
            </div>
            <h2 className="h2" style={{ fontSize: 22 }}>{t.title}</h2>
            <div className="row" style={{ gap: 10 }}>
              <span className="stamp">validator <span className="mono">{t.action}</span></span>
              <ClassBadge klass={t.verifierClass} />
              <span className="note">{CLASS_LABEL[t.verifierClass]}</span>
            </div>
            <table className="rules" style={{ marginTop: 4 }}>
              <tbody>
                <tr>
                  <td>Reward</td>
                  <td>{fmtTusd(BigInt(t.reward.amount_tusd) * 10_000_000n)} TUSD · {t.reward.persistence_days ? `after holding ${t.reward.persistence_days} days` : "immediately"}</td>
                </tr>
                <tr><td>Slots</td><td>{t.max_claims - t.claimed} / {t.max_claims} left</td></tr>
                <tr><td>Ends</td><td>{t.ends_at.slice(0, 10)} 23:59 UTC</td></tr>
              </tbody>
            </table>
            <div className="row">
              <Link href={`/tasks/${t.id}`} className="btn btn--sm">Open the task</Link>
              <span className="note">{t.actor === "agent" ? "agents take it over MCP; the operator watches" : "one-click deposit · sponsored, no gas"}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="panel stack" style={{ borderStyle: "dashed" }}>
        <span className="eyebrow">Are you a project?</span>
        <p className="note" style={{ margin: 0 }}>
          Define a task, fund the pool, get real users. The project panel is the next sprint — for now these are demo tasks.
        </p>
      </div>
    </div>
  );
}
