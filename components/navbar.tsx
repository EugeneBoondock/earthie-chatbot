// components/Navbar.js or .tsx
"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { useState, useEffect } from "react" // useEffect imported
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
import { supabase } from "@/lib/supabase" // Imported Supabase client
import type { User } from "@supabase/supabase-js" // Imported User type
import { useRouter } from 'next/navigation' // To redirect after logout

const navItems = [
  { name: "Home", path: "/" },
  { name: "Radio", path: "/radio" },
  { name: "Chat", path: "/chat" },
  { name: "Dev Tools", path: "/script-tools" },
  { name: "Raid Helper", path: "/raid-helper" },
]

// --- Configuration Constants (can be removed if not needed outside context) ---
const cryptoSymbol = 'ESS';
const cryptoLink = 'https://www.coingecko.com/en/coins/earth-2-essence';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter(); // Initialize router
  const [user, setUser] = useState<User | null>(null); // User state

  // --- Supabase Auth Listener ---
  useEffect(() => {
    // Fetch initial session on component mount
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    
    fetchSession();
    
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[Navbar] Auth state change: ${event}`, session?.user?.id);
      setUser(session?.user ?? null);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      console.log('[Navbar] Logout initiated');
      
      // Close mobile menu immediately for better UX
      setIsMobileMenuOpen(false);
      
      // Use direct browser navigation for more reliable logout
      window.location.href = '/auth/logout';
    } catch (error: any) {
      console.error('[Navbar] Logout failed:', error);
    }
  };

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
    if (change === null || change === undefined) return null; // Return null instead of empty span
    const formattedChange = change.toFixed(2);
    let changeClass = 'text-neutral';
    let prefix = '';
    if (change > 0) { changeClass = 'text-positive'; prefix = '+'; }
    else if (change < 0) { changeClass = 'text-negative'; }
    // Use smaller font size for percentage on smaller screens if needed
    return (
      <span className={`ml-1 text-xs sm:text-sm font-medium ${changeClass}`}>
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
    if (isInitialising || isLoadingPrice) {
      return <span className="text-xs sm:text-sm text-gray-400 animate-pulse">Loading Price...</span>;
    }
    if (priceError) {
      return <span className="text-xs sm:text-sm text-negative font-medium truncate" title={priceError}>Price Error</span>;
    }
    const formattedPrice = currentPrice?.toLocaleString(undefined, {
        style: 'currency',
        currency: selectedCurrency.toUpperCase(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
    }) ?? 'N/A';

    return (
        <div className="inline-flex items-center justify-center whitespace-nowrap animate-[marquee_15s_linear_infinite]">
            <span className="font-medium mr-1">{cryptoSymbol}:</span>
            <span className="font-semibold text-earthie-mint">{formattedPrice}</span>
            {formatPercentage(price24hChange)}
        </div>
    );
  };

  // --- JSX Structure ---
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-700 bg-[#383A4B]/80 backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-16 min-w-0">

        {/* Left side: Logo and Name */}
        <div className="flex items-center gap-2 z-30 flex-shrink-0 min-w-[40px] sm:min-w-[120px]">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative w-8 h-8 md:w-10 md:h-10 overflow-hidden rounded-full">
              <picture>
                <source srcSet="/images/optimized/earthie_logo.webp" type="image/webp" />
                <Image 
                  src="/images/optimized/earthie_logo_optimized.png" 
                  alt="Earthie Logo" 
                  width={40} 
                  height={40} 
                  className="object-cover rounded-full" 
                  priority 
                />
              </picture>
            </div>
            <div className="hidden sm:block relative overflow-hidden">
              <span className="font-bold text-lg md:text-xl earthie-text-gradient">Earthie</span>
              <div className="light-ray"></div>
            </div>
          </Link>
        </div>

        {/* Center: Ticker */}
        <div className="flex-1 flex justify-center items-center mx-4 min-w-0 overflow-hidden">
          <div className="w-full max-w-[400px] overflow-hidden px-2">
            <a href={cryptoLink} 
               target="_blank" 
               rel="noopener noreferrer" 
               className="block w-full text-center text-xs md:text-sm hover:text-earthie-mint transition-colors" 
               aria-label={`View ${cryptoSymbol} price on CoinGecko`}>
            <TickerContent /> 
          </a>
          </div>
        </div>

        {/* Right side: Desktop Nav, Currency, Mobile Toggle - Prevent shrinking */}
        <div className="flex items-center gap-2 z-30 flex-shrink-0 min-w-[40px] sm:min-w-[120px] justify-end">
             {/* Desktop Navigation Items - Hidden below md */}
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
                      <div className="w-48 p-2 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
                        {user ? (
                          <>
                            <NavigationMenuLink asChild>
                              <Link
                                href="/hub"
                                className="block px-4 py-2 text-sm text-gray-200 hover:text-earthie-mint hover:bg-gray-700 rounded-md"
                              >
                                The Hub
                              </Link>
                            </NavigationMenuLink>
                            <button
                              onClick={handleLogout}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:text-earthie-mint hover:bg-gray-700 rounded-md"
                            >
                              Logout
                            </button>
                          </>
                        ) : (
                          <>
                        <NavigationMenuLink asChild>
                          <Link
                            href="/auth/login"
                                className="block px-4 py-2 text-sm text-gray-200 hover:text-earthie-mint hover:bg-gray-700 rounded-md"
                          >
                            Login
                          </Link>
                        </NavigationMenuLink>
                        <NavigationMenuLink asChild>
                          <Link
                            href="/auth/signup"
                                className="block px-4 py-2 text-sm text-gray-200 hover:text-earthie-mint hover:bg-gray-700 rounded-md"
                          >
                            Sign Up
                          </Link>
                        </NavigationMenuLink>
                          </>
                        )}
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>

            {/* Currency Selector (Desktop) - Hidden below md */}
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
             {(isLoadingCurrencies || isInitialising) && (
                 <div className="hidden md:block text-xs text-gray-400 animate-pulse">...</div>
             )}

            {/* Mobile Menu Button - Shown below md */}
            <div className="flex items-center md:hidden">
                <button className="p-2 text-gray-300 hover:text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle menu" aria-expanded={isMobileMenuOpen} > {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />} </button>
            </div>
        </div>

      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
         <div className="absolute right-0 top-full w-full sm:w-2/3 md:hidden bg-[#303240] border-t border-l border-gray-700 shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto rounded-bl-lg z-40">
            <div className="flex flex-col space-y-1 p-4">
              {/* Nav items */}
              {navItems.map((item) => ( <Link key={item.path} href={item.path} onClick={() => setIsMobileMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium ${ pathname === item.path ? 'bg-earthie-mint text-gray-900' : 'text-gray-300 hover:bg-gray-700 hover:text-white' }`}> {item.name} </Link> ))}
              
              <hr className="border-gray-600 my-2" />

              {/* Profile related links for mobile */} 
              {user ? (
                <>
              <Link href="/hub" onClick={() => setIsMobileMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white`}>
                    The Hub
              </Link>
                  <button onClick={handleLogout} className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white`}>
                    Logout
                  </button>
                </>
              ) : (
                <>
              <Link href="/auth/login" onClick={() => setIsMobileMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white`}>
                Login
              </Link>
              <Link href="/auth/signup" onClick={() => setIsMobileMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white`}>
                Sign Up
              </Link>
                </>
              )}
              
              <hr className="border-gray-600 my-2" />

              {/* Mobile Currency Selector */}
              {!isInitialising && !isLoadingCurrencies && (
                <div className="mt-4">
                  <label htmlFor="currency-select-mobile" className="text-sm font-medium text-gray-400 mb-1 block">Currency:</label>
                  <select
                      id="currency-select-mobile"
                      value={selectedCurrency}
                      onChange={(e) => { handleCurrencyChange(e); setIsMobileMenuOpen(false); }}
                      className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded p-2 focus:ring-earthie-mint focus:border-earthie-mint"
                      aria-label="Select Fiat Currency"
                  >
                      {supportedFiatCurrencies.map(currency => (
                          <option key={currency} value={currency}>
                              {currency.toUpperCase()}
                          </option>
                      ))}
                  </select>
                </div>
              )}
               {(isLoadingCurrencies || isInitialising) && (
                   <div className="mt-4 text-sm text-gray-400 animate-pulse">Loading currency...</div>
               )}
            </div>
         </div>
      )}

      {/* Add the styles */}
      <style jsx>{`
        .earthie-text-gradient {
          background: linear-gradient(to right, #50E3C1, #38bdf8);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          position: relative;
          display: inline-block;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-shadow: 0 2px 10px rgba(80, 227, 193, 0.3);
        }
        
        .light-ray {
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            90deg, 
            transparent, 
            rgba(255, 255, 255, 0.4), 
            transparent
          );
          transform: skewX(-25deg);
          animation: ray-animation 3s infinite;
        }
        
        @keyframes ray-animation {
          0% { left: -100%; }
          50% { left: 200%; }
          100% { left: 200%; }
        }
      `}</style>
    </nav>
  )
}