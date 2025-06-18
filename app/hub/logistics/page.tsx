'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { get as idbGet } from 'idb-keyval';
import { 
  Loader2, AlertCircle, Map, List, Route, ArrowUpDown, Search, Gem, Car, Truck, Zap,
  Anchor, Factory, Home, TreePine, Mountain, Waves, Building, MapPin, Copy, ExternalLink,
  Package, Clock, Fuel, Calculator, TrendingUp, Compass, Navigation, Gauge,
  Ship, Plane, Train, RefreshCw, Eye, EyeOff, Settings, Info, Star, Award, PersonStanding
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
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
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"

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
  type: string;
  attributes: {
    center: string; // Needed for the map
    description: string;
    country: string;
    tileCount: number;
    landfieldTier: number;
    price: number;
  };
};

// Enhanced property types for logistics
type PropertyRole = 'port' | 'factory' | 'residential' | 'warehouse' | 'mining' | 'agricultural' | 'commercial' | 'strategic';

interface EnhancedProperty extends Property {
  logisticsRole?: PropertyRole;
  isCoastal?: boolean;
  resourcePotential?: string[];
  proximityScore?: number;
}

// Helper for IndexedDB cache key, same as profile page
const getCacheKey = (userId: string) => `e2_properties_${userId}`;

const getTierColor = (tier: number) => {
  switch (tier) {
    case 1: return 'text-amber-400 border-amber-400/50'; // Gold
    case 2: return 'text-slate-300 border-slate-300/50'; // Silver
    case 3: return 'text-orange-400 border-orange-400/50'; // Bronze
    default: return 'text-gray-400 border-gray-400/50';
  }
};

const getTierName = (tier: number) => {
  switch (tier) {
    case 1: return 'Tier 1';
    case 2: return 'Tier 2';
    case 3: return 'Tier 3';
    default: return 'Unknown Tier';
  }
};

const parseCoordinates = (center: string): { lat: number; lng: number } | null => {
  if (!center) return null;
  try {
      const match = center.match(/\(([^,]+),\s*([^)]+)\)/);
      if (match) {
          // E2 provides (lng, lat) but leaflet expects (lat, lng)
          const lat = parseFloat(match[2]); 
          const lng = parseFloat(match[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
              return { lat, lng };
          }
      }
  } catch (e) {
      console.error("Error parsing coordinates:", center, e);
  }
  return null;
}

const formatPrice = (price: number) => {
  if (typeof price !== 'number' || !isFinite(price)) {
    price = 0;
  }
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${(price / 1000).toFixed(1)}K`;
  return `$${price.toFixed(2)}`;
};

// Helper to determine property logistics role based on description and location
const determineLogisticsRole = (property: Property): PropertyRole => {
  const desc = property.attributes.description.toLowerCase();
  const country = property.attributes.country.toLowerCase();
  
  // Check if coastal (basic heuristic)
  const coastalKeywords = ['beach', 'coast', 'port', 'harbor', 'bay', 'sea', 'ocean', 'marina'];
  const isCoastal = coastalKeywords.some(keyword => desc.includes(keyword));
  
  if (isCoastal) return 'port';
  if (desc.includes('city') || desc.includes('downtown') || desc.includes('commercial')) return 'commercial';
  if (desc.includes('industrial') || desc.includes('factory')) return 'factory';
  if (desc.includes('mine') || desc.includes('quarry')) return 'mining';
  if (desc.includes('farm') || desc.includes('rural') || desc.includes('agricultural')) return 'agricultural';
  if (desc.includes('residential') || desc.includes('suburb')) return 'residential';
  if (property.attributes.tileCount > 1000) return 'warehouse'; // Large properties for storage
  
  return 'strategic'; // Default
};

// Helper to get property role icon and color
const getPropertyRoleInfo = (role: PropertyRole) => {
  switch (role) {
    case 'port':
      return { icon: Anchor, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Port' };
    case 'factory':
      return { icon: Factory, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Factory' };
    case 'residential':
      return { icon: Home, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Residential' };
    case 'agricultural':
      return { icon: TreePine, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Agricultural' };
    case 'mining':
      return { icon: Mountain, color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Mining' };
    case 'warehouse':
      return { icon: Package, color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Warehouse' };
    case 'commercial':
      return { icon: Building, color: 'text-cyan-400', bg: 'bg-cyan-400/10', label: 'Commercial' };
    default:
      return { icon: MapPin, color: 'text-gray-400', bg: 'bg-gray-400/10', label: 'Strategic' };
  }
};

// Helper to generate Earth2 URL
const generateEarth2URL = (lat: number, lng: number) => {
  return `https://app.earth2.io/?lat=${lat}&lng=${lng}#`;
};

// Helper to copy to clipboard
const copyToClipboard = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
      duration: 2000,
    });
  } catch (err) {
    toast({
      title: "Copy failed",
      description: "Could not copy to clipboard",
      variant: "destructive",
      duration: 2000,
    });
  }
};

interface PropertyListItemProps {
  prop: Property;
  isSelected: boolean;
  compactView: boolean;
  enhanced: EnhancedProperty | undefined;
  onSelect: (property: Property, isSelected: boolean) => void;
  onCopyCoords: (e: React.MouseEvent, lat: number, lng: number) => void;
  onViewOnE2: (e: React.MouseEvent, lat: number, lng: number) => void;
}

const PropertyListItem = React.memo(({
  prop,
  isSelected,
  compactView,
  enhanced,
  onSelect,
  onCopyCoords,
  onViewOnE2
}: PropertyListItemProps) => {
  const roleInfo = enhanced?.logisticsRole ? getPropertyRoleInfo(enhanced.logisticsRole) : null;
  const coords = parseCoordinates(prop.attributes.center);
  const RoleIcon = roleInfo?.icon || MapPin;

  const handleSelectClick = () => onSelect(prop, !isSelected);
  const handleCheckedChange = (checked: boolean) => onSelect(prop, !!checked);

  return (
    <div
      className={`flex items-center space-x-2 md:space-x-3 p-2 md:p-3 rounded-lg text-xs md:text-sm transition-all duration-200 cursor-pointer border backdrop-blur-sm property-item
        ${isSelected
          ? 'bg-cyan-900/50 ring-2 ring-cyan-500 border-cyan-400/50 selected'
          : 'bg-gray-800/60 hover:bg-gray-800/90 border-gray-600/30 hover:border-gray-500/50'
        }`}
      onClick={handleSelectClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify(prop));
      }}
    >
      <Checkbox
        id={`prop-${prop.id}`}
        onCheckedChange={handleCheckedChange}
        checked={isSelected}
        onClick={(e) => e.stopPropagation()}
      />

      <div className="flex-grow min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="font-semibold text-white flex items-center truncate">
            <RoleIcon className={`mr-2 h-4 w-4 ${roleInfo?.color || 'text-gray-400'}`} />
            <span className="truncate">{prop.attributes.description}</span>
          </p>

          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            {/* Tier Badge */}
            <Tooltip>
              <TooltipTrigger>
                <Badge
                  variant="outline"
                  className={`text-xs px-1 py-0 ${getTierColor(prop.attributes.landfieldTier)} border-current`}
                >
                  T{prop.attributes.landfieldTier}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{getTierName(prop.attributes.landfieldTier)}</TooltipContent>
            </Tooltip>

            {/* Coastal Badge */}
            {enhanced?.isCoastal && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs px-1 py-0 text-blue-400 border-blue-400">
                    <Waves className="h-3 w-3" />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Coastal Property</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-gray-400 text-xs">
          <span className="truncate">{prop.attributes.country} • {prop.attributes.tileCount.toLocaleString()} tiles</span>
          {prop.attributes.price > 0 && (
            <span className="text-green-400 font-medium ml-2">
              {formatPrice(prop.attributes.price)}
            </span>
          )}
        </div>

        {!compactView && roleInfo && (
          <div className="mt-2 flex items-center justify-between">
            <Badge variant="outline" className={`text-xs ${roleInfo.bg} ${roleInfo.color} border-current`}>
              {roleInfo.label}
            </Badge>

            <div className="flex items-center gap-1">
              {coords && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-cyan-400/20"
                        onClick={(e) => onCopyCoords(e, coords.lat, coords.lng)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy Coordinates</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-green-400/20"
                        onClick={(e) => onViewOnE2(e, coords.lat, coords.lng)}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View in Earth2</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
PropertyListItem.displayName = 'PropertyListItem';

export default function LogisticsPage() {
  const [linkedE2UserId, setLinkedE2UserId] = useState<string | null>(null);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [enhancedProperties, setEnhancedProperties] = useState<EnhancedProperty[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<Property[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Enhanced state for new features
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'tileCount_desc' | 'tileCount_asc' | 'name_asc' | 'name_desc' | 'tier_asc' | 'price_desc'>('tileCount_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [transportMode, setTransportMode] = useState<'walking' | 'car' | 'truck' | 'drone' | 'ship' | 'plane'>('car');
  const [filterRole, setFilterRole] = useState<PropertyRole | 'all'>('all');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [compactView, setCompactView] = useState(false);
  
  // Memoize properties per page to prevent infinite re-renders
  const PROPERTIES_PER_PAGE = useMemo(() => compactView ? 15 : 10, [compactView]);

  // Logistics calculations
  const logisticsAnalytics = useMemo(() => {
    if (selectedProperties.length === 0) return null;
    
    const totalValue = selectedProperties.reduce((sum, p) => sum + (p.attributes.price || 0), 0);
    const totalTiles = selectedProperties.reduce((sum, p) => sum + p.attributes.tileCount, 0);
    const avgTileCount = totalTiles / selectedProperties.length;
    
    const roleDistribution: Record<PropertyRole, number> = {
      port: 0, factory: 0, residential: 0, warehouse: 0, 
      mining: 0, agricultural: 0, commercial: 0, strategic: 0
    };
    
    selectedProperties.forEach(p => {
      const enhanced = enhancedProperties.find(ep => ep.id === p.id);
      if (enhanced?.logisticsRole) {
        roleDistribution[enhanced.logisticsRole]++;
      }
    });
    
    return {
      totalValue,
      totalTiles,
      avgTileCount,
      roleDistribution,
      diversityScore: Object.values(roleDistribution).filter(count => count > 0).length,
    };
  }, [selectedProperties, enhancedProperties]);

  // 1. Effect to fetch the linked Earth 2 User ID from our app's backend
  useEffect(() => {
    let isCancelled = false;
    
    async function fetchLinkedId() {
      if (linkedE2UserId) {
        console.log(`[Logistics] Already have linkedE2UserId: ${linkedE2UserId}`);
        return; // Don't fetch if we already have it
      }
      
      console.log(`[Logistics] Fetching linked E2 user ID...`);
      setIsLoading(true);
      try {
        const response = await fetch('/api/me/e2profile');
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch linked E2 profile. Please link it on the Profile page.');
        }
        const data = await response.json();
        
        if (isCancelled) return;
        
        if (data.e2_user_id) {
          console.log(`[Logistics] Successfully fetched linked E2 user ID: ${data.e2_user_id}`);
          setLinkedE2UserId(data.e2_user_id);
        } else {
          throw new Error('No Earth 2 profile linked. Please visit the Profile page to link your account.');
        }
      } catch (err: any) {
        console.error('Error fetching linked E2 ID:', err);
        if (!isCancelled) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    }
    fetchLinkedId();
    
    return () => {
      isCancelled = true;
    };
  }, []); // Remove linkedE2UserId from dependencies to prevent loops

  // 2. Effect to fetch properties from cache and enhance them
  useEffect(() => {
    if (!linkedE2UserId) return;
    
    // Prevent multiple simultaneous fetches
    let isCancelled = false;

    async function fetchPropertiesFromCache() {
      setIsLoading(true);
      setError(null);
      try {
        const cacheKey = getCacheKey(linkedE2UserId!);
        console.log(`[Logistics] Attempting to fetch cached data with key: ${cacheKey}`);
        const cachedData = await idbGet(cacheKey);
        console.log(`[Logistics] Cached data retrieved:`, cachedData ? `${cachedData.length} items` : 'null/undefined');

        // Check if effect was cancelled
        if (isCancelled) return;

        if (cachedData && cachedData.length > 0) {
          // Transform the cached E2Property data to our Property format
          const transformedProperties: Property[] = cachedData.map((e2Property: any) => ({
            id: e2Property.id,
            type: e2Property.type,
            attributes: {
              center: e2Property.attributes.center || '',
              description: e2Property.attributes.description || '',
              country: e2Property.attributes.country || '',
              tileCount: e2Property.attributes.tileCount || 0,
              landfieldTier: e2Property.attributes.landfieldTier || 1,
              price: Number(e2Property.attributes.currentValue || e2Property.attributes.price) || 0,
            }
          }));

          setAllProperties(transformedProperties);
          
          // Enhance properties with logistics information
          const enhanced = transformedProperties.map(property => {
            const role = determineLogisticsRole(property);
            const coords = parseCoordinates(property.attributes.center);
            const isCoastal = role === 'port';
            
            return {
              ...property,
              logisticsRole: role,
              isCoastal,
              resourcePotential: isCoastal ? ['Trade', 'Shipping'] : 
                               role === 'mining' ? ['Resources', 'Raw Materials'] :
                               role === 'agricultural' ? ['Food', 'Biomass'] :
                               ['General Cargo'],
              proximityScore: Math.random() * 100, // Placeholder for actual proximity calculation
            } as EnhancedProperty;
          });
          
          setEnhancedProperties(enhanced);
          setLastFetched(new Date());
          console.log(`Loaded ${transformedProperties.length} properties from IndexedDB cache using key: ${cacheKey}`);
        } else {
          console.log(`[Logistics] No cached data found for key: ${cacheKey}`);
          setError("Could not find property data in cache. Please visit your Profile page first to populate your property list.");
        }
      } catch (err) {
        console.error("Error fetching properties from cache:", err);
        setError("An unexpected error occurred while fetching your properties from the cache.");
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchPropertiesFromCache();
    
    // Cleanup function
    return () => {
      isCancelled = true;
    };
  }, [linkedE2UserId]);

  const handlePropertySelect = useCallback((property: Property, isSelected: boolean) => {
    setSelectedProperties(prev => 
      isSelected 
        ? [...prev, property] 
        : prev.filter(p => p.id !== property.id)
    );
    if (!isSelected) {
        setRouteSummary(null);
    }
  }, []);

  const handleRouteSummary = (summary: RouteSummary | null) => {
    setRouteSummary(currentSummary => {
      if (currentSummary && summary && 
          currentSummary.totalDistance === summary.totalDistance && 
          currentSummary.totalTime === summary.totalTime) {
        return currentSummary;
      }
      return summary;
    });
  };

  const handleTransportModeChange = useCallback((value: string) => {
    if (value) {
      setTransportMode(value as typeof transportMode);
    }
  }, []);

  useEffect(() => {
    if (selectedProperties.length < 2) {
      setRouteSummary(null);
    }
  }, [selectedProperties]);

  // Enhanced filtering and sorting logic
  const filteredAndSortedProperties = useMemo(() => {
    let filtered = enhancedProperties;

    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.attributes.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.attributes.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.logisticsRole && getPropertyRoleInfo(p.logisticsRole).label.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter(p => p.logisticsRole === filterRole);
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
        case 'tier_asc':
          return a.attributes.landfieldTier - b.attributes.landfieldTier;
        case 'price_desc':
          return (b.attributes.price || 0) - (a.attributes.price || 0);
        default:
          return 0;
      }
    });

    return sorted;
  }, [enhancedProperties, searchQuery, sortOption, filterRole]);
  
  // Pagination logic - stabilize with useMemo
  const totalPages = useMemo(() => 
    Math.ceil(filteredAndSortedProperties.length / PROPERTIES_PER_PAGE),
    [filteredAndSortedProperties.length, PROPERTIES_PER_PAGE]
  );

  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * PROPERTIES_PER_PAGE;
    const end = start + PROPERTIES_PER_PAGE;
    return filteredAndSortedProperties.slice(start, end);
  }, [filteredAndSortedProperties, currentPage, PROPERTIES_PER_PAGE]);

  // Display logic (Selected + Paginated)
  const displayedProperties = useMemo(() => {
    const selectedIds = new Set(selectedProperties.map(p => p.id));
    const paginatedWithoutSelected = paginatedProperties.filter(p => !selectedIds.has(p.id));
    
    return [...selectedProperties, ...paginatedWithoutSelected];
  }, [selectedProperties, paginatedProperties]);
  
  // Reset page when filters change - use useCallback to stabilize
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortOption, filterRole]);

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

  // Get transport mode details
  const getTransportModeDetails = (mode: typeof transportMode) => {
    const baseSpeedKmh = 50; // Base car speed in km/h
    
    switch(mode) {
        case 'walking': 
          return { 
            speedKmh: 5, 
            timeMultiplier: 10, 
            icon: PersonStanding,
            label: 'Walking'
          };
        case 'car': 
          return { 
            speedKmh: 50, 
            timeMultiplier: 1, 
            icon: Car,
            label: 'Car'
          };
        case 'truck': 
          return { 
            speedKmh: 40, 
            timeMultiplier: 1.25, 
            icon: Truck,
            label: 'Truck'
          };
        case 'drone': 
          return { 
            speedKmh: 120, 
            timeMultiplier: 0.42, 
            icon: Zap,
            label: 'Drone'
          };
        case 'ship':
          return { 
            speedKmh: 25, 
            timeMultiplier: 2.0, 
            icon: Ship,
            label: 'Ship'
          };
        case 'plane':
          return { 
            speedKmh: 250, 
            timeMultiplier: 0.2, 
            icon: Plane,
            label: 'Plane'
          };
        default: 
          return { 
            speedKmh: 50, 
            timeMultiplier: 1, 
            icon: Car,
            label: 'Car'
          };
    }
  };

  // Adjusted Route Summary based on Transport Mode
  const adjustedRouteSummary = useMemo(() => {
    if (!routeSummary) return null;
    
    const { totalDistance, totalTime } = routeSummary;
    const modeDetails = getTransportModeDetails(transportMode);

    return {
        ...routeSummary,
        totalTime: totalTime * modeDetails.timeMultiplier,
        speedKmh: modeDetails.speedKmh,
        mode: transportMode,
        modeLabel: modeDetails.label,
        modeIcon: modeDetails.icon,
    };
  }, [routeSummary, transportMode]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage(p => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const handlePrevPage = useCallback(() => {
    setCurrentPage(p => Math.max(1, p - 1));
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleSortChange = useCallback((option: typeof sortOption) => {
    setSortOption(option);
  }, []);
  
  const handleFilterChange = useCallback((role: PropertyRole | 'all') => {
    setFilterRole(role);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedProperties([]);
    setRouteSummary(null);
  }, []);

  const toggleAnalytics = useCallback(() => setShowAnalytics(v => !v), []);
  const toggleCompactView = useCallback(() => setCompactView(v => !v), []);

  const handleCopyCoords = useCallback((e: React.MouseEvent, lat: number, lng: number) => {
    e.stopPropagation();
    copyToClipboard(`${lat}, ${lng}`, "Coordinates");
  }, []);

  const handleViewOnE2 = useCallback((e: React.MouseEvent, lat: number, lng: number) => {
    e.stopPropagation();
    window.open(generateEarth2URL(lat, lng), '_blank');
  }, []);

  return (
    <TooltipProvider>
      <div className="h-full w-full flex flex-col p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-gray-900/95 via-slate-900/90 to-black/95 text-white backdrop-blur-sm">
        {/* Translucent Header */}
        <header className="mb-3 md:mb-6 backdrop-blur-md bg-black/20 rounded-xl p-3 md:p-6 border border-cyan-400/20">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
            <div className="flex-grow">
              <h1 className="text-xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-green-300 via-cyan-400 to-blue-400 inline-block text-transparent bg-clip-text">
                Logistics Command Center
              </h1>
              <p className="text-sm md:text-base lg:text-lg text-cyan-200/90 max-w-3xl mt-1 md:mt-2">
                Advanced logistics planning for Earth 2 operations. Plan routes, analyze properties, and optimize your supply chain.
              </p>
            </div>
            <div className="flex gap-2 self-start md:self-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleAnalytics}
                    className="bg-black/40 border-cyan-400/30 hover:bg-cyan-400/10 h-8 w-8 md:h-10 md:w-10"
                  >
                    <Calculator className="h-3 w-3 md:h-4 md:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Analytics</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleCompactView}
                    className="bg-black/40 border-cyan-400/30 hover:bg-cyan-400/10 h-8 w-8 md:h-10 md:w-10"
                  >
                    {compactView ? <Eye className="h-3 w-3 md:h-4 md:w-4" /> : <EyeOff className="h-3 w-3 md:h-4 md:w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Compact View</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>
        
        <div className="flex-grow grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 min-h-0">
          {/* Enhanced Left Panel */}
          <div className="xl:col-span-4 h-full flex flex-col rounded-xl bg-black/30 backdrop-blur-md p-3 md:p-4 shadow-2xl gap-3 md:gap-4 border border-cyan-400/20">
              
            {/* Header & Controls */}
                          <div className='flex-shrink-0 space-y-3 md:space-y-4'>
                <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2'>
                  <h2 className="text-lg md:text-xl font-semibold text-cyan-300 flex items-center">
                    <List className="mr-2 h-4 w-4 md:h-5 md:w-5"/>
                    Properties 
                    <Badge variant="secondary" className="ml-2 bg-cyan-400/20 text-cyan-300 text-xs">
                      {selectedProperties.length} selected
                    </Badge>
                  </h2>
                  <p className='text-xs md:text-sm text-gray-400'>{filteredAndSortedProperties.length} found</p>
                </div>

              {/* Enhanced Route Summary */}
              {adjustedRouteSummary && (
              <Card className="bg-gradient-to-br from-gray-800/60 via-gray-900/70 to-black/60 border-cyan-400/30 transition-all duration-300 backdrop-blur-sm">
                <CardHeader className='p-4'>
                  <CardTitle className="text-cyan-300 flex items-center text-base">
                    <Route className="mr-2 h-5 w-5"/>
                    Mission Brief
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3 p-4 pt-0">
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='flex flex-col'>
                      <p className="font-semibold text-white">Transport</p>
                      <p className="text-lg font-bold text-cyan-300 capitalize flex items-center">
                        {React.createElement(adjustedRouteSummary.modeIcon, { className: "mr-1 h-4 w-4" })}
                        {adjustedRouteSummary.modeLabel}
                      </p>
                    </div>
                    <div className='flex flex-col'>
                      <p className="font-semibold text-white">Stops</p>
                      <p className="text-lg font-bold text-cyan-300">{selectedProperties.length}</p>
                    </div>
                    <div className='flex flex-col'>
                      <p className="font-semibold text-white">Distance</p>
                      <p className="text-lg font-bold text-cyan-300">{formatDistance(adjustedRouteSummary.totalDistance)}</p>
                    </div>
                    <div className='flex flex-col'>
                      <p className="font-semibold text-white">Time</p>
                      <p className="text-lg font-bold text-cyan-300">{formatTime(adjustedRouteSummary.totalTime)}</p>
                    </div>
                  </div>
                  <div className='pt-2 border-t border-cyan-400/20'>
                    <div className='flex justify-between items-center'>
                      <p className="font-semibold text-white flex items-center">
                        <Gauge className="mr-1 h-4 w-4" />
                        Avg. Speed
                      </p>
                      <p className="text-lg font-bold text-blue-400">{adjustedRouteSummary.speedKmh} km/h</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}

                             {/* Analytics Panel */}
               {showAnalytics && (
               <Card className="bg-gradient-to-br from-purple-900/30 via-blue-900/30 to-black/60 border-purple-400/30 backdrop-blur-sm">
                 <CardHeader className='p-4'>
                   <CardTitle className="text-purple-300 flex items-center text-base">
                     <TrendingUp className="mr-2 h-5 w-5"/>
                     Transport Analytics
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="text-xs md:text-sm space-y-3 md:space-y-4 p-3 md:p-4 pt-0">
                   {/* Transport Mode Details */}
                   <div>
                                           <h4 className="text-sm md:text-base text-white font-semibold mb-2 md:mb-3 flex items-center">
                        <Gauge className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                        Current Transport Mode
                      </h4>
                      <div className='grid grid-cols-2 gap-2 md:gap-3'>
                       {(() => {
                         const modeDetails = getTransportModeDetails(transportMode);
                         return (
                           <>
                             <div>
                               <p className="text-gray-300 text-xs">Mode</p>
                               <p className="text-sm md:text-lg font-bold text-cyan-300 flex items-center">
                                 {React.createElement(modeDetails.icon, { className: "mr-1 h-3 w-3 md:h-4 md:w-4" })}
                                 <span className="truncate">{modeDetails.label}</span>
                               </p>
                             </div>
                             <div>
                               <p className="text-gray-300 text-xs">Speed</p>
                               <p className="text-sm md:text-lg font-bold text-blue-300">{modeDetails.speedKmh} km/h</p>
                             </div>
                             <div>
                               <p className="text-gray-300 text-xs">Time Factor</p>
                               <p className="text-sm md:text-lg font-bold text-yellow-300">{modeDetails.timeMultiplier}x</p>
                             </div>
                             <div>
                               <p className="text-gray-300 text-xs">Efficiency</p>
                               <p className="text-sm md:text-lg font-bold text-green-300">
                                 {modeDetails.speedKmh >= 100 ? 'High' : 
                                  modeDetails.speedKmh >= 25 ? 'Medium' : 'Low'}
                               </p>
                             </div>
                           </>
                         );
                       })()}
                     </div>
                   </div>

                   {/* Route Analytics - only show if route exists */}
                   {adjustedRouteSummary && (
                     <div className="pt-3 border-t border-purple-400/20">
                       <h4 className="text-sm md:text-base text-white font-semibold mb-2 md:mb-3 flex items-center">
                         <Route className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                         Route Performance
                       </h4>
                       <div className='grid grid-cols-2 gap-2 md:gap-3'>
                         <div>
                           <p className="text-gray-300 text-xs">Travel Time</p>
                           <p className="text-sm md:text-lg font-bold text-cyan-300">{formatTime(adjustedRouteSummary.totalTime)}</p>
                         </div>
                         <div>
                           <p className="text-gray-300 text-xs">Distance</p>
                           <p className="text-sm md:text-lg font-bold text-blue-300">{formatDistance(adjustedRouteSummary.totalDistance)}</p>
                         </div>
                         <div>
                           <p className="text-gray-300 text-xs">Waypoints</p>
                           <p className="text-sm md:text-lg font-bold text-purple-300">{selectedProperties.length}</p>
                         </div>
                         <div>
                           <p className="text-gray-300 text-xs">Avg Speed</p>
                           <p className="text-sm md:text-lg font-bold text-green-300">{adjustedRouteSummary.speedKmh} km/h</p>
                         </div>
                       </div>
                     </div>
                   )}

                   {/* Portfolio Analytics - only show if properties selected */}
                   {logisticsAnalytics && (
                     <div className="pt-3 border-t border-purple-400/20">
                       <h4 className="text-sm md:text-base text-white font-semibold mb-2 md:mb-3 flex items-center">
                         <TrendingUp className="mr-2 h-3 w-3 md:h-4 md:w-4" />
                         Portfolio Overview
                       </h4>
                       <div className='grid grid-cols-2 gap-2 md:gap-3'>
                         <div>
                           <p className="text-gray-300 text-xs">Total Value</p>
                           <p className="text-sm md:text-lg font-bold text-green-400">{formatPrice(logisticsAnalytics.totalValue)}</p>
                         </div>
                         <div>
                           <p className="text-gray-300 text-xs">Total Tiles</p>
                           <p className="text-sm md:text-lg font-bold text-cyan-300">{logisticsAnalytics.totalTiles.toLocaleString()}</p>
                         </div>
                         <div>
                           <p className="text-gray-300 text-xs">Avg. Size</p>
                           <p className="text-sm md:text-lg font-bold text-blue-300">{Math.round(logisticsAnalytics.avgTileCount)}</p>
                         </div>
                         <div>
                           <p className="text-gray-300 text-xs">Diversity</p>
                           <p className="text-sm md:text-lg font-bold text-purple-300">{logisticsAnalytics.diversityScore}/8</p>
                         </div>
                       </div>
                     </div>
                   )}
                 </CardContent>
               </Card>
               )}
            </div>

            {isLoading && <div className="flex-grow flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-cyan-400" /></div>}
            {error && <div className="flex-grow flex items-center justify-center text-red-400 p-4 bg-red-900/20 rounded-md backdrop-blur-sm"><AlertCircle className="inline-block mr-2"/>{error}</div>}
           
            {!isLoading && !error && (
            <div className="flex flex-col flex-grow min-h-0 gap-4">
                               {/* Enhanced Controls */}
                 <div className="flex flex-col gap-3 md:gap-4">
                   {/* Search and Filter Row */}
                   <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search properties, countries, roles..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                      className="pl-10 bg-gray-800/60 backdrop-blur-sm border-cyan-400/30 focus:border-cyan-400"
                    />
                  </div>
                  
                                     <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                       <Button variant="outline" className="sm:shrink-0 bg-gray-800/60 backdrop-blur-sm border-cyan-400/30 hover:bg-gray-800/90 w-full sm:w-auto">
                         <ArrowUpDown className="mr-2 h-4 w-4" /> Sort
                       </Button>
                     </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className='bg-gray-900/95 backdrop-blur-md text-white border-gray-700'>
                      <DropdownMenuItem onSelect={() => handleSortChange('tileCount_desc')} className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>
                        Tile Count (High → Low)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleSortChange('tileCount_asc')} className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>
                        Tile Count (Low → High)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleSortChange('price_desc')} className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>
                        Value (High → Low)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleSortChange('tier_asc')} className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>
                        Tier (1 → 3)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleSortChange('name_asc')} className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>
                        Name (A → Z)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => handleSortChange('name_desc')} className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>
                        Name (Z → A)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                                 {/* Role Filter */}
                 <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                   <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                       <Button variant="outline" className="bg-gray-800/60 backdrop-blur-sm border-cyan-400/30 hover:bg-gray-800/90 w-full sm:w-auto justify-start">
                         <MapPin className="mr-2 h-4 w-4" />
                         <span className="truncate">{filterRole === 'all' ? 'All Roles' : getPropertyRoleInfo(filterRole as PropertyRole).label}</span>
                       </Button>
                     </DropdownMenuTrigger>
                    <DropdownMenuContent className='bg-gray-900/95 backdrop-blur-md text-white border-gray-700'>
                      <DropdownMenuItem onSelect={() => handleFilterChange('all')} className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>
                        All Property Roles
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {Object.keys(getPropertyRoleInfo('port')).length && 
                        (['port', 'factory', 'warehouse', 'commercial', 'mining', 'agricultural', 'residential', 'strategic'] as PropertyRole[]).map(role => {
                          const info = getPropertyRoleInfo(role);
                          const Icon = info.icon;
                          return (
                            <DropdownMenuItem 
                              key={role}
                              onSelect={() => handleFilterChange(role)} 
                              className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'
                            >
                              <Icon className={`mr-2 h-4 w-4 ${info.color}`} />
                              {info.label}
                            </DropdownMenuItem>
                          );
                        })
                      }
                    </DropdownMenuContent>
                  </DropdownMenu>

                                     <Button
                     variant="outline"
                     size="sm"
                     onClick={handleClearSelection}
                     disabled={selectedProperties.length === 0}
                     className="bg-gray-800/60 backdrop-blur-sm border-red-400/30 hover:bg-red-400/10 text-red-300 hover:text-red-200 w-full sm:w-auto"
                   >
                     Clear Selection
                   </Button>
                </div>
                
                                 {/* Enhanced Transport Mode Selection */}
                 <div className="space-y-2">
                   <p className="text-sm font-medium text-gray-300">Transport Mode</p>
                   <ToggleGroup 
                     type="single" 
                     value={transportMode} 
                     onValueChange={handleTransportModeChange}
                     className="grid grid-cols-3 w-full gap-1"
                   >
                     <ToggleGroupItem value="walking" aria-label="Walking" className="flex-col h-auto py-2">
                       <PersonStanding className="h-4 w-4 mb-1" />
                       <span className="text-xs">Walk</span>
                     </ToggleGroupItem>
                     <ToggleGroupItem value="car" aria-label="Car" className="flex-col h-auto py-2">
                       <Car className="h-4 w-4 mb-1" />
                       <span className="text-xs">Car</span>
                     </ToggleGroupItem>
                     <ToggleGroupItem value="truck" aria-label="Truck" className="flex-col h-auto py-2">
                       <Truck className="h-4 w-4 mb-1" />
                       <span className="text-xs">Truck</span>
                     </ToggleGroupItem>
                     <ToggleGroupItem value="ship" aria-label="Ship" className="flex-col h-auto py-2">
                       <Ship className="h-4 w-4 mb-1" />
                       <span className="text-xs">Ship</span>
                     </ToggleGroupItem>
                     <ToggleGroupItem value="plane" aria-label="Plane" className="flex-col h-auto py-2">
                       <Plane className="h-4 w-4 mb-1" />
                       <span className="text-xs">Plane</span>
                     </ToggleGroupItem>
                     <ToggleGroupItem value="drone" aria-label="Drone" className="flex-col h-auto py-2">
                       <Zap className="h-4 w-4 mb-1" />
                       <span className="text-xs">Drone</span>
                     </ToggleGroupItem>
                   </ToggleGroup>
                 </div>
              </div>
              
                             {/* Enhanced Property List */}
               <div className="flex-grow overflow-y-auto pr-2 md:pr-3 -mr-2 md:-mr-3 property-list-scroll">
                 <div className="space-y-2">
                  {displayedProperties.map(prop => {
                    const isSelected = selectedProperties.some(p => p.id === prop.id);
                    const enhanced = enhancedProperties.find(ep => ep.id === prop.id);
                    
                    return (
                      <PropertyListItem
                        key={prop.id}
                        prop={prop}
                        isSelected={isSelected}
                        compactView={compactView}
                        enhanced={enhanced}
                        onSelect={handlePropertySelect}
                        onCopyCoords={handleCopyCoords}
                        onViewOnE2={handleViewOnE2}
                      />
                    )
                  })}
                  
                  {displayedProperties.length === 0 && !isLoading && (
                    <div className="text-center py-10 text-gray-500">
                      <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No properties match your search criteria.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex-shrink-0 pt-2">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                           onClick={(e) => { e.preventDefault(); handlePrevPage()}} 
                           className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} 
                        />
                      </PaginationItem>
                      
                      {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                        let pageNum = i + 1;
                        if(totalPages > 5 && currentPage > 3) {
                          const startPage = Math.max(1, currentPage - 2);
                          pageNum = startPage + i;
                          if (pageNum > totalPages) return null;
                        }

                        const handlePageClick = (e: React.MouseEvent) => {
                          e.preventDefault();
                          handlePageChange(pageNum);
                        };

                        return (
                        <PaginationItem key={i}>
                          <PaginationLink 
                             onClick={handlePageClick} 
                             isActive={currentPage === pageNum}
                             className='cursor-pointer'
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                        )
                      })}
                      
                      {totalPages > 5 && currentPage < totalPages - 2 && <PaginationEllipsis />}

                      <PaginationItem>
                        <PaginationNext 
                           onClick={(e) => { e.preventDefault(); handleNextPage()}} 
                           className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
           )}
          </div>

                     {/* Enhanced Right Panel: Interactive Map */}
           <div className="xl:col-span-8 h-64 md:h-96 xl:h-full rounded-xl bg-black/30 backdrop-blur-md shadow-2xl flex items-center justify-center border border-cyan-400/20 overflow-hidden">
            <LogisticsMap 
              properties={allProperties} 
              selectedProperties={selectedProperties}
              onRouteSummary={handleRouteSummary}
            />
          </div>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  );
} 