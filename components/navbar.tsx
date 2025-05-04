"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { useState } from "react"

const navItems = [
  { name: "Home", path: "/" },
  { name: "Radio", path: "/radio" },
  { name: "Chat", path: "/chat" },
  { name: "Dev Tools", path: "/script-tools" },
  { name: "Raid Helper", path: "/raid-helper" },
  { name: "Thoughts", path: "/thoughts" },
]

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-700 bg-[#383A4B]/90 backdrop-blur-md relative">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative w-10 h-10 overflow-hidden rounded-full">
              <Image
                src="/images/earthie_logo.png"
                alt="Earthie Logo"
                width={40}
                height={40}
                className="object-cover rounded-full"
              />
            </div>
            <span className="font-bold text-xl hidden md:inline-block text-white">Earthie</span>
          </Link>
        </div>

        <div className="hidden md:flex items-center space-x-6">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`text-sm font-medium transition-colors hover:text-earthie-mint ${
                pathname === item.path ? "text-earthie-mint border-b-2 border-earthie-mint" : "text-gray-300"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="absolute right-0 top-full w-2/3 bg-gray-800 border-t border-l border-gray-700 md:hidden shadow-lg max-h-[50vh] overflow-y-auto rounded-bl-lg">
          <div className="flex flex-col space-y-2 p-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  pathname === item.path
                    ? 'bg-[#50E3C1] text-gray-900'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
