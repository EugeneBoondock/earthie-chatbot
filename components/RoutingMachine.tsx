'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

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

interface RoutingProps {
    waypoints: L.LatLng[];
    onRouteFound: (summary: RouteSummary | null) => void;
    transportMode: 'walking' | 'car' | 'truck' | 'drone' | 'ship' | 'plane';
}

const RoutingMachine = ({ waypoints, onRouteFound, transportMode }: RoutingProps) => {
    const map = useMap();
    const routeElementsRef = useRef<L.Layer[]>([]);

    // Calculate simple straight-line distance between two points
    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    // Check if a coordinate is over water (improved heuristic)
    const isOverWater = (lat: number, lng: number): boolean => {
        // Detailed land mass exclusions for better water detection
        
        // Africa (detailed boundaries)
        if (lng > -20 && lng < 52 && lat > -35 && lat < 37) {
            return false; // African continent
        }
        
        // Europe 
        if (lng > -10 && lng < 40 && lat > 35 && lat < 72) {
            return false; // European continent
        }
        
        // Asia (detailed)
        if (lng > 26 && lng < 180 && lat > 5 && lat < 75) {
            return false; // Asian continent
        }
        
        // North America
        if (lng > -170 && lng < -50 && lat > 15 && lat < 75) {
            return false; // North American continent
        }
        
        // South America
        if (lng > -82 && lng < -35 && lat > -55 && lat < 15) {
            return false; // South American continent
        }
        
        // Australia
        if (lng > 110 && lng < 155 && lat > -45 && lat < -10) {
            return false; // Australian continent
        }
        
        // Madagascar (important for this specific case!)
        if (lng > 43 && lng < 51 && lat > -26 && lat < -12) {
            return false; // Madagascar island
        }
        
        // Greenland
        if (lng > -75 && lng < -10 && lat > 60 && lat < 85) {
            return false; // Greenland
        }
        
        // If not over any major land mass, assume it's water
        return true;
    };

    // Find nearest coastal point for ANY location using intelligent search
    const findNearestCoastalPoint = (lat: number, lng: number, targetLat: number, targetLng: number): { lat: number, lng: number } => {
        // If already at coast (near water), return current position
        if (isNearCoast(lat, lng)) {
            return { lat, lng };
        }

        // Search for the nearest coastal point by radiating outward
        const searchRadius = 0.5; // degrees (roughly 50km)
        const searchSteps = 16; // 16 directions around the compass
        let bestCoastalPoint = { lat, lng };
        let minTotalDistance = Infinity;

        // Search in expanding circles
        for (let radius = 0.1; radius <= 5.0; radius += 0.2) {
            for (let step = 0; step < searchSteps; step++) {
                const angle = (step / searchSteps) * 2 * Math.PI;
                const testLat = lat + Math.cos(angle) * radius;
                const testLng = lng + Math.sin(angle) * radius;

                // Check if this point is at the coast (land-water boundary)
                if (isNearCoast(testLat, testLng)) {
                    const distanceToCoast = calculateDistance(lat, lng, testLat, testLng);
                    const distanceFromCoast = calculateDistance(testLat, testLng, targetLat, targetLng);
                    const totalDistance = distanceToCoast + distanceFromCoast;

                    if (totalDistance < minTotalDistance) {
                        minTotalDistance = totalDistance;
                        bestCoastalPoint = { lat: testLat, lng: testLng };
                    }
                }
            }
            
            // If we found a good coastal point, stop searching
            if (minTotalDistance < Infinity) {
                break;
            }
        }

        // Fallback to predefined coastal points if algorithmic search fails
        if (minTotalDistance === Infinity) {
            const fallbackCoastalPoints = [
                // Global coastal points for fallback
                { lat: -33.9, lng: 18.4 },  // Cape Town
                { lat: -26.2, lng: 32.9 },  // Maputo  
                { lat: -18.9, lng: 47.5 },  // Madagascar west
                { lat: 51.9, lng: 4.1 },   // Rotterdam
                { lat: 33.7, lng: -118.3 }, // Los Angeles
                { lat: 31.2, lng: 121.5 }, // Shanghai
                { lat: 1.3, lng: 103.8 },  // Singapore
                { lat: 40.7, lng: -74.0 }, // New York
                { lat: -33.9, lng: 151.2 }, // Sydney
                { lat: 35.7, lng: 139.7 }, // Tokyo
                { lat: 53.5, lng: 10.0 },  // Hamburg
                { lat: 25.3, lng: 55.3 },  // Dubai
                { lat: -12.0, lng: -77.0 }, // Lima
                { lat: -22.9, lng: -43.2 }, // Rio de Janeiro
                { lat: 13.7, lng: 100.5 }, // Bangkok
                { lat: 55.8, lng: 37.6 },  // Moscow (via rivers)
            ];

            let nearest = fallbackCoastalPoints[0];
            let minFallbackDistance = Infinity;

            for (const point of fallbackCoastalPoints) {
                const distanceToCoast = calculateDistance(lat, lng, point.lat, point.lng);
                const distanceFromCoast = calculateDistance(point.lat, point.lng, targetLat, targetLng);
                const totalDistance = distanceToCoast + distanceFromCoast;

                if (totalDistance < minFallbackDistance) {
                    minFallbackDistance = totalDistance;
                    nearest = point;
                }
            }

            return nearest;
        }

        return bestCoastalPoint;
    };

    // Check if a location is near the coast (land-water boundary)
    const isNearCoast = (lat: number, lng: number): boolean => {
        const checkRadius = 0.1; // Small radius to check around point
        const isCurrentPointLand = !isOverWater(lat, lng);
        
        // Check surrounding points to see if we're at a land-water boundary
        const directions = [
            { lat: lat + checkRadius, lng: lng },     // North
            { lat: lat - checkRadius, lng: lng },     // South  
            { lat: lat, lng: lng + checkRadius },     // East
            { lat: lat, lng: lng - checkRadius },     // West
            { lat: lat + checkRadius, lng: lng + checkRadius }, // NE
            { lat: lat - checkRadius, lng: lng - checkRadius }, // SW
            { lat: lat + checkRadius, lng: lng - checkRadius }, // NW
            { lat: lat - checkRadius, lng: lng + checkRadius }, // SE
        ];

        for (const dir of directions) {
            const isDirectionWater = isOverWater(dir.lat, dir.lng);
            
            // If current point is land and direction point is water, we're at coast
            if (isCurrentPointLand && isDirectionWater) {
                return true;
            }
        }

        return false;
    };

    // Find nearest port (for general use)
    const findNearestPort = (lat: number, lng: number): { lat: number, lng: number } => {
        const majorPorts = [
            { lat: 51.9, lng: 4.1 },    // Rotterdam
            { lat: 33.7, lng: -118.3 }, // Los Angeles
            { lat: 31.2, lng: 121.5 },  // Shanghai
            { lat: 1.3, lng: 103.8 },   // Singapore
            { lat: 53.5, lng: 10.0 },   // Hamburg
            { lat: 25.3, lng: 55.3 },   // Dubai
            { lat: 22.3, lng: 114.2 },  // Hong Kong
            { lat: 35.7, lng: 139.7 },  // Tokyo
            { lat: 40.7, lng: -74.0 },  // New York
            { lat: -33.9, lng: 151.2 }, // Sydney
            { lat: -33.9, lng: 18.4 },  // Cape Town
            { lat: -26.2, lng: 32.9 },  // Maputo
        ];

        let nearest = majorPorts[0];
        let minDistance = calculateDistance(lat, lng, nearest.lat, nearest.lng);

        for (const port of majorPorts) {
            const distance = calculateDistance(lat, lng, port.lat, port.lng);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = port;
            }
        }

        return nearest;
    };

    // Create intelligent route based on transport mode
    const createIntelligentRoute = (waypoints: L.LatLng[]): L.LatLng[] => {
        if (waypoints.length < 2) return waypoints;

        // For air transport, use direct routes
        if (transportMode === 'drone' || transportMode === 'plane') {
            return waypoints;
        }

        const intelligentWaypoints: L.LatLng[] = [];
        intelligentWaypoints.push(waypoints[0]); // Start point

        for (let i = 0; i < waypoints.length - 1; i++) {
            const start = waypoints[i];
            const end = waypoints[i + 1];

            // Check if the route crosses water
            const routeCrossesWater = checkRouteCrossesWater(start, end);

            if (routeCrossesWater && (transportMode === 'car' || transportMode === 'truck' || transportMode === 'walking')) {
                // Land transport crossing water - need coastal routing
                const startCoast = findNearestCoastalPoint(start.lat, start.lng, end.lat, end.lng);
                const endCoast = findNearestCoastalPoint(end.lat, end.lng, start.lat, start.lng);

                // Add route to start coast (if not already there)
                if (calculateDistance(start.lat, start.lng, startCoast.lat, startCoast.lng) > 1000) {
                    intelligentWaypoints.push(L.latLng(startCoast.lat, startCoast.lng));
                }

                // Add ship route between coasts
                const shipRoute = createShipRoute(startCoast, endCoast);
                intelligentWaypoints.push(...shipRoute);

                // Add route from end coast to destination (if not already there)
                if (calculateDistance(endCoast.lat, endCoast.lng, end.lat, end.lng) > 1000) {
                    intelligentWaypoints.push(L.latLng(endCoast.lat, endCoast.lng));
                }
            } else if (transportMode === 'ship') {
                // Ship transport - create coastal route
                const shipRoute = createShipRoute(start, end);
                intelligentWaypoints.push(...shipRoute);
            } else {
                // Direct route for land transport on same landmass
                intelligentWaypoints.push(end);
            }
        }

        // Add final destination if not already added
        const lastWaypoint = waypoints[waypoints.length - 1];
        const lastIntelligent = intelligentWaypoints[intelligentWaypoints.length - 1];
        if (calculateDistance(lastIntelligent.lat, lastIntelligent.lng, lastWaypoint.lat, lastWaypoint.lng) > 1000) {
            intelligentWaypoints.push(lastWaypoint);
        }

        return intelligentWaypoints;
    };

    // Check if a route between two points crosses water (more robustly)
    const checkRouteCrossesWater = (start: L.LatLng, end: L.LatLng): boolean => {
        const startIsWater = isOverWater(start.lat, start.lng);
        const endIsWater = isOverWater(end.lat, end.lng);

        // If the start and end points are in different domains (land vs water), it's a crossing.
        if (startIsWater !== endIsWater) {
            return true;
        }

        // If both points are on land, check if the path between them goes over water.
        if (!startIsWater) {
            const steps = 20; // Check intermediate points
            for (let i = 1; i < steps; i++) {
                const ratio = i / steps;
                const lat = start.lat + (end.lat - start.lat) * ratio;
                const lng = start.lng + (end.lng - start.lng) * ratio;
                
                if (isOverWater(lat, lng)) {
                    // This is a path between two land points that crosses a body of water.
                    return true;
                }
            }
        }
        
        // Both points are on land and the path is on land, OR both points are in water.
        // In these cases, it's not a "crossing" that requires a land/sea mode change.
        return false;
    };

    // Create ship route that follows coastlines (simplified)
    const createShipRoute = (start: { lat: number, lng: number }, end: { lat: number, lng: number }): L.LatLng[] => {
        const route: L.LatLng[] = [];
        const startLatLng = L.latLng(start.lat, start.lng);
        const endLatLng = L.latLng(end.lat, end.lng);

        // For ship routes, we'll create waypoints that avoid obvious land masses
        // This is a simplified implementation - in reality you'd use proper maritime routing

        const diffLat = end.lat - start.lat;
        const diffLng = end.lng - start.lng;

        // If crossing major ocean basins, add intermediate waypoints
        if (Math.abs(diffLng) > 60 || Math.abs(diffLat) > 30) {
            const steps = Math.ceil(Math.max(Math.abs(diffLng) / 30, Math.abs(diffLat) / 15));
            
            for (let i = 1; i <= steps; i++) {
                const ratio = i / (steps + 1);
                let lat = start.lat + diffLat * ratio;
                let lng = start.lng + diffLng * ratio;

                // Adjust waypoints to avoid major landmasses (very simplified)
                if (lng > -20 && lng < 50 && lat > 0 && lat < 60) {
                    // Route around Europe/Africa
                    if (start.lng < 0 && end.lng > 20) {
                        lng = lng < 20 ? lng - 10 : lng + 10; // Go around
                    }
                }

                route.push(L.latLng(lat, lng));
            }
        }

                 route.push(endLatLng);
         return route;
     };

     // Get route color based on transport mode
     const getRouteColor = (mode: string): string => {
         switch (mode) {
             case 'ship': return '#3B82F6'; // Blue for water
             case 'plane': return '#10B981'; // Green for air
             case 'drone': return '#8B5CF6'; // Purple for drone
             case 'truck': return '#F59E0B'; // Orange for truck
             case 'car': return '#06B6D4'; // Cyan for car
             case 'walking': return '#EF4444'; // Red for walking
             default: return '#06B6D4'; // Default cyan
         }
     };

     // Get route dash pattern based on transport mode
     const getRouteDashArray = (mode: string): string => {
         switch (mode) {
             case 'ship': return '20, 10'; // Long dashes for ship
             case 'plane': return '5, 15'; // Dots for air
             case 'drone': return '5, 5'; // Small dashes for drone
             case 'truck': return '15, 5'; // Medium dashes for truck
             case 'car': return '10, 5'; // Standard dashes for car
             case 'walking': return '3, 7'; // Short dashes for walking
             default: return '10, 5'; // Default
         }
    };

    // Create realistic multi-modal route that respects transport limitations
    const createRealisticMultiModalRoute = (waypoints: L.LatLng[], requestedMode: string): RouteSummary => {
        if (waypoints.length < 2) {
            return { totalDistance: 0, totalTime: 0, segments: [], isMultiModal: false };
        }

        const segments: RouteSegment[] = [];
        let totalDistance = 0;
        let totalTime = 0;

        for (let i = 0; i < waypoints.length - 1; i++) {
            const start = waypoints[i];
            const end = waypoints[i + 1];
            const segmentWaypoints: { lat: number; lng: number }[] = [];

            // Check if this segment crosses water
            const crossesWater = checkRouteCrossesWater(start, end);

            if (crossesWater && (requestedMode === 'car' || requestedMode === 'truck' || requestedMode === 'walking')) {
                // REALISTIC ROUTING: Land transport needs to use coastal routes + ships

                // 1. Land segment to nearest coast
                const startCoast = findNearestCoastalPoint(start.lat, start.lng, end.lat, end.lng);
                const landWaypoints1 = [{ lat: start.lat, lng: start.lng }, startCoast];
                const landDistance1 = calculateDistance(start.lat, start.lng, startCoast.lat, startCoast.lng);
                const landTime1 = landDistance1 / 1000 * 3600 / getTransportSpeed(requestedMode); // Real speeds

                segments.push({
                    mode: requestedMode as any,
                    distance: landDistance1,
                    time: landTime1,
                    description: `${requestedMode.toUpperCase()} to coast`,
                    waypoints: landWaypoints1,
                    reason: `Cannot ${requestedMode} across water - route to nearest port`
                });

                // 2. Ship segment across water  
                const endCoast = findNearestCoastalPoint(end.lat, end.lng, start.lat, start.lng);
                const shipRoute = createShipRoute(startCoast, endCoast);
                const shipWaypoints = shipRoute.map(wp => ({ lat: wp.lat, lng: wp.lng }));
                const shipDistance = shipWaypoints.reduce((dist, wp, idx) => {
                    if (idx === 0) return 0;
                    const prev = shipWaypoints[idx - 1];
                    return dist + calculateDistance(prev.lat, prev.lng, wp.lat, wp.lng);
                }, 0);
                const shipTime = shipDistance / 1000 * 3600 / getTransportSpeed('ship');

                segments.push({
                    mode: 'ship',
                    distance: shipDistance,
                    time: shipTime,
                    description: 'SHIP across water',
                    waypoints: shipWaypoints,
                    reason: 'Water crossing requires ship transport'
                });

                // 3. Land segment from coast to destination
                const landWaypoints2 = [endCoast, { lat: end.lat, lng: end.lng }];
                const landDistance2 = calculateDistance(endCoast.lat, endCoast.lng, end.lat, end.lng);
                const landTime2 = landDistance2 / 1000 * 3600 / getTransportSpeed(requestedMode);

                segments.push({
                    mode: requestedMode as any,
                    distance: landDistance2, 
                    time: landTime2,
                    description: `${requestedMode.toUpperCase()} from coast`,
                    waypoints: landWaypoints2,
                    reason: `Resume ${requestedMode} transport from port`
                });

                totalDistance += landDistance1 + shipDistance + landDistance2;
                totalTime += landTime1 + shipTime + landTime2;

            } else if (requestedMode === 'ship' && !crossesWater) {
                // Ship route over land - not possible! Reroute around land
                const shipRoute = createShipRoute({ lat: start.lat, lng: start.lng }, { lat: end.lat, lng: end.lng });
                const shipWaypoints = shipRoute.map(wp => ({ lat: wp.lat, lng: wp.lng }));
                const distance = shipWaypoints.reduce((dist, wp, idx) => {
                    if (idx === 0) return 0;
                    const prev = shipWaypoints[idx - 1];
                    return dist + calculateDistance(prev.lat, prev.lng, wp.lat, wp.lng);
                }, 0);
                const time = distance / 1000 * 3600 / getTransportSpeed('ship');

                segments.push({
                    mode: 'ship',
                    distance,
                    time,
                    description: 'SHIP route around landmass',
                    waypoints: shipWaypoints,
                    reason: 'Ships must navigate around land obstacles'
                });

                totalDistance += distance;
                totalTime += time;

            } else {
                // Direct route possible for this transport mode
                const directWaypoints = [{ lat: start.lat, lng: start.lng }, { lat: end.lat, lng: end.lng }];
                const distance = calculateDistance(start.lat, start.lng, end.lat, end.lng);
                const time = distance / 1000 * 3600 / getTransportSpeed(requestedMode);

                segments.push({
                    mode: requestedMode as any,
                    distance,
                    time,
                    description: `${requestedMode.toUpperCase()} direct route`,
                    waypoints: directWaypoints,
                    reason: `Direct ${requestedMode} route possible`
                });

                totalDistance += distance;
                totalTime += time;
            }
        }

        return {
            totalDistance,
            totalTime,
            segments,
            isMultiModal: segments.length > 1 && new Set(segments.map(s => s.mode)).size > 1
        };
    };

    // Get realistic transport speeds (km/h)
    const getTransportSpeed = (mode: string): number => {
        switch (mode) {
            case 'walking': return 5;
            case 'car': return 60;
            case 'truck': return 50;
            case 'ship': return 25;
            case 'drone': return 30;
            case 'plane': return 800;
            default: return 50;
        }
    };

    // Calculate route summary
    const calculateRouteSummary = (waypoints: L.LatLng[]) => {
        if (waypoints.length < 2) return null;

        let totalDistance = 0;
        for (let i = 0; i < waypoints.length - 1; i++) {
            const current = waypoints[i];
            const next = waypoints[i + 1];
            totalDistance += calculateDistance(current.lat, current.lng, next.lat, next.lng);
        }

        // Estimate travel time based on average speed of 50 km/h
        const totalTime = (totalDistance / 1000) * 3600 / 50; // seconds

        return {
            totalDistance,
            totalTime
        };
    };

    // Cleanup function
    const cleanupRoute = () => {
        routeElementsRef.current.forEach(layer => {
            if (map && map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        });
        routeElementsRef.current = [];
    };

    useEffect(() => {
        if (!map) return;

        // Cleanup previous route
        cleanupRoute();

        // If less than 2 waypoints, just clear and return
        if (waypoints.length < 2) {
            onRouteFound(null);
            return;
        }

        try {
            // Create realistic multi-modal route
            const multiModalRoute = createRealisticMultiModalRoute(waypoints, transportMode);
            
            // Draw all route segments with different styles and markers
            const allRouteElements: L.Layer[] = [];
            
            multiModalRoute.segments?.forEach((segment, segmentIndex) => {
                const routeColor = getRouteColor(segment.mode);
                const routeLine = L.polyline(segment.waypoints.map(wp => L.latLng(wp.lat, wp.lng)), {
                    color: routeColor,
                    weight: 4,
                    opacity: 0.8,
                    dashArray: getRouteDashArray(segment.mode),
                    className: `route-line-${segment.mode} animated-route-line`
                });

                routeLine.addTo(map);
                allRouteElements.push(routeLine);
                
                // Add transport mode marker at the start of each segment (except first)
                if (segmentIndex > 0) {
                    const startPoint = segment.waypoints[0];
                    const modeIcon = L.divIcon({
                        className: 'transport-mode-marker',
                        html: `<div style="background: ${routeColor}; color: white; padding: 2px 6px; border-radius: 12px; font-size: 10px; font-weight: bold; white-space: nowrap;">${segment.mode.toUpperCase()}</div>`,
                        iconSize: [60, 20],
                        iconAnchor: [30, 10]
                    });
                    
                    const marker = L.marker([startPoint.lat, startPoint.lng], { icon: modeIcon });
                    marker.addTo(map);
                    allRouteElements.push(marker);
                }
            });

            // Add waypoint markers with sequential numbering
            waypoints.forEach((waypoint, index) => {
                const isEnd = index === waypoints.length - 1;

                let label: string;
                let color: string;

                if (index === 0) {
                    label = 'S';
                    color = '#10B981'; // Green for Start
                } else if (isEnd) {
                    label = 'E';
                    color = '#EF4444'; // Red for End
                } else {
                    label = `${index + 1}`;
                    color = '#3B82F6'; // Blue for intermediate stops
                }
                
                const markerIcon = L.divIcon({
                    html: `
                        <div style="
                            width: 28px; 
                            height: 28px; 
                            background: ${color}; 
                            border: 3px solid white;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-weight: bold;
                            font-size: 14px;
                            box-shadow: 0 3px 6px rgba(0,0,0,0.4);
                        ">
                            ${label}
                        </div>
                    `,
                    className: 'route-waypoint-marker',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                });

                const marker = L.marker(waypoint, { icon: markerIcon }).addTo(map);
                allRouteElements.push(marker);
            });

            // Store all route elements for cleanup
            routeElementsRef.current = allRouteElements;

            // Return detailed multi-modal summary
            onRouteFound(multiModalRoute);

            // Fit map to show all segments
            if (allRouteElements.length > 0) {
                const group = new L.FeatureGroup(allRouteElements);
                map.fitBounds(group.getBounds(), { padding: [20, 20] });
            }

        } catch (error) {
            console.error('Error creating route:', error);
            onRouteFound(null);
        }

        // Cleanup function
        return () => {
            cleanupRoute();
        };
    }, [map, waypoints, onRouteFound, transportMode]);

    // Additional cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupRoute();
        };
    }, []);

    return null;
};

export default RoutingMachine; 