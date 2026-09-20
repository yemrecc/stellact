import { CONFIG, short } from "@/lib/config";

export function NetBadge() {
  return <span className="net"><i aria-hidden="true" />{CONFIG.network} · canlı</span>;
}

export function AddressLink({ address, kind = "account", full = false }: { address: string; kind?: "account" | "tx" | "contract"; full?: boolean }) {
  const path = kind === "tx" ? `tx/${address}` : kind === "contract" ? `contract/${address}` : `account/${address}`;
  return (
    <span className="addr">
      <a href={`${CONFIG.explorer}/${path}`} target="_blank" rel="noopener noreferrer" title={address}>
        {full ? address : short(address)}
      </a>
    </span>
  );
}

export function Pill({ kind, children }: { kind?: "good" | "bad" | "acc"; children: React.ReactNode }) {
  return <span className={`pill${kind ? ` pill--${kind}` : ""}`}>{kind ? <i aria-hidden="true" /> : null}{children}</span>;
}

export function Fact({ v, k, big, flag }: { v: React.ReactNode; k?: React.ReactNode; big?: boolean; flag?: boolean }) {
  return (
    <div className="fact">
      <span className={`fact__v${big ? " fact__v--big" : ""}`}>{v}</span>
      {k ? <span className={`fact__k${flag ? " fact__k--flag" : ""}`}>{k}</span> : null}
    </div>
  );
}

export function Gene({ name, key_, children }: { name: string; key_: string; children: React.ReactNode }) {
  return (
    <div className="gene">
      <div className="gene__g">{name}<small>{key_}</small></div>
      <div className="facts">{children}</div>
    </div>
  );
}
