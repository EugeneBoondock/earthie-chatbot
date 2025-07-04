import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Earth2 Radio | Exclusive News, Interviews & Updates",
  description: "Tune in to Earth2 Radio for the latest news, developer interviews, and community discussions about the Earth 2 metaverse. Stay informed with our exclusive podcast episodes.",
};

export default function RadioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 