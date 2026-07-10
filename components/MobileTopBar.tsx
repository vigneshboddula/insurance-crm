"use client";

import { Shield, Search } from "lucide-react";

export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-surface/90 px-4 py-2.5 backdrop-blur md:hidden" style={{ borderColor: "var(--border)" }}>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--accent)" }}>
        <Shield size={15} className="text-white" />
      </span>
      <span className="text-sm font-semibold text-ink">Insurance CRM</span>
      <button onClick={() => window.dispatchEvent(new Event("cmdk-open"))} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg" style={{ border: "0.5px solid var(--border-2)" }} aria-label="Search">
        <Search size={16} className="text-ink-2" />
      </button>
    </header>
  );
}
