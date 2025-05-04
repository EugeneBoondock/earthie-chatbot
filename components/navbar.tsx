"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { useState, useEffect } from "react"

const navItems = [
  { name: "Home", path: "/" },
  { name: "Radio", path: "/radio" },
  { name: "Chat", path: "/chat" },
  { name: "Dev Tools", path: "/script-tools" },
  { name: "Raid Helper", path: "/raid-helper" },
  { name: "Thoughts", path: "/thoughts" },
]

// --- Configuration ---
const cryptoId = 'earth-2-essence';
const vsCurrency = 'usd';
const updateInterval = 60000; // 60 seconds
const cryptoSymbol = 'E2E';
const cryptoLink = 'https://www.coingecko.com/en/coins/earth-2-essence'; // Target link

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const [cryptoPrice, setCryptoPrice] = useState<string | null>(null);
  const [cryptoChange, setCryptoChange] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Format Percentage Change (Correct color application) ---
  const formatPercentage = (change: number | null): React.ReactNode => {
    // Return empty span if data is null or undefined to maintain layout spacing
    if (change === null || change === undefined) return <span className="ml-1.5"></span>;

    const formattedChange = change.toFixed(2);
    let changeClass = 'text-neutral'; // Default class
    let prefix = '';

    if (change > 0) {
      changeClass = 'text-positive'; // Apply green class
      prefix = '+';
    } else if (change < 0) {
      changeClass = 'text-negative'; // Apply red class
      // Negative sign included in formattedChange, no prefix needed
    }
    // If change is exactly 0, it uses text-neutral

    // Combine classes - ensure color class overrides any default text color potentially inherited
    return (
      <span className={`ml-1.5 font-medium ${changeClass}`}>
        ({prefix}{formattedChange}%)
      </span>
    );
  };

  // --- Fetch Crypto Data Effect (No changes needed here) ---
  useEffect(() => {
    const fetchCryptoData = async () => {
      setError(null); // Clear previous errors
      // Ensure API URL includes the change parameter
      const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=${vsCurrency}&include_24hr_change=true`;

      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          // Try to get error message from API if possible
          let errorMsg = `API error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
              errorMsg = `API Error: ${errorData.error}`;
            }
          } catch (parseError) { /* Ignore if response isn't JSON */ }
          throw new Error(errorMsg);
        }
        const data = await response.json();

        if (data && data[cryptoId]) {
          const priceData = data[cryptoId];
          const price = priceData[vsCurrency];
          // Ensure you're accessing the correct key for change
          const change24h = priceData[`${vsCurrency}_24h_change`];

          // Update price state
          if (price !== undefined) {
             const formattedPrice = price.toLocaleString('en-US', { style: 'currency', currency: vsCurrency.toUpperCase(), minimumFractionDigits: 2, maximumFractionDigits: 6 });
             setCryptoPrice(formattedPrice);
          } else {
             setCryptoPrice('N/A'); // Price data missing
          }

          // Update change state
          if (change24h !== undefined) {
            // console.log("Fetched Change:", change24h); // DEBUG: Check fetched value
            setCryptoChange(change24h);
          } else {
            setCryptoChange(null); // Change data missing
          }

        } else {
          console.error("Unexpected API response structure:", data);
          setError('Invalid data format');
        }
      } catch (err) {
        console.error("Could not fetch crypto data:", err);
        setError(err instanceof Error ? err.message : 'Fetch failed');
        // Optionally clear price/change on error, or leave stale data
        // setCryptoPrice(null);
        // setCryptoChange(null);
      } finally {
         // Set loading to false only after the first attempt
         if (isLoading) setIsLoading(false);
      }
    };

    // Initial Fetch
    fetchCryptoData();
    // Setup Interval
    const intervalId = setInterval(fetchCryptoData, updateInterval);
    // Cleanup Interval
    return () => clearInterval(intervalId);
  }, [isLoading]); // Keep dependency array


  // --- Prepare Ticker Display Content Component ---
  const TickerContent = () => {
      // Render placeholders or error message
      if (isLoading) return <span className="text-sm text-gray-400 animate-pulse">Loading...</span>;
      if (error) return <span className="text-sm text-negative font-medium">Error</span>; // Show concise error
      if (!cryptoPrice) return <span className="text-sm text-gray-400">N/A</span>;

      // Render the actual price and change
      return (
          // Consistent text size and color for the base content
          <div className="text-sm text-gray-200 flex items-center whitespace-nowrap">
              <span className="font-medium">{cryptoSymbol}:</span>
              {/* Use your theme's accent color for the price */}
              <span className="font-semibold text-earthie-mint ml-1">{cryptoPrice}</span>
              {/* Percentage change with dynamic color */}
              {formatPercentage(cryptoChange)}
          </div>
      );
  };


  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-700 bg-[#383A4B]/90 backdrop-blur-md">
      {/* Container with relative positioning for absolute centering */}
      <div className="container mx-auto px-4 flex h-16 items-center justify-between relative">

        {/* Left side: Logo and Name */}
        {/* Use higher z-index to ensure it's clickable over the centered ticker */}
        <div className="flex items-center gap-2 z-30">
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

        {/* --- Center: Absolutely Positioned CLICKABLE Ticker --- */}
        {/* This div centers the link using transform */}
        {/* z-20 places it above background but below nav items/logo (z-30) */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
             {/* Link wrapping the entire ticker area */}
             <a
                href={cryptoLink}
                target="_blank" // Open in new tab
                rel="noopener noreferrer" // Security best practice
                className="block cursor-pointer" // Make it clear it's clickable
                aria-label={`View ${cryptoSymbol} price on CoinGecko`} // Accessibility
             >
                <div className="marquee-container">
                    <div className="marquee-content">
                       <TickerContent />
                    </div>
                </div>
             </a>
        </div>

        {/* --- Right side: Desktop Nav Items --- */}
        {/* Use higher z-index */}
        <div className="hidden md:flex items-center space-x-4 lg:space-x-6 z-30">
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


        {/* --- Right side: Mobile Menu Button --- */}
        {/* Use higher z-index */}
        <div className="flex items-center md:hidden z-30">
            <button
                className="p-2 text-gray-300 hover:text-white"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle menu"
            >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
        </div>

      </div> {/* End of container */}

      {/* --- Mobile Menu Dropdown --- */}
      {/* Needs high z-index to appear above everything */}
      {isMobileMenuOpen && (
         <div className="absolute right-0 top-full w-2/3 bg-[#303240] border-t border-l border-gray-700 md:hidden shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto rounded-bl-lg z-40">
            <div className="flex flex-col space-y-1 p-4">
              {navItems.map((item) => (
                 <Link
                    key={item.path}
                    href={item.path}
                    className={`block px-3 py-2 rounded-md text-base font-medium ${
                       pathname === item.path
                          ? 'bg-earthie-mint text-gray-900'
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