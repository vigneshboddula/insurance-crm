"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, CheckSquare, Phone } from "lucide-react";
import { TaskDialog, type EditableTask } from "./TaskDialog";
import { deleteTask, restoreTask, setTaskStatus } from "@/app/tasks/actions";
import { useToast } from "@/components/ui/Toast";
import { fmtDate, daysUntil } from "@/lib/format";
import { TASK_STATUSES } from "@/lib/enums";
import { telLink } from "@/lib/links";

type Task = { id: string; title: string; dueDate: string; priority: string; type: string; done: boolean; status: string; notes: string | null; clientId: string | null; clientName: string | null; clientPhone: string | null };

const prClr: Record<string, string> = { high: "var(--red)", medium: "var(--amber)", low: "var(--ink-4)" };
const stClr: Record<string, string> = { completed: "var(--emerald)", needs_review: "var(--amber)", call: "var(--accent)", other: "var(--ink-3)", open: "var(--ink-4)" };

function timeOf(iso: string) {
  const d = new Date(iso);
  const hh = d.getHours(), mm = d.getMinutes();
  if (hh === 0 && mm === 0) return "";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function TasksView({ tasks, clients }: { tasks: Task[]; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EditableTask>(null);

  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => daysUntil(t.dueDate) < 0);
  const today = open.filter((t) => daysUntil(t.dueDate) === 0);
  const upcoming = open.filter((t) => daysUntil(t.dueDate) > 0);
  const done = tasks.filter((t) => t.done);

  const { toast } = useToast();
  const setStatus = (id: string, status: string) => start(async () => { await setTaskStatus(id, status); router.refresh(); });
  const remove = (id: string, title: string) =>
    start(async () => {
      const snap = await deleteTask(id);
      router.refresh();
      if (snap) toast(`Deleted "${title}"`, { undo: async () => { await restoreTask(snap); router.refresh(); } });
    });

  const Row = ({ t }: { t: Task }) => (
    <li className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
      <select value={t.status} onChange={(e) => setStatus(t.id, e.target.value)} aria-label="Task status" className="shrink-0 rounded-lg border bg-surface px-1.5 py-1 text-[11px] font-medium outline-none focus:border-accent" style={{ borderColor: "var(--border-2)", color: stClr[t.status] ?? "var(--ink-2)" }}>
        {TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: prClr[t.priority] }} title={`${t.priority} priority`} />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm ${t.done ? "text-ink-4 line-through" : "font-medium text-ink"}`}>{t.title}</div>
        <div className="flex items-center gap-2 text-[11px] text-ink-3">
          <span className="tnum">{fmtDate(t.dueDate)}{timeOf(t.dueDate) ? ` · ${timeOf(t.dueDate)}` : ""}</span>
          {t.clientName && <Link href={`/clients/${t.clientId}`} className="text-accent-700 hover:underline">{t.clientName}</Link>}
          <span className="pill-gray pill capitalize">{t.type.replace("_", " ")}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
        {t.clientPhone && <a href={telLink(t.clientPhone)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-3" aria-label="Call"><Phone size={13} className="text-ink-2" /></a>}
        <button onClick={() => setEditing({ id: t.id, title: t.title, dueDate: t.dueDate, priority: t.priority, type: t.type, clientId: t.clientId, notes: t.notes })} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-3" aria-label="Edit"><Pencil size={13} className="text-ink-2" /></button>
        <button onClick={() => remove(t.id, t.title)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-3" aria-label="Delete"><Trash2 size={13} style={{ color: "var(--red)" }} /></button>
      </div>
    </li>
  );

  const Group = ({ title, items, tone }: { title: string; items: Task[]; tone?: string }) => (
    items.length === 0 ? null : (
      <section className="card">
        <h2 className="px-4 pt-3.5 pb-1 text-[13px] font-semibold" style={{ color: tone ?? "var(--ink)" }}>{title} <span className="text-ink-4">({items.length})</span></h2>
        <ul className="px-2 pb-2">{items.map((t) => <Row key={t.id} t={t} />)}</ul>
      </section>
    )
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Tasks</h1>
          <p className="text-xs text-ink-3">{open.length} open · {overdue.length} overdue</p>
        </div>
        <button onClick={() => setAdding(true)} className="btn btn-accent"><Plus size={15} /> Add task</button>
      </div>

      {open.length === 0 && done.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <CheckSquare size={28} className="text-ink-4" />
          <p className="mt-2 text-sm font-medium text-ink">No tasks yet.</p>
          <button onClick={() => setAdding(true)} className="btn btn-accent mt-3"><Plus size={15} /> Add your first task</button>
        </div>
      )}

      <Group title="Overdue" items={overdue} tone="var(--red-700)" />
      <Group title="Today" items={today} tone="var(--amber-700)" />
      <Group title="Upcoming" items={upcoming} />
      <Group title="Done" items={done} />

      <TaskDialog open={adding} onClose={() => setAdding(false)} clients={clients} />
      <TaskDialog open={!!editing} onClose={() => setEditing(null)} clients={clients} task={editing} />
    </div>
  );
}
