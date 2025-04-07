"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { useState } from "react"
import { useSession, signOut } from "next-auth/react"

const navItems = [
  { name: "Home", path: "/" },
  { name: "Radio", path: "/radio" },
  { name: "Chat", path: "/chat" },
  { name: "Dev Tools", path: "/dev-tools" },
]

export default function Navbar() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { data: session, status } = useSession()
  const isLoading = status === "loading"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-earthie-dark-light bg-earthie-dark/95 backdrop-blur supports-[backdrop-filter]:bg-earthie-dark/60">
      <div className="container flex h-16 items-center justify-between">
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

        {/* Desktop navigation */}
        <nav className="hidden md:flex gap-6">
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
        </nav>

        {/* Auth buttons */}
        <div className="hidden md:flex items-center gap-4">
          {isLoading ? (
            <div className="h-9 w-20 bg-earthie-dark-light rounded-xl animate-pulse"></div>
          ) : session ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-300">Hi, {session.user?.name || "User"}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut()}
                className="rounded-xl border-earthie-mint text-earthie-mint hover:bg-earthie-mint/10"
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <>
              <Link href="/auth/login">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-300 hover:text-earthie-mint hover:bg-earthie-dark-light rounded-xl"
                >
                  Login
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-earthie-mint text-earthie-mint hover:bg-earthie-mint/10"
                >
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-white hover:text-earthie-mint hover:bg-earthie-dark-light"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          <span className="sr-only">Toggle menu</span>
        </Button>
      </div>

      {/* Mobile navigation */}
      {isMenuOpen && (
        <div className="md:hidden container py-4 pb-6 border-b border-earthie-dark-light">
          <nav className="flex flex-col space-y-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`text-sm font-medium transition-colors hover:text-earthie-mint ${
                  pathname === item.path ? "text-earthie-mint font-bold" : "text-gray-300"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}

            {/* Mobile auth buttons */}
            <div className="pt-4 border-t border-earthie-dark-light">
              {isLoading ? (
                <div className="h-9 w-full bg-earthie-dark-light rounded-xl animate-pulse"></div>
              ) : session ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm text-gray-300">Hi, {session.user?.name || "User"}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => signOut()}
                    className="rounded-xl border-earthie-mint text-earthie-mint hover:bg-earthie-mint/10 w-full"
                  >
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href="/auth/login" className="w-full">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-300 hover:text-earthie-mint hover:bg-earthie-dark-light rounded-xl w-full"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Login
                    </Button>
                  </Link>
                  <Link href="/auth/register" className="w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-earthie-mint text-earthie-mint hover:bg-earthie-mint/10 w-full"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Sign Up
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

