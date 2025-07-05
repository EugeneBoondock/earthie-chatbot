import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Minerals Explorer | Earth 2 Geological Resources & Property Analysis",
  description: "Discover mineral deposits and prospects near your Earth 2 properties. Explore geological data, analyze mineral occurrences, and find valuable resources with our comprehensive minerals mapping tool.",
};

export default function MineralsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 