'use client';

import { Layers, Eye, Route } from 'lucide-react';
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

export type MapLayer = 'dark' | 'satellite' | 'topo';

interface MapControlsProps {
  currentLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  showAllProperties: boolean;
  onShowAllPropertiesChange: (show: boolean) => void;
  showRoute: boolean;
  onShowRouteChange: (show: boolean) => void;
}

export function MapControls({
  currentLayer,
  onLayerChange,
  showAllProperties,
  onShowAllPropertiesChange,
  showRoute,
  onShowRouteChange,
}: MapControlsProps) {
  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control leaflet-bar bg-black/50 backdrop-blur-md border border-cyan-400/30 rounded-lg p-2 flex flex-col gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 text-white hover:bg-cyan-400/20 hover:text-cyan-300">
              <Layers className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-gray-900 text-white border-gray-700">
            <DropdownMenuLabel>Map Biome</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={currentLayer} onValueChange={(value) => onLayerChange(value as MapLayer)}>
              <DropdownMenuRadioItem value="dark" className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="satellite" className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>Satellite</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="topo" className='cursor-pointer hover:bg-gray-800 focus:bg-gray-800'>Topographic</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center justify-center h-10 w-10" title="Show All Properties">
           <Switch
             id="show-all-properties"
             checked={showAllProperties}
             onCheckedChange={onShowAllPropertiesChange}
             className="!mt-0"
           />
        </div>
        
         <div className="flex items-center justify-center h-10 w-10" title="Show Route">
           <Switch
             id="show-route"
             checked={showRoute}
             onCheckedChange={onShowRouteChange}
             className="!mt-0"
           />
        </div>

      </div>
    </div>
  );
} 