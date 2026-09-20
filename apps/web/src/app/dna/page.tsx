"use client";
/** My DNA — bağlı cüzdana yönlendirir; bağlı değilse girişe. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { restoreWallet } from "@/lib/kit";

export default function MyDna() {
  const router = useRouter();
  const [msg, setMsg] = useState("Looking for a wallet…");
  useEffect(() => {
    restoreWallet().then(w => {
      if (w.status === "connected") router.replace(`/dna/${w.contractId}`);
      else { setMsg("No wallet connected — taking you to the start."); router.replace("/"); }
    }).catch(() => router.replace("/"));
  }, [router]);
  return <div className="panel progress"><span>{msg}</span></div>;
}
