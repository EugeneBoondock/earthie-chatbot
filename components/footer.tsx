import Link from "next/link"
import Image from "next/image"

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-earthie-dark-light py-6 md:py-0 bg-earthie-dark text-white">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4 md:h-16">
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8 overflow-hidden rounded-full">
            <Image src="/images/earthie_logo.png" alt="Earthie Logo" width={32} height={32} className="object-cover" />
          </div>
          <p className="text-sm">© {currentYear} Earthie. All rights reserved.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/about" className="text-sm text-gray-300 hover:text-earthie-mint">
            About
          </Link>
          <Link href="/privacy" className="text-sm text-gray-300 hover:text-earthie-mint">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-sm text-gray-300 hover:text-earthie-mint">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  )
}

