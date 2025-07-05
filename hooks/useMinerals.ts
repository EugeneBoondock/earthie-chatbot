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
}

interface Options {
  radius?: number; // metres
  enabled?: boolean;
}

export function useMinerals(
  coords: { latitude: number; longitude: number } | null,
  { radius = 10000, enabled = true }: Options = {}
) {
  const [data, setData] = useState<MineralOccurrence[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !coords) return;

    const { latitude, longitude } = coords;
    setLoading(true);
    setError(null);

    fetch(`/api/minerals?lat=${latitude}&lon=${longitude}&radius=${radius}`)
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
  }, [coords?.latitude, coords?.longitude, radius, enabled]);

  return { data, loading, error } as const;
} 