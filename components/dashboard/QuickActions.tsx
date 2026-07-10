"use client";

import { UserPlus, ListChecks, MessageCircle, Target, Command } from "lucide-react";

export function QuickActions() {
  const onCommand = () => window.dispatchEvent(new Event("cmdk-open"));
  const links = [
    { label: "Client", icon: UserPlus, href: "/clients", plus: true },
    { label: "WhatsApp", icon: MessageCircle, href: "/whatsapp", plus: false },
    { label: "Lead", icon: Target, href: "/leads", plus: true },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href="/clients" className="btn">
        <UserPlus size={15} className="text-accent" /> <span className="hidden sm:inline">+ </span>Client
      </a>
      <button onClick={() => window.dispatchEvent(new Event("add-task-open"))} className="btn">
        <ListChecks size={15} className="text-accent" /> <span className="hidden sm:inline">+ </span>Task
      </button>
      {links.filter((l) => l.label !== "Client").map((it) => (
        <a key={it.label} href={it.href} className="btn">
          <it.icon size={15} className="text-accent" />
          <span className="hidden sm:inline">{it.plus ? "+ " : ""}{it.label}</span>
          <span className="sm:hidden">{it.label}</span>
        </a>
      ))}
      <button onClick={onCommand} className="btn ml-auto text-ink-2" aria-label="Open command palette">
        <Command size={14} />
        <span className="hidden text-xs sm:inline">
          Search… <kbd className="ml-1 rounded bg-surface-3 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </span>
      </button>
    </div>
  );
}
