// app/page.tsx - NOW A SERVER COMPONENT
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
// import { redirect } from 'next/navigation'; // No longer needed
import { Database } from '@/lib/database.types';
import HomePageClientContent from '@/components/HomePageClientContent'; // Import the new client component
import HubOverview from '@/components/HubOverview';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Earthie: The Essential Earth 2 Dashboard for Tools & Analytics",
  description: "Get the competitive edge in Earth 2 with Earthie's comprehensive dashboard. Access advanced player tools, property insights, live Essence price tracking, and community-driven scripts. Your all-in-one hub for Earth 2.",
};

export default async function Home() {
  // NOTE: We might still need Supabase instance here if HomePageClientContent needs initial data
  // If not, the Supabase setup can potentially be removed from this page.

  // // Assuming 'cookies()' might be seen as a Promise by the linter
  // const cookieStorePromise = cookies(); 

  // const supabase = createServerClient(
  //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
  //   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  //   {
  //     cookies: {
  //       get: async (name: string) => {
  //         const store = await cookieStorePromise; // Explicitly await
  //         return store.get(name)?.value;
  //       },
  //       set: async (name: string, value: string, options: CookieOptions) => {
  //         const store = await cookieStorePromise; // Explicitly await
  //         store.set(name, value, options);
  //       },
  //       remove: async (name: string, options: CookieOptions) => {
  //         const store = await cookieStorePromise; // Explicitly await
  //         const deleteOptions = { 
  //           ...options, // Spread original options like path, domain, secure, httpOnly, sameSite
  //           expires: new Date(0), 
  //           maxAge: 0 
  //         };
  //         store.set(name, '', deleteOptions);
  //       },
  //     }
  //   }
  // );

  // // Fetch session, but DO NOT redirect
  // const { data: { session } } = await supabase.auth.getSession();

  // // REMOVED REDIRECT LOGIC
  // // if (session) {
  // //   redirect('/hub');
  // // }

  // Always render the client content
  return (
    <>
      <HomePageClientContent />
      {/* Hub Overview Section (login-aware, styled) */}
      <HubOverview />
    </>
  );
}