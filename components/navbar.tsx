// components/Navbar.js or .tsx
"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { useState } from "react" // Only keep useState for mobile menu toggle
import { usePriceContext } from "@/contexts/PriceContext"; // Import the custom hook
import { format } from 'date-fns'; // For formatting dates if needed elsewhere
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

const navItems = [
  { name: "Home", path: "/" },
  { name: "Radio", path: "/radio" },
  { name: "Chat", path: "/chat" },
  { name: "Dev Tools", path: "/script-tools" },
  { name: "Raid Helper", path: "/raid-helper" },
]

// --- Configuration Constants (can be removed if not needed outside context) ---
const cryptoSymbol = 'E2E';
const cryptoLink = 'https://www.coingecko.com/en/coins/earth-2-essence';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // --- Consume Price Context ---
  const {
    selectedCurrency,
    setSelectedCurrencyAndUpdate, // Use the update function from context
    currentPrice,
    price24hChange,
    supportedFiatCurrencies,
    isLoadingCurrencies,
    isLoadingPrice,
    isInitialising,
    priceError,
  } = usePriceContext();

  // --- Format Percentage Change (Remains the same, uses context data now) ---
  const formatPercentage = (change: number | null): React.ReactNode => {
    if (change === null || change === undefined) return <span className="ml-1.5"></span>;
    const formattedChange = change.toFixed(2);
    let changeClass = 'text-neutral';
    let prefix = '';
    if (change > 0) { changeClass = 'text-positive'; prefix = '+'; }
    else if (change < 0) { changeClass = 'text-negative'; }
    return (
      <span className={`ml-1.5 font-medium ${changeClass}`}>
        ({prefix}{formattedChange}%)
      </span>
    );
  };

  // --- Handle Currency Change (Calls context function) ---
  const handleCurrencyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCurrencyAndUpdate(event.target.value);
  };

  // --- Ticker Display Content Component (Uses context data) ---
  const TickerContent = () => {
      // Use the most comprehensive loading state: isInitialising means list or initial selection is pending
      if (isInitialising || isLoadingPrice) {
        return <span className="text-sm text-gray-400 animate-pulse">Loading...</span>;
      }
      if (priceError) {
        // Show error, maybe title has more detail
        return <span className="text-sm text-negative font-medium" title={priceError}>Error</span>;
      }
      // Format the current price from context
      const formattedPrice = currentPrice?.toLocaleString(undefined, {
          style: 'currency',
          currency: selectedCurrency.toUpperCase(),
          minimumFractionDigits: 2,
          maximumFractionDigits: 6
      }) ?? 'N/A'; // Display N/A if price is null

      return (
          <div className="text-sm text-gray-200 flex items-center whitespace-nowrap">
              <span className="font-medium">{cryptoSymbol}:</span>
              <span className="font-semibold text-earthie-mint ml-1">{formattedPrice}</span>
              {formatPercentage(price24hChange)}
          </div>
      );
  };

  // --- JSX Structure ---
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-700 bg-[#383A4B]/90 backdrop-blur-md">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between flex-wrap min-w-0">

        {/* Left side: Logo and Name */}
        <div className="flex items-center gap-2 z-30 min-w-[56px]">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative w-10 h-10 overflow-hidden rounded-full"> <Image src="/images/earthie_logo.png" alt="Earthie Logo" width={40} height={40} className="object-cover rounded-full"/> </div>
            <span className="font-bold text-xl hidden md:inline-block text-white">Earthie</span>
          </Link>
        </div>

        {/* Center: Ticker - always perfectly centered */}
        <div className="flex-1 flex justify-center min-w-0 overflow-hidden ml-4 md:ml-0">
          <a href={cryptoLink} target="_blank" rel="noopener noreferrer" className="block cursor-pointer w-full max-w-xs" aria-label={`View ${cryptoSymbol} price on CoinGecko`}>
            <div className="marquee-container"><div className="marquee-content"><TickerContent /></div></div>
          </a>
        </div>

        {/* Right: placeholder for perfect centering on mobile */}
        <div className="min-w-[56px] block md:hidden" aria-hidden="true"></div>

        {/* Right side: Contains Desktop Nav, Currency Selector, Mobile Menu Button */}
        <div className="flex items-center gap-4 z-30">
             {/* Desktop Navigation Items */}
            <div className="hidden md:flex items-center space-x-4 lg:space-x-6">
              {navItems.map((item) => ( <Link key={item.path} href={item.path} className={`text-sm font-medium transition-colors hover:text-earthie-mint ${ pathname === item.path ? "text-earthie-mint border-b-2 border-earthie-mint" : "text-gray-300" }`}> {item.name} </Link> ))}

              {/* Profile Menu */}
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="text-sm font-medium text-gray-300 hover:text-earthie-mint">
                      Profile
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="w-48 p-2">
                        <NavigationMenuLink asChild>
                          <Link
                            href="/auth/login"
                            className="block px-4 py-2 text-sm text-gray-300 hover:text-earthie-mint hover:bg-gray-700 rounded-md"
                          >
                            Login
                          </Link>
                        </NavigationMenuLink>
                        <NavigationMenuLink asChild>
                          <Link
                            href="/auth/signup"
                            className="block px-4 py-2 text-sm text-gray-300 hover:text-earthie-mint hover:bg-gray-700 rounded-md"
                          >
                            Sign Up
                          </Link>
                        </NavigationMenuLink>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>

            {/* Currency Selector (Desktop) - Uses context data */}
            {/* Show selector only when fully initialised */}
            {!isInitialising && !isLoadingCurrencies && (
                <div className="hidden md:block">
                    <select
                        id="currency-select-desktop"
                        value={selectedCurrency} // From context
                        onChange={handleCurrencyChange} // Calls context update
                        className="bg-gray-700 border border-gray-600 text-white text-xs rounded p-1 pr-5 focus:ring-earthie-mint focus:border-earthie-mint cursor-pointer" // Removed appearance-none
                        aria-label="Select Fiat Currency"
                        title="Select Fiat Currency"
                    >
                        {/* Map over supportedFiatCurrencies from context */}
                        {supportedFiatCurrencies.map(currency => (
                            <option key={currency} value={currency}>
                                {currency.toUpperCase()}
                            </option>
                        ))}
                    </select>
                </div>
            )}
             {/* Loading indicator */}
             {(isLoadingCurrencies || isInitialising) && (
                 <div className="hidden md:block text-xs text-gray-400 animate-pulse">...</div>
             )}

            {/* Mobile Menu Button */}
            <div className="flex items-center md:hidden">
                <button className="p-2 text-gray-300 hover:text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle menu" aria-expanded={isMobileMenuOpen} > {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />} </button>
            </div>
        </div>

      </div>

      {/* Mobile Menu Dropdown - Uses context data */}
      {isMobileMenuOpen && (
         <div className="absolute right-0 top-full w-2/3 bg-[#303240] border-t border-l border-gray-700 md:hidden shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto rounded-bl-lg z-40">
            <div className="flex flex-col space-y-1 p-4">
              {/* Nav items */}
              {navItems.map((item) => ( <Link key={item.path} href={item.path} onClick={() => setIsMobileMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium ${ pathname === item.path ? 'bg-earthie-mint text-gray-900' : 'text-gray-300 hover:bg-gray-700 hover:text-white' }`}> {item.name} </Link> ))}
              
              <hr className="border-gray-600 my-2" />

              {/* Profile related links for mobile */} 
              {/* TODO: Conditionally render based on session state later */}
              {/* For now, showing Login/Sign Up, assuming user is not logged in, or showing all for testing */}
              
              <Link href="/hub/profile" onClick={() => setIsMobileMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white`}>
                My Profile (Hub)
              </Link>
              <Link href="/auth/login" onClick={() => setIsMobileMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white`}>
                Login
              </Link>
              <Link href="/auth/signup" onClick={() => setIsMobileMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white`}>
                Sign Up
              </Link>
              
              <hr className="border-gray-600 my-2" />

              {/* Mobile Currency Selector */}
              {!isInitialising && !isLoadingCurrencies && (
                  <div className="px-3 py-2">
                      <label htmlFor="currency-select-mobile" className="block text-sm font-medium text-gray-400 mb-1">Currency:</label>
                      <select
                          id="currency-select-mobile"
                          value={selectedCurrency} // From context
                          onChange={(e) => {handleCurrencyChange(e); setIsMobileMenuOpen(false);}} // Calls context update & closes menu
                          className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded p-1.5 pr-6 focus:ring-earthie-mint focus:border-earthie-mint cursor-pointer"
                          aria-label="Select Fiat Currency"
                      >
                         {supportedFiatCurrencies.map(currency => ( <option key={currency} value={currency}> {currency.toUpperCase()} </option> ))}
                      </select>
                  </div>
               )}
               {(isLoadingCurrencies || isInitialising) && (
                   <div className="px-3 py-2 text-sm text-gray-400 animate-pulse">Loading currencies...</div>
               )}
            </div>
         </div>
      )}
    </nav>
  )
}