'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { toast } from '@/components/ui/use-toast';

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

interface Property {
    id: string;
    attributes: {
        center: string;
        description: string;
        country: string;
        tileCount: number;
        landfieldTier: number;
        price: number;
    };
}

interface RoutingProps {
    waypoints: L.LatLng[];
    onRouteFound: (summary: RouteSummary | null) => void;
    transportMode: 'walking' | 'car' | 'truck' | 'drone' | 'ship' | 'plane';
    properties: Property[];
}

// Create waypoint icon
const createWaypointIcon = (isFirst: boolean, isLast: boolean, index: number) => {
    const color = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#3b82f6';
    let label: string;
    if (isFirst) label = 'A';
    else if (isLast) label = 'B';
    else label = `${index}`;

    return L.divIcon({
        html: `<div style="background-color: ${color}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; box-shadow: 0 0 5px rgba(0,0,0,0.5);">${label}</div>`,
        className: 'custom-waypoint-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
};

// Format price for display
const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
};

// Generate Earth2 URL
const generateEarth2URL = (lat: number, lng: number) => {
    return `https://app.earth2.io/?lat=${lat}&lng=${lng}#`;
};

// Copy text to clipboard
const copyToClipboard = async (text: string, label: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast({
            title: `${label} Copied`,
            description: text,
        });
    } catch (err) {
        console.error('Failed to copy:', err);
        toast({
            title: 'Copy Failed',
            description: 'Please try again',
            variant: 'destructive',
        });
    }
};

const RoutingMachine = ({ waypoints, onRouteFound, transportMode, properties }: RoutingProps) => {
    const map = useMap();
    const routeLayersRef = useRef<L.Layer[]>([]);
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    // Get transport speeds in m/s
    const getSpeed = (mode: typeof transportMode) => {
        switch(mode) {
            case 'ship': return 20 * 0.51444; // 20 knots to m/s
            case 'plane': return 250; // 250 m/s (approx 900 km/h)
            case 'drone': return 25;  // 25 m/s
            case 'car': return 16.67; // 60 km/h in m/s
            case 'truck': return 13.89; // 50 km/h in m/s
            case 'walking': return 1.5; // Walking speed
            default: return 1.5;
        }
    };

    // Decode Mapbox polyline
    const decodeMapboxLine = (str: string): L.LatLng[] => {
        const coordinates = str.split(';').map(coord => {
            const [lng, lat] = coord.split(',').map(Number);
            return L.latLng(lat, lng);
        });
        return coordinates;
    };

    // Check if a point is over water using Mapbox isochrone API
    const isOverWater = async (point: L.LatLng): Promise<boolean> => {
        if (!mapboxToken) return false;
        
        try {
            const url = `https://api.mapbox.com/isochrone/v1/mapbox/driving/${point.lng},${point.lat}?contours_minutes=1&access_token=${mapboxToken}`;
            const response = await fetch(url);
            const data = await response.json();
            
            // If we can't generate an isochrone for driving, it's likely water
            return !data.features || data.features.length === 0;
        } catch (error) {
            console.warn('Error checking if point is over water:', error);
            return false;
        }
    };

    // Fetch route using Mapbox Directions API
    const fetchMapboxRoute = async (
        profile: 'driving' | 'walking' | 'cycling',
        start: L.LatLng,
        end: L.LatLng
    ): Promise<{ coordinates: L.LatLng[]; distance: number; duration: number } | null> => {
        if (!mapboxToken) {
            console.error('Mapbox token not configured');
            return null;
        }

        try {
            const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
            const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?geometries=geojson&overview=full&access_token=${mapboxToken}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Mapbox API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const coordinates = route.geometry.coordinates.map(([lng, lat]: number[]) => L.latLng(lat, lng));
                
                return {
                    coordinates,
                    distance: route.distance,
                    duration: route.duration
                };
            }
        } catch (error) {
            console.warn('Mapbox routing error:', error);
        }
        return null;
    };

    // Create an animated polyline
    const createAnimatedPolyline = (coordinates: L.LatLng[], options: L.PolylineOptions) => {
        const line = L.polyline(coordinates, {
            ...options,
            className: 'animated-route-line'
        });
        return line;
    };

    useEffect(() => {
        if (!map || waypoints.length < 2) return;

        // Cleanup function to remove old routes
        const cleanup = () => {
            routeLayersRef.current.forEach(layer => {
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            });
            routeLayersRef.current = [];
        };

        cleanup();

        const drawRoute = async () => {
            const drawnLayers: L.Layer[] = [];
            let totalDistance = 0;
            let totalTime = 0;
            const segments: RouteSegment[] = [];

            // Add waypoint markers with property information
            waypoints.forEach((point, index) => {
                // Find the corresponding property
                const property = properties.find(p => {
                    const coords = p.attributes.center.match(/\(([^,]+),\s*([^)]+)\)/);
                    if (!coords) return false;
                    const [_, lng, lat] = coords;
                    return Math.abs(parseFloat(lat) - point.lat) < 0.0001 && 
                           Math.abs(parseFloat(lng) - point.lng) < 0.0001;
                });

                const marker = L.marker(point, {
                    icon: createWaypointIcon(index === 0, index === waypoints.length - 1, index)
                });

                if (property) {
                    const popupContent = `
                        <div class="text-sm bg-gray-900 text-white rounded-lg shadow-lg border border-cyan-400/50 p-0 min-w-[280px]">
                            <div class="p-4 space-y-3">
                                <div class="flex items-center justify-between">
                                    <p class="font-bold text-amber-400 truncate">${property.attributes.description}</p>
                                    <div class="flex items-center gap-2">
                                        <span class="px-2 py-1 text-xs border rounded-full border-yellow-400 text-yellow-400">
                                            T${property.attributes.landfieldTier}
                                        </span>
                                    </div>
                                </div>
                                
                                <div class="space-y-2">
                                    <p class="text-gray-300">${property.attributes.country}</p>
                                    <div class="grid grid-cols-2 gap-2 text-xs">
                                        <div class="flex items-center text-gray-400">
                                            <span class="mr-1">📏</span>
                                            ${property.attributes.tileCount.toLocaleString()} tiles
                                        </div>
                                        ${property.attributes.price > 0 ? `
                                            <div class="flex items-center text-green-400 font-medium">
                                                <span class="mr-1">💰</span>
                                                ${formatPrice(property.attributes.price)}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                                
                                <div class="flex items-center justify-between pt-2 border-t border-gray-700">
                                    <button
                                        onclick="copyToClipboard('${point.lat}, ${point.lng}', 'Coordinates')"
                                        class="px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded hover:bg-gray-700 flex items-center gap-1"
                                    >
                                        <span>📋</span>
                                        Copy Coords
                                    </button>
                                    
                                    <a
                                        href="${generateEarth2URL(point.lat, point.lng)}"
                                        target="_blank"
                                        class="px-2 py-1 text-xs bg-green-900/30 border border-green-600 rounded hover:bg-green-800/50 text-green-300 flex items-center gap-1"
                                    >
                                        <span>🌍</span>
                                        View in E2
                                    </a>
                                </div>
                            </div>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                }

                marker.addTo(map);
                drawnLayers.push(marker);
            });

            // Process each segment
            for (let i = 0; i < waypoints.length - 1; i++) {
                const start = waypoints[i];
                const end = waypoints[i + 1];
                
                // Determine if we need water or air transport
                const startIsWater = await isOverWater(start);
                const endIsWater = await isOverWater(end);
                const distance = start.distanceTo(end);
                
                if (transportMode === 'plane' || transportMode === 'drone' || distance > 1000000) {
                    // Air route
                    const line = createAnimatedPolyline([start, end], {
                        color: '#3b82f6',
                        weight: 5,
                        opacity: 0.7,
                        dashArray: '10, 10'
                    }).addTo(map);
                    drawnLayers.push(line);
                    
                    const time = distance / getSpeed(transportMode);
                    totalDistance += distance;
                    totalTime += time;
                    
                    segments.push({
                        mode: transportMode,
                        distance,
                        time,
                        description: `${transportMode.toUpperCase()} route (direct flight)`,
                        waypoints: [
                            { lat: start.lat, lng: start.lng },
                            { lat: end.lat, lng: end.lng }
                        ]
                    });
                } else if (transportMode === 'ship' || (startIsWater && endIsWater)) {
                    // Water route
                    const line = createAnimatedPolyline([start, end], {
                        color: '#0ea5e9',
                        weight: 5,
                        opacity: 0.7,
                        dashArray: '15, 10'
                    }).addTo(map);
                    drawnLayers.push(line);
                    
                    const time = distance / getSpeed('ship');
                    totalDistance += distance;
                    totalTime += time;
                    
                    segments.push({
                        mode: 'ship',
                        distance,
                        time,
                        description: 'Maritime route',
                        waypoints: [
                            { lat: start.lat, lng: start.lng },
                            { lat: end.lat, lng: end.lng }
                        ]
                    });
                } else {
                    // Road route
                    const profile = transportMode === 'walking' ? 'walking' : 'driving';
                    const result = await fetchMapboxRoute(profile, start, end);
                    
                    if (result) {
                        const line = createAnimatedPolyline(result.coordinates, {
                            color: transportMode === 'truck' ? '#f97316' : '#22c55e',
                            weight: 5,
                            opacity: 0.8
                        }).addTo(map);
                        drawnLayers.push(line);
                        
                        totalDistance += result.distance;
                        totalTime += result.duration;
                        
                        segments.push({
                            mode: transportMode,
                            distance: result.distance,
                            time: result.duration,
                            description: `${transportMode.toUpperCase()} route`,
                            waypoints: result.coordinates.map(coord => ({ lat: coord.lat, lng: coord.lng }))
                        });
                    } else {
                        // Fallback to straight line if routing fails
                        console.warn('Road routing failed, falling back to straight line');
                        const line = createAnimatedPolyline([start, end], {
                            color: '#ef4444',
                            weight: 5,
                            opacity: 0.7,
                            dashArray: '5, 5'
                        }).addTo(map);
                        drawnLayers.push(line);
                        
                        const time = distance / getSpeed(transportMode);
                        totalDistance += distance;
                        totalTime += time;
                        
                        segments.push({
                            mode: transportMode,
                            distance,
                            time,
                            description: `${transportMode.toUpperCase()} route (approximate)`,
                            waypoints: [
                                { lat: start.lat, lng: start.lng },
                                { lat: end.lat, lng: end.lng }
                            ]
                        });
                    }
                }
            }

            routeLayersRef.current = drawnLayers;

            // Return route summary
            const summary: RouteSummary = {
                totalDistance,
                totalTime,
                segments,
                isMultiModal: segments.length > 1 && new Set(segments.map(s => s.mode)).size > 1
            };

            onRouteFound(summary);
            
            // Fit map to route
            if (drawnLayers.length > 0) {
                const group = new L.FeatureGroup(drawnLayers);
                map.fitBounds(group.getBounds(), { padding: [50, 50] });
            }
        };

        drawRoute();

        return cleanup;
    }, [map, waypoints, transportMode, onRouteFound, mapboxToken, properties]);

    return null;
};

export default RoutingMachine; 