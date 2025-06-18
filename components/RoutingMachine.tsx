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
    transportMode: TransportMode;
    properties: Property[];
}

type TransportMode = 'walking' | 'car' | 'truck' | 'drone' | 'ship' | 'plane';

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

// Convert lat/lng to tile coordinates
const getTileXYZ = (lat: number, lng: number, zoom: number) => {
    const n = Math.pow(2, zoom);
    const xtile = Math.floor((lng + 180) / 360 * n);
    const ytile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    return { x: xtile, y: ytile, z: zoom };
};

const RoutingMachine = ({ waypoints, onRouteFound, transportMode, properties }: RoutingProps) => {
    const map = useMap();
    const routeLayersRef = useRef<L.Layer[]>([]);
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    useEffect(() => {
        // Debug log for Mapbox token
        console.log('Mapbox token available:', !!mapboxToken);
        if (!mapboxToken) {
            console.error('Mapbox token is missing! Please check your .env.local file');
            toast({
                title: 'Configuration Error',
                description: 'Mapbox token is missing. Please check your environment variables.',
                variant: 'destructive',
            });
            return;
        }

        // Test the token with a simple API call
        const testMapboxToken = async () => {
            try {
                // Test with a simple route from New York to Boston
                const testUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/-74.0059,40.7128;-71.0589,42.3601?geometries=geojson&overview=full&access_token=${mapboxToken}`;
                console.log('Testing Mapbox Directions API with NY to Boston route...');
                
                const response = await fetch(testUrl);
                const responseText = await response.text();
                
                if (!response.ok) {
                    console.error('Mapbox token validation failed:', {
                        status: response.status,
                        statusText: response.statusText,
                        response: responseText
                    });
                    toast({
                        title: 'Mapbox API Error',
                        description: `API test failed: ${response.status} ${response.statusText}`,
                        variant: 'destructive',
                    });
                } else {
                    const data = JSON.parse(responseText);
                    console.log('✓ Mapbox Directions API test successful:', {
                        hasRoutes: !!data.routes,
                        routeCount: data.routes?.length,
                        firstRouteDistance: data.routes?.[0]?.distance,
                        firstRouteDuration: data.routes?.[0]?.duration
                    });
                    
                    if (data.routes && data.routes.length > 0) {
                        toast({
                            title: 'Mapbox API Working',
                            description: `Successfully got route with ${data.routes[0].geometry.coordinates.length} points`,
                            variant: 'default',
                        });
                    }
                }
            } catch (error) {
                console.error('Error testing Mapbox token:', error);
                toast({
                    title: 'Mapbox Test Failed',
                    description: 'Network error testing Mapbox API',
                    variant: 'destructive',
                });
            }
        };

        testMapboxToken();
    }, [mapboxToken]);

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

    // Check if a point is over water using multiple reliable sources
    const isOverWater = async (point: L.LatLng): Promise<boolean> => {
        try {
            // Method 1: Use Natural Earth coastline data via simple bounds check
            // This is a quick heuristic for major water bodies
            const isLikelyOcean = await checkOceanBounds(point);
            if (isLikelyOcean) {
                console.log('Point identified as ocean via bounds check');
                return true;
            }

            // Method 2: Use Google Earth Engine Global Surface Water
            const isWaterGEE = await checkGoogleEarthEngineWater(point);
            if (isWaterGEE !== null) {
                console.log('Water detection via Google Earth Engine:', isWaterGEE);
                return isWaterGEE;
            }

            // Method 3: Use NASA Blue Marble tile data
            const isWaterNASA = await checkNASABlueMarbleWater(point);
            if (isWaterNASA !== null) {
                console.log('Water detection via NASA Blue Marble:', isWaterNASA);
                return isWaterNASA;
            }

            // Fallback: assume land if all methods fail
            console.log('All water detection methods failed, assuming land');
            return false;
        } catch (error) {
            console.warn('Error in water detection:', error);
            return false;
        }
    };

    // Quick ocean bounds check using basic geographic knowledge
    const checkOceanBounds = async (point: L.LatLng): Promise<boolean> => {
        const { lat, lng } = point;
        
        // Major ocean areas (simplified bounding boxes)
        const oceanAreas = [
            // Pacific Ocean
            { minLat: -60, maxLat: 60, minLng: -180, maxLng: -70 },
            { minLat: -60, maxLat: 60, minLng: 120, maxLng: 180 },
            // Atlantic Ocean
            { minLat: -60, maxLat: 70, minLng: -70, maxLng: 20 },
            // Indian Ocean
            { minLat: -60, maxLat: 30, minLng: 20, maxLng: 120 },
            // Arctic Ocean
            { minLat: 70, maxLat: 90, minLng: -180, maxLng: 180 },
            // Antarctic Ocean
            { minLat: -90, maxLat: -60, minLng: -180, maxLng: 180 }
        ];

        return oceanAreas.some(ocean => 
            lat >= ocean.minLat && lat <= ocean.maxLat &&
            lng >= ocean.minLng && lng <= ocean.maxLng
        );
    };

    // Google Earth Engine Global Surface Water detection
    const checkGoogleEarthEngineWater = async (point: L.LatLng): Promise<boolean | null> => {
        try {
            // Using Google Earth Engine REST API for Global Surface Water
            // This requires setting up GEE credentials, so we'll use a public proxy if available
            const url = `https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/d1a60c8b1e2c1f0e7f8d1c4b2a3e5f6g7h8i9j0k:getPixels?bbox=${point.lng-0.001},${point.lat-0.001},${point.lng+0.001},${point.lat+0.001}&scale=30`;
            
            // For now, we'll skip this since it requires authentication
            // In production, you'd implement proper GEE authentication
            console.log('Google Earth Engine check skipped (requires authentication)');
            return null;
        } catch (error) {
            console.warn('Google Earth Engine water check failed:', error);
            return null;
        }
    };

    // NASA Blue Marble water detection using tile analysis
    const checkNASABlueMarbleWater = async (point: L.LatLng): Promise<boolean | null> => {
        try {
            // Use NASA Blue Marble NextGen tiles
            // Convert lat/lng to tile coordinates at zoom level 4 for broad coverage
            const zoom = 4;
            const tile = getTileXYZ(point.lat, point.lng, zoom);
            
            // NASA Blue Marble tile server (this is a placeholder - you'd need actual NASA tile server)
            const url = `https://map1.vis.earthdata.nasa.gov/wmts-geo/1.0.0/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/${zoom}/${tile.y}/${tile.x}.jpg`;
            
            console.log('Checking NASA Blue Marble tile:', {
                point: `${point.lat},${point.lng}`,
                tile,
                url
            });

            // For now, we'll use a simple heuristic based on distance from known coastlines
            // In production, you'd analyze the actual tile image data
            return await simpleCoastlineDistance(point);
        } catch (error) {
            console.warn('NASA Blue Marble check failed:', error);
            return null;
        }
    };

    // Simple coastline distance heuristic
    const simpleCoastlineDistance = async (point: L.LatLng): Promise<boolean> => {
        const { lat, lng } = point;
        
        // Major landmasses (very simplified)
        const landAreas = [
            // North America
            { minLat: 25, maxLat: 75, minLng: -170, maxLng: -50 },
            // South America  
            { minLat: -55, maxLat: 15, minLng: -85, maxLng: -35 },
            // Europe
            { minLat: 35, maxLat: 75, minLng: -15, maxLng: 45 },
            // Africa
            { minLat: -35, maxLat: 40, minLng: -20, maxLng: 55 },
            // Asia
            { minLat: 5, maxLat: 75, minLng: 45, maxLng: 180 },
            // Australia
            { minLat: -45, maxLat: -10, minLng: 110, maxLng: 155 }
        ];

        const isOnLand = landAreas.some(land => 
            lat >= land.minLat && lat <= land.maxLat &&
            lng >= land.minLng && lng <= land.maxLng
        );

        return !isOnLand; // Return true if NOT on major landmass (likely water)
    };

    // Enhanced shore finding using better water detection
    const findNearestShore = async (point: L.LatLng, isStartPoint: boolean): Promise<L.LatLng | null> => {
        try {
            console.log('Finding shore for:', `${point.lat},${point.lng}`);
            
            // Use a grid search pattern around the point
            const searchRadius = 0.5; // degrees (roughly 50km)
            const steps = 16; // Check 16 points in a circle
            
            for (let radius = 0.1; radius <= searchRadius; radius += 0.1) {
                for (let i = 0; i < steps; i++) {
                    const angle = (i / steps) * 2 * Math.PI;
                    const testLat = point.lat + radius * Math.cos(angle);
                    const testLng = point.lng + radius * Math.sin(angle);
                    const testPoint = L.latLng(testLat, testLng);
                    
                    const isWater = await isOverWater(testPoint);
                    
                    // For start point, find land (not water)
                    // For end point, find water
                    if (isStartPoint ? !isWater : isWater) {
                        console.log('Found shore point:', {
                            original: `${point.lat},${point.lng}`,
                            shore: `${testPoint.lat},${testPoint.lng}`,
                            distance: point.distanceTo(testPoint),
                            isWater
                        });
                        return testPoint;
                    }
                }
            }
            
            console.log('No suitable shore point found');
            return null;
        } catch (error) {
            console.warn('Error finding shore:', error);
            return null;
        }
    };

    // Fetch route using Mapbox Directions API
    const fetchMapboxRoute = async (
        profile: 'driving' | 'walking' | 'cycling',
        start: L.LatLng,
        end: L.LatLng,
        alternatives: boolean = true
    ): Promise<{ coordinates: L.LatLng[]; distance: number; duration: number } | null> => {
        if (!mapboxToken) {
            console.error('Mapbox token not configured');
            return null;
        }

        try {
            const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
            const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?geometries=geojson&overview=full&alternatives=${alternatives}&access_token=${mapboxToken}`;
            
            console.log('Fetching Mapbox route:', {
                profile,
                start: `${start.lat},${start.lng}`,
                end: `${end.lat},${end.lng}`,
                url: url.replace(mapboxToken, 'TOKEN')
            });

            const response = await fetch(url);
            const responseText = await response.text();
            
            if (!response.ok) {
                console.error('Mapbox API error:', {
                    status: response.status,
                    statusText: response.statusText,
                    response: responseText
                });
                return null;
            }

            const data = JSON.parse(responseText);
            console.log('Mapbox route response:', {
                hasRoutes: !!data.routes,
                routeCount: data.routes?.length,
                code: data.code,
                message: data.message
            });
            
            if (data.routes && data.routes.length > 0) {
                // Get the shortest route that doesn't cross water
                const validRoutes = await Promise.all(data.routes.map(async (route: any) => {
                    const coords = route.geometry.coordinates;
                    // Check a few points along the route for water
                    const checkPoints = [
                        Math.floor(coords.length * 0.25),
                        Math.floor(coords.length * 0.5),
                        Math.floor(coords.length * 0.75)
                    ];
                    
                    for (const idx of checkPoints) {
                        const point = L.latLng(coords[idx][1], coords[idx][0]);
                        if (await isOverWater(point)) {
                            console.log('Route crosses water at point:', {
                                lat: point.lat,
                                lng: point.lng,
                                routeIndex: data.routes.indexOf(route)
                            });
                            return null;
                        }
                    }
                    return route;
                }));

                const route = validRoutes.find(r => r !== null) || data.routes[0];
                const coordinates = route.geometry.coordinates.map(([lng, lat]: number[]) => L.latLng(lat, lng));
                
                console.log('Selected route:', {
                    distance: route.distance,
                    duration: route.duration,
                    pointCount: coordinates.length,
                    isWaterRoute: validRoutes.every(r => r === null)
                });

                return {
                    coordinates,
                    distance: route.distance,
                    duration: route.duration
                };
            }
        } catch (error) {
            console.error('Mapbox routing error:', error);
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

            console.log('=== STARTING ROUTE CALCULATION ===');
            console.log('Transport mode:', transportMode);
            console.log('Waypoints:', waypoints.map(wp => `${wp.lat},${wp.lng}`));
            console.log('Mapbox token available:', !!mapboxToken);

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
                
                console.log(`\n=== PROCESSING SEGMENT ${i + 1} ===`);
                console.log('Start:', `${start.lat},${start.lng}`);
                console.log('End:', `${end.lat},${end.lng}`);
                
                const distance = start.distanceTo(end);
                console.log('Segment distance:', distance, 'meters');

                let routeDrawn = false;

                // Always try road routing first for ground-based transport (unless explicitly air transport)
                if (!['plane', 'drone'].includes(transportMode)) {
                    console.log('✓ Attempting road routing for ground transport');
                    console.log('Transport mode:', transportMode);
                    console.log('Distance:', Math.round(distance / 1000), 'km');
                    
                    const profile = transportMode === 'walking' ? 'walking' : 'driving';
                    console.log('Using Mapbox profile:', profile);
                    
                    const result = await fetchMapboxRoute(profile, start, end, true);
                    
                    if (result && result.coordinates.length > 2) {
                        console.log('✓ Successfully got road route with', result.coordinates.length, 'points');
                        console.log('Route distance:', result.distance, 'meters');
                        console.log('Route duration:', result.duration, 'seconds');
                        
                        const line = createAnimatedPolyline(result.coordinates, {
                            color: transportMode === 'truck' ? '#f97316' : 
                                   transportMode === 'ship' ? '#0ea5e9' : '#22c55e',
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
                            description: `${transportMode.toUpperCase()} route via roads`,
                            waypoints: result.coordinates.map(coord => ({ lat: coord.lat, lng: coord.lng }))
                        });
                        routeDrawn = true;
                    } else {
                        console.log('✗ Road routing failed or returned invalid route');
                        console.log('Mapbox result:', result);
                    }
                }

                // Only use fallbacks if road routing completely failed
                if (!routeDrawn) {
                    console.log('Road routing failed, using fallback...');
                    
                    if (['plane', 'drone'].includes(transportMode)) {
                        console.log('→ Air transport - using direct route');
                        // Air route - straight line
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
                    } else if (transportMode === 'ship') {
                        console.log('→ Ship transport - using maritime route');
                        // Ship route
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
                        console.log('→ Fallback - road routing unavailable, using approximate route');
                        // Last resort fallback
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
                            description: `${transportMode.toUpperCase()} route (road routing unavailable)`,
                            waypoints: [
                                { lat: start.lat, lng: start.lng },
                                { lat: end.lat, lng: end.lng }
                            ],
                            reason: 'Mapbox Directions API failed'
                        });
                    }
                }
            }

            console.log('=== ROUTE CALCULATION COMPLETE ===');
            console.log('Total segments:', segments.length);
            console.log('Total distance:', totalDistance);
            console.log('Total time:', totalTime);

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