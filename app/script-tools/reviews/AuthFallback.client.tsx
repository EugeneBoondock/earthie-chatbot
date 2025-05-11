"use client"

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import ReviewClient from './ReviewClient.client'
// import { createClient, User } from '@supabase/supabase-js' // No longer creating client here
import { User } from '@supabase/supabase-js' // User type is still needed
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase' // Import the shared client

// --- Supabase Configuration ---
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; // No longer needed here
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // No longer needed here

// // Ensure keys are provided
// if (!supabaseUrl || !supabaseAnonKey) { // No longer needed here
//   console.error("Supabase URL or Anon Key environment variables are missing!");
//   console.error("Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local file or Vercel environment variables.");
//   throw new Error("Supabase environment variables not set. Check console for details.");
// }

// const supabase = createClient(supabaseUrl, supabaseAnonKey); // No longer creating client here

export default function AuthFallback() {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  
  useEffect(() => {
    // Immediately set up the auth state listener
    // The listener will provide the initial user state as well as subsequent changes.
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AuthFallback] Auth state changed: ${event}`, session);
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (currentUser) {
        try {
          console.log("[AuthFallback] Fetching profile for user:", currentUser.id);
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', currentUser.id)
            .single();

          if (profileError) {
            // Log error but don't prevent login, use fallback
            console.error("[AuthFallback] Error fetching profile on auth change:", profileError.message);
          }
          
          if (profileData?.username) {
            console.log("[AuthFallback] Using username from profiles table:", profileData.username);
            setUsername(profileData.username);
          } else if (currentUser.user_metadata?.username) {
            console.log("[AuthFallback] Using username from user metadata:", currentUser.user_metadata.username);
            setUsername(currentUser.user_metadata.username);
          } else {
            console.log("[AuthFallback] Using email as fallback username");
            setUsername(currentUser.email ?? null);
          }
        } catch (e: any) {
          console.error('[AuthFallback] Exception fetching profile on auth change:', e.message);
          // Fallback to email if profile fetch fails unexpectedly
          setUsername(currentUser.email ?? null);
        }
      } else {
        setUsername(null);
      }
      // Regardless of user presence, once the first auth event comes through, we are no longer loading initial auth state.
      setIsLoading(false);
    });

    // OPTIMISTIC CHECK: Try to get session immediately.
    // This might populate the user faster if the session is readily available,
    // but onAuthStateChange remains the ultimate source of truth for loading state.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Only act if onAuthStateChange hasn't already processed a user and we haven't stopped loading.
      // This check `isLoading` is important. If onAuthStateChange fired first and set isLoading to false,
      // we don't want this to potentially override its decision.
      if (isLoading && session?.user) {
        console.log("[AuthFallback] Pre-emptive getSession() found user:", session.user.id);
        setUser(session.user); 
        // Fetch username for this pre-emptively found user
        try {
          console.log("[AuthFallback] Fetching profile for pre-emptive user:", session.user.id);
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.error("[AuthFallback] Error fetching profile for pre-emptive user:", profileError.message);
          }

          if (profileData?.username) {
            setUsername(profileData.username);
          } else if (session.user.user_metadata?.username) {
            setUsername(session.user.user_metadata.username);
          } else {
            setUsername(session.user.email ?? null);
          }
        } catch (e: any) {
          console.error('[AuthFallback] Exception fetching profile for pre-emptive user:', e.message);
          setUsername(session.user.email ?? null);
        }
      } else if (isLoading && !session?.user) {
        console.log("[AuthFallback] Pre-emptive getSession() found no user. Waiting for onAuthStateChange.");
      }
      // DO NOT set isLoading to false here. onAuthStateChange handles that.
    });

    // Clean up listener
    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs once on mount

  // Handle login redirect
  const handleLogin = () => {
    window.location.href = '/auth/login';
  }
  
  if (isLoading) {
    return (
      <div className="mt-8 p-4 flex flex-col items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-sky-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Checking authentication...</span>
        </div>
      </div>
    )
  }
  
  if (user) {
    return <ReviewClient user={user} username={username} />
  }
  
  // If not authenticated, show login prompt
  return (
    <div className="container py-12 text-center">
      <div className="bg-slate-800 p-6 rounded-lg max-w-md mx-auto">
        <h2 className="text-xl font-bold text-white mb-4">Authentication Required</h2>
        <p className="text-gray-400 mb-6">
          You need to be logged in to access the script review dashboard.
        </p>
        <Button 
          onClick={handleLogin} 
          className="bg-blue-700 hover:bg-blue-600"
        >
          Log In
        </Button>
      </div>
    </div>
  )
} 