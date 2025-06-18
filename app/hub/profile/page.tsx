'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePriceContext } from '@/contexts/PriceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; 
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, MapPin, Maximize, Building, Zap, Tag, Landmark, CheckCircle, XCircle, Gem, ShieldCheck, User, Globe, ArrowUpRight, LinkIcon, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, Sector } from 'recharts';
import { BarChart, CartesianGrid, XAxis, YAxis, Bar } from 'recharts';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useIsMobile } from '@/components/ui/use-mobile';

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
  hasHoloBuilding?: boolean; // E2 API sometimes uses this variation
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
    count: number; // Should map to E2's 'total'
    current_page?: number;
    last_page?: number;
    per_page?: number;
  };
  links?: {
    first?: string;
    last?: string;
    prev?: string | null;
    next?: string | null; // Full URL or null
  };
}

// --- Helper function to extract E2 User ID ---
const extractE2UserId = (input: string): string | null => {
  if (!input) return null;
  const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
  const match = input.match(uuidRegex);
  return match ? match[0] : null;
};

// Helper for IndexedDB cache key
const getCacheKey = (userId: string) => `e2_properties_${userId}`;

interface Pie3DProps {
  cx?: string | number;
  cy?: string | number;
  data: Array<Record<string, any>>;
  dataKey: string;
  nameKey: string;
  innerRadius?: string | number;
  outerRadius?: string | number;
  fill?: string;
  colorArray: string[];
  stroke?: string;
  startAngle?: number;
  endAngle?: number;
}

// Create custom 3D pie effect component
const Pie3D = (props: Pie3DProps) => {
  const { cx = '50%', cy = '50%', data, dataKey, nameKey, innerRadius = 0, outerRadius = '80%', fill, colorArray, stroke } = props;
  
  return data.map((entry, index) => {
    const color = colorArray[index % colorArray.length];
    // Generate layered circles to create 3D effect
    const layers = 5;
    const startAngle = props.startAngle || 0;
    const endAngle = props.endAngle || 360;
    
    // Calculate angles for this slice
    let prevSum = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i][dataKey];
      if (i < index) prevSum += data[i][dataKey];
    }
    
    const sliceStartAngle = startAngle + (prevSum / sum) * (endAngle - startAngle);
    const sliceEndAngle = startAngle + ((prevSum + entry[dataKey]) / sum) * (endAngle - startAngle);
    
    return Array.from({ length: layers }).map((_, i) => {
      // Darker colors for back layers, lighter for front
      const darkenPercent = i / layers;
      const layerColor = i === layers-1 ? color : shadeColor(color, -15 * darkenPercent);
      const offset = i*2;
      
      // Convert to numbers before arithmetic operations
      const numCx = typeof cx === 'string' ? parseFloat(cx) : cx;
      const numCy = typeof cy === 'string' ? parseFloat(cy) : cy;
      const numInnerRadius = typeof innerRadius === 'string' ? parseFloat(innerRadius) : innerRadius;
      const numOuterRadius = typeof outerRadius === 'string' ? parseFloat(outerRadius) : outerRadius;
      
      return (
        <Sector
          key={`${index}-layer-${i}`}
          cx={numCx}
          cy={numCy + offset}
          innerRadius={numInnerRadius}
          outerRadius={numOuterRadius - offset}
          startAngle={sliceStartAngle}
          endAngle={sliceEndAngle}
          fill={layerColor}
          stroke={stroke || '#374151'}
          strokeWidth={0.5}
        />
      );
    });
  }).flat();
};

// Helper function to shade colors
const shadeColor = (color: string, percent: number): string => {
  let R = parseInt(color.substring(1,3), 16);
  let G = parseInt(color.substring(3,5), 16);
  let B = parseInt(color.substring(5,7), 16);

  R = parseInt(String(R * (100 + percent) / 100));
  G = parseInt(String(G * (100 + percent) / 100));
  B = parseInt(String(B * (100 + percent) / 100));

  R = (R<255) ? R : 255;  
  G = (G<255) ? G : 255;  
  B = (B<255) ? B : 255;  

  const RR = ((R.toString(16).length===1)?"0"+R.toString(16):R.toString(16));
  const GG = ((G.toString(16).length===1)?"0"+G.toString(16):G.toString(16));
  const BB = ((B.toString(16).length===1)?"0"+B.toString(16):B.toString(16));

  return "#"+RR+GG+BB;
};

// Create a CSS class for 3D pie chart effect
const pie3DStyle = `
  .recharts-pie {
    filter: drop-shadow(0px 10px 8px rgba(0, 0, 0, 0.5));
    transform: perspective(1000px) rotateX(45deg);
    transform-origin: center center;
  }
  .recharts-pie-sector {
    transition: transform 0.2s;
  }
  .recharts-pie-sector:hover {
    transform: scale(1.05) translateY(-5px);
    filter: brightness(1.1);
  }
  
  @media (max-width: 640px) {
    .recharts-pie {
      transform: perspective(1000px) rotateX(25deg);
    }
    .recharts-legend-wrapper {
      font-size: 0.75rem !important;
      /* max-width: 50% !important; */ /* This was causing legend items to wrap and overlap */
    }
  }
`;

// Helper function to create pie data with minimum visible percentages
const createPieDataWithMinSize = (data: {name: string, value: number}[], minPercent = 2) => {
  if (!data.length) return [];
  
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return data.map(item => {
    const percent = (item.value / total) * 100;
    // Ensure small percentages are still visible by applying a minimum
    const adjustedValue = percent < minPercent && percent > 0 
      ? (minPercent / 100) * total 
      : item.value;
      
    return {
      ...item,
      // Store original value for accurate tooltips and labels
      originalValue: item.value,
      value: adjustedValue
    };
  });
};

export default function ProfilePage() {
  const isMobile = useIsMobile();
  const [e2ProfileInput, setE2ProfileInput] = useState('');
  const [linkedE2UserId, setLinkedE2UserId] = useState<string | null>(null);
  
  const [userInfo, setUserInfo] = useState<E2UserInfo | null>(null);
  const [properties, setProperties] = useState<E2Property[]>([]);
  const [allPropertiesForAnalytics, setAllPropertiesForAnalytics] = useState<E2Property[]>([]);
  const [propertiesMeta, setPropertiesMeta] = useState<E2PropertiesResponse['meta'] | null>(null);
  const [propertiesCurrentPage, setPropertiesCurrentPage] = useState(1);
  const [cachedProps, setCachedProps] = useState<E2Property[] | null>(null); // IndexedDB cache

  const [loading, setLoading] = useState(false); // General loading, might be redundant if linking/data loading are specific enough
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false); // For paginated display properties + user info
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false); // For all properties for analytics
  const [error, setError] = useState<string | null>(null);

  // --- Access Price Context for selected currency ---
  const { selectedCurrency } = usePriceContext();

  // --- State for Exchange Rate ---
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isRateLoading, setIsRateLoading] = useState<boolean>(false);

  // --- NEW: Sort & Filter State ---
  const [sortOption, setSortOption] = useState<'latest'|'size'>('latest');
  const [tierFilter, setTierFilter] = useState<number|null>(null); // 1,2,3
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [eplFilter, setEplFilter] = useState<'all'|'with'|'without'>('all'); // New EPL filter

  const PER_PAGE_DISPLAY = 12;

  // Compute displayed properties after sort/filter
  const displayedData = useMemo(() => {
    const source = cachedProps?.length ? cachedProps : properties;
    let list = [...source];

    // search
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => (p.attributes.description?.toLowerCase().includes(q) || p.attributes.location?.toLowerCase().includes(q)));
    }

    if (tierFilter !== null) {
      list = list.filter(p => p.attributes.landfieldTier === tierFilter);
    }
    
    // Apply EPL filter
    if (eplFilter === 'with') {
      list = list.filter(p => p.attributes.epl && typeof p.attributes.epl === 'string' && p.attributes.epl.trim() !== '');
    } else if (eplFilter === 'without') {
      list = list.filter(p => !p.attributes.epl || typeof p.attributes.epl !== 'string' || p.attributes.epl.trim() === '');
    }
    
    if (sortOption === 'size') {
      list.sort((a,b) => (b.attributes.tileCount||0) - (a.attributes.tileCount||0));
    } else { // 'latest'
      list.sort((a,b) => {
        // Featured first
        const featA = a.attributes.isFeatured ? 1 : 0;
        const featB = b.attributes.isFeatured ? 1 : 0;
        if (featB - featA !== 0) return featB - featA;
        const dateA = a.attributes.purchasedAt ? new Date(a.attributes.purchasedAt).getTime() : 0;
        const dateB = b.attributes.purchasedAt ? new Date(b.attributes.purchasedAt).getTime() : 0;
        return dateB - dateA;
      });
    }
    return list;
  }, [properties, cachedProps, sortOption, tierFilter, searchQuery, eplFilter]);

  // total pages after filter
  const totalFilteredPages = Math.max(1, Math.ceil(displayedData.length / PER_PAGE_DISPLAY));

  const paginatedDisplay = displayedData.slice((propertiesCurrentPage-1)*PER_PAGE_DISPLAY, propertiesCurrentPage*PER_PAGE_DISPLAY);

  // reset page when filters change
  useEffect(()=>{
    setPropertiesCurrentPage(1);
  }, [sortOption, tierFilter, searchQuery, eplFilter]);

  // --- Fetch Exchange Rate ---
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_OPEN_EXCHANGE_RATES_APP_ID;
    const targetCurrency = selectedCurrency.toUpperCase(); // Cache for logging
    
    console.log(`[ExchangeRate Effect] Triggered for currency: ${targetCurrency}`); // Log effect trigger

    const fetchRate = async () => {
      if (!targetCurrency) {
          console.log('[ExchangeRate Effect] No target currency, exiting.');
          return;
      }
      if (!appId) {
        console.error("[ExchangeRate Effect] App ID missing");
        setError(prev => prev ? `${prev}\nOpen Exchange Rates App ID missing` : 'Open Exchange Rates App ID missing');
        setExchangeRate(null);
        setIsRateLoading(false);
        return;
      }
      console.log(`[ExchangeRate Effect] Using App ID: ${appId ? 'Loaded' : 'MISSING!'}`); // Verify App ID loaded

      if (targetCurrency === 'USD') {
        console.log('[ExchangeRate Effect] Target is USD, setting rate to 1.');
        setExchangeRate(1); 
        setIsRateLoading(false);
        return;
      }

      console.log(`[ExchangeRate Effect] Starting fetch for ${targetCurrency}...`);
      setIsRateLoading(true);
      setExchangeRate(null); 
      let responseText = '[Not Fetched]'; // For logging raw response
      try {
        const apiUrl = `https://openexchangerates.org/api/latest.json?app_id=${appId}`;
        console.log(`[ExchangeRate Effect] Fetching URL: ${apiUrl}`);
        const response = await fetch(apiUrl);
        responseText = await response.text(); // Get raw text first
        console.log(`[ExchangeRate Effect] Raw API Response (Status ${response.status}): ${responseText}`);
        
        if (!response.ok) {
            let errorMessage = `Failed OER fetch (${response.status})`;
            try {
                const errorJson = JSON.parse(responseText); // Parse from text
                errorMessage = errorJson?.description || errorJson?.message || errorMessage;
            } catch (e) { /* Ignore if not JSON */ }
            throw new Error(errorMessage);
        }

        const data = JSON.parse(responseText); // Parse JSON from text
        
        if (data && data.rates) {
          if (data.base !== 'USD') {
              console.warn(`[ExchangeRate Effect] OER base currency is ${data.base}, not USD.`);
          }
          
          const rate = data.rates[targetCurrency]; // Use cached uppercase currency
          console.log(`[ExchangeRate Effect] Rate found in response for ${targetCurrency}: ${rate} (Type: ${typeof rate})`); // Log found rate
          
          if (typeof rate === 'number') {
             console.log(`[ExchangeRate Effect] Calling setExchangeRate(${rate})`);
             setExchangeRate(rate); 
          } else {
            console.error(`[ExchangeRate Effect] Rate for ${targetCurrency} is not a number or missing.`);
            throw new Error(`Rate for ${targetCurrency} not found in OER response`);
          }
        } else {
           const errorInfo = data?.description || 'Invalid data structure from OER';
           console.error("[ExchangeRate Effect] Invalid data structure:", data);
           throw new Error(errorInfo);
        }
      } catch (err: any) {
        console.error("[ExchangeRate Effect] CATCH block error:", err);
        setError(prev => prev ? `${prev}\nOER Rate Fetch Error: ${err.message}` : `OER Rate Fetch Error: ${err.message}`);
        setExchangeRate(null); 
      } finally {
        console.log("[ExchangeRate Effect] Setting isLoadingRate to false.");
        setIsRateLoading(false);
      }
    };

    fetchRate();
  }, [selectedCurrency]); // Dependency array remains correct

  // *** ADDED: useEffect to monitor exchangeRate state changes ***
  useEffect(() => {
      console.log(`[ExchangeRate State Monitor] exchangeRate changed to: ${exchangeRate}`);
  }, [exchangeRate]);

  // --- Calculate Conversion Rate (No longer needed) ---
  // const conversionRate = useMemo(() => { ... }, [currentPrice, usdPrice]);

  // --- Updated formatCurrency helper ---
  const formatCurrency = (value: number | string | undefined | null, options?: Intl.NumberFormatOptions) => {
    console.log(`[formatCurrency] START - Raw value:`, value); // Log raw input
    // Ensure value is a number
    let numericValue: number;
    if (value === undefined || value === null) return 'N/A';
    if (typeof value === 'string') {
      numericValue = parseFloat(value);
    } else {
      numericValue = value;
    }
    console.log(`[formatCurrency] Parsed numericValue:`, numericValue); // Log parsed number
    if (isNaN(numericValue)) return 'Invalid Value'; 

    // Use fetched exchange rate for conversion
    const rate = exchangeRate; 
    const isLoading = isRateLoading;
    const currencyCode = selectedCurrency.toUpperCase();

    // Log state values being used
    console.log(`[formatCurrency] State values - Rate: ${rate}, IsLoading: ${isLoading}, Target Currency: ${currencyCode}`);

    if (isLoading && currencyCode !== 'USD') {
        console.log('[formatCurrency] Rendering loader...');
        return <Loader2 className="h-4 w-4 animate-spin inline-block" />;
    }

    const displayValue = rate !== null ? numericValue * rate : numericValue;
    const displayCurrencyCode = rate !== null ? currencyCode : 'USD';
    
    if (rate === null && currencyCode !== 'USD') {
        console.warn(`[formatCurrency] Rate is null, falling back to USD display for ${currencyCode}.`);
    }

    // Log final values before formatting
    console.log(`[formatCurrency] FINAL - displayValue: ${displayValue}, displayCurrencyCode: ${displayCurrencyCode}`); 

    return displayValue.toLocaleString(undefined, {
        style: 'currency',
        currency: displayCurrencyCode,
        minimumFractionDigits: options?.minimumFractionDigits ?? 2,
        maximumFractionDigits: options?.maximumFractionDigits ?? 2,
        ...options
    });
  };

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
          setE2ProfileInput(data.e2_user_id);
        }
      } catch (err: any) {
        console.error('Error fetching linked E2 ID:', err);
      } finally {
        setLinkingLoading(false);
      }
    };
    fetchLinkedId();
  }, []);

  useEffect(() => {
    if (linkedE2UserId) {
      // Reset state for new user ID
      setProperties([]);
      setAllPropertiesForAnalytics([]);
      setPropertiesCurrentPage(1);
      setUserInfo(null);
      setError(null);
      setCachedProps(null);
      setDataLoading(true);
      setIsAnalyticsLoading(true); // Show analytics loading from the start

      const loadProfileData = async () => {
        let userInfoData: E2UserInfo | null = null;
        try {
          const userInfoRes = await fetch(`https://app.earth2.io/api/v2/user_info/${linkedE2UserId}`);
          if (!userInfoRes.ok) {
            throw new Error(`Failed to fetch E2 user info (status: ${userInfoRes.status})`);
          }
          userInfoData = await userInfoRes.json();
          setUserInfo(userInfoData);
        } catch (err: any) {
          setError(err.message || 'Could not fetch user profile.');
          setDataLoading(false);
          setIsAnalyticsLoading(false);
          return; // Stop if we can't get basic info
        }

        // Pass user info to the main data fetcher.
        // This function handles cache/network and sets all necessary state for display.
        await fetchAllPropertiesForAnalytics(linkedE2UserId, userInfoData);

        // Loading states are turned off inside fetchAllPropertiesForAnalytics
        setDataLoading(false);
      };

      loadProfileData();
    }
  }, [linkedE2UserId]);

  const fetchE2Data = async (userId: string, page: number = 1) => {
    // This function is now only for pagination from cached data.
    if (!userId || !cachedProps) return;

    // The full data is expected to be in `cachedProps`. We just paginate over it.
      const PER_PAGE = 12;
      const start = (page - 1) * PER_PAGE;
    const end = start + PER_PAGE;
    const slice = cachedProps.slice(start, end);

      setProperties(slice);
    setPropertiesMeta(prevMeta => ({
      ...prevMeta,
        count: cachedProps.length,
        current_page: page,
        last_page: Math.ceil(cachedProps.length / PER_PAGE),
        per_page: PER_PAGE,
    }));
      setPropertiesCurrentPage(page);
  };

  const fetchAllPropertiesForAnalytics = async (userId: string, userInfo: E2UserInfo | null, forceRefetch: boolean = false) => {
    if (!userId) {
      setIsAnalyticsLoading(false);
      return;
    }

    // Set loading state at the beginning of the operation.
    // Note: The parent useEffect already sets this, but this is a good safeguard.
    setIsAnalyticsLoading(true);
    setAllPropertiesForAnalytics([]);

    // --- Use passed-in user info for expected count ---
    const expectedCount = userInfo?.userLandfieldCount ?? userInfo?.userNetworth?.totalTiles;
        console.log(`[Analytics] Expected total properties from user info: ${expectedCount}`);

    // Attempt to load from IndexedDB first
    if (!forceRefetch) {
    try {
      const cached: E2Property[] | undefined = await idbGet(getCacheKey(userId));
      if (cached && cached.length > 0) {
            // If we couldn't get expectedCount, assume cache is good. Otherwise require a close match.
            const isCacheValid = expectedCount === undefined || Math.abs(cached.length - expectedCount) <= 5;

            if (isCacheValid) {
              console.log(`[Cache] Using valid cached property data from IndexedDB (${cached.length} items).`);
          setCachedProps(cached);
          setAllPropertiesForAnalytics(cached);
              
              // Prime first page list for display
          const PER_PAGE = 12;
          setProperties(cached.slice(0, PER_PAGE));
          setPropertiesMeta({
            count: cached.length,
            current_page: 1,
            last_page: Math.ceil(cached.length / PER_PAGE),
            per_page: PER_PAGE,
          });
          setPropertiesCurrentPage(1);
              setIsAnalyticsLoading(false); // Turn off loading
              return; // IMPORTANT: Skip network fetching
            } else {
               console.log(`[Cache] Invalidating cache. Expected ${expectedCount}, found ${cached.length}. Re-fetching.`);
        }
      }
    } catch (err) {
      console.error('[Cache] Error accessing IndexedDB:', err);
    }
    }

    // --- If cache is not used, proceed with network fetch ---
    const allProperties = new Map<string, E2Property>();

    const performLetterPass = async () => {
      const searchTerms = 'abcdefghijklmnopqrstuvwxyz0123456789*'.split('');
      const PER_PAGE_ANALYTICS = 60;

      for (const term of searchTerms) {
        let totalPages = 1;
        try {
          const firstPageUrl = new URL('/api/e2/properties', window.location.origin);
          firstPageUrl.searchParams.set('userId', userId);
          firstPageUrl.searchParams.set('page', '1');
          firstPageUrl.searchParams.set('perPage', String(PER_PAGE_ANALYTICS));
          firstPageUrl.searchParams.set('letter', term.toUpperCase());

          const firstPageResponse = await fetch(firstPageUrl.toString());
          if (!firstPageResponse.ok) {
            console.warn(`[Analytics] Warning: Initial fetch for letter '${term.toUpperCase()}' failed. Skipping.`);
            continue;
          }

          const firstPageData: E2PropertiesResponse = await firstPageResponse.json();
          if (!firstPageData || !firstPageData.meta || !firstPageData.data) {
            console.warn(`[Analytics] Warning: Invalid response structure for letter '${term.toUpperCase()}'. Skipping.`);
            continue;
          }
          
          totalPages = Math.ceil((firstPageData.meta.count || 0) / PER_PAGE_ANALYTICS) || 1;
          firstPageData.data.forEach(prop => allProperties.set(prop.id, prop));

        } catch (error) {
          console.error(`[Analytics] Error on first page for letter '${term.toUpperCase()}'. Skipping.`, error);
          continue;
        }

        // Fetch remaining pages in parallel for efficiency
        if (totalPages > 1) {
            const pageFetches = [];
            for (let currentPage = 2; currentPage <= totalPages; currentPage++) {
                const pageUrl = new URL('/api/e2/properties', window.location.origin);
                pageUrl.searchParams.set('userId', userId);
                pageUrl.searchParams.set('page', String(currentPage));
                pageUrl.searchParams.set('perPage', String(PER_PAGE_ANALYTICS));
                pageUrl.searchParams.set('letter', term.toUpperCase());
                pageFetches.push(fetch(pageUrl.toString()).then(res => res.ok ? res.json() : Promise.reject(`Failed fetch for page ${currentPage}`)));
        }

            const results = await Promise.allSettled(pageFetches);
            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value.data) {
                    const newProperties: E2Property[] = result.value.data;
                    newProperties.forEach(prop => allProperties.set(prop.id, prop));
                }
            });
        }
      }
    };
    
    console.log('[Analytics] Starting unified letter-based fetch...');
    await performLetterPass();
    console.log(`[Analytics] Fetch complete. Found ${allProperties.size} unique properties.`);

    const accumulatedProps = Array.from(allProperties.values());
    setAllPropertiesForAnalytics(accumulatedProps);
    setCachedProps(accumulatedProps);

    const PER_PAGE_DISPLAY = 12;
    setProperties(accumulatedProps.slice(0, PER_PAGE_DISPLAY));
      setPropertiesMeta({
        count: accumulatedProps.length,
        current_page: 1,
        last_page: Math.ceil(accumulatedProps.length / PER_PAGE_DISPLAY),
        per_page: PER_PAGE_DISPLAY,
      });
      setPropertiesCurrentPage(1);

    try {
      await idbSet(getCacheKey(userId), accumulatedProps);
      console.log(`[Cache] Saved ${accumulatedProps.length} properties to IndexedDB.`);
    } catch (err) {
      console.error('[Cache] Failed to save properties to IndexedDB:', err);
        }
        
    setIsAnalyticsLoading(false);

    if (expectedCount !== undefined && accumulatedProps.length < expectedCount) {
        console.warn(`[Analytics] Mismatch: Expected count was ${expectedCount}, but fetched ${accumulatedProps.length}.`);
    }
  };

  const handleRefetch = async () => {
    if (!linkedE2UserId) return;

    console.log('[Refetch] Starting user-triggered data refetch...');
    setIsAnalyticsLoading(true);
    setDataLoading(true); // To show general loading indicator
    setError(null);

    let userInfoData: E2UserInfo | null = null;
    try {
      const userInfoRes = await fetch(`https://app.earth2.io/api/v2/user_info/${linkedE2UserId}`);
      if (!userInfoRes.ok) {
        throw new Error(`Failed to fetch E2 user info (status: ${userInfoRes.status})`);
      }
      userInfoData = await userInfoRes.json();
      setUserInfo(userInfoData);
      } catch (err: any) {
      setError(err.message || 'Could not fetch user profile for refetch.');
      setDataLoading(false);
      setIsAnalyticsLoading(false);
      return; 
    }

    // Call fetchAllPropertiesForAnalytics with the force flag and fresh user info
    await fetchAllPropertiesForAnalytics(linkedE2UserId, userInfoData, true);

    setDataLoading(false); // isAnalyticsLoading is turned off inside fetchAll
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const extractedId = extractE2UserId(e2ProfileInput);

    if (!extractedId) {
      setError('Invalid Earth2 Profile Link or User ID format. Please ensure it contains a valid UUID.');
      return;
    }

    // Check if user already has a linked E2 profile that's different from the current input
    if (linkedE2UserId && linkedE2UserId !== extractedId) {
      setError('You already have a linked Earth2 profile. Once linked, the Earth2 user ID cannot be changed.');
      return;
    }

    setLinkingLoading(true);
    try {
      // First fetch the E2 user info to verify it exists
      const userInfoResponse = await fetch(`https://app.earth2.io/api/v2/user_info/${extractedId}`);
      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch Earth2 user info');
      }
      const userInfoData: E2UserInfo = await userInfoResponse.json();
      
      // Only send the POST request if we don't already have this ID linked
      if (!linkedE2UserId) {
        // Send to our API to persist the link
        const linkResponse = await fetch('/api/me/e2profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            e2_user_id: extractedId,
            username: userInfoData.username,
            customPhoto: userInfoData.customPhoto,
            picture: userInfoData.picture
          }),
        });

        if (!linkResponse.ok) {
          const errorData = await linkResponse.json();
          throw new Error(errorData.error || `Failed to link Earth2 profile (status: ${linkResponse.status})`);
        }
      }
      
      // Update local state
      setUserInfo(userInfoData);
      setLinkedE2UserId(extractedId);
    } catch (err: any) {
      console.error('Error linking E2 profile:', err);
      setError(err.message);
    } finally {
      setLinkingLoading(false);
    }
  };
  
  const isOverallLoading = linkingLoading || dataLoading; // Combined for simpler button disable logic

  // --- ANALYTICS STATE ---
  const [tileClassCounts, setTileClassCounts] = useState<Record<string, { properties: number; tiles: number }>>({}); 
  const [countryCounts, setCountryCounts] = useState<Record<string, number>>({});
  const [landfieldTierCounts, setLandfieldTierCounts] = useState<Record<string, number>>({});
  const [featureCounts, setFeatureCounts] = useState<{ mentars: number; holobuildings: number; featured: number; activeClaims: number; tierUpgraded: number; purchasedForEssence: number; forSale: number; notForSale: number; withEPL: number; withoutEPL: number; }>({ mentars: 0, holobuildings: 0, featured: 0, activeClaims: 0, tierUpgraded: 0, purchasedForEssence: 0, forSale: 0, notForSale: 0, withEPL: 0, withoutEPL: 0 });
  const [valueSummary, setValueSummary] = useState<{ totalCurrentValue: number; totalPurchaseValue: number; countWithValue: number; totalTiles: number; totalClaimedEssence: number; totalPromisedEssence: number; }>({ totalCurrentValue: 0, totalPurchaseValue: 0, countWithValue: 0, totalTiles: 0, totalClaimedEssence: 0, totalPromisedEssence: 0 });
  const [acquisitionTimelineData, setAcquisitionTimelineData] = useState<{name: string, properties: number, tiles: number}[]>([]); 
  const [tileCountDistributionData, setTileCountDistributionData] = useState<{name: string, count: number}[]>([]);

  // --- ANALYTICS CALCULATION ---
  useEffect(() => {
    if (allPropertiesForAnalytics && allPropertiesForAnalytics.length > 0 && !isAnalyticsLoading) {
      const newTileClassCounts: Record<string, { properties: number; tiles: number }> = {}; 
      const newCountryCounts: Record<string, number> = {};
      const newLandfieldTierCounts: Record<string, number> = {};
      
      let mentarC = 0, holobuildingC = 0, featuredC = 0, activeClaimsC = 0, tierUpgradedC = 0, purchasedForEssenceC = 0, forSaleC = 0, notForSaleC = 0, withEPLC = 0, withoutEPLC = 0;
      let currentValSum = 0, purchaseValSum = 0, propsWithValueCount = 0, tilesSum = 0, claimedEssenceSum = 0, promisedEssenceSum = 0;
      
      // Update acquisition structure
      const acquisitionsByYear: Record<string, { properties: number; tiles: number }> = {}; 
      const TILE_COUNT_BINS = { "1-10": 0, "11-50": 0, "51-100": 0, "101-250": 0, "251-500": 0, "501-750": 0, "751+": 0, "Unknown": 0};

      allPropertiesForAnalytics.forEach(prop => {
        const attrs = prop.attributes;
        const tileCount = attrs.tileCount || 0;

        // Tile Class Calculation
        const tileClass = attrs.tileClass;
        const propertyTier = attrs.landfieldTier;
        let className = 'Unknown Class'; 

        if (typeof tileClass === 'number' || (typeof tileClass === 'string' && String(tileClass).trim() !== '')) {
            className = `Class ${tileClass}`; 
        } else if (tileClass === null || tileClass === undefined || String(tileClass).trim() === '') {
            if (propertyTier === 2) {
                className = 'Unclassified (Tier 2)';
            } else if (propertyTier === 3) {
                className = 'Unclassified (Tier 3)';
            } else {
                 className = 'Unclassified (Other Tier)'; 
            }
        }
        if (!newTileClassCounts[className]) {
          newTileClassCounts[className] = { properties: 0, tiles: 0 };
        }
        newTileClassCounts[className].properties += 1;
        newTileClassCounts[className].tiles += tileCount;

        // Country Calculation
        const country = attrs.country?.toUpperCase() || 'Unknown';
        newCountryCounts[country] = (newCountryCounts[country] || 0) + 1;

        // Landfield Tier Calculation
        const tierName = propertyTier ? `Tier ${propertyTier}` : 'Unknown Tier'; 
        newLandfieldTierCounts[tierName] = (newLandfieldTierCounts[tierName] || 0) + 1;
        
        if (attrs.hasMentar) mentarC++;
        if (attrs.hasHolobuilding || attrs.hasHoloBuilding) holobuildingC++;
        if (attrs.isFeatured) featuredC++;
        if (attrs.activeResourceClaimsCount && attrs.activeResourceClaimsCount > 0) activeClaimsC++;
        if (attrs.landfieldTierUpgraded) tierUpgradedC++;
        if (attrs.purchasedForEssence) purchasedForEssenceC++;
        
        // Fix For Sale status counting - use strict equality check
        if (attrs.forSale === true) forSaleC++; else notForSaleC++;
        
        // Fix EPL counting - check for string existence and non-emptiness
        if (attrs.epl && typeof attrs.epl === 'string' && attrs.epl.trim() !== '') withEPLC++; 
        else withoutEPLC++;

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
        if (attrs.claimedEssenceBalance) claimedEssenceSum += parseFloat(String(attrs.claimedEssenceBalance).replace(/,/g, '')) || 0; 
        if (attrs.promisedEssenceBalance) promisedEssenceSum += parseFloat(String(attrs.promisedEssenceBalance).replace(/,/g, '')) || 0;
        
        // Acquisition Timeline Calculation (Properties & Tiles)
        if (attrs.purchasedAt) {
            try {
                const year = new Date(attrs.purchasedAt).getFullYear();
                const yearStr = String(year);
                if (!isNaN(year)) {
                    if (!acquisitionsByYear[yearStr]) {
                        acquisitionsByYear[yearStr] = { properties: 0, tiles: 0 }; // Initialize year
                    }
                    acquisitionsByYear[yearStr].properties += 1;
                    acquisitionsByYear[yearStr].tiles += tileCount;
                }
            } catch (e) { /* ignore */ }
        }

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

      // Set State
      setTileClassCounts(newTileClassCounts);
      setCountryCounts(newCountryCounts);
      setLandfieldTierCounts(newLandfieldTierCounts);
      setFeatureCounts({ mentars: mentarC, holobuildings: holobuildingC, featured: featuredC, activeClaims: activeClaimsC, tierUpgraded: tierUpgradedC, purchasedForEssence: purchasedForEssenceC, forSale: forSaleC, notForSale: notForSaleC, withEPL: withEPLC, withoutEPL: withoutEPLC });
      setValueSummary({ totalCurrentValue: currentValSum, totalPurchaseValue: purchaseValSum, countWithValue: propsWithValueCount, totalTiles: tilesSum, totalClaimedEssence: claimedEssenceSum, totalPromisedEssence: promisedEssenceSum });
      
      // Update acquisition timeline data setting
      setAcquisitionTimelineData(
          Object.entries(acquisitionsByYear)
              .map(([year, data]) => ({name: year, properties: data.properties, tiles: data.tiles }))
              .sort((a,b) => a.name.localeCompare(b.name))
      );
      setTileCountDistributionData(Object.entries(TILE_COUNT_BINS).map(([range, count]) => ({name: range, count})));

    } else if (!isAnalyticsLoading) { // Reset State
      setTileClassCounts({});
      setCountryCounts({});
      setLandfieldTierCounts({});
      setFeatureCounts({ mentars: 0, holobuildings: 0, featured: 0, activeClaims: 0, tierUpgraded: 0, purchasedForEssence: 0, forSale: 0, notForSale: 0, withEPL: 0, withoutEPL: 0 });
      setValueSummary({ totalCurrentValue: 0, totalPurchaseValue: 0, countWithValue: 0, totalTiles: 0, totalClaimedEssence: 0, totalPromisedEssence: 0 });
      setAcquisitionTimelineData([]); // Reset acquisition data
      setTileCountDistributionData([]);
    }
  }, [allPropertiesForAnalytics, isAnalyticsLoading]);

  // --- CHART DATA PREPARATION ---
  const tileClassPieData = useMemo(() => {
    // Pie chart still based on property count
    return Object.entries(tileClassCounts)
      .map(([name, value]) => ({ name, value: value.properties })) // Use property count for pie slices
      .sort((a, b) => b.value - a.value);
  }, [tileClassCounts]);

  const COLORS = ['#34D399', '#60A5FA', '#FBBF24', '#F87171', '#A78BFA', '#2DD4BF', '#FB923C', '#EC4899', '#8B5CF6', '#14B8A6', '#F59E0B', '#EF4444'];
  const BAR_CHART_COLORS = ['#38BDF8', '#A3E635', '#FACC15', '#FB923C', '#EC4899', '#8B5CF6'];

  // Country chart by tile count
  const countryChartData = useMemo(() => {
    const map = new Map<string, number>();
    allPropertiesForAnalytics.forEach(p => {
      const country = p.attributes.country?.toUpperCase() || 'Unknown';
      const tiles = p.attributes.tileCount || 0;
      map.set(country, (map.get(country) || 0) + tiles);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [allPropertiesForAnalytics]);

  const tierChartData = useMemo(() => {
    if (Object.keys(landfieldTierCounts).length === 0) return [];
    
    const data = Object.entries(landfieldTierCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => {
        const tierA = parseInt(a.name.replace('Tier ', ''));
        const tierB = parseInt(b.name.replace('Tier ', ''));
        if (!isNaN(tierA) && !isNaN(tierB)) return tierA - tierB;
        if (!isNaN(tierA)) return -1;
        if (!isNaN(tierB)) return 1;
        return a.name.localeCompare(b.name);
      });

    return createPieDataWithMinSize(data, 2);
  }, [landfieldTierCounts]);

  const forSaleChartData = useMemo(() => {
    if (featureCounts.forSale === 0 && featureCounts.notForSale === 0) return [];
    return createPieDataWithMinSize([
        { name: 'For Sale', value: featureCounts.forSale },
        { name: 'Not For Sale', value: featureCounts.notForSale }
    ], 2);
  }, [featureCounts]);
  
  const eplChartData = useMemo(() => {
    if (featureCounts.withEPL === 0 && featureCounts.withoutEPL === 0) return [];
    return createPieDataWithMinSize([
        { name: 'With EPL', value: featureCounts.withEPL },
        { name: 'No EPL', value: featureCounts.withoutEPL }
    ], 2);
  }, [featureCounts]);

  // --- Country Code to Name Mapping (Basic) ---
  const countryNameMap: Record<string, string> = {
    USD: "United States",
    CY: "Cyprus",
    RO: "Romania",
    PH: "Philippines",
    AE: "United Arab Emirates", // Base for AE-RK, AE-FU etc.
    "AE-RK": "UAE (Ras al-Khaimah)",
    "AE-FU": "UAE (Fujairah)",
    BZ: "Belize",
    NF: "Norfolk Island",
    MH: "Marshall Islands",
    LI: "Liechtenstein",
    SK: "Slovakia",
    HM: "Heard & McDonald Islands",
    IO: "British Indian Ocean Territory",
    KM: "Comoros",
    ZA: "South Africa",
    ZW: "Zimbabwe",
    FM: "Micronesia",
    NL: "Netherlands",
    WF: "Wallis and Futuna",
    CH: "Switzerland",
    LU: "Luxembourg",
    BN: "Brunei",
    MK: "North Macedonia",
    CC: "Cocos (Keeling) Islands",
    YT: "Mayotte",
    AW: "Aruba",
    BQ: "Bonaire, Sint Eustatius & Saba",
    TK: "Tokelau",
    AS: "American Samoa",
    TG: "Togo",
    CU: "Cuba",
    TJ: "Tajikistan",
    BW: "Botswana",
    VG: "British Virgin Islands",
    KI: "Kiribati",
    BB: "Barbados",
    NP: "Nepal",
    BM: "Bermuda",
    AI: "Anguilla",
    OM: "Oman",
    ST: "Sao Tome and Principe",
    MA: "Morocco",
    GP: "Guadeloupe",
    SM: "San Marino",
    JM: "Jamaica",
    LC: "Saint Lucia",
    PS: "Palestine",
    FK: "Falkland Islands (Malvinas)",
    ME: "Montenegro",
    MP: "Northern Mariana Islands",
    XK: "Kosovo",
    BL: "Saint Barthelemy",
    XX: "Disputed/Unknown", // From Nansha example
    // Add more as needed
  };

  // --- Global Metrics State ---
  interface GlobalMetrics { [key:string]: number | string; }
  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics|null>(null);
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const fetchGlobalMetrics = async () => {
    if (globalMetrics || isMetricsLoading) {
      setIsMetricsOpen(true); return;
    }
    setIsMetricsLoading(true);
    try {
      // Fetch via internal API route to avoid CORS issues
      const res = await fetch('/api/e2/metrics');
      const json = await res.json();
      setGlobalMetrics(json?.data?.attributes ?? {});
      setIsMetricsOpen(true);
    } catch(e){ console.error('Global metrics fetch err',e);} finally{ setIsMetricsLoading(false);} };

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl p-8 backdrop-blur-lg bg-gradient-to-br from-sky-900/40 to-blue-900/30 border border-sky-400/30 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-blue-500/5 z-0"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-earthie-mint/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-sky-400/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-sky-300 to-blue-300 inline-block text-transparent bg-clip-text mb-4">
            Your Earth2 Profile
          </h1>
          <p className="text-base sm:text-lg text-cyan-200/90 max-w-3xl">
            Connect your Earth2 profile to view your properties, stats, and track your portfolio in one place.
          </p>
        </div>
      </div>

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
                disabled={linkingLoading || (linkedE2UserId !== null && linkedE2UserId !== extractE2UserId(e2ProfileInput))}
                readOnly={linkedE2UserId !== null}
              />
            </div>
            <Button 
              type="submit" 
              disabled={isOverallLoading || !e2ProfileInput || (linkedE2UserId === extractE2UserId(e2ProfileInput) && !dataLoading && !isAnalyticsLoading) || (linkedE2UserId !== null && linkedE2UserId !== extractE2UserId(e2ProfileInput))}
              className="bg-sky-600/80 hover:bg-sky-500/90 border border-sky-400/30 transition-all duration-300"
            >
              {linkingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {linkedE2UserId === extractE2UserId(e2ProfileInput) && !dataLoading ? 'Re-fetch Data' : 'Link & Fetch Data'}
              {!linkingLoading && <ArrowUpRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
          {linkedE2UserId && (
            <p className="mt-2 text-sm text-amber-300 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              <span>Note: Once an Earth2 profile is linked, the user ID cannot be changed.</span>
            </p>
          )}
          {error && !dataLoading && (
            <div className="mt-4 bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex items-center text-sm text-red-300">
              <AlertCircle className="h-5 w-5 mr-2 text-red-400" />
              <p className="whitespace-pre-wrap">{error}</p>
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
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-4 sm:p-6 bg-gray-900/50">
            {(userInfo.picture || userInfo.customPhoto) && (
              <img 
                src={userInfo.customPhoto || userInfo.picture} 
                alt={userInfo.username} 
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-sky-500 object-cover shadow-lg flex-shrink-0"
              />
            )}
            <div className="flex-grow">
              <CardTitle className="text-2xl sm:text-3xl font-bold text-sky-200 tracking-tight">{userInfo.username}</CardTitle>
              {userInfo.description && <CardDescription className="text-cyan-200/80 mt-1 text-sm max-w-prose">{userInfo.description}</CardDescription>}
            </div>
            {userInfo.customFlag && (
                <img src={userInfo.customFlag} alt="User Flag" className="w-10 h-auto object-contain rounded-sm shadow-md self-start sm:self-center"/>
            )}
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
            {[ 
              { label: 'Networth', value: userInfo?.userNetworth?.networth, isCurrency: true, icon: <Landmark className="w-4 h-4 mr-1.5 text-sky-400"/> },
              { label: 'Total Properties', value: userInfo?.userLandfieldCount ?? (allPropertiesForAnalytics.length > 0 ? allPropertiesForAnalytics.length : undefined), icon: <Building className="w-4 h-4 mr-1.5 text-sky-400"/> },
              { label: 'Total Tiles', value: valueSummary.totalTiles > 0 ? valueSummary.totalTiles : userInfo?.userNetworth?.totalTiles, icon: <Maximize className="w-4 h-4 mr-1.5 text-sky-400"/> },
              { label: 'Country', value: userInfo?.countryCode?.toUpperCase(), icon: <MapPin className="w-4 h-4 mr-1.5 text-sky-400"/> },
            ].map(stat => stat.value !== undefined && stat.value !== null && (
              <div key={stat.label} className="flex items-center">
                {stat.icon}
                <div>
                    <p className="text-xs text-sky-400/70 uppercase tracking-wider">{stat.label}</p>
                    <p className="text-lg font-semibold text-sky-100">
                        {(stat as any).isCurrency ? formatCurrency(stat.value as number) : (typeof stat.value === 'number' ? stat.value.toLocaleString(undefined, stat.label === 'Networth' ? {minimumFractionDigits: 2, maximumFractionDigits: 2} : {}) : stat.value)}
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

      {properties.length > 0 && (
        <div className="space-y-6 mt-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-semibold text-sky-200">Your Earth2 Properties ({userInfo?.userLandfieldCount?.toLocaleString() ?? (allPropertiesForAnalytics.length > 0 ? allPropertiesForAnalytics.length.toLocaleString() : '...')})</h2>
                <Button onClick={handleRefetch} disabled={isAnalyticsLoading || dataLoading} className="bg-sky-600/80 hover:bg-sky-500/90 border border-sky-400/30 transition-all duration-300 self-start sm:self-center">
                  {(isAnalyticsLoading || dataLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refetch Data
                </Button>
            </div>
            {/* Sort / Filter Bar */}
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between bg-gray-800/60 backdrop-blur-md mb-4 px-4 py-3 rounded-lg gap-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 w-full justify-between">
                <div className="flex items-center space-x-2 text-sm text-sky-200">
                  <span>Sort by:</span>
                  <select
                    value={sortOption}
                    onChange={e => setSortOption(e.target.value as any)}
                    className="bg-gray-700 text-sky-200 px-2 py-1 rounded border border-gray-600 focus:outline-none"
                  >
                    <option value="latest">Purchase Date (Latest)</option>
                    <option value="size">Size (Tiles)</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2 text-sm text-sky-200">
                  <span>Filter tier:</span>
                  <select
                    value={tierFilter === null ? '' : tierFilter}
                    onChange={e => {
                      const v = e.target.value; setTierFilter(v === ''? null : parseInt(v));
                    }}
                    className="bg-gray-700 text-sky-200 px-2 py-1 rounded border border-gray-600 focus:outline-none"
                  >
                    <option value="">All</option>
                    <option value="1">T1</option>
                    <option value="2">T2</option>
                    <option value="3">T3</option>
                  </select>
                </div>
                
                {/* New EPL filter */}
                <div className="flex items-center space-x-2 text-sm text-sky-200">
                  <span>EPL status:</span>
                  <select
                    value={eplFilter}
                    onChange={e => setEplFilter(e.target.value as 'all'|'with'|'without')}
                    className="bg-gray-700 text-sky-200 px-2 py-1 rounded border border-gray-600 focus:outline-none"
                  >
                    <option value="all">All properties</option>
                    <option value="with">With EPL only</option>
                    <option value="without">Without EPL only</option>
                  </select>
                </div>
              </div>
              
              {/* Search */}
              <form onSubmit={e=>{e.preventDefault();}} className="flex items-center w-full sm:w-auto sm:flex-grow">
                <input
                  type="text"
                  placeholder="Search description/location..."
                  value={searchQuery}
                  onChange={e=>setSearchQuery(e.target.value)}
                  className="bg-gray-700 text-sky-200 px-3 py-1.5 rounded-l-md border border-gray-600 focus:outline-none w-full sm:w-48"
                />
                <button type="submit" className="bg-sky-600 hover:bg-sky-500 px-3 py-1.5 rounded-r-md text-white text-sm">Search</button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {paginatedDisplay.map((prop) => {
                const attrs = prop.attributes;
                return (
                  <Card key={prop.id} className="bg-gray-800/75 border-sky-600/40 hover:border-sky-500/70 transition-all duration-300 ease-in-out shadow-lg hover:shadow-sky-500/20 flex flex-col">
                    {/* Image with external link overlay */}
                    {attrs.thumbnail && (
                      <div className="relative">
                        <img src={attrs.thumbnail} alt={attrs.description || 'Property'} className="w-full h-48 object-cover rounded-t-lg" />
                        <a
                          href={`https://app.earth2.io/#propertyInfo/${prop.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2 bg-gray-900/70 hover:bg-gray-900/90 text-sky-200 p-1 rounded-full"
                          title="Open on Earth2"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                    <CardHeader className="pb-3 pt-4 px-5 flex-shrink-0">
                      <CardTitle className="text-lg leading-tight text-sky-200 hover:text-sky-100 transition-colors truncate" title={attrs.description}>{attrs.description || 'Unnamed Property'}</CardTitle>
                      <CardDescription className="text-xs text-cyan-300/70 truncate flex items-center mt-1">
                        <MapPin className="w-3 h-3 mr-1.5 text-sky-400/80 flex-shrink-0" /> {attrs.location || 'Unknown Location'}{attrs.country && `, ${attrs.country}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm px-5 pb-4 space-y-2 text-cyan-100/90 flex-grow">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                            {[ 
                                { label: 'Value', value: attrs.currentValue, isCurrency: true, icon: <Landmark size={14} className="text-sky-400/90"/>, formatOpts: {minimumFractionDigits:2, maximumFractionDigits:2} },
                                { label: 'Tiles', value: attrs.tileCount, icon: <Maximize size={14} className="text-sky-400/90"/> },
                                { label: 'Tier', value: attrs.landfieldTier, icon: <Building size={14} className="text-sky-400/90"/> },
                                { label: 'Class', value: attrs.tileClass !== null && attrs.tileClass !== undefined && String(attrs.tileClass).trim() !== '' ? `Class ${attrs.tileClass}` : 'N/A', icon: <Tag size={14} className="text-sky-400/90"/> },
                                { label: 'Price', value: attrs.forSale ? attrs.price : undefined, isCurrency: true, icon: <Tag size={14} className="text-sky-400/90"/>, formatOpts: {minimumFractionDigits:2, maximumFractionDigits:2} },
                                { label: 'Purchase Value', value: attrs.purchaseValue, isCurrency: true, icon: <Tag size={14} className="text-sky-400/90"/>, formatOpts: {minimumFractionDigits:2, maximumFractionDigits:2} },
                                { label: 'Trading Value', value: attrs.tradingValue, isCurrency: true, icon: <Zap size={14} className="text-sky-400/90"/>, formatOpts: {minimumFractionDigits:3, maximumFractionDigits:3} },
                                { label: 'Essence', value: attrs.claimedEssenceBalance ? parseFloat(String(attrs.claimedEssenceBalance).replace(/,/g, '')).toLocaleString(undefined, {maximumFractionDigits:2}) : '0', icon: <Gem size={14} className="text-sky-400/90"/> },
                            ].map(item => item.value !== undefined && item.value !== null && (
                                <div key={item.label} className="flex items-center space-x-1.5">
                                    {item.icon} <span className="text-sky-400/80">{item.label}:</span> 
                                    <span className="font-medium text-sky-200">{item.isCurrency ? formatCurrency(item.value as number, item.formatOpts) : (typeof item.value === 'number' ? item.value.toLocaleString(undefined, item.formatOpts) : item.value)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 text-xs border-t border-sky-700/30 mt-2">
                            {attrs.forSale && <span className="bg-green-600/30 text-green-200 px-2 py-0.5 rounded-full border border-green-500/50 flex items-center"><CheckCircle size={12} className="mr-1"/> For Sale</span>}
                            {(attrs.hasMentar) && <span className="bg-purple-600/30 text-purple-200 px-2 py-0.5 rounded-full border border-purple-500/50 flex items-center"><Zap size={12} className="mr-1"/> Mentar</span>}
                            {(attrs.hasHolobuilding || attrs.hasHoloBuilding) && <span className="bg-indigo-600/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-500/50 flex items-center"><Building size={12} className="mr-1"/> Holo</span>}
                            {attrs.epl && <span className="bg-yellow-600/30 text-yellow-200 px-2 py-0.5 rounded-full border border-yellow-500/50 truncate max-w-[100px]" title={attrs.epl}><Tag size={12} className="mr-1"/>{attrs.epl}</span>}
                        </div>
                    </CardContent>
                  </Card>
                )}
              )}
            </div>
            {/* --- Pagination --- */}
            {totalFilteredPages>1 && (
              <div className="mt-8 flex justify-center items-center space-x-1 select-none text-sm bg-gray-800/60 backdrop-blur-md px-4 py-2 rounded-lg max-w-fit mx-auto">
                {/* Prev */}
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={propertiesCurrentPage === 1 || dataLoading}
                  onClick={() => setPropertiesCurrentPage(propertiesCurrentPage - 1)}
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  &lt;
                </Button>

                {(() => {
                  const pages:number[] = [];
                  const perPageVal = propertiesMeta!.per_page ?? 12;
                  const total = propertiesMeta!.last_page ?? Math.ceil((propertiesMeta!.count ?? userInfo?.userLandfieldCount ?? 0) / perPageVal);
                  const current = propertiesCurrentPage;
                  if (total <= 7) {
                    for (let i=1;i<=total;i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (current > 3) pages.push(-1); // ellipsis marker
                    const start = Math.max(2, current-1);
                    const end = Math.min(total-1, current+1);
                    for (let i=start; i<=end; i++) pages.push(i);
                    if (current < total-2) pages.push(-1);
                    pages.push(total);
                  }
                  return pages.map((p, idx) => p === -1 ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-sky-400">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant={p===current?"default":"ghost"}
                      disabled={p===current || dataLoading}
                      onClick={() => setPropertiesCurrentPage(p)}
                      className={p===current?"bg-sky-600 text-white px-2 py-1":"text-emerald-400 hover:text-emerald-300 px-2 py-1"}
                    >
                      {p}
                    </Button>
                  ));
                })()}

                {/* Next */}
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={propertiesCurrentPage === totalFilteredPages}
                  onClick={() => setPropertiesCurrentPage(propertiesCurrentPage + 1)}
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  &gt;
                </Button>
              </div>
            )}
        </div>
      )}

      {isAnalyticsLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-sky-300 mt-12">
          <Loader2 className="h-12 w-12 animate-spin text-sky-400 mb-4" />
          <p className="text-xl">Crunching Full Portfolio Analytics...</p>
          <p className="text-sm text-sky-400/70">Fetching all your property data. This might take a few moments.</p>
        </div>
      )}

      {!isAnalyticsLoading && allPropertiesForAnalytics.length > 0 && linkedE2UserId && (
        <div className="mt-12 space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <h2 className="text-3xl font-bold text-sky-200">Full Portfolio Analytics</h2>
            <Button onClick={fetchGlobalMetrics} className="bg-fuchsia-700/70 hover:bg-fuchsia-600 text-white text-sm px-4 py-2 rounded-lg shadow self-start sm:self-auto">
              {isMetricsLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'View Global E2 Metrics'}
            </Button>
          </div>
          
          <Card className="border-emerald-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
              <CardHeader>
                  <CardTitle className="flex items-center text-emerald-300">
                      <Tag className="h-5 w-5 mr-2" /> Tile Class Distribution
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                      Based on your total of {allPropertiesForAnalytics.length.toLocaleString()} properties.
                  </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 items-start">
                  <div>
                      {Object.keys(tileClassCounts).length > 0 ? (
                          <div className="space-y-3">
                              {Object.entries(tileClassCounts)
                                .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
                                .map(([className, data]) => (
                                  <div key={className} className="text-sm">
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-300 font-medium">{className}:</span>
                                      <span className="font-semibold text-white tabular-nums">{data.properties.toLocaleString()} Props</span>
                                    </div>
                                     <div className="flex justify-between items-center pl-4 text-xs">
                                      <span className="text-gray-400"></span> {/* Empty span for alignment */}
                                      <span className="text-gray-400 tabular-nums">({data.tiles.toLocaleString()} Tiles)</span>
                                    </div>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <p className="text-gray-500 text-sm">No property data for tile classes.</p>
                      )}
                  </div>
                  
                  <div className="h-64 md:h-80"> 
                    {tileClassPieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <>
                            <style>{pie3DStyle}</style>
                            <Pie
                              data={tileClassPieData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius="70%"
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
                              formatter={(value: number) => value.toLocaleString()}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <Card className="border-sky-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center text-sky-300">
                  <Landmark className="h-5 w-5 mr-2" /> Full Portfolio Overview
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Financial and key metrics summary of your {allPropertiesForAnalytics.length.toLocaleString()} properties.
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
                    <div className="flex justify-between"><span className="text-gray-300">Properties with Mentars:</span> <span className="font-semibold text-white">{featureCounts.mentars.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Properties with Holos:</span> <span className="font-semibold text-white">{featureCounts.holobuildings.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Featured Properties:</span> <span className="font-semibold text-white">{featureCounts.featured.toLocaleString()}</span></div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-sky-200 mb-1">Essence & Activity</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-gray-300">Total Claimed Essence:</span> <span className="font-semibold text-white">{valueSummary.totalClaimedEssence.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Total Promised Essence:</span> <span className="font-semibold text-white">{valueSummary.totalPromisedEssence.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Active Resource Claims:</span> <span className="font-semibold text-white">{featureCounts.activeClaims.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-300">Tier Upgraded Props:</span> <span className="font-semibold text-white">{featureCounts.tierUpgraded.toLocaleString()}</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {countryChartData.length > 0 && (
              <Card className="border-lime-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-lime-300">
                    <Globe className="h-5 w-5 mr-2" /> Property Distribution by Country
                  </CardTitle>
                  <CardDescription className="text-gray-400">Top 10 countries by tiles across your portfolio.</CardDescription>
                </CardHeader>
                <CardContent className="h-96 md:h-80 lg:h-96"> {/* Increased height for better spacing */}
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <style>{pie3DStyle}</style>
                      <Pie
                        data={countryChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={{ stroke: '#6B7280', strokeWidth: 1 }}
                        outerRadius="65%"
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        stroke="#374151"
                      >
                        {countryChartData.map((entry, index) => (
                          <Cell key={`cell-country-${index}`} fill={BAR_CHART_COLORS[index % BAR_CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        itemStyle={{ color: '#d1d5db' }}
                        formatter={(value: number, name: string) => [
                          `${value.toLocaleString()} tiles`,
                          countryNameMap[name] || name
                        ]}
                      />
                      <Legend 
                        formatter={(value) => countryNameMap[value] || value}
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        wrapperStyle={{
                          paddingLeft: '15px',
                          maxWidth: '40%',
                          fontSize: '0.8rem',
                          lineHeight: '1.2rem'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {tierChartData.length > 0 && (
              <Card className="border-violet-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
                  <CardHeader>
                      <CardTitle className="flex items-center text-violet-300">
                          <Building className="h-5 w-5 mr-2" /> Property Distribution by Tier
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                          From your {allPropertiesForAnalytics.length.toLocaleString()} properties.
                      </CardDescription>
                  </CardHeader>
                  <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <style>{pie3DStyle}</style>
                            <Pie
                                data={tierChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius="70%"
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                stroke="#374151"
                              >
                                {tierChartData.map((entry, index) => (
                                  <Cell key={`cell-tier-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip 
                                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                  itemStyle={{ color: '#d1d5db' }}
                                  formatter={(value, name, props) => {
                                    const originalValue = props.payload.originalValue ?? value;
                                    return [originalValue.toLocaleString(), name];
                                  }}
                              />
                              <Legend 
                                layout={isMobile ? "horizontal" : "vertical"}
                                verticalAlign={isMobile ? "bottom" : "middle"}
                                align={isMobile ? "center" : "right"}
                                wrapperStyle={{
                                  fontSize: '0.8rem',
                                  lineHeight: '1.2rem',
                                  paddingLeft: isMobile ? 0 : '15px',
                                  paddingTop: isMobile ? '10px' : 0,
                                }}
                              />
                          </PieChart>
                      </ResponsiveContainer>
                  </CardContent>
              </Card>
            )}

            {acquisitionTimelineData.length > 0 && (
              <Card className="border-amber-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-amber-300">
                    <Zap className="h-5 w-5 mr-2" /> Property & Tile Acquisition Timeline
                  </CardTitle>
                  <CardDescription className="text-gray-400">Properties and total tiles acquired per year.</CardDescription>
                </CardHeader>
                <CardContent className="h-72 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    {/* Using ComposedChart for potentially different axes later, but using two Bars for now */}
                    <BarChart data={acquisitionTimelineData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}> 
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize="0.75rem" />
                      <YAxis yAxisId="left" width={50} stroke="#F59E0B" orientation="left" allowDecimals={false} tickFormatter={(value) => value.toLocaleString()} fontSize="0.75rem" />
                      <YAxis yAxisId="right" width={60} stroke="#A3E635" orientation="right" allowDecimals={false} tickFormatter={(value) => value.toLocaleString()} fontSize="0.75rem" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        itemStyle={{ color: '#d1d5db' }}
                        cursor={{fill: 'rgba(107, 114, 128, 0.1)'}}
                        formatter={(value: number) => value.toLocaleString()}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="properties" name="Properties" fill="#F59E0B" barSize={20} />
                      <Bar yAxisId="right" dataKey="tiles" name="Tiles" fill="#A3E635" barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {tileCountDistributionData.length > 0 && (
              <Card className="border-rose-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-rose-300">
                    <Maximize className="h-5 w-5 mr-2" /> Tile Count Distribution
                  </CardTitle>
                  <CardDescription className="text-gray-400">Distribution of property sizes by tile count.</CardDescription>
                </CardHeader>
                <CardContent className="h-72 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tileCountDistributionData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize="0.75rem" />
                      <YAxis width={50} stroke="#9ca3af" allowDecimals={false} tickFormatter={(value) => value.toLocaleString()} fontSize="0.75rem" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        itemStyle={{ color: '#d1d5db' }}
                        cursor={{fill: 'rgba(107, 114, 128, 0.1)'}}
                        formatter={(value: number, name, props) => {
                          return [value.toLocaleString(), 'Properties'];
                        }}
                      />
                      <Bar dataKey="count" fill="#FB7185" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {forSaleChartData.length > 0 && (
              <Card className="border-green-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-green-300">
                    <CheckCircle className="h-5 w-5 mr-2" /> For Sale Status
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Properties listed for sale vs. not for sale.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-72 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <style>{pie3DStyle}</style>
                      <Pie
                        data={forSaleChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius="70%"
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        stroke="#374151"
                      >
                        {forSaleChartData.map((entry, index) => (
                          <Cell key={`cell-sale-${index}`} fill={entry.name === 'For Sale' ? '#34D399' : '#F87171'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        itemStyle={{ color: '#d1d5db' }}
                        formatter={(value, name, props) => {
                           const originalValue = props.payload.originalValue ?? value;
                           return [originalValue.toLocaleString(), name];
                        }}
                      />
                      <Legend
                        layout={isMobile ? "horizontal" : "vertical"}
                        verticalAlign={isMobile ? "bottom" : "middle"}
                        align={isMobile ? "center" : "right"}
                        wrapperStyle={{
                          fontSize: '0.8rem',
                          lineHeight: '1.2rem',
                          paddingLeft: isMobile ? 0 : '15px',
                          paddingTop: isMobile ? '10px' : 0,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {eplChartData.length > 0 && (
              <Card className="border-yellow-400/30 bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center text-yellow-300">
                    <Tag className="h-5 w-5 mr-2" /> EPL Usage
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Properties with and without an EPL address.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-72 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <style>{pie3DStyle}</style>
                      <Pie
                        data={eplChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius="70%"
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                        stroke="#374151"
                      >
                        {eplChartData.map((entry, index) => (
                          <Cell key={`cell-epl-${index}`} fill={entry.name === 'With EPL' ? '#FBBF24' : '#60A5FA'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                        itemStyle={{ color: '#d1d5db' }}
                        formatter={(value, name, props) => {
                           const originalValue = props.payload.originalValue ?? value;
                           return [originalValue.toLocaleString(), name];
                        }}
                      />
                      <Legend
                        layout={isMobile ? "horizontal" : "vertical"}
                        verticalAlign={isMobile ? "bottom" : "middle"}
                        align={isMobile ? "center" : "right"}
                        wrapperStyle={{
                          fontSize: '0.8rem',
                          lineHeight: '1.2rem',
                          paddingLeft: isMobile ? 0 : '15px',
                          paddingTop: isMobile ? '10px' : 0,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Global Metrics Modal */}
      <Dialog open={isMetricsOpen} onOpenChange={setIsMetricsOpen}>
        <DialogContent className="max-w-md w-[90vw] bg-gray-900/80 backdrop-blur-md border-sky-400/50 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl text-sky-200">Global Earth2 Metrics</DialogTitle>
          </DialogHeader>
          <div className="mt-4 text-sm max-h-[60vh] overflow-y-auto">
          {globalMetrics ? (
              <ul className="space-y-2">
                {Object.entries(globalMetrics).map(([key, value]) => (
                  <li key={key} className="flex justify-between items-center bg-gray-800/60 p-2 rounded-md">
                    <span className="text-gray-300 capitalize">{key.replace(/_/g, ' ')}:</span>
                    <span className="font-mono text-sky-300 font-semibold">
                      {typeof value === 'number' 
                        ? value.toLocaleString(undefined, { maximumFractionDigits: key.includes('price') ? 4 : 0 }) 
                        : String(value)
                      }
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-center text-gray-400">No global metrics available.</p>}
                            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
