import React from 'react';

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