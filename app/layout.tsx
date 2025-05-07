import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
// Ensure only the correct globals.css is imported
import "./globals.css" // Should point to app/globals.css
import { ThemeProvider } from "@/components/theme-provider"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import TopographicBackground from "@/components/TopographicBackground"
import Head from "next/head"
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister"
import PWAInstallButton from "@/components/PWAInstallButton"
import { Analytics } from "@vercel/analytics/react"
import { PriceProvider } from "@/contexts/PriceContext"

// Imports for server-side Supabase and conditional layout
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/lib/database.types';
import ConditionalLayoutRenderer from '@/components/ConditionalLayoutRenderer';

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Earthie - Earth2 Chatbot",
  description: "Your AI companion for everything Earth2",
  icons: {
    icon: [
      {
        url: "/images/earthie_logo.png",
        href: "/images/earthie_logo.png",
      },
    ],
    apple: {
      url: "/images/earthie_logo.png",
      href: "/images/earthie_logo.png",
    },
  },
    generator: 'EugeneBoondock'
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStorePromise = cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => {
          const store = await cookieStorePromise;
          return store.get(name)?.value;
        },
        set: async (name: string, value: string, options: CookieOptions) => {
          const store = await cookieStorePromise;
          store.set(name, value, options);
        },
        remove: async (name: string, options: CookieOptions) => {
          const store = await cookieStorePromise;
          const deleteOptions = {
            ...options,
            expires: new Date(0),
            maxAge: 0
          };
          store.set(name, '', deleteOptions);
        },
      }
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  return (
    <>
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#50E3C1" />
        <link rel="apple-touch-icon" href="/images/earthie_logo.png" />
      </Head>
      {/* Ensure html and body have height: 100% via globals.css */}
      <html lang="en" className="dark" suppressHydrationWarning>
        <body className={`${inter.className} text-white`}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
            {/* Background should likely be positioned absolutely or fixed if it needs to be behind everything */}
            <TopographicBackground />
            {/* Grid container: takes full screen height */}
            <div className="grid grid-rows-[auto_1fr_auto] min-h-screen relative z-0">
              {/* PriceProvider wraps Navbar, ConditionalLayoutRenderer, and Footer */}
              <PriceProvider>
                <Navbar />
                <ConditionalLayoutRenderer initialSession={session}>
                  {children} {/* This children is the page content */}
                </ConditionalLayoutRenderer>
                <Footer />
              </PriceProvider>
            </div>
          </ThemeProvider>
          <ServiceWorkerRegister />
          <PWAInstallButton />
        </body>
      </html>
    </>
  )
}