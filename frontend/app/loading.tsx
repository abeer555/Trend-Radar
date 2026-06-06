function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-surface-2 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Pulse className="h-7 w-72" />
          <Pulse className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Pulse className="hidden h-8 w-64 sm:block" />
      </div>

      <Pulse className="h-9 w-full" />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3">
        <Pulse className="h-9 w-64" />
        <Pulse className="h-9 w-44" />
        <Pulse className="h-9 w-28" />
        <Pulse className="h-9 w-36" />
        <Pulse className="h-9 w-40" />
        <Pulse className="h-9 w-32" />
      </div>

      {/* Table rows */}
      <div className="overflow-hidden rounded-lg border border-border bg-bg">
        <div className="border-b border-border bg-surface px-4 py-3">
          <Pulse className="h-3.5 w-full max-w-2xl" />
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-0">
            <Pulse className="h-4 w-6" />
            <div className="w-44">
              <Pulse className="h-4 w-28" />
              <Pulse className="mt-1.5 h-3 w-40 opacity-60" />
            </div>
            <Pulse className="hidden h-5 w-32 rounded-full lg:block" />
            <Pulse className="ml-auto h-4 w-20" />
            <Pulse className="h-4 w-16" />
            <Pulse className="hidden h-4 w-32 md:block" />
            <Pulse className="hidden h-7 w-20 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
