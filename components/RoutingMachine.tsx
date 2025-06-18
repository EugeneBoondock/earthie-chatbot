'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

// Define a custom icon for waypoints to match the app's dark theme
const waypointIcon = L.icon({
    iconUrl: "data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310B981' width='32px' height='32px'%3e%3cpath d='M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z'/%3e%3c/svg%3e",
    iconSize: [24, 24],
    className: 'leaflet-waypoint-icon'
});

interface RoutingProps {
    waypoints: L.LatLng[];
    onRouteFound: (summary: any) => void;
}

const RoutingMachine = ({ waypoints, onRouteFound }: RoutingProps) => {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        // Ensure L is globally available for the plugin
        (window as any).L = L;

        let routingControl: L.Routing.Control | null = null;
        
        import('leaflet-routing-machine').then(() => {
            if (!map.getContainer()) return; // Map might have been unmounted

            if (waypoints.length < 2) {
                // Clean up existing routes if any
                map.eachLayer((layer) => {
                    if (layer.options && (layer.options as any).waypoints) {
                        map.removeLayer(layer);
                    }
                });
                return;
            }

            routingControl = L.Routing.control({
                waypoints: waypoints,
                routeWhileDragging: true,
                plan: L.Routing.plan(waypoints, {
                    createMarker: function (i, waypoint) {
                        return L.marker(waypoint.latLng, {
                            draggable: true,
                            icon: waypointIcon
                        });
                    }
                }),
                lineOptions: {
                    styles: [{ color: '#63b3ed', opacity: 0.8, weight: 6 }],
                    extendToWaypoints: true,
                    missingRouteTolerance: 100
                },
                show: false,
                addWaypoints: false,
            }).addTo(map);

            routingControl.on('routesfound', function (e: any) {
                if (e.routes && e.routes.length > 0) {
                    onRouteFound(e.routes[0].summary);
                }
            });
        });

        return () => {
            if (routingControl && map) {
                try {
                    map.removeControl(routingControl);
                } catch(e) {
                    // Ignore errors on cleanup
                }
            }
        };
    }, [map, waypoints, onRouteFound]);

    return null;
};

export default RoutingMachine; 