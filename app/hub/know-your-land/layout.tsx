import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Know Your Land | In-Depth Earth 2 Property Analysis",
  description: "Get detailed insights into your Earth 2 properties with Know Your Land. Analyze location data, historical information, and local resources to make informed decisions about your land assets.",
};

export default function KnowYourLandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 