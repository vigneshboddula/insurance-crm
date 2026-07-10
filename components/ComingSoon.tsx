export function ComingSoon({
  title,
  phase,
  desc,
}: {
  title: string;
  phase: number;
  desc: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-3 text-4xl">🚧</div>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-1 max-w-md text-sm text-slate-500">{desc}</p>
      <span className="mt-4 pill pill-accent">Coming in Phase {phase}</span>
    </div>
  );
}
