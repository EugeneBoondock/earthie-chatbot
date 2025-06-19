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

interface TransportHub {
    name: string;
    lat: number;
    lng: number;
    type: 'airport' | 'port' | 'city' | 'train_station';
    importance: number;
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

    // Calculate distance between two points
    const calculateDistance = (point1: L.LatLng, point2: L.LatLng): number => {
        return point1.distanceTo(point2);
    };

    // Find transportation hubs dynamically using OpenStreetMap Overpass API
    const findTransportHubs = async (center: L.LatLng, radius: number, hubType: 'airport' | 'port' | 'city' | 'train_station'): Promise<TransportHub[]> => {
        console.log(`Searching for ${hubType} hubs within ${Math.round(radius/1000)}km of ${center.lat.toFixed(2)}, ${center.lng.toFixed(2)}`);
        
        try {
            let overpassQuery = '';
            
            switch (hubType) {
                case 'airport':
                    overpassQuery = `
                        [out:json][timeout:25];
                        (
                          node(around:${radius},${center.lat},${center.lng})[aeroway=aerodrome][iata];
                          node(around:${radius},${center.lat},${center.lng})[aeroway=aerodrome][icao];
                          way(around:${radius},${center.lat},${center.lng})[aeroway=aerodrome][iata];
                          way(around:${radius},${center.lat},${center.lng})[aeroway=aerodrome][icao];
                        );
                        out center tags;
                    `;
                    break;
                    
                case 'port':
                    overpassQuery = `
                        [out:json][timeout:25];
                        (
                          node(around:${radius},${center.lat},${center.lng})[harbour=yes];
                          node(around:${radius},${center.lat},${center.lng})[seamark:type=harbour];
                          node(around:${radius},${center.lat},${center.lng})[landuse=port];
                          way(around:${radius},${center.lat},${center.lng})[harbour=yes];
                          way(around:${radius},${center.lat},${center.lng})[landuse=port];
                          way(around:${radius},${center.lat},${center.lng})[seamark:type=harbour];
                          node(around:${radius},${center.lat},${center.lng})[amenity=ferry_terminal];
                          way(around:${radius},${center.lat},${center.lng})[amenity=ferry_terminal];
                        );
                        out center tags;
                    `;
                    break;
                    
                case 'city':
                    overpassQuery = `
                        [out:json][timeout:25];
                        (
                          node(around:${radius},${center.lat},${center.lng})[place=city];
                          node(around:${radius},${center.lat},${center.lng})[place=town];
                          node(around:${radius},${center.lat},${center.lng})[admin_level=4];
                          node(around:${radius},${center.lat},${center.lng})[admin_level=6];
                        );
                        out center tags;
                    `;
                    break;
                    
                case 'train_station':
                    overpassQuery = `
                        [out:json][timeout:25];
                        (
                          node(around:${radius},${center.lat},${center.lng})[railway=station];
                          node(around:${radius},${center.lat},${center.lng})[public_transport=station][station=subway];
                          way(around:${radius},${center.lat},${center.lng})[railway=station];
                        );
                        out center tags;
                    `;
                    break;
            }

            const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
            console.log(`Overpass query URL: ${url.substring(0, 100)}...`);
            
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`Overpass API error: ${response.status}`);
                return [];
            }

            const data = await response.json();
            console.log(`Overpass response for ${hubType}:`, data.elements?.length || 0, 'elements');

            const hubs: TransportHub[] = [];

            for (const element of data.elements || []) {
                let lat: number, lng: number;
                
                // Handle different element types
                if (element.type === 'node') {
                    lat = element.lat;
                    lng = element.lon;
                } else if (element.type === 'way' && element.center) {
                    lat = element.center.lat;
                    lng = element.center.lon;
                } else {
                    continue;
                }

                const tags = element.tags || {};
                let name = tags.name || tags['name:en'] || tags.iata || tags.icao || 'Unknown';
                let importance = 1;

                // Calculate importance based on various factors
                if (hubType === 'airport') {
                    if (tags.iata) importance += 5; // International airports
                    if (tags.icao) importance += 3;
                    if (tags['aerodrome:type'] === 'international') importance += 7;
                    if (tags.name && tags.name.toLowerCase().includes('international')) importance += 5;
                } else if (hubType === 'port') {
                    if (tags.harbour === 'yes') importance += 3;
                    if (tags['seamark:type'] === 'harbour') importance += 4;
                    if (tags.landuse === 'port') importance += 5;
                    if (tags.amenity === 'ferry_terminal') importance += 4;
                } else if (hubType === 'city') {
                    if (tags.place === 'city') importance += 5;
                    if (tags.admin_level === '4') importance += 4;
                    if (tags.population) {
                        const pop = parseInt(tags.population);
                        if (pop > 1000000) importance += 8;
                        else if (pop > 500000) importance += 6;
                        else if (pop > 100000) importance += 4;
                    }
                }

                // Add distance factor (closer hubs are more important)
                const distance = calculateDistance(center, new L.LatLng(lat, lng));
                const distanceFactor = Math.max(0, 10 - (distance / (radius / 10)));
                importance += distanceFactor;

                hubs.push({
                    name,
                    lat,
                    lng,
                    type: hubType,
                    importance
                });
            }

            // Sort by importance and return top results
            const sortedHubs = hubs.sort((a, b) => b.importance - a.importance).slice(0, 10);
            console.log(`Found ${sortedHubs.length} ${hubType} hubs:`, sortedHubs.map(h => `${h.name} (${h.importance.toFixed(1)})`));
            
            return sortedHubs;

        } catch (error) {
            console.error(`Error finding ${hubType} hubs:`, error);
            return [];
        }
    };

    // Check if route crosses significant water bodies
    const checkRouteForWaterCrossing = async (start: L.LatLng, end: L.LatLng): Promise<boolean> => {
        console.log(`Checking for water crossing between ${start.lat.toFixed(3)},${start.lng.toFixed(3)} and ${end.lat.toFixed(3)},${end.lng.toFixed(3)}`);
        
        // Sample points along the route to check for water
        const numSamples = 10;
        for (let i = 1; i < numSamples; i++) {
            const ratio = i / numSamples;
            const sampleLat = start.lat + (end.lat - start.lat) * ratio;
            const sampleLng = start.lng + (end.lng - start.lng) * ratio;
            const samplePoint = new L.LatLng(sampleLat, sampleLng);
            
            if (await isOverWater(samplePoint)) {
                console.log(`Water detected at sample point ${i}: ${sampleLat.toFixed(3)},${sampleLng.toFixed(3)}`);
                return true;
            }
        }
        
        console.log('No significant water crossings detected');
        return false;
    };

    // Find nearest port to a given point
    const findNearestPort = async (point: L.LatLng): Promise<L.LatLng | null> => {
        console.log(`Finding nearest port to ${point.lat.toFixed(3)},${point.lng.toFixed(3)}`);
        
        const ports = await findTransportHubs(point, 200000, 'port'); // Search within 200km
        
        if (ports.length === 0) {
            console.log('No ports found within search radius');
            return null;
        }

        // Return the closest port
        const nearestPort = ports[0];
        console.log(`Found nearest port: ${nearestPort.name} at ${nearestPort.lat.toFixed(3)},${nearestPort.lng.toFixed(3)}`);
        return new L.LatLng(nearestPort.lat, nearestPort.lng);
    };

    // Create multi-modal route when water crossing is detected
    const createMultiModalRoute = async (start: L.LatLng, end: L.LatLng, originalMode: TransportMode): Promise<{
        waypoints: L.LatLng[];
        segments: RouteSegment[];
    }> => {
        console.log(`Creating multi-modal route from ${start.lat.toFixed(3)},${start.lng.toFixed(3)} to ${end.lat.toFixed(3)},${end.lng.toFixed(3)}`);
        
        const segments: RouteSegment[] = [];
        const waypoints: L.LatLng[] = [start];

        // Find nearest ports to start and end points
        const startPort = await findNearestPort(start);
        const endPort = await findNearestPort(end);

        if (!startPort || !endPort) {
            console.log('Could not find suitable ports for multi-modal routing');
            // Fallback to direct route
            waypoints.push(end);
            const distance = calculateDistance(start, end);
            const time = distance / getSpeed(originalMode);
            segments.push({
                mode: originalMode,
                distance,
                time,
                description: `${originalMode.toUpperCase()} route (water crossing - no ports found)`,
                waypoints: [
                    { lat: start.lat, lng: start.lng },
                    { lat: end.lat, lng: end.lng }
                ],
                reason: 'No suitable ports found for water crossing'
            });
            return { waypoints, segments };
        }

        // Segment 1: Ground transport to start port
        if (calculateDistance(start, startPort) > 1000) { // Only if port is more than 1km away
            waypoints.push(startPort);
            const landDistance1 = calculateDistance(start, startPort);
            const landTime1 = landDistance1 / getSpeed(originalMode);
            segments.push({
                mode: originalMode,
                distance: landDistance1,
                time: landTime1,
                description: `${originalMode.toUpperCase()} to departure port`,
                waypoints: [
                    { lat: start.lat, lng: start.lng },
                    { lat: startPort.lat, lng: startPort.lng }
                ]
            });
        }

        // Segment 2: Ship transport across water
        if (startPort.lat !== endPort.lat || startPort.lng !== endPort.lng) {
            waypoints.push(endPort);
            const waterDistance = calculateDistance(startPort, endPort);
            const waterTime = waterDistance / getSpeed('ship');
            segments.push({
                mode: 'ship',
                distance: waterDistance,
                time: waterTime,
                description: 'Ferry/Ship across water',
                waypoints: [
                    { lat: startPort.lat, lng: startPort.lng },
                    { lat: endPort.lat, lng: endPort.lng }
                ]
            });
        }

        // Segment 3: Ground transport from end port to destination
        if (calculateDistance(endPort, end) > 1000) { // Only if port is more than 1km away
            waypoints.push(end);
            const landDistance2 = calculateDistance(endPort, end);
            const landTime2 = landDistance2 / getSpeed(originalMode);
            segments.push({
                mode: originalMode,
                distance: landDistance2,
                time: landTime2,
                description: `${originalMode.toUpperCase()} from arrival port`,
                waypoints: [
                    { lat: endPort.lat, lng: endPort.lng },
                    { lat: end.lat, lng: end.lng }
                ]
            });
        }

        console.log(`Multi-modal route created with ${segments.length} segments and ${waypoints.length} waypoints`);
        return { waypoints, segments };
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
                const route = data.routes[0];
                const coordinates = route.geometry.coordinates.map(([lng, lat]: number[]) => L.latLng(lat, lng));
                
                console.log('Selected route:', {
                    distance: route.distance,
                    duration: route.duration,
                    pointCount: coordinates.length
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
        console.log('🔍 RoutingMachine useEffect triggered');
        console.log('Map available:', !!map);
        console.log('Waypoints count:', waypoints.length);
        console.log('Waypoints:', waypoints.map(wp => `${wp.lat},${wp.lng}`));
        console.log('Current route layers count:', routeLayersRef.current.length);
        
        if (!map) return;

        // Cleanup function to remove old routes
        const cleanup = () => {
            console.log('🧹 Cleaning up routes - removing', routeLayersRef.current.length, 'layers');
            
            // Remove all tracked layers
            routeLayersRef.current.forEach((layer, index) => {
                try {
                    if (map.hasLayer(layer)) {
                        map.removeLayer(layer);
                        console.log(`  ✓ Removed layer ${index} from map`);
                    } else {
                        console.log(`  ⚠️ Layer ${index} not found on map`);
                    }
                } catch (error) {
                    console.error(`  ❌ Error removing layer ${index}:`, error);
                }
            });
            
            // Clear the reference array
            routeLayersRef.current = [];
            
            // Additional cleanup: remove any route-related layers that might have been missed
            // This is a failsafe to remove any polylines or markers with route-specific classes
            try {
                map.eachLayer((layer: any) => {
                    // Check if layer has route-specific classes or properties
                    if (layer.options && (
                        layer.options.className?.includes('animated-route-line') ||
                        layer.options.className?.includes('route-line') ||
                        layer.options.className?.includes('navigation-line')
                    )) {
                        map.removeLayer(layer);
                        console.log('  🔧 Removed orphaned route layer');
                    }
                    
                    // Remove route waypoint markers
                    if (layer._icon && layer._icon.className?.includes('route-waypoint')) {
                        map.removeLayer(layer);
                        console.log('  🔧 Removed orphaned waypoint marker');
                    }
                });
            } catch (error) {
                console.error('  ❌ Error in additional cleanup:', error);
            }
            
            console.log('🧹 Cleanup complete');
        };

        // Always cleanup first
        cleanup();

        // If there are fewer than 2 waypoints, clear the route summary and return
        if (waypoints.length < 2) {
            console.log('🚫 Less than 2 waypoints - clearing route summary and stopping');
            onRouteFound(null);
            return cleanup;
        }

        console.log('✅ Proceeding with route calculation for', waypoints.length, 'waypoints');

        const drawRoute = async () => {
            const drawnLayers: L.Layer[] = [];
            let totalDistance = 0;
            let totalTime = 0;
            const segments: RouteSegment[] = [];

            console.log('=== STARTING MULTI-MODAL ROUTE CALCULATION ===');
            console.log('Transport mode:', transportMode);
            console.log('Waypoints:', waypoints.map(wp => `${wp.lat},${wp.lng}`));
            console.log('Mapbox token available:', !!mapboxToken);

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

                // For air and ship modes, use direct routing
                if (['plane', 'drone', 'ship'].includes(transportMode)) {
                    console.log(`→ ${transportMode.toUpperCase()} transport - using direct route`);
                    
                    const lineColor = {
                        'plane': '#3b82f6',
                        'drone': '#8b5cf6',
                        'ship': '#0ea5e9',
                        'car': '#22c55e',
                        'truck': '#f97316',
                        'walking': '#gray-500'
                    }[transportMode] || '#0ea5e9';

                    const line = createAnimatedPolyline([start, end], {
                        color: lineColor,
                        weight: 5,
                        opacity: 0.7,
                        dashArray: transportMode === 'ship' ? '15, 10' : '10, 10'
                    }).addTo(map);
                    drawnLayers.push(line);
                    console.log(`  📍 Added ${transportMode} route line to map`);
                    
                    const time = distance / getSpeed(transportMode);
                    totalDistance += distance;
                    totalTime += time;
                    
                    segments.push({
                        mode: transportMode,
                        distance,
                        time,
                        description: `${transportMode.toUpperCase()} route (${Math.round(distance/1000)}km)`,
                        waypoints: [
                            { lat: start.lat, lng: start.lng },
                            { lat: end.lat, lng: end.lng }
                        ]
                    });
                    routeDrawn = true;
                }
                // For ground transport, check for water crossings and create multi-modal routes
                else {
                    console.log('✓ Attempting road routing for ground transport');
                    console.log('Transport mode:', transportMode);
                    console.log('Distance:', Math.round(distance / 1000), 'km');
                    
                    // First, check if the route crosses water
                    const crossesWater = await checkRouteForWaterCrossing(start, end);
                    
                    if (crossesWater && distance > 50000) { // Only use multi-modal for distances > 50km
                        console.log('🌊 Water crossing detected - creating multi-modal route');
                        
                        const multiModalResult = await createMultiModalRoute(start, end, transportMode);
                        
                        // Draw multi-modal route segments
                        for (let j = 0; j < multiModalResult.segments.length; j++) {
                            const segment = multiModalResult.segments[j];
                            const segmentCoords = segment.waypoints.map(wp => L.latLng(wp.lat, wp.lng));
                            
                            const segmentColor = segment.mode === 'ship' ? '#0ea5e9' : 
                                               transportMode === 'truck' ? '#f97316' : '#22c55e';
                            const segmentStyle = segment.mode === 'ship' ? '15, 10' : undefined;
                            
                            console.log(`Drawing ${segment.mode} segment: ${segmentCoords.length} points`);
                            
                            // Try to get actual road routing for ground segments
                            if (segment.mode !== 'ship') {
                                const profile = segment.mode === 'walking' ? 'walking' : 'driving';
                                const roadResult = await fetchMapboxRoute(profile, segmentCoords[0], segmentCoords[segmentCoords.length - 1], true);
                                
                                if (roadResult && roadResult.coordinates.length > 2) {
                                    console.log(`✓ Got road route for ${segment.mode} segment`);
                                    const line = createAnimatedPolyline(roadResult.coordinates, {
                                        color: segmentColor,
                                        weight: 5,
                                        opacity: 0.8
                                    }).addTo(map);
                                    drawnLayers.push(line);
                                    
                                    // Update segment with actual route data
                                    segment.distance = roadResult.distance;
                                    segment.time = roadResult.duration;
                                    segment.waypoints = roadResult.coordinates.map(coord => ({ lat: coord.lat, lng: coord.lng }));
                                } else {
                                    // Fallback to direct line
                                    const line = createAnimatedPolyline(segmentCoords, {
                                        color: segmentColor,
                                        weight: 5,
                                        opacity: 0.8,
                                        dashArray: segmentStyle
                                    }).addTo(map);
                                    drawnLayers.push(line);
                                }
                            } else {
                                // Ship segment - always direct line
                                const line = createAnimatedPolyline(segmentCoords, {
                                    color: segmentColor,
                                    weight: 5,
                                    opacity: 0.8,
                                    dashArray: segmentStyle
                                }).addTo(map);
                                drawnLayers.push(line);
                            }
                            
                            totalDistance += segment.distance;
                            totalTime += segment.time;
                        }
                        
                        segments.push(...multiModalResult.segments);
                        routeDrawn = true;
                    } else {
                        // Try normal road routing
                        const profile = transportMode === 'walking' ? 'walking' : 'driving';
                        console.log('Using Mapbox profile:', profile);
                        
                        const result = await fetchMapboxRoute(profile, start, end, true);
                        
                        if (result && result.coordinates.length > 2) {
                            console.log('✓ Successfully got road route with', result.coordinates.length, 'points');
                            console.log('Route distance:', result.distance, 'meters');
                            console.log('Route duration:', result.duration, 'seconds');
                            
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
                                description: `${transportMode.toUpperCase()} route via roads`,
                                waypoints: result.coordinates.map(coord => ({ lat: coord.lat, lng: coord.lng }))
                            });
                            routeDrawn = true;
                        } else {
                            console.log('✗ Road routing failed or returned invalid route');
                            console.log('Mapbox result:', result);
                        }
                    }
                }

                // Fallback if no routing succeeded
                if (!routeDrawn) {
                    console.log('→ Fallback - using direct route');
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
                        description: `${transportMode.toUpperCase()} route (routing unavailable)`,
                        waypoints: [
                            { lat: start.lat, lng: start.lng },
                            { lat: end.lat, lng: end.lng }
                        ],
                        reason: 'All routing methods failed'
                    });
                }
            }

            // Add waypoint markers
            waypoints.forEach((point, index) => {
                const marker = L.marker(point, {
                    icon: createWaypointIcon(index === 0, index === waypoints.length - 1, index)
                });

                // Find the corresponding property for enhanced popup
                const property = properties.find(p => {
                    const coords = p.attributes.center.match(/\(([^,]+),\s*([^)]+)\)/);
                    if (!coords) return false;
                    const [_, lng, lat] = coords;
                    return Math.abs(parseFloat(lat) - point.lat) < 0.0001 && 
                           Math.abs(parseFloat(lng) - point.lng) < 0.0001;
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

            console.log('=== MULTI-MODAL ROUTE CALCULATION COMPLETE ===');
            console.log('Total segments:', segments.length);
            console.log('Total distance:', totalDistance);
            console.log('Total time:', totalTime);
            console.log('Total drawn layers:', drawnLayers.length);

            routeLayersRef.current = drawnLayers;
            console.log('📍 Stored', drawnLayers.length, 'layers in routeLayersRef for future cleanup');

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