'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface PropertyMapProps {
  coordinates: { longitude: number; latitude: number } | null;
  locationName: string;
}

export function PropertyMap({ coordinates, locationName }: PropertyMapProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    // Reset states when coordinates change
    setMapLoaded(false);
    setError(null);
  }, [coordinates]);

  if (!coordinates) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm p-4">
        No location data available
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-yellow-400 text-sm p-4 text-center">
        <p className="font-medium">Mapbox token not configured</p>
        <p className="text-xs mt-1">Please set NEXT_PUBLIC_MAPBOX_TOKEN in your environment variables</p>
      </div>
    );
  }

  const { longitude, latitude } = coordinates;
  console.log('Map coordinates:', { longitude, latitude });
  // Note: For satellite view with a pin, we need to use the correct format
  const pinIcon = `pin-s+ff0000(${longitude},${latitude})`;
  const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${pinIcon}/${latitude},${longitude},14,0/600x400@2x?access_token=${mapboxToken}&attribution=false&logo=false`;
  console.log('Map URL:', mapUrl);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Failed to load map image:', e);
    setError('Failed to load map. Please check your Mapbox token and coordinates.');
  };

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-2 left-2 z-10 bg-black/50 text-white text-xs p-1 rounded">
        {longitude.toFixed(6)}, {latitude.toFixed(6)}
      </div>
      
      <img
        src={mapUrl}
        alt={`Map of ${locationName}`}
        className={`w-full h-full object-cover transition-opacity duration-300 ${mapLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setMapLoaded(true)}
        onError={handleImageError}
      />

      {!mapLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50">
          <Loader2 className="h-8 w-8 animate-spin text-earthie-mint" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/90 p-4 text-center">
          <p className="text-red-400 font-medium">Error Loading Map</p>
          <p className="text-sm text-gray-300 mt-2">{error}</p>
          <a 
            href="https://account.mapbox.com/access-tokens/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-earthie-mint hover:underline mt-4 text-xs"
          >
            Check Mapbox Token Settings
          </a>
        </div>
      )}
    </div>
  );
}
