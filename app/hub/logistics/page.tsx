'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { get as idbGet } from 'idb-keyval';
import { 
  Loader2, AlertCircle, Map, List, Route, ArrowUpDown, Search, Gem, Car, Truck, Zap,
  Anchor, Factory, Home, TreePine, Mountain, Waves, Building, MapPin, Copy, ExternalLink,
  Package, Clock, Fuel, Calculator, TrendingUp, Compass, Navigation, Gauge,
  Ship, Plane, Train, RefreshCw, Eye, EyeOff, Settings, Info, Star, Award, PersonStanding, X
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

// Multi-modal route segment
interface RouteSegment {
  mode: 'walking' | 'car' | 'truck' | 'drone' | 'ship' | 'plane';
  distance: number;
  time: number;
  description: string;
  waypoints: { lat: number; lng: number }[];
  reason?: string; // Why this mode was chosen
}

// Define the type locally to avoid module resolution issues
interface RouteSummary {
  totalDistance: number;
  totalTime: number;
  elevationGain?: number;
  terrainDifficulty?: 'easy' | 'moderate' | 'difficult';
  routeType?: 'direct' | 'detoured' | 'rerouted';
  weatherImpact?: number;
  obstacles?: RouteObstacle[];
  segments?: RouteSegment[]; // Multi-modal journey segments
  isMultiModal?: boolean;
}

// Obstacle Detection Types (Natural terrain only - Earth 2 removed man-made structures)
interface RouteObstacle {
  id: string;
  type: 'mountain' | 'steep_cliff' | 'water_body' | 'deep_valley' | 'swamp' | 'glacier';
  position: { lat: number; lng: number };
  severity: 'low' | 'medium' | 'high';
  description: string;
  detourRequired: boolean;
  naturalFeature: true; // Always true since only natural obstacles exist
}

// Elevation and Terrain Analysis
interface ElevationPoint {
  lat: number;
  lng: number;
  elevation: number;
  terrainType: 'water_body' | 'flat_land' | 'hills' | 'mountains' | 'steep_cliff' | 'deep_valley';
  isPassable: boolean;
  difficulty: 'easy' | 'moderate' | 'difficult' | 'impassable';
}

interface RouteProfile {
  elevationProfile: ElevationPoint[];
  maxElevation: number;
  minElevation: number;
  elevationGain: number;
  terrainDifficulty: 'easy' | 'moderate' | 'difficult';
  recommendedTransport: Array<'walking' | 'car' | 'truck' | 'drone' | 'ship' | 'plane'>;
  obstacles: RouteObstacle[];
  alternativeRoutes?: AlternativeRoute[];
}

interface AlternativeRoute {
  id: string;
  reason: string;
  waypoints: { lat: number; lng: number }[];
  additionalDistance: number;
  additionalTime: number;
  description: string;
}

// No port operations in Earth 2's natural world

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

// Distance calculation helper
const calculateDistance = (coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Elevation and Terrain Analysis
const getElevationProfile = async (waypoints: { lat: number; lng: number }[]): Promise<RouteProfile | null> => {
  if (waypoints.length < 2) return null;
  
  try {
    // Using Open Elevation API for elevation data
    const elevationProfile: ElevationPoint[] = [];
    
    for (const waypoint of waypoints) {
      const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${waypoint.lat},${waypoint.lng}`);
      const data = await response.json();
      
      if (data.results && data.results[0]) {
        const elevation = data.results[0].elevation;
        const terrainType = classifyTerrain(elevation, waypoint);
        elevationProfile.push({
          lat: waypoint.lat,
          lng: waypoint.lng,
          elevation,
          terrainType,
          isPassable: terrainType !== 'water_body' && elevation < 3000 && terrainType !== 'steep_cliff',
          difficulty: classifyTerrainDifficulty(elevation, terrainType),
        });
      }
    }
    
    if (elevationProfile.length === 0) return null;
    
    const elevations = elevationProfile.map(p => p.elevation);
    const maxElevation = Math.max(...elevations);
    const minElevation = Math.min(...elevations);
    const elevationGain = calculateElevationGain(elevationProfile);
    const terrainDifficulty = calculateRouteTerrainDifficulty(elevationGain, maxElevation - minElevation);
    const recommendedTransport = getRecommendedTransportForTerrain(terrainDifficulty, elevationProfile);
    
    return {
      elevationProfile,
      maxElevation,
      minElevation,
      elevationGain,
      terrainDifficulty,
      recommendedTransport,
      obstacles: elevationProfile.filter(p => !p.isPassable).map(p => ({
        id: `obstacle_${p.lat}_${p.lng}`,
        type: mapTerrainToObstacleType(p.terrainType),
        position: { lat: p.lat, lng: p.lng },
        severity: p.difficulty === 'difficult' || p.difficulty === 'impassable' ? 'high' : 
                  p.difficulty === 'moderate' ? 'medium' : 'low',
        description: `Natural obstacle: ${p.terrainType.replace('_', ' ')} (${p.elevation}m elevation)`,
        detourRequired: true,
        naturalFeature: true,
      })),
      alternativeRoutes: [],
    };
  } catch (error) {
    console.error('Error fetching elevation data:', error);
    return null;
  }
};

const classifyTerrain = (elevation: number, coord: { lat: number; lng: number }): 'water_body' | 'flat_land' | 'hills' | 'mountains' | 'steep_cliff' | 'deep_valley' => {
  // Classify based on elevation and geographic context (Earth 2 has only natural terrain)
  if (elevation < 0) return 'deep_valley'; // Below sea level
  if (elevation < 10) return 'water_body'; // Sea level or coastal water
  if (elevation < 200) return 'flat_land'; // Plains and lowlands
  if (elevation < 1000) return 'hills'; // Rolling hills
  if (elevation > 2500) return 'steep_cliff'; // Very steep terrain
  return 'mountains'; // Mountain ranges
};

const calculateElevationGain = (profile: ElevationPoint[]): number => {
  let gain = 0;
  for (let i = 1; i < profile.length; i++) {
    const diff = profile[i].elevation - profile[i-1].elevation;
    if (diff > 0) gain += diff;
  }
  return gain;
};

const classifyTerrainDifficulty = (elevation: number, terrainType: string): 'easy' | 'moderate' | 'difficult' | 'impassable' => {
  if (terrainType === 'water_body') return 'impassable'; // for land transport
  if (terrainType === 'steep_cliff') return 'impassable'; // steep cliffs are impassable
  if (terrainType === 'deep_valley') return 'difficult'; // valleys are challenging
  if (elevation > 3000) return 'impassable';
  if (elevation > 2000) return 'difficult';
  if (elevation > 1000) return 'moderate';
  return 'easy';
};

const calculateRouteTerrainDifficulty = (elevationGain: number, elevationRange: number): 'easy' | 'moderate' | 'difficult' => {
  if (elevationGain < 100 && elevationRange < 200) return 'easy';
  if (elevationGain < 500 && elevationRange < 800) return 'moderate';
  return 'difficult';
};

const getRecommendedTransportForTerrain = (difficulty: 'easy' | 'moderate' | 'difficult', profile: ElevationPoint[]): Array<'walking' | 'car' | 'truck' | 'drone' | 'ship' | 'plane'> => {
  const hasWater = profile.some(p => p.terrainType === 'water_body');
  const hasMountains = profile.some(p => p.terrainType === 'mountains');
  const hasSteepCliffs = profile.some(p => p.terrainType === 'steep_cliff');
  
  let modes: Array<'walking' | 'car' | 'truck' | 'drone' | 'ship' | 'plane'> = ['drone', 'plane']; // Always available
  
  if (hasWater) modes.push('ship');
  
  if (difficulty === 'easy' && !hasSteepCliffs) {
    modes.push('walking', 'car', 'truck');
  } else if (difficulty === 'moderate' && !hasSteepCliffs) {
    modes.push('car', 'truck');
  }
  // For difficult terrain or steep cliffs, only air transport is recommended
  
  return modes;
};

// No shipping or port operations in Earth 2's natural world

// Helper to map natural terrain types to obstacle types (Earth 2 natural world only)
const mapTerrainToObstacleType = (terrainType: string): 'mountain' | 'steep_cliff' | 'water_body' | 'deep_valley' | 'swamp' | 'glacier' => {
  switch (terrainType) {
    case 'mountains': return 'mountain';
    case 'water_body': return 'water_body';
    case 'steep_cliff': return 'steep_cliff';
    case 'deep_valley': return 'deep_valley';
    case 'hills': return 'steep_cliff'; // Steep hills become cliff obstacles
    case 'flat_land': return 'swamp'; // Some flat areas might be swampy
    default: return 'mountain'; // Default to mountain obstacle
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
  
  // New state for advanced features
  const [routeProfile, setRouteProfile] = useState<RouteProfile | null>(null);
  const [showElevationProfile, setShowElevationProfile] = useState(false);
  const [terrainBasedRerouting, setTerrainBasedRerouting] = useState(true);
  const [detectedObstacles, setDetectedObstacles] = useState<RouteObstacle[]>([]);
  const [autoSwitchedMode, setAutoSwitchedMode] = useState<string | null>(null);
  
  // Memoize properties per page to prevent infinite re-renders
  const PROPERTIES_PER_PAGE = useMemo(() => compactView ? 15 : 10, [compactView]);

  // Enhanced logistics calculations with network analysis
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
      obstacleCount: detectedObstacles.length,
      terrainDifficulty: routeProfile?.terrainDifficulty || 'easy',
    };
  }, [selectedProperties, enhancedProperties, detectedObstacles, routeProfile]);

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

  // New effects for advanced features
  // 3. Effect to detect obstacles when route changes and terrain rerouting is enabled
  useEffect(() => {
    if (selectedProperties.length >= 2 && terrainBasedRerouting) {
      const waypoints = selectedProperties
        .map(p => parseCoordinates(p.attributes.center))
        .filter(coord => coord !== null) as { lat: number; lng: number }[];
      
      if (waypoints.length >= 2) {
        detectRouteObstacles(waypoints, transportMode).then(obstacles => {
          setDetectedObstacles(obstacles);
          
          if (obstacles.length > 0) {
            const highSeverityObstacles = obstacles.filter(o => o.severity === 'high');
            if (highSeverityObstacles.length > 0) {
              toast({
                title: "Route Obstacles Detected",
                description: `${obstacles.length} obstacles found, ${highSeverityObstacles.length} requiring detour. Consider alternative transport or route.`,
                duration: 5000,
              });
            }
          }
        }).catch(err => {
          console.error('Failed to detect obstacles:', err);
        });
      }
    }
  }, [selectedProperties, terrainBasedRerouting, transportMode]);

  // 4. Effect to fetch elevation profile when route changes and terrain rerouting is enabled
  useEffect(() => {
    if (selectedProperties.length >= 2 && terrainBasedRerouting) {
      const waypoints = selectedProperties
        .map(p => parseCoordinates(p.attributes.center))
        .filter(coord => coord !== null) as { lat: number; lng: number }[];
      
      if (waypoints.length >= 2) {
        getElevationProfile(waypoints).then(profile => {
          setRouteProfile(profile);
          
          // If terrain is difficult, suggest rerouting or alternative transport
          if (profile && profile.terrainDifficulty === 'difficult') {
            toast({
              title: "Difficult Terrain Detected",
              description: `Elevation gain: ${Math.round(profile.elevationGain)}m. Consider using ${profile.recommendedTransport.join(', ')} for this route.`,
              duration: 5000,
            });
          }
        }).catch(err => {
          console.error('Failed to fetch elevation profile:', err);
        });
      }
    }
  }, [selectedProperties, terrainBasedRerouting]);

  // No port operations in Earth 2's natural world

  const handleRouteSummary = (summary: RouteSummary | null) => {
    setRouteSummary(currentSummary => {
      if (currentSummary && summary && 
          currentSummary.totalDistance === summary.totalDistance && 
          currentSummary.totalTime === summary.totalTime) {
        return currentSummary;
      }
      return summary;
    });

    // Auto-update transport mode based on multi-modal route requirements
    if (summary?.isMultiModal && summary.segments && summary.segments.length > 0) {
      // Find the recommended transport mode for the current route
      const recommendedMode = findRecommendedTransportMode(summary.segments);
      if (recommendedMode !== transportMode) {
        console.log(`🚨 Auto-switching transport mode from ${transportMode} to ${recommendedMode} due to terrain constraints`);
        setAutoSwitchedMode(`${transportMode} → ${recommendedMode}`);
        setTransportMode(recommendedMode);
        
        // Show toast notification to user about mode change
        toast({
          title: "🚨 Transport Mode Auto-Changed",
          description: `Switched from ${transportMode.toUpperCase()} to ${recommendedMode.toUpperCase()} due to terrain impossibility`,
          duration: 5000,
        });
      }
    }
  };

  // Find the most appropriate transport mode based on route segments
  const findRecommendedTransportMode = (segments: RouteSegment[]): typeof transportMode => {
    if (!segments || segments.length === 0) return transportMode;
    
    // Priority order: Ship > Plane > Drone > Truck > Car > Walking
    const modePriority = {
      'ship': 6,
      'plane': 5, 
      'drone': 4,
      'truck': 3,
      'car': 2,
      'walking': 1
    };
    
    // Find the highest priority mode that appears in segments
    const modesInRoute = segments.map(s => s.mode);
    const highestPriorityMode = modesInRoute.reduce((highest, current) => {
      return (modePriority[current] || 0) > (modePriority[highest] || 0) ? current : highest;
    }, modesInRoute[0]);
    
    return highestPriorityMode as typeof transportMode;
  };

  const handleTransportModeChange = useCallback((value: string) => {
    if (value) {
      setTransportMode(value as typeof transportMode);
      // Clear auto-switched indicator when user manually changes mode
      if (autoSwitchedMode) {
        setAutoSwitchedMode(null);
      }
    }
  }, [autoSwitchedMode]);

  useEffect(() => {
    if (selectedProperties.length < 2) {
      setRouteSummary(null);
    }
  }, [selectedProperties]);

  // Reset page when filters change - use useCallback to stabilize
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortOption, filterRole]);

  // Helper function to get location context from coordinates
  const getLocationContext = (lat: number, lng: number): string => {
    const contexts = [];
    
    // Add continent
    if (lat > 35 && lat < 75 && lng > -15 && lng < 65) {
      contexts.push('Europe');
    } else if (lat > -40 && lat < 40 && lng > -20 && lng < 55) {
      contexts.push('Africa');
    } else if (lat > 5 && lat < 75 && lng > 60 && lng < 180) {
      contexts.push('Asia');
    } else if (lat > 15 && lat < 75 && lng > -170 && lng < -50) {
      contexts.push('North America');
    } else if (lat > -60 && lat < 15 && lng > -85 && lng < -35) {
      contexts.push('South America');
    } else if (lat > -50 && lat < -10 && lng > 110 && lng < 180) {
      contexts.push('Australia Oceania');
    }
    
    // Add hemisphere info
    if (lat > 0) contexts.push('Northern Hemisphere');
    else contexts.push('Southern Hemisphere');
    
    if (lng > 0) contexts.push('Eastern Hemisphere');
    else contexts.push('Western Hemisphere');
    
    return contexts.join(' ');
  };

  // Helper function to get country name variations
  const getCountryVariations = (query: string): string[] => {
    const variations = [query];
    
    // Expanded country name mappings with more variations
    const countryMappings: Record<string, string[]> = {
      // North America
      'usa': ['united states', 'america', 'us', 'united states of america', 'states'],
      'united states': ['usa', 'america', 'us', 'united states of america', 'states'],
      'america': ['usa', 'united states', 'us', 'united states of america'],
      'canada': ['can', 'dominion of canada'],
      'mexico': ['mexican states', 'united mexican states', 'méxico'],
      
      // Europe
      'uk': ['united kingdom', 'britain', 'england', 'great britain', 'scotland', 'wales', 'northern ireland'],
      'united kingdom': ['uk', 'britain', 'england', 'great britain', 'scotland', 'wales'],
      'britain': ['uk', 'united kingdom', 'england', 'great britain'],
      'england': ['uk', 'united kingdom', 'britain', 'great britain'],
      'scotland': ['uk', 'united kingdom', 'britain', 'great britain'],
      'wales': ['uk', 'united kingdom', 'britain', 'great britain'],
      'ireland': ['republic of ireland', 'eire'],
      'germany': ['deutschland', 'federal republic of germany', 'german'],
      'france': ['french republic', 'république française', 'french'],
      'spain': ['españa', 'kingdom of spain', 'spanish'],
      'italy': ['italia', 'italian republic', 'italian'],
      'netherlands': ['holland', 'kingdom of the netherlands', 'dutch'],
      'holland': ['netherlands', 'kingdom of the netherlands', 'dutch'],
      'poland': ['polska', 'republic of poland', 'polish'],
      'russia': ['russian federation', 'ussr', 'soviet union', 'russian'],
      'czech republic': ['czechia', 'česká republika', 'bohemia'],
      'czechia': ['czech republic', 'česká republika', 'bohemia'],
      'greece': ['hellenic republic', 'hellas', 'greek'],
      'portugal': ['portuguese republic', 'portuguese'],
      'sweden': ['kingdom of sweden', 'swedish'],
      'norway': ['kingdom of norway', 'norwegian'],
      'denmark': ['kingdom of denmark', 'danish'],
      'finland': ['republic of finland', 'finnish'],
      'switzerland': ['swiss confederation', 'swiss'],
      'austria': ['republic of austria', 'austrian'],
      'belgium': ['kingdom of belgium', 'belgian'],
      
      // Asia
      'china': ['people\'s republic of china', 'prc', 'chinese'],
      'japan': ['nippon', 'nihon', 'japanese'],
      'south korea': ['korea', 'republic of korea', 'korean'],
      'north korea': ['korea', 'democratic people\'s republic of korea', 'korean'],
      'india': ['republic of india', 'bharat', 'indian'],
      'thailand': ['kingdom of thailand', 'siam', 'thai'],
      'vietnam': ['socialist republic of vietnam', 'vietnamese'],
      'taiwan': ['republic of china', 'chinese taipei', 'formosa'],
      'singapore': ['republic of singapore', 'singaporean'],
      'indonesia': ['republic of indonesia', 'indonesian'],
      'malaysia': ['malaysian'],
      'philippines': ['republic of the philippines', 'filipino'],
      'pakistan': ['islamic republic of pakistan', 'pakistani'],
      'bangladesh': ['people\'s republic of bangladesh', 'bangladeshi'],
      'iran': ['islamic republic of iran', 'persia', 'persian'],
      'iraq': ['republic of iraq', 'iraqi'],
      'saudi arabia': ['kingdom of saudi arabia', 'saudi'],
      'israel': ['state of israel', 'israeli'],
      'turkey': ['republic of turkey', 'türkiye', 'turkish'],
      
      // Middle East
      'uae': ['united arab emirates', 'emirates'],
      'united arab emirates': ['uae', 'emirates'],
      'qatar': ['state of qatar', 'qatari'],
      'kuwait': ['state of kuwait', 'kuwaiti'],
      'bahrain': ['kingdom of bahrain', 'bahraini'],
      'oman': ['sultanate of oman', 'omani'],
      'jordan': ['hashemite kingdom of jordan', 'jordanian'],
      'lebanon': ['lebanese republic', 'lebanese'],
      'syria': ['syrian arab republic', 'syrian'],
      
      // Africa
      'south africa': ['republic of south africa', 'south african'],
      'egypt': ['arab republic of egypt', 'egyptian'],
      'nigeria': ['federal republic of nigeria', 'nigerian'],
      'kenya': ['republic of kenya', 'kenyan'],
      'ethiopia': ['federal democratic republic of ethiopia', 'ethiopian'],
      'morocco': ['kingdom of morocco', 'moroccan'],
      'algeria': ['people\'s democratic republic of algeria', 'algerian'],
      'tunisia': ['republic of tunisia', 'tunisian'],
      'libya': ['state of libya', 'libyan'],
      'ghana': ['republic of ghana', 'ghanaian'],
      
      // Oceania
      'australia': ['commonwealth of australia', 'australian', 'aussie'],
      'new zealand': ['nz', 'new zealander', 'kiwi'],
      
      // South America
      'brazil': ['federative republic of brazil', 'brazilian'],
      'argentina': ['argentine republic', 'argentinian', 'argentine'],
      'chile': ['republic of chile', 'chilean'],
      'peru': ['republic of peru', 'peruvian'],
      'colombia': ['republic of colombia', 'colombian'],
      'venezuela': ['bolivarian republic of venezuela', 'venezuelan'],
      'ecuador': ['republic of ecuador', 'ecuadorian'],
      'bolivia': ['plurinational state of bolivia', 'bolivian'],
      'uruguay': ['oriental republic of uruguay', 'uruguayan'],
      'paraguay': ['republic of paraguay', 'paraguayan'],
    };
    
    const lowerQuery = query.toLowerCase();
    
    // Direct mapping check
    if (countryMappings[lowerQuery]) {
      variations.push(...countryMappings[lowerQuery]);
    }
    
    // Partial matches for longer country names
    Object.entries(countryMappings).forEach(([key, values]) => {
      if (key.includes(lowerQuery) || values.some(v => v.includes(lowerQuery))) {
        variations.push(key, ...values);
      }
    });
    
    // Add common language/nationality searches
    const languageToCountry: Record<string, string[]> = {
      'english': ['united kingdom', 'usa', 'canada', 'australia', 'new zealand'],
      'spanish': ['spain', 'mexico', 'argentina', 'colombia', 'peru', 'chile'],
      'french': ['france', 'canada', 'belgium', 'switzerland'],
      'german': ['germany', 'austria', 'switzerland'],
      'italian': ['italy', 'switzerland'],
      'portuguese': ['portugal', 'brazil'],
      'chinese': ['china', 'taiwan', 'singapore'],
      'japanese': ['japan'],
      'korean': ['south korea', 'north korea'],
      'arabic': ['saudi arabia', 'uae', 'egypt', 'jordan', 'lebanon'],
      'russian': ['russia'],
      'dutch': ['netherlands', 'belgium'],
    };
    
    if (languageToCountry[lowerQuery]) {
      variations.push(...languageToCountry[lowerQuery]);
    }
    
    return [...new Set(variations)]; // Remove duplicates
  };

  // Helper function to check continent matches
  const checkContinentMatch = (query: string, coords: { lat: number; lng: number } | null): boolean => {
    if (!coords) return false;
    
    const continentQueries = {
      'europe': () => coords.lat > 35 && coords.lat < 75 && coords.lng > -15 && coords.lng < 65,
      'africa': () => coords.lat > -40 && coords.lat < 40 && coords.lng > -20 && coords.lng < 55,
      'asia': () => coords.lat > 5 && coords.lat < 75 && coords.lng > 60 && coords.lng < 180,
      'north america': () => coords.lat > 15 && coords.lat < 75 && coords.lng > -170 && coords.lng < -50,
      'south america': () => coords.lat > -60 && coords.lat < 15 && coords.lng > -85 && coords.lng < -35,
      'australia': () => coords.lat > -50 && coords.lat < -10 && coords.lng > 110 && coords.lng < 180,
      'oceania': () => coords.lat > -50 && coords.lat < -10 && coords.lng > 110 && coords.lng < 180,
    };
    
    const lowerQuery = query.toLowerCase();
    return Object.entries(continentQueries).some(([continent, checkFn]) => 
      (continent.includes(lowerQuery) || lowerQuery.includes(continent)) && checkFn()
    );
  };

  // Enhanced filtering and sorting logic
  const filteredAndSortedProperties = useMemo(() => {
    let filtered = enhancedProperties;

    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      
      // Create a comprehensive search that matches various location formats with priority scoring
      const searchResults = enhancedProperties.map(p => {
        const description = p.attributes.description.toLowerCase();
        const country = p.attributes.country.toLowerCase();
        const logisticsRoleLabel = p.logisticsRole ? getPropertyRoleInfo(p.logisticsRole).label.toLowerCase() : '';
        
        // Parse center coordinates to get location context
        const coords = parseCoordinates(p.attributes.center);
        let locationContext = '';
        if (coords) {
          locationContext = getLocationContext(coords.lat, coords.lng).toLowerCase();
        }
        
        let score = 0;
        let matched = false;
        
        // High priority: Exact country name match
        if (country === query) {
          score += 100;
          matched = true;
        }
        
        // High priority: Country name contains query or query contains country
        if (country.includes(query) || query.includes(country)) {
          score += 80;
          matched = true;
        }
        
        // Enhanced country matching with common variations
        const countryVariations = getCountryVariations(query);
        const exactCountryMatch = countryVariations.find(variation => country === variation);
        if (exactCountryMatch) {
          score += 90;
          matched = true;
        } else if (countryVariations.some(variation => country.includes(variation))) {
          score += 70;
          matched = true;
        }
        
        // Medium-high priority: Property description contains query
        if (description.includes(query)) {
          score += 60;
          matched = true;
        }
        
        // Medium priority: Logistics role match
        if (logisticsRoleLabel.includes(query)) {
          score += 50;
          matched = true;
        }
        
        // Medium priority: Continent/region match
        const continentMatch = checkContinentMatch(query, coords);
        if (continentMatch) {
          score += 40;
          matched = true;
        }
        
        // Lower priority: Location context match
        if (locationContext.includes(query)) {
          score += 30;
          matched = true;
        }
        
        // Lower priority: City/region names in description (split by commas)
        if (description.split(',').some(part => part.trim().includes(query))) {
          score += 25;
          matched = true;
        }
        
        // Lowest priority: Any partial text match in combined searchable text
        const searchableText = [description, country, logisticsRoleLabel, locationContext].join(' ');
        if (searchableText.includes(query) && !matched) {
          score += 10;
          matched = true;
        }
        
        return { property: p, score, matched };
      });
      
      // Filter only matched results and sort by score
      filtered = searchResults
        .filter(result => result.matched)
        .sort((a, b) => b.score - a.score)
        .map(result => result.property);
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
            label: 'Walking',
            color: 'text-red-400'
          };
        case 'car': 
          return { 
            speedKmh: 50, 
            timeMultiplier: 1, 
            icon: Car,
            label: 'Car',
            color: 'text-cyan-400'
          };
        case 'truck': 
          return { 
            speedKmh: 40, 
            timeMultiplier: 1.25, 
            icon: Truck,
            label: 'Truck',
            color: 'text-orange-400'
          };
        case 'drone': 
          return { 
            speedKmh: 120, 
            timeMultiplier: 0.42, 
            icon: Zap,
            label: 'Drone',
            color: 'text-purple-400'
          };
        case 'ship':
          return { 
            speedKmh: 25, 
            timeMultiplier: 2.0, 
            icon: Ship,
            label: 'Ship',
            color: 'text-blue-400'
          };
        case 'plane':
          return { 
            speedKmh: 250, 
            timeMultiplier: 0.2, 
            icon: Plane,
            label: 'Plane',
            color: 'text-green-400'
          };
        default: 
          return { 
            speedKmh: 50, 
            timeMultiplier: 1, 
            icon: Car,
            label: 'Car',
            color: 'text-cyan-400'
          };
    }
  };

  // Adjusted Route Summary based on Transport Mode
  const adjustedRouteSummary = useMemo(() => {
    if (!routeSummary) return null;
    
    const { totalDistance, totalTime } = routeSummary;
    
    // For multi-modal routes, use the actual calculated data
    if (routeSummary.isMultiModal) {
      return {
        ...routeSummary,
        speedKmh: Math.round((totalDistance / 1000) / (totalTime / 3600)),
        mode: 'multi-modal',
        modeLabel: 'Multi-Modal Journey',
        modeIcon: Route, // Use Route icon for multi-modal
      };
    }
    
    // For single-mode routes, apply mode-specific adjustments
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

  // Obstacle Detection and Rerouting Functions
  const detectRouteObstacles = async (waypoints: { lat: number; lng: number }[], transportMode: 'walking' | 'car' | 'truck' | 'drone' | 'ship' | 'plane'): Promise<RouteObstacle[]> => {
    const obstacles: RouteObstacle[] = [];
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i];
      const end = waypoints[i + 1];
      
      // Check for terrain obstacles between waypoints
      const routeObstacles = await checkTerrainObstacles(start, end, transportMode);
      obstacles.push(...routeObstacles);
    }
    
    return obstacles;
  };

  const checkTerrainObstacles = async (start: { lat: number; lng: number }, end: { lat: number; lng: number }, transportMode: string): Promise<RouteObstacle[]> => {
    const obstacles: RouteObstacle[] = [];
    
    // Sample points along the route
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      const lat = start.lat + (end.lat - start.lat) * ratio;
      const lng = start.lng + (end.lng - start.lng) * ratio;
      
      try {
        // Get elevation data for this point
        const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`);
        const data = await response.json();
        
        if (data.results && data.results[0]) {
          const elevation = data.results[0].elevation;
          const terrainType = classifyTerrain(elevation, { lat, lng });
          const isPassable = checkPassability(elevation, terrainType, transportMode);
          
          if (!isPassable) {
            obstacles.push({
              id: `obstacle_${lat}_${lng}`,
              type: mapTerrainToObstacleType(terrainType),
              position: { lat, lng },
              severity: classifyObstacleSeverity(elevation, terrainType, transportMode),
              description: `Natural ${terrainType.replace('_', ' ')} obstacle (${elevation}m elevation)`,
              detourRequired: true,
              naturalFeature: true,
            });
          }
        }
      } catch (error) {
        console.error('Error checking terrain obstacle:', error);
      }
    }
    
    return obstacles;
  };

  const checkPassability = (elevation: number, terrainType: string, transportMode: string): boolean => {
    switch (transportMode) {
      case 'walking':
        return elevation < 3000 && terrainType !== 'water_body' && terrainType !== 'steep_cliff'; // Can walk up to 3000m, not through water or cliffs
      case 'car':
      case 'truck':
        return elevation < 2000 && terrainType !== 'water_body' && terrainType !== 'mountains' && terrainType !== 'steep_cliff'; // Roads don't go through water, steep mountains or cliffs
      case 'ship':
        return terrainType === 'water_body' || elevation < 10; // Ships need water
      case 'drone':
      case 'plane':
        return true; // Air transport can go anywhere
      default:
        return true;
    }
  };

  const classifyObstacleSeverity = (elevation: number, terrainType: string, transportMode: string): 'low' | 'medium' | 'high' => {
    if (transportMode === 'drone' || transportMode === 'plane') return 'low';
    
    if (terrainType === 'water_body' && (transportMode === 'car' || transportMode === 'truck' || transportMode === 'walking')) {
      return 'high';
    }
    
    if (terrainType === 'steep_cliff') return 'high'; // Cliffs are always high severity
    if (terrainType === 'deep_valley') return 'medium'; // Valleys are moderate
    
    if (elevation > 2000) return 'high';
    if (elevation > 1000) return 'medium';
    return 'low';
  };

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
                  <div className="flex gap-2">
                    <p className='text-xs md:text-sm text-gray-400'>{filteredAndSortedProperties.length} found</p>
                    
                    {/* Advanced Feature Toggles */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setTerrainBasedRerouting(!terrainBasedRerouting)}
                          className={`h-6 w-6 ${terrainBasedRerouting ? 'bg-orange-400/20 border-orange-400' : 'bg-black/40 border-cyan-400/30'} hover:bg-orange-400/20`}
                        >
                          <Navigation className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Obstacle Detection</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowElevationProfile(!showElevationProfile)}
                          className={`h-6 w-6 ${showElevationProfile ? 'bg-green-400/20 border-green-400' : 'bg-black/40 border-cyan-400/30'} hover:bg-green-400/20`}
                        >
                          <Mountain className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Elevation Profile</TooltipContent>
                    </Tooltip>
                    
                    {/* No shipping data in Earth 2's natural world */}
                  </div>
                </div>

              {/* Enhanced Multi-Modal Route Summary */}
              {adjustedRouteSummary && (
              <Card className="bg-gradient-to-br from-gray-800/60 via-gray-900/70 to-black/60 border-cyan-400/30 transition-all duration-300 backdrop-blur-sm">
                <CardHeader className='p-4'>
                  <CardTitle className="text-cyan-300 flex items-center text-base">
                    <Route className="mr-2 h-5 w-5"/>
                    Mission Brief
                    {adjustedRouteSummary.isMultiModal && <Badge variant="outline" className="ml-2 text-xs border-green-400 text-green-400">Smart Routing</Badge>}
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

                  {/* Multi-Modal Route Segments */}
                  {adjustedRouteSummary.segments && adjustedRouteSummary.segments.length > 1 && (
                    <div className="space-y-2 pt-3 border-t border-cyan-400/20">
                      <p className="font-semibold text-white text-xs">Journey Segments:</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {adjustedRouteSummary.segments.map((segment, index) => {
                          const modeDetails = getTransportModeDetails(segment.mode);
                          return (
                            <div key={index} className="bg-black/30 rounded-md p-2 border border-gray-600/30">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-2">
                                  <modeDetails.icon className={`h-3 w-3 ${modeDetails.color}`} />
                                  <span className={`text-xs font-medium ${modeDetails.color}`}>{segment.description}</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-gray-300 text-xs">{formatDistance(segment.distance)}</p>
                                  <p className="text-gray-400 text-xs">{formatTime(segment.time)}</p>
                                </div>
                              </div>
                              {segment.reason && (
                                <p className="text-gray-400 text-xs mt-1 italic">{segment.reason}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
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
                         {/* Route Obstacle Analytics */}
                         {detectedObstacles.length > 0 && (
                           <>
                             <div>
                               <p className="text-gray-300 text-xs">Route Obstacles</p>
                               <p className="text-sm md:text-lg font-bold text-red-400">{logisticsAnalytics.obstacleCount}</p>
                             </div>
                             <div>
                               <p className="text-gray-300 text-xs">Terrain</p>
                               <p className="text-sm md:text-lg font-bold text-orange-400">{logisticsAnalytics.terrainDifficulty}</p>
                             </div>
                           </>
                         )}
                       </div>
                     </div>
                   )}
                 </CardContent>
               </Card>
               )}

               {/* Obstacle Detection Panel */}
               {terrainBasedRerouting && detectedObstacles.length > 0 && (
                 <Card className="bg-gradient-to-br from-red-900/30 via-orange-900/30 to-black/60 border-red-400/30 backdrop-blur-sm">
                   <CardHeader className='p-4'>
                     <CardTitle className="text-red-300 flex items-center text-base">
                       <Navigation className="mr-2 h-5 w-5"/>
                       Route Obstacles
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="text-xs md:text-sm space-y-3 md:space-y-4 p-3 md:p-4 pt-0">
                     <div className='grid grid-cols-2 gap-2 md:gap-3'>
                       <div>
                         <p className="text-gray-300 text-xs">Total Obstacles</p>
                         <p className="text-sm md:text-lg font-bold text-red-300">{detectedObstacles.length}</p>
                       </div>
                       <div>
                         <p className="text-gray-300 text-xs">High Severity</p>
                         <p className="text-sm md:text-lg font-bold text-red-400">{detectedObstacles.filter(o => o.severity === 'high').length}</p>
                       </div>
                       <div>
                         <p className="text-gray-300 text-xs">Detours Required</p>
                         <p className="text-sm md:text-lg font-bold text-orange-300">{detectedObstacles.filter(o => o.detourRequired).length}</p>
                       </div>
                       <div>
                         <p className="text-gray-300 text-xs">Transport Mode</p>
                         <p className="text-sm md:text-lg font-bold text-cyan-300 capitalize">{transportMode}</p>
                       </div>
                     </div>
                     
                     {detectedObstacles.filter(o => o.severity === 'high').length > 0 && (
                       <div className="pt-3 border-t border-red-400/20">
                         <h4 className="text-sm text-white font-semibold mb-2">⚠️ Critical Obstacles</h4>
                         <div className="space-y-1">
                           {detectedObstacles.filter(o => o.severity === 'high').slice(0, 3).map(obstacle => (
                             <div key={obstacle.id} className="text-xs bg-red-900/20 p-2 rounded border border-red-500/30">
                               <p className="text-red-300 font-medium">{obstacle.description}</p>
                               <p className="text-gray-400">{obstacle.type} - {obstacle.severity} severity</p>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </CardContent>
                 </Card>
               )}

               {/* Elevation Profile Panel */}
               {showElevationProfile && routeProfile && (
                 <Card className="bg-gradient-to-br from-green-900/30 via-emerald-900/30 to-black/60 border-green-400/30 backdrop-blur-sm">
                   <CardHeader className='p-4'>
                     <CardTitle className="text-green-300 flex items-center text-base">
                       <Mountain className="mr-2 h-5 w-5"/>
                       Terrain Analysis
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="text-xs md:text-sm space-y-3 md:space-y-4 p-3 md:p-4 pt-0">
                     <div className='grid grid-cols-2 gap-2 md:gap-3'>
                       <div>
                         <p className="text-gray-300 text-xs">Difficulty</p>
                         <Badge variant="outline" className={`text-xs ${
                           routeProfile.terrainDifficulty === 'easy' ? 'text-green-400 border-green-400' :
                           routeProfile.terrainDifficulty === 'moderate' ? 'text-yellow-400 border-yellow-400' :
                           'text-red-400 border-red-400'
                         }`}>
                           {routeProfile.terrainDifficulty.toUpperCase()}
                         </Badge>
                       </div>
                       <div>
                         <p className="text-gray-300 text-xs">Elevation Gain</p>
                         <p className="text-sm md:text-lg font-bold text-green-300">{Math.round(routeProfile.elevationGain)}m</p>
                       </div>
                       <div>
                         <p className="text-gray-300 text-xs">Max Elevation</p>
                         <p className="text-sm md:text-lg font-bold text-blue-300">{Math.round(routeProfile.maxElevation)}m</p>
                       </div>
                       <div>
                         <p className="text-gray-300 text-xs">Min Elevation</p>
                         <p className="text-sm md:text-lg font-bold text-cyan-300">{Math.round(routeProfile.minElevation)}m</p>
                       </div>
                     </div>
                     
                     <div className="pt-3 border-t border-green-400/20">
                       <h4 className="text-sm text-white font-semibold mb-2">🚁 Recommended Transport</h4>
                       <div className="flex flex-wrap gap-1">
                         {routeProfile.recommendedTransport.map(mode => (
                           <Badge key={mode} variant="outline" className="text-xs text-green-300 border-green-400">
                             {mode}
                           </Badge>
                         ))}
                       </div>
                     </div>
                   </CardContent>
                 </Card>
               )}

               {/* No port operations in Earth 2's natural world */}
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
                      placeholder="Search by country, property name, or location..."
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
                   <div className="flex items-center justify-between">
                     <p className="text-sm font-medium text-gray-300">Transport Mode</p>
                     {autoSwitchedMode && (
                       <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-400 bg-yellow-400/10">
                         Auto: {autoSwitchedMode}
                       </Badge>
                     )}
                   </div>
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
              transportMode={transportMode}
            />
          </div>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  );
} 