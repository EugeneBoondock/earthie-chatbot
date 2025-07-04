import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "My Earth 2 Profile | Stats, Properties & Portfolio",
  description: "View your complete Earth 2 profile on Earthie. Track your net worth, property portfolio, and key statistics in one convenient dashboard. Analyze your performance and manage your assets.",
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 