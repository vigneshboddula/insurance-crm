"use client";

import { useEffect, useState } from "react";
import { TaskDialog } from "./TaskDialog";

// Mounts once; opens the task dialog when any "add-task-open" event fires
// (dispatched by quick-action buttons across the app).
export function QuickAddTask({ clients }: { clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("add-task-open", on);
    return () => window.removeEventListener("add-task-open", on);
  }, []);
  return <TaskDialog open={open} onClose={() => setOpen(false)} clients={clients} />;
}
