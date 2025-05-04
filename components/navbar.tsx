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
const updateInterval = 60000; // 60 seconds
const cryptoSymbol = 'E2E';
const cryptoLink = 'https://www.coingecko.com/en/coins/earth-2-essence';
const localStorageKey = 'selectedFiatCurrency';
const defaultCurrency = 'usd'; // Fallback currency

// List of common fiat currency codes (lowercase) expected to be supported by CoinGecko
const commonFiatCodes = [
  'aed', 'ars', 'aud', 'bdt', 'bhd', 'bmd', 'brl', 'cad', 'chf', 'clp', 'cny',
  'czk', 'dkk', 'eur', 'gbp', 'hkd', 'huf', 'idr', 'ils', 'inr', 'jpy', 'krw',
  'kwd', 'lkr', 'mmk', 'mxn', 'myr', 'ngn', 'nok', 'nzd', 'php', 'pkr', 'pln',
  'rub', 'sar', 'sek', 'sgd', 'thb', 'try', 'twd', 'uah', 'usd', 'vef', 'vnd',
  'zar', 'xdr'
].sort(); // Keep it sorted for consistent display order

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // --- State Variables ---
  const [selectedCurrency, setSelectedCurrency] = useState<string>(defaultCurrency);
  const [cryptoPrice, setCryptoPrice] = useState<string | null>(null);
  const [cryptoChange, setCryptoChange] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialising, setIsInitialising] = useState(true);
  // State will now hold ONLY the supported FIAT currencies
  const [supportedFiatCurrencies, setSupportedFiatCurrencies] = useState<string[]>([defaultCurrency]);
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(true);

  // --- Effect 1: Fetch Supported Currencies List & Filter for Fiat ---
  useEffect(() => {
    const fetchAndFilterCurrencies = async () => {
      setIsLoadingCurrencies(true);
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/supported_vs_currencies');
        if (!response.ok) {
            console.error(`Failed to fetch supported currencies, status: ${response.status}`);
            throw new Error('Failed to fetch supported currencies');
        }
        const allSupportedVs = await response.json();

        if (Array.isArray(allSupportedVs) && allSupportedVs.length > 0 && allSupportedVs.every(item => typeof item === 'string')) {
          // Filter the list from CoinGecko against our known fiat codes
          const filteredFiat = allSupportedVs
            .filter(currency => commonFiatCodes.includes(currency.toLowerCase()))
            .sort(); // Sort the final list

          if (filteredFiat.length > 0) {
            setSupportedFiatCurrencies(filteredFiat);
            // Ensure default is included if somehow missed (shouldn't happen if list is good)
            if (!filteredFiat.includes(defaultCurrency)) {
                setSupportedFiatCurrencies([defaultCurrency, ...filteredFiat].sort());
            }
          } else {
            console.warn("No common fiat currencies found in CoinGecko's supported list. Using default.");
            setSupportedFiatCurrencies([defaultCurrency]);
          }
        } else {
           console.warn("Received unexpected data format for supported currencies, using default.");
           setSupportedFiatCurrencies([defaultCurrency]);
        }
      } catch (err) {
        console.error("Error fetching/filtering supported currencies:", err);
        setSupportedFiatCurrencies([defaultCurrency]); // Fallback on error
      } finally {
        setIsLoadingCurrencies(false);
      }
    };
    fetchAndFilterCurrencies();
  }, []); // Fetch only once on mount

  // --- Effect 2: Initialize Selected Currency ---
  useEffect(() => {
    if (isLoadingCurrencies) {
        return; // Wait for the fiat list
    }

    let currencyToSet = defaultCurrency;
    const storedCurrency = localStorage.getItem(localStorageKey);

    // Check if stored currency is in our *filtered* fiat list
    if (storedCurrency && supportedFiatCurrencies.includes(storedCurrency)) {
      currencyToSet = storedCurrency;
      setSelectedCurrency(currencyToSet);
      setIsInitialising(false);
      return;
    }

    // Fetch Geo IP only if no valid stored *fiat* currency
    const fetchGeoCurrency = async () => {
        try {
            const ipApiResponse = await fetch('https://ipapi.co/json/');
            if (!ipApiResponse.ok) throw new Error('ipapi.co fetch failed');
            const ipApiData = await ipApiResponse.json();

            if (ipApiData && ipApiData.currency) {
                const detectedCurrency = ipApiData.currency.toLowerCase();
                // Check if detected currency is in our *filtered* fiat list
                if (supportedFiatCurrencies.includes(detectedCurrency)) {
                    currencyToSet = detectedCurrency;
                } else {
                    currencyToSet = defaultCurrency;
                }
            } else {
                 currencyToSet = defaultCurrency;
            }
        } catch (geoError) {
            console.warn("Could not fetch geolocation currency:", geoError);
            currencyToSet = defaultCurrency;
        } finally {
             setSelectedCurrency(currencyToSet);
             setIsInitialising(false);
        }
    };

    fetchGeoCurrency();

  }, [isLoadingCurrencies, supportedFiatCurrencies]); // Depend on the *filtered* list now


  // --- Handle Currency Change ---
  const handleCurrencyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newCurrency = event.target.value;
    setSelectedCurrency(newCurrency);
    localStorage.setItem(localStorageKey, newCurrency);
  };

  // --- Format Percentage Change ---
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

  // --- Effect 3: Fetch Crypto Price & Change Data ---
   useEffect(() => {
    if (isInitialising) {
        return; // Wait
    }
    let isMounted = true;
    const fetchCryptoData = async () => {
        setIsLoadingPrice(true);
        setError(null);
        const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=${selectedCurrency}&include_24hr_change=true`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                let errorMsg = `API error! status: ${response.status}`;
                try { const errorData = await response.json(); if (errorData?.error) { errorMsg = `API Error: ${errorData.error}`; } } catch (e) { /* Ignore */ }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            if (!isMounted) return;
            if (data && data[cryptoId]) {
                const priceData = data[cryptoId];
                const price = priceData[selectedCurrency];
                const change24h = priceData[`${selectedCurrency}_24h_change`];
                if (price !== undefined) {
                    const formattedPrice = price.toLocaleString(undefined, { style: 'currency', currency: selectedCurrency.toUpperCase(), minimumFractionDigits: 2, maximumFractionDigits: 6 });
                    setCryptoPrice(formattedPrice);
                } else { setCryptoPrice('N/A'); }
                if (change24h !== undefined) { setCryptoChange(change24h); } else { setCryptoChange(null); }
            } else { setError('Invalid data format'); setCryptoPrice(null); setCryptoChange(null); }
        } catch (err) {
             if (!isMounted) return;
            console.error(`Could not fetch crypto data for ${selectedCurrency}:`, err);
            setError(err instanceof Error ? err.message : 'Fetch failed');
            setCryptoPrice(null); setCryptoChange(null);
        } finally { if (isMounted) { setIsLoadingPrice(false); } }
    };
    fetchCryptoData();
    const intervalId = setInterval(fetchCryptoData, updateInterval);
    return () => { isMounted = false; clearInterval(intervalId); };
 }, [selectedCurrency, isInitialising, cryptoId]);


  // --- Ticker Display Content Component ---
  const TickerContent = () => {
      if (isInitialising || isLoadingPrice) { return <span className="text-sm text-gray-400 animate-pulse">Loading...</span>; }
      if (error) { return <span className="text-sm text-negative font-medium" title={error}>Error</span>; }
      if (!cryptoPrice) { return <span className="text-sm text-gray-400">N/A</span>; }
      return (
          <div className="text-sm text-gray-200 flex items-center whitespace-nowrap">
              <span className="font-medium">{cryptoSymbol}:</span>
              <span className="font-semibold text-earthie-mint ml-1">{cryptoPrice}</span>
              {formatPercentage(cryptoChange)}
          </div>
      );
  };


  // --- JSX Structure ---
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-700 bg-[#383A4B]/90 backdrop-blur-md">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between relative">

        {/* Left side: Logo and Name */}
        <div className="flex items-center gap-2 z-30">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative w-10 h-10 overflow-hidden rounded-full"> <Image src="/images/earthie_logo.png" alt="Earthie Logo" width={40} height={40} className="object-cover rounded-full"/> </div>
            <span className="font-bold text-xl hidden md:inline-block text-white">Earthie</span>
          </Link>
        </div>

        {/* Center: Absolutely Positioned CLICKABLE Ticker */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
             <a href={cryptoLink} target="_blank" rel="noopener noreferrer" className="block cursor-pointer" aria-label={`View ${cryptoSymbol} price on CoinGecko`}>
                <div className="marquee-container"> <div className="marquee-content"> <TickerContent /> </div> </div>
             </a>
        </div>

        {/* Right side: Contains Desktop Nav, Currency Selector, Mobile Menu Button */}
        <div className="flex items-center gap-4 z-30">
             {/* Desktop Navigation Items */}
            <div className="hidden md:flex items-center space-x-4 lg:space-x-6">
              {navItems.map((item) => ( <Link key={item.path} href={item.path} className={`text-sm font-medium transition-colors hover:text-earthie-mint ${ pathname === item.path ? "text-earthie-mint border-b-2 border-earthie-mint" : "text-gray-300" }`}> {item.name} </Link> ))}
            </div>

            {/* Currency Selector (Desktop) */}
            {!isInitialising && !isLoadingCurrencies && (
                <div className="hidden md:block">
                    {/* REMOVED appearance-none, added padding-right */}
                    <select
                        id="currency-select-desktop"
                        value={selectedCurrency}
                        onChange={handleCurrencyChange}
                        className="bg-gray-700 border border-gray-600 text-white text-xs rounded p-1 pr-5 focus:ring-earthie-mint focus:border-earthie-mint cursor-pointer"
                        aria-label="Select Fiat Currency"
                        title="Select Fiat Currency"
                    >
                        {/* Map over the FILTERED supportedFiatCurrencies state */}
                        {supportedFiatCurrencies.map(currency => (
                            <option key={currency} value={currency}>
                                {currency.toUpperCase()}
                            </option>
                        ))}
                    </select>
                </div>
            )}
             {/* Optional: Loading indicator (condition remains the same) */}
             {(isLoadingCurrencies || (isInitialising && supportedFiatCurrencies.length <= 1)) && (
                 <div className="hidden md:block text-xs text-gray-400 animate-pulse">...</div>
             )}

            {/* Mobile Menu Button */}
            <div className="flex items-center md:hidden">
                <button className="p-2 text-gray-300 hover:text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle menu" aria-expanded={isMobileMenuOpen} > {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />} </button>
            </div>
        </div>

      </div> {/* End of container */}

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
         <div className="absolute right-0 top-full w-2/3 bg-[#303240] border-t border-l border-gray-700 md:hidden shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto rounded-bl-lg z-40">
            <div className="flex flex-col space-y-1 p-4">
              {/* Mobile Navigation Items */}
              {navItems.map((item) => ( <Link key={item.path} href={item.path} onClick={() => setIsMobileMenuOpen(false)} className={`block px-3 py-2 rounded-md text-base font-medium ${ pathname === item.path ? 'bg-earthie-mint text-gray-900' : 'text-gray-300 hover:bg-gray-700 hover:text-white' }`}> {item.name} </Link> ))}
              {/* Divider */}
              <hr className="border-gray-600 my-2" />
              {/* Currency Selector (Mobile) */}
              {!isInitialising && !isLoadingCurrencies && (
                  <div className="px-3 py-2">
                      <label htmlFor="currency-select-mobile" className="block text-sm font-medium text-gray-400 mb-1">Currency:</label>
                       {/* REMOVED appearance-none, added padding-right */}
                      <select
                          id="currency-select-mobile"
                          value={selectedCurrency}
                          onChange={(e) => {handleCurrencyChange(e); setIsMobileMenuOpen(false);}}
                          className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded p-1.5 pr-6 focus:ring-earthie-mint focus:border-earthie-mint cursor-pointer"
                          aria-label="Select Fiat Currency"
                      >
                         {/* Map over the FILTERED supportedFiatCurrencies state */}
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
                   <div className="px-3 py-2 text-sm text-gray-400 animate-pulse">Loading currencies...</div>
               )}
            </div>
         </div>
      )}
    </nav>
  )
}