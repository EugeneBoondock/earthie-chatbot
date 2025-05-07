'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Corrected import
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, // Icon for Hub/Dashboard
  UserCircle,      // Icon for Profile
  Newspaper,       // Icon for E2Pedia
  LogOut,          // Icon for Logout
  Menu,            // Icon for Toggle Open
  X                // Icon for Toggle Close
} from 'lucide-react';
import { cn } from '@/lib/utils'; // For conditional class names

// Define the type for your database if you have one for Supabase client
// import { Database } from '@/lib/database.types';

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false); // Start closed by default
  const router = useRouter();
  const supabase = createClientComponentClient(); // For client-side auth actions like logout

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/'); // Redirect to home page after logout
    router.refresh(); // Refresh server components
  };

  const toggleSidebar = () => setIsOpen(!isOpen);

  const navItems = [
    { href: '/hub', label: 'Hub Home', icon: LayoutDashboard },
    { href: '/hub/profile', label: 'My Profile', icon: UserCircle },
    { href: '/hub/e2pedia', label: 'E2Pedia', icon: Newspaper },
    // Add other Hub-specific links here
  ];

  return (
    <>
      {/* Toggle Button (always visible, fixed position) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className={cn(
          "fixed top-18 left-4 z-50 text-white bg-gray-800/70 hover:bg-gray-700/90 backdrop-blur-sm rounded-full",
          "lg:top-4",
        )}
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Sidebar Panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen bg-gray-900/95 backdrop-blur-lg text-white transition-transform duration-300 ease-in-out", // Use transform for animation
          "flex flex-col shadow-2xl border-r border-gray-700/50",
          isOpen ? "translate-x-0 w-64" : "-translate-x-full w-64", // Slide in/out
          className
        )}
      >
        {/* Content is always rendered, but only visible when open */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
            <h2 className="text-2xl font-semibold">Earthie Hub</h2>
            {/* Optional: Keep X here too, or rely on external toggle */}
             <Button variant="ghost" size="icon" onClick={toggleSidebar} className="lg:hidden" aria-label="Close sidebar">
                <X className="h-6 w-6" />
             </Button>
        </div>
        <nav className="flex-grow p-4 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link href={item.href} passHref>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left hover:bg-gray-700"
                    // Add active link styling if needed using usePathname
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-700">
          <Button
            variant="destructive"
            className="w-full justify-start text-left bg-red-600 hover:bg-red-700"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content overlay when sidebar is open (for mobile/tablet touch dismiss) */}
      {isOpen && (
        <div 
          onClick={toggleSidebar} 
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-hidden="true"
        />
      )}
    </>
  );
} 