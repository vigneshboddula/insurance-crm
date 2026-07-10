"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Section } from "./Section";
import { CheckSquare, Square, ListChecks, Plus } from "lucide-react";
import { toggleTask } from "@/app/tasks/actions";
import { fmtDate } from "@/lib/format";

type Task = { id: string; title: string; priority: string; dueDate: string; overdue: boolean; clientId: string | null; clientName: string | null };
const prClr: Record<string, string> = { high: "var(--red)", medium: "var(--amber)", low: "var(--ink-4)" };

export function TasksWidget({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const complete = (id: string) => start(async () => { await toggleTask(id, true); router.refresh(); });

  return (
    <Section title="Tasks due" icon={<ListChecks size={15} />} href="/tasks" hrefLabel="All tasks"
      right={<button onClick={() => window.dispatchEvent(new Event("add-task-open"))} className="mr-3 inline-flex items-center gap-1 text-xs font-medium text-accent-700"><Plus size={13} /> Add</button>}>
      {tasks.length === 0 ? (
        <p className="py-5 text-center text-sm text-ink-3">Nothing due today. You&apos;re on top of it. ✅</p>
      ) : (
        <ul className="space-y-0.5">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-surface-2">
              <button onClick={() => complete(t.id)} aria-label="Complete" className="shrink-0"><Square size={17} className="text-ink-4 hover:text-emerald-700" /></button>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: prClr[t.priority] }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{t.title}</div>
                {t.clientName && <Link href={`/clients/${t.clientId}`} className="text-[11px] text-accent-700 hover:underline">{t.clientName}</Link>}
              </div>
              <span className={`pill pill-${t.overdue ? "red" : "amber"}`}>{t.overdue ? "overdue" : "today"}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
