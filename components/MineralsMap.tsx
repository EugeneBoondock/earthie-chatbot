"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";
import L from "leaflet";
import { MapControls, MapLayer } from "@/components/MapControls";
import { MineralOccurrence } from "@/hooks/useMinerals";
import { Loader2 } from "lucide-react";
import { useMap } from "react-leaflet";

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

interface MineralsMapProps {
  center: { latitude: number; longitude: number };
  minerals: MineralOccurrence[] | null;
  loading: boolean;
}

function MapCenter({ center }: { center: { latitude: number; longitude: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.latitude, center.longitude]);
  }, [center.latitude, center.longitude]);
  return null;
}

export default function MineralsMap({ center, minerals, loading }: MineralsMapProps) {
  const [layer, setLayer] = useState<MapLayer>("dark");
  const [showLabels, setShowLabels] = useState(true);

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden">
      <MapContainer
        center={[center.latitude, center.longitude] as L.LatLngExpression}
        zoom={8}
        className="w-full h-full"
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
          showAllProperties={false}
          onShowAllPropertiesChange={() => {}}
          showRoute={false}
          onShowRouteChange={() => {}}
          showLabels={showLabels}
          onShowLabelsChange={setShowLabels}
        />
        {minerals &&
          minerals.map((m) => (
            <Marker
              key={m.id}
              position={[m.coordinates.latitude, m.coordinates.longitude]}
            >
              <Popup minWidth={160}>
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">{m.name}</h4>
                  {m.commodities.length > 0 && (
                    <p className="text-xs">{m.commodities.join(", ")}</p>
                  )}
                  {m.status && <p className="text-xs text-gray-400">{m.status}</p>}
                  <p className="text-[10px] mt-1 text-gray-500">{m.source}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-[1000]">
            <Loader2 className="h-8 w-8 animate-spin text-earthie-mint" />
          </div>
        )}
        <MapCenter center={center} />
      </MapContainer>
    </div>
  );
} 