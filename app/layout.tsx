import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import TopographicBackground from "@/components/TopographicBackground"

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
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} text-white`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
          <TopographicBackground />
          <div className="flex flex-col min-h-screen relative z-0">
            <Navbar />
            <main className="flex-grow container mx-auto px-4 py-8 relative z-10">
              {children}
            </main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}

import './globals.css'