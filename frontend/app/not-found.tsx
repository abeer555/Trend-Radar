import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="text-6xl font-bold text-border">404</p>
      <h2 className="mt-4 text-xl font-semibold">Stock not found</h2>
      <p className="mt-2 text-sm text-muted">
        This ticker may not be in the current universe or the scan hasn&apos;t run yet.
      </p>
      <Link
        href="/"
        className="mt-6 rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/80"
      >
        ← Back to Leaderboard
      </Link>
    </div>
  );
}
