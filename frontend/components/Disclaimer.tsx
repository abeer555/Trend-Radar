export default function Disclaimer() {
  return (
    <div className="rounded-lg border border-warn/20 bg-warn/5 px-4 py-3 text-xs text-warn/90">
      <strong className="font-semibold">Educational Tool — Not Investment Advice.</strong>{" "}
      All signals are rule-based and historical. Past performance does not predict future results.
      This tool does not recommend buying or selling securities.
      <span className="mt-1 block text-warn/70">
        India users: sharing stock recommendations publicly may require SEBI Research Analyst (RA)
        or Investment Adviser (IA) registration under SEBI (Research Analysts) Regulations, 2014.
      </span>
    </div>
  );
}
