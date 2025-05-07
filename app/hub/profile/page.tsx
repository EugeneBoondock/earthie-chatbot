'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePriceContext } from '@/contexts/PriceContext';
// Assuming these are imported from your UI library, e.g., @/components/ui/card
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; 
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, MapPin, Maximize, Building, Zap, Tag, Landmark, CheckCircle, XCircle, Gem, ShieldCheck, User, Globe, ArrowUpRight } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart, CartesianGrid, XAxis, YAxis, Bar } from 'recharts';

// --- Interfaces for Earth2 API responses ---
interface E2UserInfo {
  id: string;
  picture?: string;
  customPhoto?: string;
  username: string;
  description?: string;
  customFlag?: string;
  countryCode?: string;
  userNetworth?: {
    networth: number;
    totalTiles: number;
    spent: number;
  };
  userLandfieldCount?: number;
  is_t1_owner?: boolean;
}

interface E2PropertyAttribute {
  description: string;
  location: string;
  country?: string;
  tileCount: number;
  tileClass?: number | string | null;
  price: number;
  purchaseValue?: number;
  currentValue: number;
  tradingValue?: number;
  landfieldTier: number;
  epl?: string | null;
  forSale: boolean;
  thumbnail?: string;
  claimedEssenceBalance?: string;
  hasMentar?: boolean;
  hasHolobuilding?: boolean;
  hasHoloBuilding?: boolean;
  activeResourceClaimsCount?: number;
  lastEdited?: string;
  isFeatured?: boolean;
  landfieldTierUpgraded?: boolean;
  purchasedForEssence?: boolean;
  promisedEssenceBalance?: string;
  purchasedAt?: string;
}

interface E2Property {
  id: string;
  type: string;
  attributes: E2PropertyAttribute;
}

interface E2PropertiesResponse {
  data: E2Property[];
  meta?: {
    count: number;
    // ... other meta fields
  };
  links?: {
    next?: string;
    // ... other links
  };
}

// --- Helper function to extract E2 User ID ---
const extractE2UserId = (input: string): string | null => {
  if (!input) return null;
  const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
  const match = input.match(uuidRegex);
  return match ? match[0] : null;
};

export default function ProfilePage() {
  const [e2ProfileInput, setE2ProfileInput] = useState(''); // Input field value
  const [linkedE2UserId, setLinkedE2UserId] = useState<string | null>(null); // Persisted E2 User ID
  
  const [userInfo, setUserInfo] = useState<E2UserInfo | null>(null);
  const [properties, setProperties] = useState<E2Property[]>([]);
  const [allPropertiesForAnalytics, setAllPropertiesForAnalytics] = useState<E2Property[]>([]);
  const [propertiesMeta, setPropertiesMeta] = useState<E2PropertiesResponse['meta'] | null>(null);
  const [propertiesCurrentPage, setPropertiesCurrentPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Access Price Context for selected currency ---
  const { selectedCurrency } = usePriceContext();

  // --- State for Exchange Rate ---
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isRateLoading, setIsRateLoading] = useState<boolean>(false);

  // --- Fetch Exchange Rate ---
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_OPEN_EXCHANGE_RATES_APP_ID; // Use new App ID

    const fetchRate = async () => {
      if (!selectedCurrency) return;
      // Check for the new App ID
      if (!appId) {
        console.error("[ProfilePage] Open Exchange Rates App ID missing in .env.local (NEXT_PUBLIC_OPEN_EXCHANGE_RATES_APP_ID)");
        setError(prev => prev ? `${prev}\nOpen Exchange Rates App ID missing` : 'Open Exchange Rates App ID missing');
        setExchangeRate(null);
        setIsRateLoading(false);
        return;
      }

      if (selectedCurrency.toUpperCase() === 'USD') {
        setExchangeRate(1); // USD to USD is always 1
        setIsRateLoading(false);
        return;
      }

      setIsRateLoading(true);
      setExchangeRate(null); 
      try {
        // Using Open Exchange Rates /latest.json endpoint
        const apiUrl = `https://openexchangerates.org/api/latest.json?app_id=${appId}`;
        console.log(`[ProfilePage] Fetching latest rates from Open Exchange Rates`);
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            const errorBody = await response.text(); // OER often returns plain text or specific JSON errors
            let errorMessage = `Failed to fetch OER data (${response.status})`;
            try {
                const errorJson = JSON.parse(errorBody);
                // Use error structure from OER docs if known (e.g., error.description)
                errorMessage = errorJson?.description || errorJson?.message || errorMessage;
            } catch (e) { /* Ignore parsing error if body wasn't JSON */ }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        
        // OER response structure: { base: "USD", rates: { "EUR": 0.9..., "GBP": 0.8... } }
        if (data && data.rates) {
          // Ensure the base is USD (as expected by our logic)
          if (data.base !== 'USD') {
              console.warn(`[ProfilePage] OER base currency is ${data.base}, not USD. Conversion might be incorrect if logic assumes USD base.`);
              // Potentially add logic here to handle non-USD base if necessary
          }
          
          const rate = data.rates[selectedCurrency.toUpperCase()];
          if (typeof rate === 'number') {
             setExchangeRate(rate); // This is the rate: 1 USD = X SelectedCurrency
             console.log(`[ProfilePage] Fetched OER rate USD to ${selectedCurrency}: ${rate}`);
          } else {
            throw new Error(`Rate for ${selectedCurrency.toUpperCase()} not found in OER response`);
          }
        } else {
           const errorInfo = data?.description || 'Invalid data received from OER';
           throw new Error(errorInfo);
        }
      } catch (err: any) {
        console.error("[ProfilePage] Error fetching OER exchange rate:", err);
        setError(prev => prev ? `${prev}\nOER Rate Fetch Error: ${err.message}` : `OER Rate Fetch Error: ${err.message}`);
        setExchangeRate(null); 
      } finally {
        setIsRateLoading(false);
      }
    };

    fetchRate();
  }, [selectedCurrency]);

  // --- Calculate Conversion Rate (No longer needed) ---
  // const conversionRate = useMemo(() => { ... }, [currentPrice, usdPrice]);

  // --- Updated formatCurrency helper ---
  const formatCurrency = (value: number | string | undefined | null, options?: Intl.NumberFormatOptions) => {
    // Ensure value is a number
    let numericValue: number;
    if (value === undefined || value === null) return 'N/A';
    if (typeof value === 'string') {
      numericValue = parseFloat(value);
    } else {
      numericValue = value;
    }
    if (isNaN(numericValue)) return 'Invalid Value'; 

    // Use fetched exchange rate for conversion
    const rate = exchangeRate; // Use state directly
    const isLoading = isRateLoading;
    const currencyCode = selectedCurrency.toUpperCase();

    if (isLoading && currencyCode !== 'USD') {
        return <Loader2 className="h-4 w-4 animate-spin inline-block" />; // Show loader while rate is fetching
    }

    const displayValue = rate !== null ? numericValue * rate : numericValue;
    const displayCurrencyCode = rate !== null ? currencyCode : 'USD'; // Fallback to USD if rate is null

    return displayValue.toLocaleString(undefined, {
        style: 'currency',
        currency: displayCurrencyCode,
        minimumFractionDigits: options?.minimumFractionDigits ?? 2,
        maximumFractionDigits: options?.maximumFractionDigits ?? 2,
        ...options
    });
  };

  // Fetch linked E2 User ID on mount
  useEffect(() => {
    const fetchLinkedId = async () => {
      setLinkingLoading(true);
      try {
        const response = await fetch('/api/me/e2profile');
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch linked E2 ID');
        }
        const data = await response.json();
        if (data.e2_user_id) {
          setLinkedE2UserId(data.e2_user_id);
          setE2ProfileInput(data.e2_user_id); // Pre-fill input
          // Optionally, trigger data fetch if ID is already linked
          // fetchE2Data(data.e2_user_id); 
        }
      } catch (err: any) {
        console.error('Error fetching linked E2 ID:', err);
        // Not setting a user-facing error here, as it might be normal not to have one linked
      } finally {
        setLinkingLoading(false);
      }
    };
    fetchLinkedId();
  }, []);

  // Fetch E2 data when linkedE2UserId changes and is valid
  useEffect(() => {
    if (linkedE2UserId) {
      setProperties([]);
      setAllPropertiesForAnalytics([]);
      setPropertiesCurrentPage(1);
      setUserInfo(null);
      setError(null);

      fetchE2Data(linkedE2UserId, 1);
      fetchAllPropertiesForAnalytics(linkedE2UserId);
    }
  }, [linkedE2UserId]); // Re-run if linkedE2UserId changes

  const fetchE2Data = async (userId: string, page: number = 1) => {
    if (!userId) return;
    // If fetching page 1, set loading state for the whole data section
    if (page === 1 && !userInfo) {
        setDataLoading(true);
        setError(null);
        // setUserInfo(null); // Moved to useEffect for linkedE2UserId
        // setProperties([]); // Moved to useEffect for linkedE2UserId
    }

    try {
      // Fetch User Info (only on initial load/user change, if not already loaded)
      if (page === 1 && !userInfo) {
          const userInfoRes = await fetch(`https://app.earth2.io/api/v2/user_info/${userId}`);
          if (!userInfoRes.ok) throw new Error(`Failed to fetch E2 user info (status: ${userInfoRes.status})`);
          const userInfoData: E2UserInfo = await userInfoRes.json();
          setUserInfo(userInfoData);
      }

      // Fetch Properties via internal API route for paginated display
      const propertiesUrl = new URL('/api/e2/properties', window.location.origin);
      propertiesUrl.searchParams.set('page', String(page)); 
      propertiesUrl.searchParams.set('perPage', '12'); 
      propertiesUrl.searchParams.set('userId', userId);
      
      console.log(`[Profile Page Display] Fetching properties (page ${page}, perPage 12) via: ${propertiesUrl.toString()}`);
      const propertiesRes = await fetch(propertiesUrl.toString());
      
      if (!propertiesRes.ok) {
         const errorData = await propertiesRes.json();
         throw new Error(errorData.error || `Failed to fetch E2 properties for display (status: ${propertiesRes.status})`);
      }
      const propertiesData: E2PropertiesResponse = await propertiesRes.json();
      
      // Replace the properties list when fetching a specific page via user action
      setProperties(propertiesData.data || []); 
      setPropertiesMeta(propertiesData.meta || null); 
      setPropertiesCurrentPage(page);

    } catch (err: any) {
      console.error('Error fetching E2 data for display:', err);
      setError(err.message || 'Failed to fetch data for display from Earth2 APIs via internal proxy.');
    } finally {
       if (page === 1) {
           setDataLoading(false); // Turn off main loading for display section
       }
    }
  };

  const fetchAllPropertiesForAnalytics = async (userId: string) => {
    if (!userId) return;
    setIsAnalyticsLoading(true);
    setAllPropertiesForAnalytics([]); 
    let currentPage = 1; // Keep track for logging/debugging
    let fetchedAll = false;
    const accumulatedProps: E2Property[] = [];
    let totalCountFromMeta: number | undefined = undefined;
    let nextUrlFromProxy: string | undefined = undefined; // Use this to determine if there's more

    console.log(`[Analytics] Starting fetch for all properties of user ${userId}`);

    do {
      try {
        const proxyUrl = new URL('/api/e2/properties', window.location.origin);
        proxyUrl.searchParams.set('page', String(currentPage));
        proxyUrl.searchParams.set('perPage', '60'); // Fetch smaller chunks (like observed URL) via proxy
        proxyUrl.searchParams.set('userId', userId);

        console.log(`[Analytics] Fetching page ${currentPage} via proxy (perPage 60): ${proxyUrl.toString()}`);
        const proxyRes = await fetch(proxyUrl.toString());

        if (!proxyRes.ok) {
          const errorData = await proxyRes.json();
          throw new Error(errorData.error || `Proxy API failed for analytics (page ${currentPage}, status: ${proxyRes.status})`);
        }
        
        // Expecting the proxy to return the exact structure from E2 API
        const proxyData: E2PropertiesResponse = await proxyRes.json(); 
        
        console.log(`[Analytics] Page ${currentPage} Response:`, { 
            dataLength: proxyData.data?.length ?? 0,
            meta: proxyData.meta,
            links: proxyData.links 
        });

        if (proxyData.data && proxyData.data.length > 0) {
          accumulatedProps.push(...proxyData.data);
        }

        if (proxyData.meta?.count !== undefined && totalCountFromMeta === undefined) {
            totalCountFromMeta = proxyData.meta.count;
        }
        
        // *** Use links.next from the PROXY response to decide if more pages exist ***
        nextUrlFromProxy = proxyData.links?.next; 

        if (!nextUrlFromProxy) { 
            fetchedAll = true;
            console.log(`[Analytics] Loop Decision: Stop - No next link found.`);
        } else if (totalCountFromMeta !== undefined && accumulatedProps.length >= totalCountFromMeta) { 
            fetchedAll = true;
            console.log(`[Analytics] Loop Decision: Stop - Reached or exceeded total count (${accumulatedProps.length}/${totalCountFromMeta}).`);
        } else if (proxyData.data && proxyData.data.length === 0) {
            fetchedAll = true;
             console.log(`[Analytics] Loop Decision: Stop - Fetched page returned 0 properties.`);
        } else {
            currentPage++; 
            console.log(`[Analytics] Loop Decision: Continue - Found next link, incrementing page to ${currentPage}.`);
        }

      } catch (err: any) {
        console.error('Error fetching/processing E2 properties page for analytics:', err);
        // Append errors, but only add unique messages
        setError(prevError => {
          const newErrorMessage = `Error fetching analytics page ${currentPage}: ${err.message}`;
          return prevError ? (prevError.includes(newErrorMessage) ? prevError : `${prevError}\n${newErrorMessage}`) : newErrorMessage;
        });
        fetchedAll = true; // Stop fetching on error for this attempt
      }
    } while (!fetchedAll);

    setAllPropertiesForAnalytics(accumulatedProps);
    setIsAnalyticsLoading(false);
    console.log(`[Analytics] Finished fetching. Total ${accumulatedProps.length} properties gathered for analytics.`);
    // Optionally compare accumulatedProps.length with totalCountFromMeta here if needed for logging
    if(totalCountFromMeta !== undefined && accumulatedProps.length !== totalCountFromMeta){
        console.warn(`[Analytics] Mismatch: Meta count was ${totalCountFromMeta}, but fetched ${accumulatedProps.length}`);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const extractedId = extractE2UserId(e2ProfileInput);

    if (!extractedId) {
      setError('Invalid Earth2 Profile Link or User ID format. Please ensure it contains a valid UUID.');
      return;
    }

    setLinkingLoading(true);
    try {
      const response = await fetch('/api/me/e2profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ e2_user_id: extractedId }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to link E2 profile via API');
      }
      setLinkedE2UserId(extractedId); // Update state to trigger data fetch via useEffect
      // Data fetching will now be handled by the useEffect listening to linkedE2UserId
    } catch (err: any) {
      console.error('Error linking E2 profile:', err);
      setError(err.message);
    } finally {
      setLinkingLoading(false);
    }
  };
  
  const isLoading = linkingLoading || dataLoading;

  // --- States for analytics data (derived from allPropertiesForAnalytics) ---
  const [tileClassCounts, setTileClassCounts] = useState<Record<string, number>>({});
  const [countryCounts, setCountryCounts] = useState<Record<string, number>>({});
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({});
  const [featureCounts, setFeatureCounts] = useState<{ mentars: number; holobuildings: number; featured: number; activeClaims: number; tierUpgraded: number; purchasedForEssence: number; forSale: number; notForSale: number; withEPL: number; withoutEPL: number; }>({ mentars: 0, holobuildings: 0, featured: 0, activeClaims: 0, tierUpgraded: 0, purchasedForEssence: 0, forSale: 0, notForSale: 0, withEPL: 0, withoutEPL: 0 });
  const [valueSummary, setValueSummary] = useState<{ totalCurrentValue: number; totalPurchaseValue: number; countWithValue: number; totalTiles: number; totalClaimedEssence: number; totalPromisedEssence: number; }>({ totalCurrentValue: 0, totalPurchaseValue: 0, countWithValue: 0, totalTiles: 0, totalClaimedEssence: 0, totalPromisedEssence: 0 });
  const [acquisitionTimelineData, setAcquisitionTimelineData] = useState<{name: string, count: number}[]>([]);
  const [tileCountDistributionData, setTileCountDistributionData] = useState<{name: string, count: number}[]>([]);

  // --- useEffect to calculate counts when ALL properties for analytics change ---
  useEffect(() => {
    if (allPropertiesForAnalytics && allPropertiesForAnalytics.length > 0 && !isAnalyticsLoading) {
      const newTileClassCounts: Record<string, number> = {};
      const newCountryCounts: Record<string, number> = {};
      const newTierCounts: Record<string, number> = {};
      
      let mentarC = 0, holobuildingC = 0, featuredC = 0, activeClaimsC = 0, tierUpgradedC = 0, purchasedForEssenceC = 0, forSaleC = 0, notForSaleC = 0, withEPLC = 0, withoutEPLC = 0;
      let currentValSum = 0, purchaseValSum = 0, propsWithValueCount = 0, tilesSum = 0, claimedEssenceSum = 0, promisedEssenceSum = 0;
      
      const acquisitionsByYear: Record<string, number> = {};
      const TILE_COUNT_BINS = { "1-10": 0, "11-50": 0, "51-100": 0, "101-250": 0, "251-500": 0, "501-750": 0, "751+": 0, "Unknown": 0};

      allPropertiesForAnalytics.forEach(prop => {
        const attrs = prop.attributes;

        // Tile Class
        const tileClass = attrs.tileClass;
        let className = 'Unknown Class';
        if (typeof tileClass === 'number' || (typeof tileClass === 'string' && String(tileClass).trim() !== '')) {
            className = `Class ${tileClass}`;
        } else if (tileClass === null || tileClass === undefined || String(tileClass).trim() === '') {
            className = 'Unclassified';
        }
        newTileClassCounts[className] = (newTileClassCounts[className] || 0) + 1;

        // Country
        const country = attrs.country?.toUpperCase() || 'Unknown';
        newCountryCounts[country] = (newCountryCounts[country] || 0) + 1;

        // Landfield Tier
        const tier = attrs.landfieldTier ? `Tier ${attrs.landfieldTier}` : 'Unknown Tier';
        newTierCounts[tier] = (newTierCounts[tier] || 0) + 1;
        
        // Features
        if (attrs.hasMentar) mentarC++;
        if (attrs.hasHolobuilding || attrs.hasHoloBuilding) holobuildingC++; // Combined both
        if (attrs.isFeatured) featuredC++;
        if (attrs.activeResourceClaimsCount && attrs.activeResourceClaimsCount > 0) activeClaimsC++;
        if (attrs.landfieldTierUpgraded) tierUpgradedC++;
        if (attrs.purchasedForEssence) purchasedForEssenceC++;
        if (attrs.forSale) forSaleC++; else notForSaleC++;
        if (attrs.epl && attrs.epl.trim() !== '') withEPLC++; else withoutEPLC++;

        // Value Summary
        const currentV = parseFloat(String(attrs.currentValue));
        const purchaseV = attrs.purchaseValue !== undefined && attrs.purchaseValue !== null ? parseFloat(String(attrs.purchaseValue)) : null;

        if (!isNaN(currentV)) {
            currentValSum += currentV;
            if (purchaseV !== null && !isNaN(purchaseV)) {
                purchaseValSum += purchaseV;
                propsWithValueCount++;
            }
        }
        if (attrs.tileCount) tilesSum += attrs.tileCount;
        if (attrs.claimedEssenceBalance) claimedEssenceSum += parseFloat(String(attrs.claimedEssenceBalance)) || 0;
        if (attrs.promisedEssenceBalance) promisedEssenceSum += parseFloat(String(attrs.promisedEssenceBalance)) || 0;
        
        // Acquisition Timeline
        if (attrs.purchasedAt) {
            try {
                const year = new Date(attrs.purchasedAt).getFullYear();
                if (!isNaN(year)) {
                    acquisitionsByYear[String(year)] = (acquisitionsByYear[String(year)] || 0) + 1;
                }
            } catch (e) { /* ignore invalid dates */ }
        }

        // Tile Count Distribution
        const tc = attrs.tileCount;
        if (tc === null || tc === undefined) TILE_COUNT_BINS["Unknown"]++;
        else if (tc <= 10) TILE_COUNT_BINS["1-10"]++;
        else if (tc <= 50) TILE_COUNT_BINS["11-50"]++;
        else if (tc <= 100) TILE_COUNT_BINS["51-100"]++;
        else if (tc <= 250) TILE_COUNT_BINS["101-250"]++;
        else if (tc <= 500) TILE_COUNT_BINS["251-500"]++;
        else if (tc <= 750) TILE_COUNT_BINS["501-750"]++;
        else TILE_COUNT_BINS["751+"]++;

      });

      setTileClassCounts(newTileClassCounts);
      setCountryCounts(newCountryCounts);
      setTierCounts(newTierCounts);
      setFeatureCounts({ mentars: mentarC, holobuildings: holobuildingC, featured: featuredC, activeClaims: activeClaimsC, tierUpgraded: tierUpgradedC, purchasedForEssence: purchasedForEssenceC, forSale: forSaleC, notForSale: notForSaleC, withEPL: withEPLC, withoutEPL: withoutEPLC });
      setValueSummary({ totalCurrentValue: currentValSum, totalPurchaseValue: purchaseValSum, countWithValue: propsWithValueCount, totalTiles: tilesSum, totalClaimedEssence: claimedEssenceSum, totalPromisedEssence: promisedEssenceSum });
      
      setAcquisitionTimelineData(Object.entries(acquisitionsByYear).map(([year, count]) => ({name: year, count})).sort((a,b) => a.name.localeCompare(b.name)));
      setTileCountDistributionData(Object.entries(TILE_COUNT_BINS).map(([range, count]) => ({name: range, count})));

    } else if (!isAnalyticsLoading) { // Reset if no data or not loading
      setTileClassCounts({});
      setCountryCounts({});
      setTierCounts({});
      setFeatureCounts({ mentars: 0, holobuildings: 0, featured: 0, activeClaims: 0, tierUpgraded: 0, purchasedForEssence: 0, forSale: 0, notForSale: 0, withEPL: 0, withoutEPL: 0 });
      setValueSummary({ totalCurrentValue: 0, totalPurchaseValue: 0, countWithValue: 0, totalTiles: 0, totalClaimedEssence: 0, totalPromisedEssence: 0 });
      setAcquisitionTimelineData([]);
      setTileCountDistributionData([]);
    }
  }, [allPropertiesForAnalytics, isAnalyticsLoading]);

  // --- Prepare data for Recharts Pie Chart (Tile Class) ---
  const tileClassPieData = useMemo(() => {
    return Object.entries(tileClassCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Sort by count descending for chart
  }, [tileClassCounts]);

  // --- Define colors for pie chart slices ---
  // Define more colors if you expect more than ~10 classes often
  const COLORS = [
      '#34D399', // emerald-400
      '#60A5FA', // blue-400
      '#FBBF24', // amber-400
      '#F87171', // red-400
      '#A78BFA', // violet-400
      '#2DD4BF', // teal-400
      '#FB923C', // orange-400
      '#EC4899', // pink-400
      '#8B5CF6', // purple-500  // Note: Added more colors
      '#14B8A6', // teal-500
      '#F59E0B', // amber-500
      '#EF4444', // red-500
  ];

  const BAR_CHART_COLORS = [
    '#38BDF8', // sky-400
    '#A3E635', // lime-400
    '#FACC15', // yellow-400
    '#FB923C', // orange-400
    '#EC4899', // pink-400
    '#8B5CF6', // violet-500
  ];

  const countryChartData = useMemo(() => {
    return Object.entries(countryCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); 
  }, [countryCounts]);

  const tierChartData = useMemo(() => {
    return Object.entries(tierCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => { // Custom sort for Tiers (Tier 1, Tier 2, etc., then Unknown)
        const tierA = parseInt(a.name.replace('Tier ', ''));
        const tierB = parseInt(b.name.replace('Tier ', ''));
        if (!isNaN(tierA) && !isNaN(tierB)) return tierA - tierB;
        if (!isNaN(tierA)) return -1;
        if (!isNaN(tierB)) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [tierCounts]);

  const forSaleChartData = useMemo(() => {
    if (featureCounts.forSale === 0 && featureCounts.notForSale === 0) return [];
    return [
        { name: 'For Sale', value: featureCounts.forSale },
        { name: 'Not For Sale', value: featureCounts.notForSale }
    ];
  }, [featureCounts]);
  
  const eplChartData = useMemo(() => {
    if (featureCounts.withEPL === 0 && featureCounts.withoutEPL === 0) return [];
    return [
        { name: 'With EPL', value: featureCounts.withEPL },
        { name: 'No EPL', value: featureCounts.withoutEPL }
    ];
  }, [featureCounts]);

  return (
    <div className="space-y-8">
      {/* Header Section with Glassmorphic Effect */}
      <div className="relative overflow-hidden rounded-2xl p-8 backdrop-blur-lg bg-gradient-to-br from-sky-900/40 to-blue-900/30 border border-sky-400/30 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-blue-500/5 z-0"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-earthie-mint/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-sky-400/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-300 to-blue-300 inline-block text-transparent bg-clip-text mb-4">
            Your Earth2 Profile
          </h1>
          <p className="text-lg text-cyan-200/90 max-w-3xl">
            Connect your Earth2 profile to view your properties, stats, and track your portfolio in one place.
          </p>
        </div>
      </div>

      {/* Profile Linking Card with Glassmorphic Effect */}
      <div className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-sky-500/30 rounded-xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-sky-500/20 flex items-center">
          <User className="h-5 w-5 text-sky-400 mr-3" />
          <div>
            <h2 className="text-xl font-semibold text-white">Link Your Earth2 Profile</h2>
            <p className="text-sm text-gray-300">Paste your Earth2 profile link or just your User ID to fetch and display your public data.</p>
          </div>
        </div>
        <div className="p-6">
          <form onSubmit={handleLinkSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Globe className="h-5 w-5 text-sky-500/50" />
              </div>
              <Input
                type="text"
                placeholder="e.g., https://app.earth2.io/#profile/YOUR_USER_ID"
                value={e2ProfileInput}
                onChange={(e) => setE2ProfileInput(e.target.value)}
                className="flex-grow pl-10 bg-earthie-dark-light/50 border-sky-500/30 backdrop-blur-sm focus:border-sky-400/70 focus:ring-1 focus:ring-sky-400/70 transition-all"
                disabled={linkingLoading}
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading || !e2ProfileInput || e2ProfileInput === linkedE2UserId}
              className="bg-sky-600/80 hover:bg-sky-500/90 border border-sky-400/30 transition-all duration-300"
            >
              {linkingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {linkedE2UserId === extractE2UserId(e2ProfileInput) && !dataLoading ? 'Re-fetch Data' : 'Link & Fetch Data'}
              {!linkingLoading && <ArrowUpRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
          {error && !dataLoading && (
            <div className="mt-4 bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex items-center text-sm text-red-300">
              <AlertCircle className="h-5 w-5 mr-2 text-red-400" />
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>

      {dataLoading && !userInfo && (
        <div className="flex flex-col items-center justify-center py-12 text-sky-300">
          <Loader2 className="h-12 w-12 animate-spin text-sky-400 mb-4" />
          <p className="text-xl">Fetching Your Earth2 Data...</p>
          <p className="text-sm text-sky-400/70">This might take a moment.</p>
        </div>
      )}

      {userInfo && (
        <Card className="shadow-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/70 border-sky-400/40 overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-6 bg-gray-900/50">
            {(userInfo.picture || userInfo.customPhoto) && (
              <img 
                src={userInfo.customPhoto || userInfo.picture} 
                alt={userInfo.username} 
                className="w-24 h-24 rounded-full border-4 border-sky-500 object-cover shadow-lg flex-shrink-0"
              />
            )}
            <div className="flex-grow">
              <CardTitle className="text-3xl font-bold text-sky-200 tracking-tight">{userInfo.username}</CardTitle>
              {userInfo.description && <CardDescription className="text-cyan-200/80 mt-1 text-sm max-w-prose">{userInfo.description}</CardDescription>}
            </div>
            {userInfo.customFlag && (
                <img src={userInfo.customFlag} alt="User Flag" className="w-10 h-auto object-contain rounded-sm shadow-md self-start sm:self-center"/>
            )}
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
            {[ 
              { label: 'Networth', value: userInfo.userNetworth?.networth, isCurrency: true },
              { label: 'Total Properties', value: propertiesMeta?.count ?? (allPropertiesForAnalytics.length > 0 ? allPropertiesForAnalytics.length : userInfo.userLandfieldCount), isCurrency: false },
              { label: 'Total Tiles', value: valueSummary.totalTiles > 0 ? valueSummary.totalTiles : userInfo.userNetworth?.totalTiles, isCurrency: false },
              { label: 'Country', value: userInfo.countryCode?.toUpperCase(), isCurrency: false },
            ].map(stat => stat.value !== undefined && stat.value !== null && (
              <div key={stat.label} className="flex items-center">
                <Landmark className="w-4 h-4 mr-1.5 text-sky-400"/>
                <div>
                    <p className="text-xs text-sky-400/70 uppercase tracking-wider">{stat.label}</p>
                    <p className="text-lg font-semibold text-sky-100">
                       {stat.isCurrency 
                          ? formatCurrency(stat.value)
                          : (typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value)}
                    </p>
                </div>
              </div>
            ))}
            {userInfo.is_t1_owner && (
              <div className="flex items-center col-span-full sm:col-span-1 mt-2 sm:mt-0">
                <ShieldCheck className="w-5 h-5 mr-2 text-emerald-400"/> 
                <span className="text-sm bg-emerald-600/40 text-emerald-200 px-3 py-1 rounded-full border border-emerald-500/70 font-medium">Tier 1 Owner</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Paginated Property Cards Section */}
      {properties.length > 0 && (
        <div className="space-y-6 mt-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-sky-200">Your Earth2 Properties ({propertiesMeta?.count ? properties.length.toLocaleString() : '...'} of {propertiesMeta?.count ? propertiesMeta.count.toLocaleString() : 'Many'})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {properties.map((prop) => {
                const attr = prop.attributes;
                return (
                  <Card key={prop.id} className="bg-gray-800/60 border-sky-600/40 hover:border-sky-500/70 transition-all duration-300 ease-in-out shadow-lg hover:shadow-sky-500/20 flex flex-col">
                    {attr.thumbnail && (
                      <img src={attr.thumbnail} alt={attr.description || 'Property'} className="w-full h-48 object-cover rounded-t-lg" />
                    )}
                    <CardHeader className="pb-3 pt-4 px-5 flex-shrink-0">
                      <CardTitle className="text-lg leading-tight text-sky-200 hover:text-sky-100 transition-colors truncate" title={attr.description}>{attr.description || 'Unnamed Property'}</CardTitle>
                      <CardDescription className="text-xs text-cyan-300/70 truncate flex items-center mt-1">
                        <MapPin className="w-3 h-3 mr-1.5 text-sky-400/80 flex-shrink-0" /> {attr.location || 'Unknown Location'}{attr.country && `, ${attr.country}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm px-5 pb-4 space-y-2 text-cyan-100/90 flex-grow">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                            {[ 
                                { label: 'Value', value: attr.currentValue, isCurrency: true },
                                { label: 'Tiles', value: attr.tileCount, isCurrency: false },
                                { label: 'Tier', value: attr.landfieldTier, isCurrency: false },
                                { label: 'Class', value: attr.tileClass !== null && attr.tileClass !== undefined ? `Class ${attr.tileClass}` : 'N/A', isCurrency: false },
                                { label: 'Price', value: attr.forSale ? attr.price : undefined, isCurrency: true },
                                { label: 'Purchase Value', value: attr.purchaseValue, isCurrency: true, options: { minimumFractionDigits: 2, maximumFractionDigits: 2 } },
                                { label: 'Trading Value', value: attr.tradingValue, isCurrency: true, options: { minimumFractionDigits: 3, maximumFractionDigits: 3 } },
                                { label: 'Essence', value: attr.claimedEssenceBalance ? parseFloat(String(attr.claimedEssenceBalance)).toLocaleString(undefined, {maximumFractionDigits:2}) : '0', isCurrency: false },
                            ].map(item => item.value !== undefined && item.value !== null && (
                                <div key={item.label} className="flex items-center space-x-1.5">
                                    <Landmark size={14} className="text-sky-400/90"/>
                                    <span className="text-sky-400/80">{item.label}:</span> 
                                    <span className="font-medium text-sky-200">
                                        {item.isCurrency ? formatCurrency(item.value, item.options) : item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 text-xs border-t border-sky-700/30 mt-2">
                            {attr.forSale && <span className="bg-green-600/30 text-green-200 px-2 py-0.5 rounded-full border border-green-500/50 flex items-center"><CheckCircle size={12} className="mr-1"/> For Sale</span>}
                            {attr.hasMentar && <span className="bg-purple-600/30 text-purple-200 px-2 py-0.5 rounded-full border border-purple-500/50 flex items-center"><Zap size={12} className="mr-1"/> Mentar</span>}
                            {attr.hasHolobuilding && <span className="bg-indigo-600/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-500/50 flex items-center"><Building size={12} className="mr-1"/> Holo</span>}
                            {attr.epl && <span className="bg-yellow-600/30 text-yellow-200 px-2 py-0.5 rounded-full border border-yellow-500/50 truncate max-w-[100px]" title={attr.epl}><Tag size={12} className="mr-1"/>{attr.epl}</span>}
                        </div>
                    </CardContent>
                  </Card>
                )}
              )}
            </div>
            {propertiesMeta && propertiesMeta.count && (propertiesCurrentPage * 12 < propertiesMeta.count) && (
                <div className="mt-8 text-center">
                    <Button 
                        onClick={() => fetchE2Data(linkedE2UserId!, propertiesCurrentPage + 1)}
                        disabled={dataLoading} // Disable during display load, not analytics load
                        className="bg-sky-600 hover:bg-sky-500 shadow-lg"
                    >
                        {dataLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Load Page {propertiesCurrentPage + 1}
                    </Button>
                </div>
            )}
        </div>
      )}

      {/* Analytics Section Moved Here - Below Properties */}
      {isAnalyticsLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-sky-300 mt-12">
          <Loader2 className="h-12 w-12 animate-spin text-sky-400 mb-4" />
          <p className="text-xl">Crunching Full Portfolio Analytics...</p>
          <p className="text-sm text-sky-400/70">Fetching all your property data. This might take a few moments.</p>
        </div>
      )}

      {!isAnalyticsLoading && allPropertiesForAnalytics.length > 0 && linkedE2UserId && (
        <div className="mt-12 space-y-8"> {/* Added top margin and consistent spacing */}
          <h2 className="text-3xl font-bold text-center text-sky-200 mb-6">Full Portfolio Analytics ({selectedCurrency.toUpperCase()}{isRateLoading ? ' (Loading Rate...)' : ''})</h2>
          
          {/* Tile Class Stats Section */}
          <Card className="border-emerald-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
              <CardHeader>
                  <CardTitle className="flex items-center text-emerald-300">
                      <Tag className="h-5 w-5 mr-2" /> Tile Class Distribution
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                      Based on your total of {allPropertiesForAnalytics.length} properties.
                  </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* Column 1: Text Counts */}
                  <div>
                      {Object.keys(tileClassCounts).length > 0 ? (
                          <div className="space-y-2">
                              {Object.entries(tileClassCounts)
                                .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
                                .map(([className, count]) => (
                                  <div key={className} className="flex justify-between items-center text-sm">
                                      <span className="text-gray-300">{className}:</span>
                                      <span className="font-semibold text-white">{count}</span>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <p className="text-gray-500 text-sm">No property data for tile classes.</p>
                      )}
                  </div>
                  
                  {/* Column 2: Pie Chart */}
                  <div className="h-64 md:h-80"> 
                      {tileClassPieData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <>
                                  <Pie
                                      data={tileClassPieData}
                                      cx="50%"
                                      cy="50%"
                                      labelLine={false}
                                      outerRadius="80%"
                                      innerRadius="40%"
                                      fill="#8884d8"
                                      dataKey="value"
                                      stroke="#374151"
                                  >
                                      {tileClassPieData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <Tooltip 
                                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                      itemStyle={{ color: '#d1d5db' }}
                                  />
                                </>
                              </PieChart>
                          </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                            No data for tile class chart.
                        </div>
                      )}
                  </div>
              </CardContent>
          </Card>

          {/* Enhanced Analytics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            {/* Value Summary Card (Enhanced) */}
            <Card className="border-sky-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg lg:col-span-2"> {/* Full width on large screens */}
              <CardHeader>
                <CardTitle className="flex items-center text-sky-300">
                  <Landmark className="h-5 w-5 mr-2" /> Full Portfolio Overview
                </CardTitle>
                <CardDescription className="text-gray-400">
                   Financial summary of your {allPropertiesForAnalytics.length} properties in {selectedCurrency.toUpperCase()}.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-sky-200 mb-1">Financials</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-gray-300">Total Current Value:</span> <span className="font-semibold text-white">{formatCurrency(valueSummary.totalCurrentValue)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Total Purchase Value:</span> <span className="font-semibold text-white">{formatCurrency(valueSummary.totalPurchaseValue)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Portfolio Gain/Loss:</span> <span className={`font-semibold ${(valueSummary.totalCurrentValue - valueSummary.totalPurchaseValue) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(valueSummary.totalCurrentValue - valueSummary.totalPurchaseValue)}</span></div>
                    {valueSummary.countWithValue > 0 && valueSummary.totalPurchaseValue > 0 && (
                      <div className="flex justify-between"><span className="text-gray-300">Average ROI:</span> <span className={`font-semibold ${((valueSummary.totalCurrentValue - valueSummary.totalPurchaseValue) / valueSummary.totalPurchaseValue) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(((valueSummary.totalCurrentValue - valueSummary.totalPurchaseValue) / valueSummary.totalPurchaseValue) * 100).toFixed(2)}%</span></div>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-sky-200 mb-1">Property Stats</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-gray-300">Total Tiles:</span> <span className="font-semibold text-white">{valueSummary.totalTiles.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Properties with Mentars:</span> <span className="font-semibold text-white">{featureCounts.mentars}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Properties with Holos:</span> <span className="font-semibold text-white">{featureCounts.holobuildings}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Featured Properties:</span> <span className="font-semibold text-white">{featureCounts.featured}</span></div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-sky-200 mb-1">Essence & Activity</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-gray-300">Total Claimed Essence:</span> <span className="font-semibold text-white">{valueSummary.totalClaimedEssence.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Total Promised Essence:</span> <span className="font-semibold text-white">{valueSummary.totalPromisedEssence.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Active Resource Claims:</span> <span className="font-semibold text-white">{featureCounts.activeClaims}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Tier Upgraded Props:</span> <span className="font-semibold text-white">{featureCounts.tierUpgraded}</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Country Distribution Card */}
            {countryChartData.length > 0 && (
              <Card className="border-lime-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-lime-300">
                    <Globe className="h-5 w-5 mr-2" /> Property Distribution by Country
                  </CardTitle>
                  <CardDescription className="text-gray-400">Top 10 countries from your {allPropertiesForAnalytics.length} properties.</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={countryChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius="80%"
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        stroke="#374151"
                      >
                        {countryChartData.map((entry, index) => (
                          <Cell key={`cell-country-${index}`} fill={BAR_CHART_COLORS[index % BAR_CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        itemStyle={{ color: '#d1d5db' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Tier Distribution Card */}
            {tierChartData.length > 0 && (
              <Card className="border-violet-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
                  <CardHeader>
                      <CardTitle className="flex items-center text-violet-300">
                          <Building className="h-5 w-5 mr-2" /> Property Distribution by Tier
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                          From your {allPropertiesForAnalytics.length} properties.
                      </CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                                data={tierChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius="80%"
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                stroke="#374151"
                              >
                                {tierChartData.map((entry, index) => (
                                  <Cell key={`cell-tier-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip 
                                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                  itemStyle={{ color: '#d1d5db' }}
                              />
                              <Legend />
                          </PieChart>
                      </ResponsiveContainer>
                  </CardContent>
              </Card>
            )}

            {/* Acquisition Timeline Card */}
            {acquisitionTimelineData.length > 0 && (
              <Card className="border-amber-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-amber-300">
                    <Zap className="h-5 w-5 mr-2" /> Property Acquisition Timeline
                  </CardTitle>
                  <CardDescription className="text-gray-400">Properties acquired per year.</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={acquisitionTimelineData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        itemStyle={{ color: '#d1d5db' }}
                        cursor={{fill: 'rgba(107, 114, 128, 0.1)'}}
                      />
                      <Legend />
                      <Bar dataKey="count" name="Properties Acquired" fill="#F59E0B" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Tile Count Distribution Card */}
            {tileCountDistributionData.length > 0 && (
              <Card className="border-rose-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-rose-300">
                    <Maximize className="h-5 w-5 mr-2" /> Tile Count Distribution
                  </CardTitle>
                  <CardDescription className="text-gray-400">Distribution of property sizes by tile count.</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tileCountDistributionData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        itemStyle={{ color: '#d1d5db' }}
                        cursor={{fill: 'rgba(107, 114, 128, 0.1)'}}
                      />
                      <Legend />
                      <Bar dataKey="count" name="Number of Properties" fill="#F43F5E" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* For Sale Status Card */}
            {forSaleChartData.length > 0 && (
                <Card className="border-teal-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center text-teal-300">
                            <CheckCircle className="h-5 w-5 mr-2" /> For Sale Status
                        </CardTitle>
                        <CardDescription className="text-gray-400">Breakdown of properties listed for sale.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={forSaleChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius="80%"
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    stroke="#374151"
                                >
                                    {forSaleChartData.map((entry, index) => (
                                        <Cell key={`cell-forsale-${index}`} fill={index === 0 ? BAR_CHART_COLORS[1] : BAR_CHART_COLORS[3]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                    itemStyle={{ color: '#d1d5db' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
            
            {/* EPL Usage Card */}
            {eplChartData.length > 0 && (
                <Card className="border-fuchsia-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center text-fuchsia-300">
                            <Tag className="h-5 w-5 mr-2" /> EPL Usage
                        </CardTitle>
                        <CardDescription className="text-gray-400">Properties with and without an EPL.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={eplChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius="80%"
                                    fill="#8884d8"
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    stroke="#374151"
                                >
                                    {eplChartData.map((entry, index) => (
                                        <Cell key={`cell-epl-${index}`} fill={index === 0 ? BAR_CHART_COLORS[4] : BAR_CHART_COLORS[0]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                    itemStyle={{ color: '#d1d5db' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

          </div>
        </div>
      )}
      
      {/* Fallback if no analytics data and not loading (and user is linked) */}
      {!isAnalyticsLoading && allPropertiesForAnalytics.length === 0 && linkedE2UserId && !error && (
         <div className="flex flex-col items-center justify-center py-12 text-sky-300/70 mt-12">
          <AlertCircle className="h-10 w-10 text-sky-400/50 mb-3" />
          <p className="text-lg">No property data found to generate full analytics.</p>
          <p className="text-sm">Please ensure the linked E2 User ID is correct and has properties.</p>
        </div>
      )}

    </div>
  );
} 