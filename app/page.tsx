// app/page.tsx - NOW A SERVER COMPONENT
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { Database } from '@/lib/database.types';
import HomePageClientContent from '@/components/HomePageClientContent'; // Import the new client component

export default async function Home() {
  // Assuming 'cookies()' might be seen as a Promise by the linter
  const cookieStorePromise = cookies(); 

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => {
          const store = await cookieStorePromise; // Explicitly await
          return store.get(name)?.value;
        },
        set: async (name: string, value: string, options: CookieOptions) => {
          const store = await cookieStorePromise; // Explicitly await
          store.set(name, value, options);
        },
        remove: async (name: string, options: CookieOptions) => {
          const store = await cookieStorePromise; // Explicitly await
          const deleteOptions = { 
            ...options, // Spread original options like path, domain, secure, httpOnly, sameSite
            expires: new Date(0), 
            maxAge: 0 
          };
          store.set(name, '', deleteOptions);
        },
      }
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect('/hub');
  }

  return <HomePageClientContent />;
}