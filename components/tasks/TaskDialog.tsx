"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea, SubmitButton } from "@/components/ui/form";
import { createTask, updateTask } from "@/app/tasks/actions";

const PRIORITIES = [{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }];
const TYPES = [
  { value: "follow_up", label: "Follow-up" }, { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" }, { value: "renewal", label: "Renewal" },
  { value: "birthday", label: "Birthday" }, { value: "other", label: "Other" },
];

export type EditableTask = {
  id: string; title: string; dueDate: string; priority: string; type: string;
  clientId: string | null; notes: string | null;
} | null;

export function TaskDialog({ open, onClose, clients, task }: { open: boolean; onClose: () => void; clients: { id: string; name: string }[]; task?: EditableTask }) {
  const router = useRouter();
  const [, start] = useTransition();
  const editing = !!task;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      if (editing) await updateTask(fd);
      else await createTask(fd);
      onClose();
      router.refresh();
    });
  };

  const dueDefault = task?.dueDate ? task.dueDate.slice(0, 16) : new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <Dialog open={open} onClose={onClose} title={editing ? "Edit task" : "Add task"}>
      <form onSubmit={onSubmit} className="space-y-3">
        {editing && <input type="hidden" name="id" value={task!.id} />}
        <Field label="Title" required><Input name="title" required defaultValue={task?.title} placeholder="Call Imran about renewal" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Due date & time"><Input name="dueDate" type="datetime-local" defaultValue={dueDefault} /></Field>
          <Field label="Priority"><Select name="priority" options={PRIORITIES} defaultValue={task?.priority ?? "medium"} /></Field>
          <Field label="Type"><Select name="type" options={TYPES} defaultValue={task?.type ?? "follow_up"} /></Field>
          <Field label="Linked client"><Select name="clientId" options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="None" defaultValue={task?.clientId ?? ""} /></Field>
        </div>
        <Field label="Notes"><Textarea name="notes" rows={2} defaultValue={task?.notes ?? ""} /></Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <SubmitButton>{editing ? "Save task" : "Add task"}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
