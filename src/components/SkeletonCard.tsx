export function SkeletonCard() {
  return (
    <div className="neu-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-muted animate-pulse-soft" />
        <div className="w-16 h-5 rounded-full bg-muted animate-pulse-soft" />
      </div>
      <div className="h-4 w-3/4 rounded bg-muted animate-pulse-soft mb-2" />
      <div className="h-3 w-1/2 rounded bg-muted animate-pulse-soft" />
    </div>
  );
}
