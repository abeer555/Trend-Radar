import HomeClient from "./HomeClient";

// The leaderboard is rendered client-side so the offline fallbacks
// (browser cache → committed static snapshot) apply — the page works on
// Vercel even while the backend laptop is off.
export default function Page() {
  return <HomeClient />;
}
