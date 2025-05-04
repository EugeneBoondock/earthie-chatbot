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
import { PriceProvider } from "../contexts/PriceContext"

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
              <PriceProvider>
                <Navbar />
                {/* Main content area: Add h-full HERE */}
                <main className="relative z-10 h-full overflow-y-auto"> {/* Added h-full */}
                  {/* Children (like ChatPage) can now use h-full effectively */}
                  {children}
                </main>
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