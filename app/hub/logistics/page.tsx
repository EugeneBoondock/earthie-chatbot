'use client';

import { useState, useEffect, useMemo } from 'react';
import { get } from 'idb-keyval';
import { Loader2, AlertCircle, Map, List, Route, ArrowUpDown, Search, Gem, Car, Truck, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

// Define the type locally to avoid module resolution issues
interface RouteSummary {
  totalDistance: number;
  totalTime: number;
}

const LogisticsMap = dynamic(() => import('@/components/LogisticsMap').then(mod => mod.LogisticsMap), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin h-8 w-8 text-cyan-400" /></div>
});

// Match the Property type from Profile page for cache consistency
type Property = {
  id: string;
  type: string; // Added to match profile page structure
  attributes: {
    center: string; // Needed for the map
    description: string;
    country: string;
    tileCount: number;
    landfieldTier: number;
    price: number;
  };
};

// Helper for IndexedDB cache key, same as profile page
const getCacheKey = (userId: string) => `e2_properties_${userId}`;

// Helper to get color for Landfield Tier
const getTierColor = (tier: number) => {
  switch (tier) {
    case 1: return 'text-yellow-400'; // T1 Gold
    case 2: return 'text-gray-300';  // T2 Silver
    case 3: return 'text-orange-400';// T3 Bronze
    default: return 'text-gray-500';
  }
};

export default function LogisticsPage() {
  const [linkedE2UserId, setLinkedE2UserId] = useState<string | null>(null);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<Property[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // --- New state for search, sort, and pagination ---
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'tileCount_desc' | 'tileCount_asc' | 'name_asc' | 'name_desc'>('tileCount_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [transportMode, setTransportMode] = useState<'car' | 'truck' | 'drone'>('car');
  const PROPERTIES_PER_PAGE = 10;

  // 1. Effect to fetch the linked Earth 2 User ID from our app's backend
  useEffect(() => {
    async function fetchLinkedId() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/me/e2profile');
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch linked E2 profile. Please link it on the Profile page.');
        }
        const data = await response.json();
        if (data.e2_user_id) {
          setLinkedE2UserId(data.e2_user_id);
        } else {
          throw new Error('No Earth 2 profile linked. Please visit the Profile page to link your account.');
        }
      } catch (err: any) {
        console.error('Error fetching linked E2 ID:', err);
        setError(err.message);
        setIsLoading(false);
      }
    }
    fetchLinkedId();
  }, []);

  // 2. Effect to fetch properties from cache once we have the user ID
  useEffect(() => {
    if (!linkedE2UserId) return;

    async function fetchPropertiesFromCache() {
      setError(null);
      try {
        const cacheKey = getCacheKey(linkedE2UserId!);
        const cachedData = await get<Property[]>(cacheKey);

        if (cachedData && cachedData.length > 0) {
          setAllProperties(cachedData);
          setLastFetched(new Date());
          console.log(`Loaded ${cachedData.length} properties from IndexedDB cache using key: ${cacheKey}`);
        } else {
          console.log(`No cached data found for key: ${cacheKey}`);
          setError("Could not find property data in cache. Please visit your Profile page first to populate your property list.");
        }
      } catch (err) {
        console.error("Error fetching properties from cache:", err);
        setError("An unexpected error occurred while fetching your properties from the cache.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPropertiesFromCache();
  }, [linkedE2UserId]);

  const handlePropertySelect = (property: Property, isSelected: boolean) => {
    setSelectedProperties(prev => 
      isSelected 
        ? [...prev, property] 
        : prev.filter(p => p.id !== property.id)
    );
    if (!isSelected) {
        setRouteSummary(null);
    }
  };

  useEffect(() => {
    if (selectedProperties.length < 2) {
      setRouteSummary(null);
    }
  }, [selectedProperties]);

  // --- Filtering and Sorting Logic ---
  const filteredAndSortedProperties = useMemo(() => {
    let filtered = allProperties;

    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.attributes.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'tileCount_desc':
          return b.attributes.tileCount - a.attributes.tileCount;
        case 'tileCount_asc':
          return a.attributes.tileCount - b.attributes.tileCount;
        case 'name_asc':
            return a.attributes.description.localeCompare(b.attributes.description);
        case 'name_desc':
            return b.attributes.description.localeCompare(a.attributes.description);
        default:
          return 0;
      }
    });

    return sorted;
  }, [allProperties, searchQuery, sortOption]);
  
  // --- Pagination Logic ---
  const totalPages = Math.ceil(filteredAndSortedProperties.length / PROPERTIES_PER_PAGE);

  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * PROPERTIES_PER_PAGE;
    const end = start + PROPERTIES_PER_PAGE;
    return filteredAndSortedProperties.slice(start, end);
  }, [filteredAndSortedProperties, currentPage]);

  // --- Display Logic (Selected + Paginated) ---
  const displayedProperties = useMemo(() => {
    const selectedIds = new Set(selectedProperties.map(p => p.id));
    const paginatedWithoutSelected = paginatedProperties.filter(p => !selectedIds.has(p.id));
    
    // Show selected properties first, then the rest of the current page
    return [...selectedProperties, ...paginatedWithoutSelected];
  }, [selectedProperties, paginatedProperties]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortOption]);

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters.toFixed(0)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [
        h > 0 ? `${h}h` : '',
        m > 0 ? `${m}m` : '',
        s > 0 ? `${s}s` : ''
    ].filter(Boolean).join(' ');
  }

  // --- Adjusted Route Summary based on Transport Mode ---
  const adjustedRouteSummary = useMemo(() => {
    if (!routeSummary) return null;
    
    const { totalDistance, totalTime } = routeSummary;
    let timeMultiplier = 1;
    
    switch(transportMode) {
        case 'truck': timeMultiplier = 1.3; break;
        case 'drone': timeMultiplier = 0.4; break;
        default: timeMultiplier = 1; break;
    }

    return {
        ...routeSummary,
        totalTime: totalTime * timeMultiplier,
        mode: transportMode,
    };
  }, [routeSummary, transportMode]);

  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-earthie-dark to-gray-900 text-white">
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-green-300 to-cyan-400 inline-block text-transparent bg-clip-text">
          Logistics Planner
        </h1>
        <p className="text-base sm:text-lg text-cyan-200/90 max-w-3xl mt-2">
          Visualize your properties, plan optimal routes, and manage your logistical operations across Earth 2.
        </p>
      </header>
      
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* Left Panel: Controls and Property List */}
        <div className="lg:col-span-4 h-full flex flex-col rounded-lg bg-black/30 p-4 shadow-xl gap-4">
            
            {/* --- HEADER & CONTROLS (fixed) --- */}
            <div className='flex-shrink-0'>
                <div className='flex justify-between items-center'>
                    <h2 className="text-xl font-semibold text-cyan-300 flex items-center"><List className="mr-2 h-5 w-5"/>Properties ({selectedProperties.length} selected)</h2>
                    <p className='text-sm text-gray-400'>{filteredAndSortedProperties.length} found</p>
                </div>

                {adjustedRouteSummary && (
                <Card className="mt-4 bg-gradient-to-br from-gray-800/60 to-gray-900/70 border-cyan-400/30 transition-all duration-300">
                    <CardHeader className='p-4'>
                        <CardTitle className="text-cyan-300 flex items-center text-base"><Route className="mr-2 h-5 w-5"/>Route Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3 p-4 pt-0">
                        <div className='flex justify-between items-baseline'>
                            <p className="font-semibold text-white">Transport Mode</p>
                            <p className="text-lg font-bold text-cyan-300 capitalize">{transportMode}</p>
                        </div>
                        <div className='flex justify-between items-baseline'>
                            <p className="font-semibold text-white">Stops</p>
                            <p className="text-lg font-bold text-cyan-300">{selectedProperties.length}</p>
                        </div>
                        <div className='flex justify-between items-baseline'>
                            <p className="font-semibold text-white">Total Distance</p>
                            <p className="text-lg font-bold text-cyan-300">{formatDistance(adjustedRouteSummary.totalDistance)}</p>
                        </div>
                        <div className='flex justify-between items-baseline'>
                            <p className="font-semibold text-white">Travel Time</p>
                            <p className="text-lg font-bold text-cyan-300">{formatTime(adjustedRouteSummary.totalTime)}</p>
                        </div>
                    </CardContent>
                </Card>
                )}
            </div>

            {isLoading && <div className="flex-grow flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-cyan-400" /></div>}
            {error && <div className="flex-grow flex items-center justify-center text-red-400 p-4 bg-red-900/20 rounded-md"><AlertCircle className="inline-block mr-2"/>{error}</div>}
           
            {!isLoading && !error && (
            <div className="flex flex-col flex-grow min-h-0 gap-4">
                {/* --- CONTROLS (Search, Sort, Transport) --- */}
                 <div className="flex flex-col gap-4">
                    <div className="flex gap-2 items-center">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder="Search properties..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-gray-800/60 border-cyan-400/30 focus:border-cyan-400"
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="shrink-0 bg-gray-800/60 border-cyan-400/30 hover:bg-gray-800/90">
                                    <ArrowUpDown className="mr-2 h-4 w-4" /> Sort
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className='bg-gray-900 text-white border-gray-700'>
                                <DropdownMenuItem onSelect={() => setSortOption('tileCount_desc')} className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>
                                    Tile Count (High to Low)
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setSortOption('tileCount_asc')} className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>
                                    Tile Count (Low to High)
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setSortOption('name_asc')} className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>
                                    Name (A-Z)
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setSortOption('name_desc')} className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>
                                    Name (Z-A)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <ToggleGroup 
                        type="single" 
                        value={transportMode} 
                        onValueChange={(value: 'car' | 'truck' | 'drone') => {
                            if (value) setTransportMode(value);
                        }}
                        className="w-full"
                    >
                        <ToggleGroupItem value="car" aria-label="Car" className="flex-grow">
                            <Car className="h-4 w-4 mr-2" /> Car
                        </ToggleGroupItem>
                        <ToggleGroupItem value="truck" aria-label="Truck" className="flex-grow">
                            <Truck className="h-4 w-4 mr-2" /> Truck
                        </ToggleGroupItem>
                        <ToggleGroupItem value="drone" aria-label="Drone" className="flex-grow">
                            <Zap className="h-4 w-4 mr-2" /> Drone
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
                
                {/* --- SCROLLABLE LIST --- */}
                <div className="flex-grow overflow-y-auto pr-3 -mr-3">
                    <div className="space-y-2">
                        {displayedProperties.map(prop => {
                        const isSelected = selectedProperties.some(p => p.id === prop.id);
                        return (
                        <div key={prop.id} className={`flex items-center space-x-3 p-3 rounded-md text-sm transition-all ${isSelected ? 'bg-cyan-900/50 ring-2 ring-cyan-500' : 'bg-gray-800/60 hover:bg-gray-800/90'}`}>
                            <Checkbox
                                id={`prop-${prop.id}`}
                                onCheckedChange={(checked) => handlePropertySelect(prop, !!checked)}
                                checked={isSelected}
                            />
                            <div className="flex-grow cursor-pointer" onClick={() => handlePropertySelect(prop, !isSelected)}>
                                <p className="font-semibold text-white flex items-center">
                                    <Gem className={`mr-2 h-4 w-4 ${getTierColor(prop.attributes.landfieldTier)}`} />
                                    {prop.attributes.description}
                                </p>
                                <p className="text-gray-400 pl-6">{prop.attributes.country} - {prop.attributes.tileCount} tiles</p>
                            </div>
                        </div>
                        )})}
                        {displayedProperties.length === 0 && (
                            <div className="text-center py-10 text-gray-500">
                                <p>No properties match your search.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- PAGINATION (fixed) --- */}
                {totalPages > 1 && (
                    <div className="flex-shrink-0 pt-2">
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p-1))}} className={currentPage === 1 ? 'pointer-events-none opacity-50' : undefined} />
                                </PaginationItem>
                                
                                {Array.from({length: totalPages > 5 ? 5 : totalPages}, (_, i) => {
                                    let pageNum = i + 1;
                                    if(totalPages > 5 && currentPage > 3) {
                                        const startPage = currentPage - 2;
                                        pageNum = startPage + i;
                                        if (pageNum > totalPages) return null;
                                    }

                                    return (
                                    <PaginationItem key={i}>
                                        <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(pageNum)}} isActive={currentPage === pageNum}>
                                        {pageNum}
                                        </PaginationLink>
                                    </PaginationItem>
                                    )
                                })}
                                
                                {totalPages > 5 && currentPage < totalPages - 2 && <PaginationEllipsis />}

                                <PaginationItem>
                                    <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p+1))}} className={currentPage === totalPages ? 'pointer-events-none opacity-50' : undefined}/>
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                )}
            </div>
           )}
        </div>

        {/* Right Panel: Interactive Map */}
        <div className="lg:col-span-8 h-full rounded-lg bg-black/30 shadow-xl flex items-center justify-center">
          <LogisticsMap 
            properties={allProperties} 
            selectedProperties={selectedProperties}
            onRouteSummary={setRouteSummary as (summary: any) => void}
          />
        </div>
      </div>
    </div>
  );
} 