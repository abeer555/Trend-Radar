function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-surface-2 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Pulse className="h-4 w-44" />

      {/* Hero / stat strip */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <Pulse className="h-6 w-56" />
          <Pulse className="mt-2 h-4 w-72 max-w-full opacity-60" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4 md:border-l md:border-border md:first:border-l-0">
              <Pulse className="h-3 w-20 opacity-60" />
              <Pulse className="mt-2 h-7 w-28" />
              <Pulse className="mt-2 h-3 w-16 opacity-60" />
            </div>
          ))}
        </div>
      </div>

      <Pulse className="h-9 w-full" />

      {/* Chart */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <Pulse className="h-4 w-28" />
        <Pulse className="mt-4 h-[420px] w-full" />
      </div>

      {/* Panels */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Pulse className="h-40 w-full" />
          <Pulse className="h-64 w-full" />
        </div>
        <div className="flex flex-col gap-4">
          <Pulse className="h-56 w-full" />
          <Pulse className="h-72 w-full" />
        </div>
      </div>
    </div>
  );
}
