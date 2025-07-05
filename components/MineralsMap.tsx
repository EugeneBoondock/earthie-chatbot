"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { MapControls, MapLayer } from "@/components/MapControls";
import { MineralOccurrence } from "@/hooks/useMinerals";
import { Loader2 } from "lucide-react";
import { useMap, useMapEvents } from "react-leaflet";

const MAP_LAYERS: Record<MapLayer, { url: string; attribution: string }> = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/attributions'>CARTO</a>",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri et al.",
  },
  topo: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      "Map data: &copy; OpenStreetMap contributors | Map style: &copy; OpenTopoMap",
  },
};

const getCommodityIcon = (commodities: string[]) => {
    const primary = (commodities[0] || '').toLowerCase();
    
    // Icon styles based on commodity type
    const commodityStyles: Record<string, { shape: 'circle' | 'square' | 'diamond', color: string }> = {
      // Precious Metals
      'gold': { shape: 'diamond', color: '#facc15' },
      'silver': { shape: 'diamond', color: '#f8fafc' },
      'platinum': { shape: 'diamond', color: '#e5e7eb' },
      // Base Metals
      'copper': { shape: 'square', color: '#fb923c' },
      'lead': { shape: 'square', color: '#a1a1aa' },
      'zinc': { shape: 'square', color: '#d4d4d8' },
      'nickel': { shape: 'square', color: '#10b981' },
      'iron': { shape: 'square', color: '#ef4444' },
      // Gems & Industrial
      'diamond': { shape: 'diamond', color: '#60a5fa' },
      'lithium': { shape: 'circle', color: '#a855f7' },
      'uranium': { shape: 'circle', color: '#14b8a6' },
      'rare-earth elements': { shape: 'circle', color: '#f472b6' },
      'barite': { shape: 'circle', color: '#8b5cf6' },
      'clay': { shape: 'circle', color: '#fca5a5' },
    };

    const style = commodityStyles[primary] || { shape: 'circle', color: '#50E3C1' };

    let html = `<span class='mineral-dot' style='background:${style.color};`;
    if (style.shape === 'square') {
        html += ` border-radius: 0;'></span>`;
    } else if (style.shape === 'diamond') {
        html += ` transform: rotate(45deg); border-radius: 2px;'></span>`;
    } else { // circle
        html += ` border-radius: 50%;'></span>`;
    }

    return L.divIcon({
        html: html,
        className: 'mineral-icon',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
};

interface MineralsMapProps {
  center: { latitude: number; longitude: number } | null;
  minerals: MineralOccurrence[] | null;
  loading: boolean;
  onSearchArea: (bbox: string) => void;
}

function MapChangeHandler({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
    const map = useMapEvents({
        moveend: () => onBoundsChange(map.getBounds()),
        zoomend: () => onBoundsChange(map.getBounds()),
    });
    return null;
}

function MapCenter({ center }: { center: { latitude: number; longitude: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.latitude, center.longitude]);
  }, [center.latitude, center.longitude]);
  return null;
}

export default function MineralsMap({ center, minerals, loading, onSearchArea }: MineralsMapProps) {
  const [layer, setLayer] = useState<MapLayer>("dark");
  const [showLabels, setShowLabels] = useState(true);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const mapRef = useRef<L.Map>(null);

  useEffect(() => {
    if (mapRef.current) {
      setMapBounds(mapRef.current.getBounds());
    }
  }, []);

  const handleSearchArea = () => {
    if (mapBounds) {
        const bboxStr = `${mapBounds.getSouth()},${mapBounds.getWest()},${mapBounds.getNorth()},${mapBounds.getEast()}`;
        onSearchArea(bboxStr);
    }
  };

  const propertyIcon = L.divIcon({
      html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-earthie-gold"><path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 005.16-4.057l-1.18-1.18a15.475 15.475 0 01-4.042 3.486l-.006.004a.832.832 0 01-.739 0l-.007-.004A15.474 15.474 0 018.61 17.12l-1.18 1.182A16.975 16.975 0 0011.54 22.35zM12 14.375a2.375 2.375 0 100-4.75 2.375 2.375 0 000 4.75z" clip-rule="evenodd" /><path d="M12 1.625a10.375 10.375 0 100 20.75 10.375 10.375 0 000-20.75zM10 12a2 2 0 114 0 2 2 0 01-4 0z" /></svg>`,
      className: 'property-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
  });

  const mapCenter: L.LatLngExpression = center ? [center.latitude, center.longitude] : [0,0];

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden">
      <MapContainer
        center={mapCenter}
        zoom={8}
        className="w-full h-full"
        ref={mapRef}
      >
        <TileLayer attribution={MAP_LAYERS[layer].attribution} url={MAP_LAYERS[layer].url} />
        {layer === "satellite" && showLabels && (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={0.4}
            zIndex={998}
          />
        )}
        <MapControls
          currentLayer={layer}
          onLayerChange={setLayer}
          onSearchArea={handleSearchArea}
          showRoute={false}
          onShowRouteChange={() => {}}
          showLabels={showLabels}
          onShowLabelsChange={setShowLabels}
        />
        <MapChangeHandler onBoundsChange={setMapBounds} />

        {center && (
            <Marker position={[center.latitude, center.longitude]} icon={propertyIcon}>
                <Popup>Your selected property</Popup>
            </Marker>
        )}

        {minerals &&
          minerals.map((m) => {
            const icon = getCommodityIcon(m.commodities);
            return (
              <Marker key={m.id} position={[m.coordinates.latitude, m.coordinates.longitude]} icon={icon}>
                <Popup minWidth={160}>
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm">{m.name}</h4>
                    {m.commodities.length > 0 && (
                      <p className="text-xs">{m.commodities.join(', ')}</p>
                    )}
                    {(m as any).ref && (
                      <p className="text-[11px] italic text-gray-400">{(m as any).ref}</p>
                    )}
                    <p className="text-[10px] mt-1 text-gray-500">USGS</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-[1000]">
            <Loader2 className="h-8 w-8 animate-spin text-earthie-mint" />
          </div>
        )}
        {center && <MapCenter center={center} />}
      </MapContainer>

      <style jsx global>{`
        .mineral-dot { width:16px; height:16px; display:block; border:2px solid #0f172a; }
        .leaflet-marker-icon.mineral-icon { background:transparent; border:none; }
        .property-icon { background:transparent; border:none; }
      `}</style>
    </div>
  );
} 