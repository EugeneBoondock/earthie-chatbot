'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Session } from '@supabase/supabase-js';
import Sidebar from '@/components/sidebar';
import { cn } from '@/lib/utils';

interface ConditionalLayoutRendererProps {
  initialSession: Session | null;
  children: React.ReactNode;
}

export default function ConditionalLayoutRenderer({ 
  initialSession,
  children 
}: ConditionalLayoutRendererProps) {
  const pathname = usePathname();
  const supabase = createClientComponentClient();
  const [session, setSession] = useState<Session | null>(initialSession);

  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
      }
    );
    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const isInHub = pathname.startsWith('/hub');
  const showSidebar = session && isInHub;

  console.log("[ConditionalLayoutRenderer] Path:", pathname, "Is in Hub:", isInHub, "Session Active:", !!session, "Show Sidebar:", showSidebar);

  return (
    <>
      {showSidebar && <Sidebar />} 
      
      <main 
        className={cn(
          "relative z-10 h-full overflow-y-auto",
          showSidebar && "lg:pl-64" 
        )}
      >
        {children}
      </main>
    </>
  );
} 