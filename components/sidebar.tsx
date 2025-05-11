'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  UserCircle,
  Newspaper,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Coins
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Define the type for your database if you have one for Supabase client
// import { Database } from '@/lib/database.types';

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);

  const handleLogout = async () => {
    try {
      console.log('[Sidebar] Logout initiated');
      
      // Close sidebar first for immediate UI feedback
      setIsOpen(false);
      
      // Use direct browser navigation for more reliable logout
      window.location.href = '/auth/logout';
    } catch (error: any) {
      console.error('[Sidebar] Logout failed:', error);
    }
  };

  const toggleSidebar = () => setIsOpen(!isOpen);

  const navItems = [
    { href: '/hub', label: 'Hub Home', icon: LayoutDashboard },
    { href: '/hub/profile', label: 'My Profile', icon: UserCircle },
    { href: '/hub/essence', label: 'Essence Tracker', icon: Coins },
    { href: '/hub/lobbyist', label: 'My Lobbyist', icon: MessageSquare },
    { href: '/hub/e2pedia', label: 'E2Pedia', icon: Newspaper },
  ];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  return (
    <>
      {/* Toggle Button (always visible, fixed position) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className={cn(
          "fixed top-[4.1rem] z-50 flex items-center justify-center text-white hover:text-earthie-mint transition-colors",
          "h-10 w-10 rounded-none border-gray-700/50",
          isOpen 
            ? "left-64 border-l bg-gray-900/95" 
            : "left-0 border-r bg-gray-800/70 hover:bg-gray-700/90",
        )}
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isOpen ? 
          <PanelLeftClose className="h-5 w-5" /> : 
          <PanelLeftOpen className="h-5 w-5" />
        }
      </Button>

      {/* Sidebar Panel */}
      <aside
        className={cn(
          "fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] bg-[#383A4B]/80 backdrop-blur-md text-white transition-all duration-300 ease-in-out",
          "flex flex-col shadow-2xl border-r border-gray-700/50",
          isOpen ? "translate-x-0 opacity-100 w-64" : "-translate-x-full opacity-0 w-64",
          className
        )}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-700/50">
            <h2 className="text-2xl font-semibold">Earthie Hub</h2>
        </div>
        <nav className="flex-grow p-4 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link href={item.href} passHref>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left hover:bg-gray-700/80 hover:text-earthie-mint transition-colors"
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </Button>
                </Link>
              </li>
            ))}
            {/* Code Review link - always show since sidebar is only for logged-in users */}
            <li>
              <Link href="/script-tools/reviews" passHref>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left hover:bg-gray-700/80 hover:text-earthie-mint transition-colors"
                >
                  <Newspaper className="mr-3 h-5 w-5" />
                  Code Review
                </Button>
              </Link>
            </li>
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-700/50">
          <Button
            variant="ghost"
            className="w-full justify-start text-left hover:bg-gray-700/80 hover:text-earthie-mint transition-colors"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content overlay when sidebar is open */}
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