// contexts/PriceContext.tsx
"use client";

import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { parseISO, format } from 'date-fns'; // Ensure date-fns is installed

// --- Constants ---
const cryptoId = 'earth-2-essence';
const updateInterval = 120000; // 120 seconds
const localStorageKey = 'selectedFiatCurrency';
const defaultCurrency = 'usd';

// List of common fiat currency codes (lowercase) expected to be supported by CoinGecko
const commonFiatCodes = [
  'aed', 'ars', 'aud', 'bdt', 'bhd', 'bmd', 'brl', 'cad', 'chf', 'clp', 'cny',
  'czk', 'dkk', 'eur', 'gbp', 'hkd', 'huf', 'idr', 'ils', 'inr', 'jpy', 'krw',
  'kwd', 'lkr', 'mmk', 'mxn', 'myr', 'ngn', 'nok', 'nzd', 'php', 'pkr', 'pln',
  'rub', 'sar', 'sek', 'sgd', 'thb', 'try', 'twd', 'uah', 'usd', 'vef', 'vnd',
  'zar', 'xdr'
].sort();

// --- Types ---
interface PriceContextState {
  selectedCurrency: string;
  setSelectedCurrencyAndUpdate: (currency: string) => void; // Renamed for clarity
  currentPrice: number | null;
  price24hChange: number | null;
  supportedFiatCurrencies: string[];
  isLoadingCurrencies: boolean;
  isLoadingPrice: boolean;
  isInitialising: boolean; // Tracks the whole initial load process
  priceError: string | null;
}

// --- Create Context ---
const PriceContext = createContext<PriceContextState | null>(null);

// --- Create Provider Component ---
interface PriceProviderProps {
  children: ReactNode;
}

export function PriceProvider({ children }: PriceProviderProps) {
  // --- State within the Provider ---
  const [selectedCurrency, setSelectedCurrency] = useState<string>(defaultCurrency);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [price24hChange, setPrice24hChange] = useState<number | null>(null);
  const [supportedFiatCurrencies, setSupportedFiatCurrencies] = useState<string[]>([defaultCurrency]);
  const [isLoadingCurrencies, setIsLoadingCurrencies] = useState(true);
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const [isInitialising, setIsInitialising] = useState(true); // Combined initialisation state
  const [priceError, setPriceError] = useState<string | null>(null);

  // --- Effect 1: Fetch Supported Currencies & Filter ---
  useEffect(() => {
    const fetchAndFilterCurrencies = async () => {
      setIsLoadingCurrencies(true);
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/supported_vs_currencies');
        if (!response.ok) throw new Error('Failed to fetch supported currencies');
        const allSupportedVs = await response.json();
        if (Array.isArray(allSupportedVs) && allSupportedVs.length > 0) {
          const filteredFiat = allSupportedVs
            .filter((currency: string) => commonFiatCodes.includes(currency?.toLowerCase()))
            .sort();
          if (filteredFiat.length > 0) {
            setSupportedFiatCurrencies(filteredFiat.includes(defaultCurrency) ? filteredFiat : [defaultCurrency, ...filteredFiat].sort());
          } else { setSupportedFiatCurrencies([defaultCurrency]); }
        } else { setSupportedFiatCurrencies([defaultCurrency]); }
      } catch (err) {
        console.error("Error fetching/filtering supported currencies:", err);
        setSupportedFiatCurrencies([defaultCurrency]);
      } finally {
        setIsLoadingCurrencies(false);
      }
    };
    fetchAndFilterCurrencies();
  }, []);

  // --- Effect 2: Initialize Selected Currency ---
  useEffect(() => {
    if (isLoadingCurrencies) return; // Wait for list

    let currencyToSet = defaultCurrency;
    const storedCurrency = localStorage.getItem(localStorageKey);

    if (storedCurrency && supportedFiatCurrencies.includes(storedCurrency)) {
      currencyToSet = storedCurrency;
      setSelectedCurrency(currencyToSet);
      setIsInitialising(false); // Initial currency is set
      return; // Don't need GeoIP
    }

    // Fetch GeoIP if no valid stored currency
    const fetchGeoCurrency = async () => {
        try {
            const ipApiResponse = await fetch('https://ipapi.co/json/');
            if (!ipApiResponse.ok) throw new Error('ipapi.co fetch failed');
            const ipApiData = await ipApiResponse.json();
            if (ipApiData?.currency) {
                const detected = ipApiData.currency.toLowerCase();
                if (supportedFiatCurrencies.includes(detected)) {
                    currencyToSet = detected;
                }
            }
        } catch (geoError) {
            console.warn("GeoIP fetch failed:", geoError);
        } finally {
             setSelectedCurrency(currencyToSet);
             setIsInitialising(false); // Initialisation attempt complete
        }
    };
    fetchGeoCurrency();

  }, [isLoadingCurrencies, supportedFiatCurrencies]); // Rerun when list loads

  // --- Effect 3: Fetch Price Data ---
  useEffect(() => {
    if (isInitialising) return; // Don't fetch until initial currency is set

    let isMounted = true;
    const fetchCryptoData = async () => {
      setIsLoadingPrice(true);
      setPriceError(null);
      const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=${selectedCurrency}&include_24hr_change=true`;

      try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`API error ${response.status}`);
        const data = await response.json();

        if (!isMounted) return;

        if (data && data[cryptoId]) {
          const priceData = data[cryptoId];
          const price = priceData[selectedCurrency];
          const change = priceData[`${selectedCurrency}_24h_change`];

          setCurrentPrice(price !== undefined ? Number(price) : null);
          setPrice24hChange(change !== undefined ? Number(change) : null);
          if (price === undefined) {
             console.warn(`Price data missing for ${selectedCurrency}`);
             setPriceError(`Data unavailable for ${selectedCurrency.toUpperCase()}`)
          }
        } else {
          throw new Error('Invalid data format received');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error(`Price fetch error for ${selectedCurrency}:`, err);
        setPriceError(err instanceof Error ? err.message : 'Fetch failed');
        setCurrentPrice(null);
        setPrice24hChange(null);
      } finally {
        if (isMounted) setIsLoadingPrice(false);
      }
    };

    fetchCryptoData(); // Initial fetch for the selected currency
    const intervalId = setInterval(fetchCryptoData, updateInterval);

    return () => { // Cleanup
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [selectedCurrency, isInitialising]); // Refetch when currency changes or initialisation completes

  // --- Function to Update Currency and Save ---
  const setSelectedCurrencyAndUpdate = useCallback((currency: string) => {
    if (supportedFiatCurrencies.includes(currency)) {
        setSelectedCurrency(currency);
        localStorage.setItem(localStorageKey, currency);
    } else {
        console.warn(`Attempted to set unsupported currency: ${currency}`);
    }
  }, [supportedFiatCurrencies]); // Include dependency

  // --- Context Value ---
  const value: PriceContextState = {
    selectedCurrency,
    setSelectedCurrencyAndUpdate, // Provide the update function
    currentPrice,
    price24hChange,
    supportedFiatCurrencies,
    isLoadingCurrencies,
    isLoadingPrice,
    isInitialising,
    priceError,
  };

  return <PriceContext.Provider value={value}>{children}</PriceContext.Provider>;
}

// --- Custom Hook to Consume Context ---
export function usePriceContext(): PriceContextState {
  const context = useContext(PriceContext);
  if (context === null) {
    throw new Error('usePriceContext must be used within a PriceProvider');
  }
  return context;
}
