import { notFound } from "next/navigation";
import { DnaView } from "@/components/dna-view";

const ADDR = /^[GC][A-Z2-7]{55}$/;

export default async function DnaPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!ADDR.test(address)) notFound();
  return <DnaView address={address} />;
}
