import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Live Earth 2 Essence Tracker | Price, Charts & Analytics",
  description: "Track the live price of Earth 2's Essence token with real-time charts and analytics. Monitor market cap, trading volume, and wallet transactions with our comprehensive Essence tracker.",
};

export default function EssenceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 