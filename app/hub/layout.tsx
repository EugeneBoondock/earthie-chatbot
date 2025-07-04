import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "The Hub | Earthie's Earth 2 Player Dashboard",
  description: "Welcome to The Hub, your central dashboard for all Earthie tools. Access your profile, track Essence, explore E2Pedia, and connect with the community in the Lobbyist social hub.",
};

// HubLayout now only provides a <main> wrapper for its children.
// Styling like padding (p-6) can be kept here for consistency across hub pages,
// or removed if each page should define its own layout fully.
export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex-grow p-6"> 
      {children}
    </main>
  );
} 