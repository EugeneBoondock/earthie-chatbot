'use client';

import { Layers, Eye, Route, MapPin, Type, Map, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuLabel, 
  DropdownMenuRadioGroup, 
  DropdownMenuRadioItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export type MapLayer = 'dark' | 'satellite' | 'topo';

interface MapControlsProps {
  currentLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  onSearchArea: () => void;
  showRoute: boolean;
  onShowRouteChange: (value: boolean) => void;
  showLabels: boolean;
  onShowLabelsChange: (value: boolean) => void;
}

export function MapControls({
  currentLayer,
  onLayerChange,
  onSearchArea,
  showRoute,
  onShowRouteChange,
  showLabels,
  onShowLabelsChange,
}: MapControlsProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className="absolute top-2 right-2 z-[1000]">
      {/* Mobile minimizer toggle */}
      <button
        className="md:hidden absolute top-0 right-0 flex items-center justify-center w-8 h-8 bg-gray-800/80 rounded-full border border-cyan-400/20 text-white shadow-lg m-2"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Hide map controls' : 'Show map controls'}
        style={{ zIndex: 1010 }}
      >
        {open ? (
          <span className="text-xl">&minus;</span>
        ) : (
          <span className="text-xl">&#9776;</span>
        )}
      </button>
      {/* Controls: always visible on md+, togglable on mobile */}
      <div
        className={
          'p-2 bg-gray-800/80 backdrop-blur-sm rounded-lg border border-cyan-400/20 text-white shadow-lg space-y-3 ' +
          (open ? 'block' : 'hidden') + ' md:block mt-10 md:mt-0'
        }
      >
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">Map Type</Label>
          <div className="flex items-center space-x-1">
            <Button
              size="icon"
              variant={currentLayer === "dark" ? "secondary" : "ghost"}
              onClick={() => onLayerChange("dark")}
              className="h-8 w-8"
            >
              <Map className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={currentLayer === "satellite" ? "secondary" : "ghost"}
              onClick={() => onLayerChange("satellite")}
              className="h-8 w-8"
            >
              <Layers className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={currentLayer === "topo" ? "secondary" : "ghost"}
              onClick={() => onLayerChange("topo")}
              className="h-8 w-8"
            >
              <Layers className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="border-t border-gray-700/50 my-2"></div>
        <div className="flex flex-col gap-2">
          <Button onClick={onSearchArea} size="sm" className="bg-earthie-mint/20 hover:bg-earthie-mint/40 text-earthie-mint font-medium">
              <Search className="h-4 w-4 mr-2" />
              Search This Area
          </Button>
          {currentLayer === 'satellite' && (
              <div className="flex items-center space-x-2">
                  <Switch
                  id="show-labels"
                  checked={showLabels}
                  onCheckedChange={onShowLabelsChange}
                  />
                  <Label htmlFor="show-labels">Show Labels</Label>
              </div>
          )}
        </div>
      </div>
    </div>
  );
} 