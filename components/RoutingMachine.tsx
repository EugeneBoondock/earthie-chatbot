'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface RoutingProps {
    waypoints: L.LatLng[];
    onRouteFound: (summary: any) => void;
}

const RoutingMachine = ({ waypoints, onRouteFound }: RoutingProps) => {
    const map = useMap();
    const routeLayerRef = useRef<L.Polyline | null>(null);
    const markersRef = useRef<L.Marker[]>([]);

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
        // Remove existing route line
        if (routeLayerRef.current && map) {
            try {
                if (map.hasLayer(routeLayerRef.current)) {
                    map.removeLayer(routeLayerRef.current);
                }
            } catch (e) {
                console.warn('Error removing route layer:', e);
            }
            routeLayerRef.current = null;
        }

        // Remove existing markers
        markersRef.current.forEach(marker => {
            try {
                if (map && map.hasLayer(marker)) {
                    map.removeLayer(marker);
                }
            } catch (e) {
                console.warn('Error removing marker:', e);
            }
        });
        markersRef.current = [];
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
            // Create simple polyline route
            const routeLine = L.polyline(waypoints, {
                color: '#06B6D4',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 5',
                className: 'route-line'
            });

            // Add to map
            routeLine.addTo(map);
            routeLayerRef.current = routeLine;

            // Create waypoint markers
            const newMarkers: L.Marker[] = [];
            waypoints.forEach((waypoint, index) => {
                const isStart = index === 0;
                const isEnd = index === waypoints.length - 1;
                
                const markerIcon = L.divIcon({
                    html: `
                        <div style="
                            width: 24px; 
                            height: 24px; 
                            background: ${isStart ? '#10B981' : isEnd ? '#EF4444' : '#06B6D4'}; 
                            border: 2px solid white;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-weight: bold;
                            font-size: 12px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        ">
                            ${isStart ? 'S' : isEnd ? 'E' : index}
                        </div>
                    `,
                    className: 'route-waypoint-marker',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });

                const marker = L.marker(waypoint, { icon: markerIcon });
                marker.addTo(map);
                newMarkers.push(marker);
            });

            markersRef.current = newMarkers;

            // Calculate and return route summary
            const summary = calculateRouteSummary(waypoints);
            if (summary) {
                onRouteFound(summary);
            }

            // Fit map to show all waypoints
            if (waypoints.length > 0) {
                const group = new L.FeatureGroup([routeLine, ...newMarkers]);
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
    }, [map, waypoints, onRouteFound]);

    // Additional cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupRoute();
        };
    }, []);

    return null;
};

export default RoutingMachine; 