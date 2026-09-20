import { notFound } from "next/navigation";
import { findTask } from "@/lib/tasks";
import { Result } from "@/components/result";

const ADDR = /^[GC][A-Z2-7]{55}$/;

export default async function ResultPage({ params }: { params: Promise<{ id: string; subject: string }> }) {
  const { id, subject } = await params;
  const task = findTask(id);
  if (!task || !ADDR.test(subject)) notFound();
  return <Result task={task} subject={subject} />;
}
