"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import { MapControls, MapLayer } from "@/components/MapControls";
import { MineralOccurrence } from "@/hooks/useMinerals";
import { Loader2, BookText, ExternalLink } from "lucide-react";
import { useMap, useMapEvents } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createPortal } from 'react-dom';
import { Tooltip as LeafletTooltip } from "react-leaflet";

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

const DEPOSIT_TYPE_DEFINITIONS: Record<string, string> = {
  Surficial: 'Formed at or near the Earth\'s surface, typically by weathering, sedimentation, or other surface processes.',
  Hydrothermal: 'Created by hot, mineral-rich fluids circulating through rocks, often associated with volcanic or geothermal activity.',
  Igneous: 'Originates from the solidification of molten magma, either below (intrusive) or above (extrusive) the Earth\'s surface.',
  Sedimentary: 'Formed by the accumulation and lithification of mineral and organic particles, usually in water environments.',
  Gemstone: 'Deposits primarily containing minerals valued for their beauty, rarity, and durability, used in jewelry and ornamentation.',
  Unclassified: 'The deposit type is not specified or does not fit standard geological categories.',
  Metamorphic: 'Resulting from the transformation of existing rock types through heat, pressure, or chemically active fluids.'
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
  center: { latitude: number; longitude: number; _fromProperty?: boolean } | null;
  minerals: MineralOccurrence[] | null;
  loading: boolean;
  onSearchArea: (bbox: string) => void;
}

function MapChangeHandler({ onBoundsChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void }) {
    const map = useMapEvents({
        moveend: () => onBoundsChange(map.getBounds()),
        zoomend: () => onBoundsChange(map.getBounds()),
        load: () => onBoundsChange(map.getBounds()),
    });
    return null;
}

function MapCenter({ center }: { center: { latitude: number; longitude: number } }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.latitude, center.longitude]);
    }
  }, [center?.latitude, center?.longitude]);
  return null;
}

function TooltipWithPortal({ children, content }: { children: React.ReactNode, content: string }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (show && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({ left: rect.right + 8, top: rect.top });
    }
  }, [show]);

  return (
    <span
      ref={ref}
      className="relative group cursor-pointer flex items-center gap-1"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <span className="inline-block w-4 h-4 rounded-full bg-cyan-700 text-cyan-100 text-[10px] flex items-center justify-center font-bold ml-1">i</span>
      {show && typeof window !== 'undefined' && createPortal(
        <span
          className="fixed z-[9999] bg-gray-900 text-xs text-cyan-100 px-3 py-2 rounded shadow-2xl max-w-xs w-max break-words border border-cyan-700"
          style={{ left: coords.left, top: coords.top }}
        >
          {content}
        </span>,
        document.body
      )}
    </span>
  );
}

export default function MineralsMap({ center, minerals, loading, onSearchArea }: MineralsMapProps) {
  const [layer, setLayer] = useState<MapLayer>("dark");
  const [showLabels, setShowLabels] = useState(true);
  const mapBoundsRef = useRef<L.LatLngBounds | null>(null);
  const mapRef = useRef<L.Map>(null);
  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [openReferences, setOpenReferences] = useState<string | null>(null);
  const [selectedMineral, setSelectedMineral] = useState<MineralOccurrence | null>(null);
  const [draggedPos, setDraggedPos] = useState<{ lat: number; lng: number } | null>(null);

  const handleBoundsChange = (bounds: L.LatLngBounds) => {
    mapBoundsRef.current = bounds;
  };

  const handleSearchArea = () => {
    if (mapBoundsRef.current) {
        const bboxStr = `${mapBoundsRef.current.getSouth()},${mapBoundsRef.current.getWest()},${mapBoundsRef.current.getNorth()},${mapBoundsRef.current.getEast()}`;
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

  // Haversine formula for distance in km
  function getDistanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const aVal = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
  }

  return (
    <Dialog onOpenChange={(isOpen) => {
      if (!isOpen) setSelectedReference(null);
      setSelectedMineral(null);
      setDraggedPos(null);
    }}>
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
          <MapChangeHandler onBoundsChange={handleBoundsChange} />

          {center && (
              <Marker position={[center.latitude, center.longitude]} icon={propertyIcon}>
                  <Popup>Your selected property</Popup>
              </Marker>
          )}

          {/* Draggable arrow/line from property to selected mineral */}
          {center && selectedMineral && (
            <>
              <Polyline
                positions={[
                  [center.latitude, center.longitude],
                  draggedPos ? [draggedPos.lat, draggedPos.lng] : [selectedMineral.coordinates.latitude, selectedMineral.coordinates.longitude]
                ]}
                color="#38bdf8"
                weight={4}
                dashArray="6 8"
                opacity={0.8}
              />
              <Marker
                position={draggedPos ? [draggedPos.lat, draggedPos.lng] : [selectedMineral.coordinates.latitude, selectedMineral.coordinates.longitude]}
                draggable={true}
                eventHandlers={{
                  drag: (e: L.LeafletEvent) => {
                    const { lat, lng } = (e.target as L.Marker).getLatLng();
                    setDraggedPos({ lat, lng });
                  },
                  dragend: (e: L.LeafletEvent) => {
                    const { lat, lng } = (e.target as L.Marker).getLatLng();
                    setDraggedPos({ lat, lng });
                  }
                }}
                icon={getCommodityIcon(selectedMineral.commodities)}
              >
                <LeafletTooltip direction="top" offset={[0, -16]} permanent>
                  {(() => {
                    const mineralPos = draggedPos ? { latitude: draggedPos.lat, longitude: draggedPos.lng } : selectedMineral.coordinates;
                    const dist = getDistanceKm(center, mineralPos);
                    return `${dist.toFixed(2)} km`;
                  })()}
                </LeafletTooltip>
              </Marker>
            </>
          )}

          {minerals &&
            minerals.map((m) => {
              const icon = getCommodityIcon(m.commodities);
              return (
                <Marker key={m.id} position={[m.coordinates.latitude, m.coordinates.longitude]} icon={icon}
                  eventHandlers={{
                    popupopen: () => {
                      setSelectedMineral(m);
                      setDraggedPos(null);
                    },
                    popupclose: () => {
                      setSelectedMineral(null);
                      setDraggedPos(null);
                    }
                  }}
                >
                  <Popup minWidth={260} className="mineral-popup bg-black bg-opacity-100 rounded-2xl shadow-2xl border border-cyan-900">
                    <div className="p-4 space-y-3 font-sans">
                      <h4 className="font-extrabold text-xl text-cyan-200 mb-1 tracking-tight">
                        {m.name}
                      </h4>
                      <div className="flex flex-col gap-2">
                        <div>
                          <span className="text-xs font-semibold text-cyan-400 tracking-widest">Commodities</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {m.commodities && m.commodities.length > 0 ? (
                              m.commodities.map((c, i) => (
                                <span key={i} className="inline-block bg-cyan-800/80 text-cyan-100 text-xs px-2 py-0.5 rounded-full font-medium shadow-sm border border-cyan-700">
                                  {c}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">None</span>
                            )}
                          </div>
                        </div>
                        {m.description && (
                          <div className="pt-2 border-t border-cyan-700/30">
                            <span className="text-xs font-semibold text-cyan-400 tracking-widest">Type</span>
                            <div className="text-sm text-cyan-100 mt-1 flex items-center gap-1">
                              <TooltipWithPortal content={DEPOSIT_TYPE_DEFINITIONS[m.description] || 'Deposit type refers to the geological classification of the mineral occurrence.'}>
                                <span>{m.description}</span>
                              </TooltipWithPortal>
                            </div>
                            {/* Distance from property */}
                            {center && center._fromProperty && (
                              <div className="text-xs text-cyan-300 mt-2">
                                Distance from your property: {(() => {
                                  const dist = getDistanceKm(center, m.coordinates);
                                  return `${dist.toFixed(2)} km`;
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end items-end pt-2">
                        <span className="text-[11px] text-gray-400 mr-1">Source:</span>
                        <a href="https://mrdata.usgs.gov/major-deposits/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline text-[11px]">USGS</a>
                      </div>
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

        <DialogContent className="bg-gray-900/80 backdrop-blur-sm border-cyan-400/20 text-white">
          <DialogHeader>
            <DialogTitle>Bibliographic Reference</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] p-4 rounded-md">
              <p className="text-sm">{selectedReference}</p>
          </ScrollArea>
          <DialogFooter>
              <DialogTrigger asChild>
                  <Button variant="outline">Close</Button>
              </DialogTrigger>
          </DialogFooter>
        </DialogContent>

        <style jsx global>{`
          .mineral-dot { width:16px; height:16px; display:block; border:2px solid #0f172a; }
          .leaflet-marker-icon.mineral-icon { background:transparent; border:none; }
          .property-icon { background:transparent; border:none; }
          /* Force ALL leaflet popups to have a black background */
          .leaflet-popup-content-wrapper, .leaflet-popup-tip {
            background: #000 !important;
            color: #fff !important;
            border-radius: 12px;
            border: 1px solid rgba(56, 189, 248, 0.4);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2), 0 0 25px rgba(56, 189, 248, 0.2) inset;
          }
          .mineral-popup .leaflet-popup-close-button,
          .leaflet-popup-close-button {
            color: #e5e7eb !important;
            transition: color 0.2s ease-in-out;
          }
          .mineral-popup .leaflet-popup-close-button:hover,
          .leaflet-popup-close-button:hover {
            color: #fff !important;
          }
        `}</style>
      </div>
    </Dialog>
  );
} 