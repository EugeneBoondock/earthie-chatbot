import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Logistics Planner | Earth 2 Route & Property Visualization",
  description: "Plan your Earth 2 logistics with our advanced planner. Visualize your property network, calculate optimal routes between properties, and manage your in-game supply chain efficiently.",
};

export default function LogisticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 