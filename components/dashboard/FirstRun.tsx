import Link from "next/link";
import { UserPlus, Upload, MessageCircle, Sparkles, ArrowRight } from "lucide-react";

// Shown instead of the analytics dashboard while the book is empty —
// one clear starting point instead of a wall of zeros.
export function FirstRun() {
  const steps = [
    { icon: UserPlus, title: "Add your first policy holder", desc: "Enter one client and their policy — everything else lights up from there.", href: "/clients", cta: "Add holder" },
    { icon: Upload, title: "…or bulk upload policies", desc: "Drop a folder of policy PDFs on the Policies page — they're read, matched, and filed automatically.", href: "/policies", cta: "Bulk upload" },
    { icon: MessageCircle, title: "Check WhatsApp is connected", desc: "Reminders and one-tap sends go from your own number.", href: "/whatsapp", cta: "Open WhatsApp" },
  ];
  return (
    <section className="card overflow-hidden">
      <div className="p-6 text-center sm:p-10">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--accent)" }}>
          <Sparkles size={22} className="text-white" />
        </div>
        <h2 className="text-lg font-semibold text-ink">Welcome, Vignesh — your book is ready</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-3">Your data lives safely on this PC. Start with one holder or a bulk import; renewals, reminders and the AI briefing take over from there.</p>
      </div>
      <div className="grid grid-cols-1 gap-px sm:grid-cols-3" style={{ background: "var(--border)" }}>
        {steps.map((s) => (
          <Link key={s.title} href={s.href} className="group flex flex-col gap-2 bg-surface p-5 transition hover:bg-surface-2">
            <s.icon size={18} style={{ color: "var(--accent-700)" }} />
            <div className="text-sm font-semibold text-ink">{s.title}</div>
            <p className="flex-1 text-xs leading-relaxed text-ink-3">{s.desc}</p>
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent-700)" }}>{s.cta} <ArrowRight size={13} className="transition group-hover:translate-x-0.5" /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
