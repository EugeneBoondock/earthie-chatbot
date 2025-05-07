import Link from 'next/link';

export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-cyan-100">
      {/* You could add a shared HubHeader or Navbar here if needed */}
      <header className="bg-gray-900/80 backdrop-blur-md shadow-lg p-4 sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/hub" className="text-2xl font-bold text-sky-300 hover:text-sky-200 transition">
            The Hub
          </Link>
          <nav className="space-x-4">
            <Link href="/hub/profile" className="text-cyan-200 hover:text-sky-300 transition">Profile</Link>
            <Link href="/hub/e2pedia" className="text-cyan-200 hover:text-sky-300 transition">E2pedia</Link>
            <Link href="/hub/firesales" className="text-cyan-200 hover:text-sky-300 transition">Firesales</Link>
            <Link href="/dashboard" className="text-cyan-200 hover:text-sky-300 transition">Dashboard</Link> 
          </nav>
        </div>
      </header>
      <main className="flex-grow container mx-auto p-6">
        {children}
      </main>
      <footer className="bg-gray-900 text-center p-4 text-xs text-cyan-400/70 border-t border-sky-400/20">
        Welcome to The Hub.
      </footer>
    </div>
  );
} 