import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Earth 2 Raid Helper | Optimize Your Strategy & Performance",
  description: "Analyze your Earth 2 raid history with the Raid Helper. Upload your data to get detailed performance insights, track your success rate, and optimize your raiding strategy.",
};

export default function RaidHelperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 