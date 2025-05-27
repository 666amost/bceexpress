"use client";

import dynamic from "next/dynamic";

// Lazy load analytics to reduce initial bundle size and improve performance
const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((mod) => mod.SpeedInsights),
  { 
    ssr: false,
    loading: () => null // No loading component to avoid layout shift
  }
);

const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((mod) => mod.Analytics),
  { 
    ssr: false,
    loading: () => null // No loading component to avoid layout shift
  }
);

export function AnalyticsWrapper() {
  // Only load analytics in production and not for courier routes to improve performance
  // We can add more sophisticated route checking if needed
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  // For now, load on all production pages
  return (
    <>
      <SpeedInsights />
      <Analytics />
    </>
  );
} 