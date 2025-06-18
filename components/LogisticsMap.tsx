'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useState, useEffect } from 'react';
import RoutingMachine from './RoutingMachine';
import { MapControls, MapLayer } from './MapControls';

// Fix for default icon issue with webpack
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;

const defaultIcon = L.icon({
  iconRetinaUrl: iconRetinaUrl.src,
  iconUrl: iconUrl.src,
  shadowUrl: shadowUrl.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

const selectedIcon = L.icon({
  iconUrl: "data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2334D399' width='48px' height='48px'%3e%3cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3e%3c/svg%3e",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38]
});

// New faint icon for non-selected properties
const secondaryIcon = L.icon({
  iconUrl: "data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236B7280' width='32px' height='32px'%3e%3cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3e%3c/svg%3e",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
  className: 'opacity-50 hover:opacity-100 transition-opacity'
});

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl.src,
  iconUrl: iconUrl.src,
  shadowUrl: shadowUrl.src,
});


type Property = {
  id: string;
  attributes: {
    center: string; // e.g., "(10.212822, 56.127854)"
    description: string;
    country: string;
  };
};

interface RouteSummary {
  totalDistance: number;
  totalTime: number;
}

interface LogisticsMapProps {
  properties: Property[];
  selectedProperties: Property[];
  onRouteSummary: (summary: RouteSummary | null) => void;
}

const parseCoordinates = (center: string): [number, number] | null => {
    if (!center) return null;
    try {
        // Corrected regex to match "(lon, lat)" format. E.g. "(10.2, -56.1)"
        const match = center.match(/\(([^,]+),\s*([^)]+)\)/);
        if (match) {
            const lon = parseFloat(match[1]); // E2 provides longitude first
            const lat = parseFloat(match[2]); // Then latitude
            if (!isNaN(lat) && !isNaN(lon)) {
                return [lat, lon]; // Leaflet expects [latitude, longitude]
            } else {
                console.warn("Parsed coordinates are NaN:", { lat, lon, center });
            }
        } else {
             console.warn("Could not match coordinates in string:", center);
        }
    } catch (e) {
        console.error("Error parsing coordinates:", center, e);
    }
    return null;
}

function MapEffect({ waypoints }: { waypoints: L.LatLng[] }) {
    const map = useMap();
    useEffect(() => {
        if (waypoints.length > 0) {
            map.fitBounds(L.latLngBounds(waypoints), { padding: [50, 50] });
        }
    }, [waypoints, map]);
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

export function LogisticsMap({ properties, selectedProperties, onRouteSummary }: LogisticsMapProps) {
    const [currentLayer, setCurrentLayer] = useState<MapLayer>('dark');
    const [showAllProperties, setShowAllProperties] = useState(false);
    const [showRoute, setShowRoute] = useState(true);

    if (properties.length === 0 && selectedProperties.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-800 rounded-lg">
                <p className="text-gray-400">Select properties from the list to begin planning your route.</p>
            </div>
        );
    }
    
    // Use selected properties for the initial view, or all properties if none are selected
    const propertySource = selectedProperties.length > 0 ? selectedProperties : properties;
    const validProperties = propertySource.filter(p => p.attributes.center && parseCoordinates(p.attributes.center));

    if (validProperties.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-800 rounded-lg">
                <p className="text-gray-400">No properties with valid coordinates found.</p>
            </div>
        );
    }
    
    const initialCenter = parseCoordinates(validProperties[0].attributes.center) || [0, 0];
  
    const waypoints = selectedProperties
        .map(p => parseCoordinates(p.attributes.center))
        .filter((p): p is [number, number] => p !== null)
        .map(p => L.latLng(p[0], p[1]));

  return (
    <MapContainer center={initialCenter} zoom={4} scrollWheelZoom={true} style={{ height: '100%', width: '100%', borderRadius: '0.5rem', background: '#111827' }}>
      <TileLayer
        key={currentLayer} // Important: force re-render on layer change
        attribution={MAP_LAYERS[currentLayer].attribution}
        url={MAP_LAYERS[currentLayer].url}
      />
      <MapEffect waypoints={waypoints} />
      <MapControls 
        currentLayer={currentLayer}
        onLayerChange={setCurrentLayer}
        showAllProperties={showAllProperties}
        onShowAllPropertiesChange={setShowAllProperties}
        showRoute={showRoute}
        onShowRouteChange={setShowRoute}
      />

      {/* Render all properties with a faint icon if toggled */}
      {showAllProperties && properties.map(prop => {
        // Avoid duplicating markers that are already selected
        if (selectedProperties.some(p => p.id === prop.id)) return null;

        const position = parseCoordinates(prop.attributes.center);
        if (!position) return null;

        return (
             <Marker key={`secondary-${prop.id}`} position={position} icon={secondaryIcon}>
                <Popup>
                    <div className="text-sm">
                        <p className="font-bold">{prop.attributes.description}</p>
                        <p>{prop.attributes.country}</p>
                    </div>
                </Popup>
            </Marker>
        )
      })}

      {/* Only render markers for the properties that have been selected for the route */}
      {selectedProperties.map(prop => {
        const position = parseCoordinates(prop.attributes.center);
        if (!position) return null; // Don't render marker if coords are invalid

        return (
            <Marker 
              key={prop.id} 
              position={position}
              icon={selectedIcon} // All markers in this loop are for selected properties
            >
            <Popup>
              <div className="text-sm bg-gray-900 text-white rounded-lg shadow-lg border border-cyan-400/50 p-0">
                <div className='p-2'>
                    <p className="font-bold text-amber-400">{prop.attributes.description}</p>
                    <p className='text-gray-300'>{prop.attributes.country}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        )
      })}
      
      {showRoute && <RoutingMachine waypoints={waypoints} onRouteFound={onRouteSummary} />}
    </MapContainer>
  );
} 