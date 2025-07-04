import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "The Lobbyist | Earth 2 Social Hub & Community Forum",
  description: "Join The Lobbyist, the official social hub for Earth 2 players. Share posts, discuss strategies, and connect with the community in our interactive forum.",
};

export default function LobbyistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 