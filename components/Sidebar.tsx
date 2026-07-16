"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/GlobalSearch";
import {
  LayoutDashboard, Users, FileText, Bell, Target, Stethoscope,
  CheckSquare, MessageCircle, Sparkles, Shield, Settings, Briefcase, Camera, Video,
  MessagesSquare, BarChart3, Banknote, Contact, TrendingUp,
} from "lucide-react";

type Social = { linkedin: string | null; instagram: string | null; youtube: string | null };

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Policy Holders", icon: Users },
  { href: "/contacts", label: "Contacts", icon: Contact },
  { href: "/policies", label: "Policies", icon: FileText },
  { href: "/renewals", label: "Renewals", icon: Bell },
  { href: "/collections", label: "Collections", icon: Banknote },
  { href: "/leads", label: "Leads", icon: Target },
  { href: "/claims", label: "Service", icon: Stethoscope },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/communications", label: "Communications", icon: MessagesSquare },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/growth", label: "Growth", icon: TrendingUp },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ social }: { social?: Social }) {
  const pathname = usePathname();
  const hasSocial = social && (social.linkedin || social.instagram || social.youtube);

  return (
    <aside className="fixed left-0 top-0 z-10 hidden h-screen w-60 flex-col border-r bg-surface md:flex" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2.5 px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "var(--accent)" }}>
          <Shield size={17} className="text-white" />
        </span>
        <div>
          <div className="text-sm font-semibold leading-tight text-ink">Insurance CRM</div>
          <div className="text-[11px] text-ink-3">Vignesh · Agent</div>
        </div>
      </div>
      <div className="px-3 pb-1">
        <GlobalSearch variant="compact" />
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition"
              style={active ? { background: "var(--accent-50)", color: "var(--accent-700)" } : { color: "var(--ink-2)" }}
            >
              <item.icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {hasSocial && (
        <div className="flex items-center gap-3 px-5 pb-1 pt-2">
          {social!.linkedin && <a href={social!.linkedin} target="_blank" rel="noopener" className="text-ink-4 hover:text-accent" aria-label="LinkedIn"><Briefcase size={16} /></a>}
          {social!.instagram && <a href={social!.instagram} target="_blank" rel="noopener" className="text-ink-4 hover:text-accent" aria-label="Instagram"><Camera size={16} /></a>}
          {social!.youtube && <a href={social!.youtube} target="_blank" rel="noopener" className="text-ink-4 hover:text-accent" aria-label="YouTube"><Video size={16} /></a>}
        </div>
      )}
      <div className="px-5 py-3 text-[11px] text-ink-4">
        <kbd className="rounded bg-surface-3 px-1.5 py-0.5">⌘K</kbd> to search
      </div>
    </aside>
  );
}
