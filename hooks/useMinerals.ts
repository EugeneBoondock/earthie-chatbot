'use client';

import { useState, useEffect } from 'react';

export interface MineralOccurrence {
  id: string;
  name: string;
  commodities: string[];
  description: string | null;
  status: string | null;
  coordinates: { latitude: number; longitude: number };
  source: string;
  references: {
      text: string;
      link: string | null;
  }[];
}

interface Options {
  radius?: number; // metres
  enabled?: boolean;
}

export function useMinerals(
  coords: { latitude: number; longitude: number } | null,
  { radius = 10000, enabled = true }: Options = {},
  bbox: string | null = null,
) {
  const [data, setData] = useState<MineralOccurrence[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isBboxSearch = bbox && enabled;
    const isCoordSearch = enabled && coords;

    if (!isBboxSearch && !isCoordSearch) {
        // If neither search is active (e.g. showAll is true but no bbox yet), do nothing.
        if (!enabled) setData(null);
        return;
    }

    setLoading(true);
    setError(null);

    let url: string;
    if (isBboxSearch) {
        url = `/api/minerals?bbox=${bbox}`;
    } else if (isCoordSearch) {
        const { latitude, longitude } = coords;
        url = `/api/minerals?lat=${latitude}&lon=${longitude}&radius=${radius}`;
    } else {
        setLoading(false);
        return; // should not happen
    }
    
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || `Minerals API returned ${r.status}`);
        }
        return r.json();
      })
      .then((j) => {
        setData(Array.isArray(j.data) ? j.data : []);
      })
      .catch((e: any) => {
        console.error('useMinerals error', e);
        setError(typeof e === 'string' ? e : e.message || 'Unknown error');
      })
      .finally(() => setLoading(false));
  }, [coords?.latitude, coords?.longitude, radius, enabled, bbox]);

  return { data, loading, error } as const;
} 