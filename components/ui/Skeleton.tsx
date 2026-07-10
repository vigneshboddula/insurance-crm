// Shared skeleton pieces for route-level loading states.
export function SkeletonBlock({ h = 96, className = "" }: { h?: number; className?: string }) {
  return <div className={`card animate-pulse ${className}`} style={{ height: h, background: "var(--surface-2)", borderColor: "var(--border)" }} />;
}

export function PageSkeleton({ title = true, blocks = [96, 220, 160, 320] }: { title?: boolean; blocks?: number[] }) {
  return (
    <div className="space-y-4">
      {title && (
        <div className="space-y-2">
          <div className="h-5 w-36 animate-pulse rounded-lg" style={{ background: "var(--surface-3)" }} />
          <div className="h-3 w-52 animate-pulse rounded-lg" style={{ background: "var(--surface-2)" }} />
        </div>
      )}
      {blocks.map((h, i) => <SkeletonBlock key={i} h={h} />)}
    </div>
  );
}
