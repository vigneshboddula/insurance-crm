"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

export function Section({
  title,
  icon,
  preview,
  href,
  hrefLabel = "View all",
  right,
  className = "",
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  preview?: boolean;
  href?: string;
  hrefLabel?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`card card-hover ${className}`}>
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 sm:px-5">
        <div className="flex items-center gap-2">
          {icon && <span className="text-ink-3">{icon}</span>}
          <h2 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h2>
          {preview && (
            <span className="preview-tag" title="Computed from your data now — connects to your Claude key in Phase 4">
              <Sparkles size={11} /> AI preview
            </span>
          )}
        </div>
        {right}
        {href && (
          <Link href={href} className="text-xs font-medium text-accent-700 hover:underline">
            {hrefLabel} →
          </Link>
        )}
      </div>
      <div className="px-4 pb-4 sm:px-5">{children}</div>
    </section>
  );
}
