'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useState, useEffect } from 'react';
import RoutingMachine from './RoutingMachine';
import { MapControls, MapLayer } from './MapControls';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ExternalLink, Copy, Anchor, Factory, Home, TreePine, Mountain, 
  Package, Building, MapPin, Gem, DollarSign, Ruler, Users 
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

// Fix for default icon issue with webpack
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl.src,
  iconUrl: iconUrl.src,
  shadowUrl: shadowUrl.src,
});

// Enhanced property types
type PropertyRole = 'port' | 'factory' | 'residential' | 'warehouse' | 'mining' | 'agricultural' | 'commercial' | 'strategic';

type Property = {
  id: string;
  attributes: {
    center: string; // e.g., "(10.212822, 56.127854)"
    description: string;
    country: string;
    tileCount: number;
    landfieldTier: number;
    price: number;
  };
};

interface RouteSummary {
  totalDistance: number;
  totalTime: number;
}

interface RouteSegment {
  mode: 'walking' | 'car' | 'truck' | 'drone' | 'ship' | 'plane';
  distance: number;
  time: number;
  description: string;
  waypoints: { lat: number; lng: number }[];
  reason?: string;
}

interface RouteSummary {
  totalDistance: number;
  totalTime: number;
  segments?: RouteSegment[];
  isMultiModal?: boolean;
}

interface LogisticsMapProps {
  properties: Property[];
  selectedProperties: Property[];
  onRouteSummary: (summary: RouteSummary | null) => void;
  transportMode: 'walking' | 'car' | 'truck' | 'drone' | 'ship' | 'plane';
}

// Helper to determine property logistics role
const determineLogisticsRole = (property: Property): PropertyRole => {
  const desc = property.attributes.description.toLowerCase();
  const coastalKeywords = ['beach', 'coast', 'port', 'harbor', 'bay', 'sea', 'ocean', 'marina'];
  const isCoastal = coastalKeywords.some(keyword => desc.includes(keyword));
  
  if (isCoastal) return 'port';
  if (desc.includes('city') || desc.includes('downtown') || desc.includes('commercial')) return 'commercial';
  if (desc.includes('industrial') || desc.includes('factory')) return 'factory';
  if (desc.includes('mine') || desc.includes('quarry')) return 'mining';
  if (desc.includes('farm') || desc.includes('rural') || desc.includes('agricultural')) return 'agricultural';
  if (desc.includes('residential') || desc.includes('suburb')) return 'residential';
  if (property.attributes.tileCount > 1000) return 'warehouse';
  return 'strategic';
};

// Helper to get property role icon and color
const getPropertyRoleInfo = (role: PropertyRole) => {
  switch (role) {
    case 'port':
      return { icon: Anchor, color: '#3B82F6', label: 'Port' };
    case 'factory':
      return { icon: Factory, color: '#EF4444', label: 'Factory' };
    case 'residential':
      return { icon: Home, color: '#10B981', label: 'Residential' };
    case 'agricultural':
      return { icon: TreePine, color: '#059669', label: 'Agricultural' };
    case 'mining':
      return { icon: Mountain, color: '#F97316', label: 'Mining' };
    case 'warehouse':
      return { icon: Package, color: '#8B5CF6', label: 'Warehouse' };
    case 'commercial':
      return { icon: Building, color: '#06B6D4', label: 'Commercial' };
    default:
      return { icon: MapPin, color: '#6B7280', label: 'Strategic' };
  }
};

// Helper to get tier color
const getTierColor = (tier: number) => {
  switch (tier) {
    case 1: return '#FCD34D'; // Gold
    case 2: return '#D1D5DB'; // Silver
    case 3: return '#FB923C'; // Bronze
    default: return '#6B7280'; // Gray
  }
};

// Helper to create custom property icon
const createPropertyIcon = (property: Property, isSelected: boolean = false) => {
  const role = determineLogisticsRole(property);
  const roleInfo = getPropertyRoleInfo(role);
  const tierColor = getTierColor(property.attributes.landfieldTier);
  
  const size = isSelected ? 40 : 32;
  const opacity = isSelected ? 1.0 : 0.8;
  
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="${size}" height="${size}">
      <!-- Outer circle with tier color -->
      <circle cx="30" cy="30" r="28" fill="${tierColor}" opacity="0.2" stroke="${tierColor}" stroke-width="2"/>
      <!-- Inner circle with role color -->
      <circle cx="30" cy="30" r="20" fill="${roleInfo.color}" opacity="${opacity}"/>
      <!-- Icon placeholder - simplified for SVG -->
      <circle cx="30" cy="30" r="12" fill="white" opacity="0.9"/>
      <text x="30" y="35" text-anchor="middle" fill="${roleInfo.color}" font-size="12" font-weight="bold">
        ${role === 'port' ? '⚓' : role === 'factory' ? '🏭' : role === 'residential' ? '🏠' : 
          role === 'agricultural' ? '🌲' : role === 'mining' ? '⛰️' : role === 'warehouse' ? '📦' : 
          role === 'commercial' ? '🏢' : '📍'}
      </text>
      ${isSelected ? '<circle cx="30" cy="30" r="28" fill="none" stroke="#06B6D4" stroke-width="3" opacity="0.8"/>' : ''}
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-property-icon',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  });
};

// Faint icon for non-selected properties
const createSecondaryIcon = (property: Property) => {
  const role = determineLogisticsRole(property);
  const roleInfo = getPropertyRoleInfo(role);
  
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <circle cx="12" cy="12" r="10" fill="${roleInfo.color}" opacity="0.3"/>
      <circle cx="12" cy="12" r="6" fill="white" opacity="0.6"/>
      <text x="12" y="16" text-anchor="middle" fill="${roleInfo.color}" font-size="8">
        ${role === 'port' ? '⚓' : role === 'factory' ? '🏭' : role === 'residential' ? '🏠' : 
          role === 'agricultural' ? '🌲' : role === 'mining' ? '⛰️' : role === 'warehouse' ? '📦' : 
          role === 'commercial' ? '🏢' : '📍'}
      </text>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-property-icon-secondary',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const parseCoordinates = (center: string): [number, number] | null => {
    if (!center) return null;
    try {
        const match = center.match(/\(([^,]+),\s*([^)]+)\)/);
        if (match) {
            const lng = parseFloat(match[1]); // E2 provides longitude first
            const lat = parseFloat(match[2]); // Then latitude
            if (!isNaN(lat) && !isNaN(lng)) {
                return [lat, lng]; // Leaflet expects [latitude, longitude]
            } else {
                console.warn("Parsed coordinates are NaN:", { lat, lng, center });
            }
        } else {
             console.warn("Could not match coordinates in string:", center);
        }
    } catch (e) {
        console.error("Error parsing coordinates:", center, e);
    }
    return null;
}

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

// Helper to format price
const formatPrice = (price: number) => {
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${(price / 1000).toFixed(1)}K`;
  return `$${price}`;
};

function MapEffect({ waypoints }: { waypoints: L.LatLng[] }) {
    const map = useMap();
    useEffect(() => {
        if (waypoints.length > 0) {
            map.fitBounds(L.latLngBounds(waypoints), { padding: [50, 50] });
        }
    }, [waypoints, map]);
    return null;
}

// Drop zone component
function DropZone({ onPropertyDrop }: { onPropertyDrop: (property: Property) => void }) {
    const map = useMap();

    useEffect(() => {
        const container = map.getContainer();
        
        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'copy';
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            try {
                const propertyData = e.dataTransfer!.getData('text/plain');
                const property = JSON.parse(propertyData) as Property;
                onPropertyDrop(property);
            } catch (error) {
                console.error('Error handling property drop:', error);
            }
        };

        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', handleDrop);

        return () => {
            container.removeEventListener('dragover', handleDragOver);
            container.removeEventListener('drop', handleDrop);
        };
    }, [map, onPropertyDrop]);

    return null;
}

function MapInstance({ setMap }: { setMap: (map: L.Map) => void }) {
    const map = useMap();
    useEffect(() => {
        if (map) {
            setMap(map);
        }
    }, [map, setMap]);
    return null;
}

const MAP_LAYERS: Record<MapLayer, { url: string; attribution: string }> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
  },
};

export function LogisticsMap({ properties, selectedProperties, onRouteSummary, transportMode }: LogisticsMapProps) {
    const [map, setMap] = useState<L.Map | null>(null);
    const [mapLayer, setMapLayer] = useState<MapLayer>('dark');
    const [showAllProperties, setShowAllProperties] = useState(false);
    const [showRoute, setShowRoute] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [waypoints, setWaypoints] = useState<L.LatLng[]>([]);
    
    // Calculate center point for the map view
    const centerPoint: [number, number] = properties.length > 0 && parseCoordinates(properties[0].attributes.center)
        ? parseCoordinates(properties[0].attributes.center)!
        : [51.505, -0.09]; // Default to London if no properties

    useEffect(() => {
        console.log('🗺️ LogisticsMap: selectedProperties changed');
        console.log('Selected properties count:', selectedProperties.length);
        console.log('Selected properties:', selectedProperties.map(p => p.attributes.description));
        
        // Update waypoints when selected properties change
        const newWaypoints = selectedProperties
            .map(p => parseCoordinates(p.attributes.center))
            .filter((p): p is [number, number] => p !== null)
            .map(p => L.latLng(p[0], p[1]));
        
        console.log('Generated waypoints count:', newWaypoints.length);
        console.log('Generated waypoints:', newWaypoints.map(wp => `${wp.lat},${wp.lng}`));
        
        setWaypoints(newWaypoints);
        console.log('🗺️ Waypoints state updated');
    }, [selectedProperties]);
    
    const handlePropertyDrop = (property: Property) => {
        // This is a placeholder for a function to add the dropped property
        // to the selection list, which should be managed in the parent component.
        console.log("Property dropped on map:", property.attributes.description);
        // In a real implementation, you'd call a function passed via props here.
        toast({
            title: "Property Dropped",
            description: `${property.attributes.description} was dropped on the map.`,
        });
    };

    if (properties.length === 0 && selectedProperties.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-800/60 backdrop-blur-sm rounded-lg border border-cyan-400/20">
                <div className="text-center p-8">
                    <MapPin className="h-16 w-16 mx-auto mb-4 text-gray-500" />
                    <p className="text-gray-400 text-lg">Drop properties here to begin planning</p>
                    <p className="text-gray-500 text-sm mt-2">Select properties from the list or drag them onto the map</p>
                </div>
            </div>
        );
    }
    
    // Use selected properties for the initial view, or all properties if none are selected
    const propertySource = selectedProperties.length > 0 ? selectedProperties : properties;
    const validProperties = propertySource.filter(p => p.attributes.center && parseCoordinates(p.attributes.center));

    if (validProperties.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-800/60 backdrop-blur-sm rounded-lg border border-cyan-400/20">
                <div className="text-center p-8">
                    <MapPin className="h-16 w-16 mx-auto mb-4 text-red-400" />
                    <p className="text-red-400 text-lg">No valid coordinates found</p>
                    <p className="text-gray-500 text-sm mt-2">Properties need valid location data to display on the map</p>
                </div>
            </div>
        );
    }
    
    const initialCenter = parseCoordinates(validProperties[0].attributes.center) || [0, 0];
  
    const handleRouteSummary = (summary: RouteSummary | null) => {
        onRouteSummary(summary);
    };

    return (
        <div className="relative w-full h-full">
            <MapContainer 
                center={centerPoint} 
                zoom={5} 
                className="w-full h-full z-0"
            >
                <MapInstance setMap={setMap} />
                {map ? (
                    <MapControls 
                        currentLayer={mapLayer}
                        onLayerChange={setMapLayer}
                        showAllProperties={showAllProperties}
                        onShowAllPropertiesChange={setShowAllProperties}
                        showRoute={showRoute}
                        onShowRouteChange={setShowRoute}
                        showLabels={showLabels}
                        onShowLabelsChange={setShowLabels}
                    />
                ) : null}

                {mapLayer === 'dark' && (
                    <TileLayer
                        key={mapLayer}
                        attribution={MAP_LAYERS[mapLayer].attribution}
                        url={MAP_LAYERS[mapLayer].url}
                    />
                )}
                {mapLayer === 'satellite' && (
                    <>
                        <TileLayer
                            key={mapLayer}
                            attribution={MAP_LAYERS[mapLayer].attribution}
                            url={MAP_LAYERS[mapLayer].url}
                        />
                        {showLabels && (
                            <>
                                {/* Country boundaries - distinct layer for borders only */}
                                <TileLayer
                                    key="satellite-boundaries"
                                    attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    opacity={0.4}
                                    zIndex={998}
                                    className="satellite-boundaries-overlay"
                                />
                                {/* Administrative boundaries with enhanced visibility */}
                                <TileLayer
                                    key="satellite-admin-boundaries"
                                    attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
                                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
                                    opacity={0.6}
                                    zIndex={999}
                                    className="satellite-admin-boundaries-overlay"
                                />
                                {/* Place labels and city names with enhanced contrast */}
                                <TileLayer
                                    key="satellite-labels"
                                    attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
                                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
                                    opacity={1.0}
                                    zIndex={1000}
                                    className="satellite-labels-overlay"
                                />
                            </>
                        )}
                    </>
                )}
                {mapLayer === 'topo' && (
                    <TileLayer
                        key={mapLayer}
                        attribution={MAP_LAYERS[mapLayer].attribution}
                        url={MAP_LAYERS[mapLayer].url}
                    />
                )}
                <MapEffect waypoints={waypoints} />
                <DropZone onPropertyDrop={handlePropertyDrop} />

                {/* Render all properties with faint icons if toggled */}
                {showAllProperties && properties.map(prop => {
                    if (selectedProperties.some(p => p.id === prop.id)) return null;

                    const position = parseCoordinates(prop.attributes.center);
                    if (!position) return null;

                    return (
                        <Marker 
                            key={`secondary-${prop.id}`} 
                            position={position} 
                            icon={createSecondaryIcon(prop)}
                        >
                            <Popup className="custom-popup">
                                <div className="text-sm bg-gray-900 text-white rounded-lg shadow-lg border border-gray-600 p-0 min-w-[250px]">
                                    <div className='p-3 space-y-2'>
                                        <div className="flex items-center justify-between">
                                            <p className="font-bold text-amber-400 truncate">{prop.attributes.description}</p>
                                            <Badge variant="outline" className="ml-2 text-xs">
                                                T{prop.attributes.landfieldTier}
                                            </Badge>
                                        </div>
                                        <p className='text-gray-300 text-sm'>{prop.attributes.country}</p>
                                        <div className="flex items-center justify-between text-xs text-gray-400">
                                            <span className="flex items-center">
                                                <Ruler className="h-3 w-3 mr-1" />
                                                {prop.attributes.tileCount.toLocaleString()} tiles
                                            </span>
                                            {prop.attributes.price > 0 && (
                                                <span className="text-green-400 font-medium">
                                                    {formatPrice(prop.attributes.price)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    )
                })}

                {/* Enhanced markers for selected properties */}
                {selectedProperties.map(prop => {
                    const position = parseCoordinates(prop.attributes.center);
                    if (!position) return null;

                    const role = determineLogisticsRole(prop);
                    const roleInfo = getPropertyRoleInfo(role);

                    return (
                        <Marker 
                            key={prop.id} 
                            position={position}
                            icon={createPropertyIcon(prop, true)}
                        >
                            <Popup className="custom-popup">
                                <div className="text-sm bg-gray-900 text-white rounded-lg shadow-lg border border-cyan-400/50 p-0 min-w-[280px]">
                                    <div className='p-4 space-y-3'>
                                        <div className="flex items-center justify-between">
                                            <p className="font-bold text-amber-400 truncate">{prop.attributes.description}</p>
                                            <div className="flex items-center gap-2">
                                                <Badge 
                                                    variant="outline" 
                                                    className={`text-xs ${getTierColor(prop.attributes.landfieldTier) === '#FCD34D' ? 'border-yellow-400 text-yellow-400' : 
                                                       getTierColor(prop.attributes.landfieldTier) === '#D1D5DB' ? 'border-gray-300 text-gray-300' : 
                                                       'border-orange-400 text-orange-400'}`}
                                                >
                                                    <Gem className="h-3 w-3 mr-1" />
                                                    T{prop.attributes.landfieldTier}
                                                </Badge>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <Badge 
                                                variant="outline" 
                                                style={{ 
                                                    backgroundColor: `${roleInfo.color}20`, 
                                                    borderColor: roleInfo.color,
                                                    color: roleInfo.color 
                                                }}
                                                className="text-xs"
                                            >
                                                {roleInfo.label}
                                            </Badge>
                                            {role === 'port' && (
                                                <Badge variant="outline" className="text-xs text-blue-400 border-blue-400">
                                                    Coastal
                                                </Badge>
                                            )}
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <p className='text-gray-300'>{prop.attributes.country}</p>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="flex items-center text-gray-400">
                                                    <Ruler className="h-3 w-3 mr-1" />
                                                    {prop.attributes.tileCount.toLocaleString()} tiles
                                                </div>
                                                {prop.attributes.price > 0 && (
                                                    <div className="flex items-center text-green-400 font-medium">
                                                        <DollarSign className="h-3 w-3 mr-1" />
                                                        {formatPrice(prop.attributes.price)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex items-center gap-1 text-xs bg-gray-800 border-gray-600 hover:bg-gray-700"
                                                onClick={() => copyToClipboard(`${position[0]}, ${position[1]}`, "Coordinates")}
                                            >
                                                <Copy className="h-3 w-3" />
                                                Copy Coords
                                            </Button>
                                            
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex items-center gap-1 text-xs bg-green-900/30 border-green-600 hover:bg-green-800/50 text-green-300"
                                                onClick={() => window.open(generateEarth2URL(position[0], position[1]), '_blank')}
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                View in E2
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    )
                })}
                
                {/* Routing Machine Component */}
                <RoutingMachine 
                    waypoints={waypoints} 
                    onRouteFound={handleRouteSummary} 
                    transportMode={transportMode}
                    properties={selectedProperties}
                />
            </MapContainer>
        </div>
    );
} 