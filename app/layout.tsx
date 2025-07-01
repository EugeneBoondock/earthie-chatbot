/// <reference types="next" />
/// <reference types="react" />
/// <reference lib="dom" />

import type { ReactNode } from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
// Ensure only the correct globals.css is imported
import "./globals.css" // Should point to app/globals.css
import { ThemeProvider } from "@/components/theme-provider"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import TopographicBackground from "@/components/TopographicBackground"
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister"
import PWAInstallButton from "@/components/PWAInstallButton"
import SplashScreenProvider from "@/components/SplashScreenProvider"
import { Analytics } from "@vercel/analytics/react"
import { PriceProvider } from "@/contexts/PriceContext"
import { AudioProvider } from "@/contexts/AudioContext"
import GlobalRadioPlayer from "@/components/GlobalRadioPlayer"
import Script from 'next/script';

// Imports for server-side Supabase and conditional layout
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/lib/database.types';
import ConditionalLayoutRenderer from '@/components/ConditionalLayoutRenderer';

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Earthie",
  description: "Your Earth2 companion",
  themeColor: "#50E3C1",
  manifest: "/manifest.json",
  icons: {
    icon: "/images/earthie_logo.png",
    apple: "/images/earthie_logo.png"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Earthie",
    startupImage: [
      {
        url: "/images/splash-gray/splash-640x1136.png",
        media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)"
      },
      {
        url: "/images/splash-gray/splash-750x1334.png",
        media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)"
      },
      {
        url: "/images/splash-gray/splash-1242x2208.png", 
        media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)"
      },
      {
        url: "/images/splash-gray/splash-1125x2436.png",
        media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
      },
      {
        url: "/images/splash-gray/splash-1242x2688.png",
        media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)"
      }
    ]
  },
  generator: 'EugeneBoondock'
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} text-white`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
          <TopographicBackground />
          <SplashScreenProvider>
            <AudioProvider>
              <div className="grid grid-rows-[auto_1fr_auto] min-h-screen relative z-0">
                <PriceProvider>
                  <Navbar />
                  <ConditionalLayoutRenderer initialSession={session}>
                    {children}
                  </ConditionalLayoutRenderer>
                  <Footer />
                </PriceProvider>
              </div>
              <GlobalRadioPlayer />
            </AudioProvider>
          </SplashScreenProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
        <PWAInstallButton />
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-3RFDT0F1SH"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-3RFDT0F1SH');
          `}
        </Script>
      </body>
    </html>
  )
}