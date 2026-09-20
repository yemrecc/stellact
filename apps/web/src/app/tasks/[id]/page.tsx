import { notFound } from "next/navigation";
import { findTask } from "@/lib/tasks";
import { TaskDetail } from "@/components/task-detail";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = findTask(id);
  if (!task) notFound();
  return <TaskDetail task={task} />;
}
