'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import dynamicImport from 'next/dynamic';
import { useMinerals } from '@/hooks/useMinerals';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { MineralOccurrence } from '@/hooks/useMinerals';
import { MapControls } from '@/components/MapControls';
import { Skeleton } from '@/components/ui/skeleton';

// Property type with tile count for minerals page
type Property = {
  id: string;
  attributes: {
    center: string;
    description: string;
    location: string;
    country: string;
    landfieldTier: number;
    tileCount: number;
  };
};

const getCacheKey = (userId: string) => `e2_properties_${userId}`;

// Country code to full name mapping
const countryCodeToName: Record<string, string> = {
  US: "United States of America",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  JP: "Japan",
  CN: "China",
  IN: "India",
  BR: "Brazil",
  RU: "Russia",
  ZA: "South Africa",
  MX: "Mexico",
  AR: "Argentina",
  PE: "Peru",
  CL: "Chile",
  CO: "Colombia",
  VE: "Venezuela",
  EC: "Ecuador",
  BO: "Bolivia",
  PY: "Paraguay",
  UY: "Uruguay",
  GY: "Guyana",
  SR: "Suriname",
  GF: "French Guiana",
  FK: "Falkland Islands",
  AF: "Afghanistan",
  AL: "Albania",
  DZ: "Algeria",
  AD: "Andorra",
  AO: "Angola",
  AG: "Antigua and Barbuda",
  SA: "Saudi Arabia",
  AM: "Armenia",
  AT: "Austria",
  AZ: "Azerbaijan",
  BS: "Bahamas",
  BH: "Bahrain",
  BD: "Bangladesh",
  BB: "Barbados",
  BE: "Belgium",
  BZ: "Belize",
  BJ: "Benin",
  BT: "Bhutan",
  BY: "Belarus",
  MM: "Myanmar",
  BA: "Bosnia and Herzegovina",
  BW: "Botswana",
  BN: "Brunei",
  BG: "Bulgaria",
  BF: "Burkina Faso",
  BI: "Burundi",
  KH: "Cambodia",
  CM: "Cameroon",
  CV: "Cape Verde",
  TD: "Chad",
  LK: "Sri Lanka",
  CD: "Democratic Republic of the Congo",
  CG: "Republic of the Congo",
  CR: "Costa Rica",
  HR: "Croatia",
  CU: "Cuba",
  CY: "Cyprus",
  CZ: "Czech Republic",
  DK: "Denmark",
  DJ: "Djibouti",
  DO: "Dominican Republic",
  EG: "Egypt",
  SV: "El Salvador",
  GQ: "Equatorial Guinea",
  ER: "Eritrea",
  EE: "Estonia",
  ET: "Ethiopia",
  FJ: "Fiji",
  FI: "Finland",
  GA: "Gabon",
  GM: "Gambia",
  GE: "Georgia",
  GH: "Ghana",
  GR: "Greece",
  GT: "Guatemala",
  GN: "Guinea",
  GW: "Guinea-Bissau",
  HT: "Haiti",
  HN: "Honduras",
  HK: "Hong Kong",
  HU: "Hungary",
  IS: "Iceland",
  ID: "Indonesia",
  IR: "Iran",
  IQ: "Iraq",
  IE: "Ireland",
  IL: "Israel",
  JM: "Jamaica",
  JO: "Jordan",
  KZ: "Kazakhstan",
  KE: "Kenya",
  KP: "North Korea",
  KR: "South Korea",
  KW: "Kuwait",
  KG: "Kyrgyzstan",
  LA: "Laos",
  LV: "Latvia",
  LB: "Lebanon",
  LS: "Lesotho",
  LR: "Liberia",
  LY: "Libya",
  LT: "Lithuania",
  LU: "Luxembourg",
  MK: "North Macedonia",
  MG: "Madagascar",
  MW: "Malawi",
  MY: "Malaysia",
  ML: "Mali",
  MT: "Malta",
  MR: "Mauritania",
  MU: "Mauritius",
  MA: "Morocco",
  MZ: "Mozambique",
  NA: "Namibia",
  NP: "Nepal",
  NL: "Netherlands",
  NZ: "New Zealand",
  NI: "Nicaragua",
  NE: "Niger",
  NG: "Nigeria",
  NO: "Norway",
  OM: "Oman",
  PK: "Pakistan",
  PA: "Panama",
  PG: "Papua New Guinea",
  PH: "Philippines",
  PL: "Poland",
  PT: "Portugal",
  QA: "Qatar",
  RO: "Romania",
  RW: "Rwanda",
  SN: "Senegal",
  RS: "Serbia",
  SL: "Sierra Leone",
  SG: "Singapore",
  SK: "Slovakia",
  SI: "Slovenia",
  SO: "Somalia",
  SD: "Sudan",
  SS: "South Sudan",
  SY: "Syria",
  TW: "Taiwan",
  TJ: "Tajikistan",
  TZ: "Tanzania",
  TH: "Thailand",
  TL: "Timor-Leste",
  TG: "Togo",
  TO: "Tonga",
  TN: "Tunisia",
  TR: "Turkey",
  TM: "Turkmenistan",
  UG: "Uganda",
  UA: "Ukraine",
  AE: "United Arab Emirates",
  UZ: "Uzbekistan",
  VN: "Vietnam",
  YE: "Yemen",
  ZM: "Zambia",
  ZW: "Zimbabwe"
};

function parseCenter(center: string): { latitude: number; longitude: number } | null {
  const match = center.match(/\(([^,]+),\s*([^)]+)\)/);
  if (match) {
    const lon = parseFloat(match[1]);
    const lat = parseFloat(match[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) return { latitude: lat, longitude: lon };
  }
  return null;
}

const MineralsMap = dynamicImport(() => import('@/components/MineralsMap').then(mod=>mod.default||mod), { ssr: false, loading: ()=>(<div className="aspect-video bg-gray-800/50 rounded-md border border-gray-700/50 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-earthie-mint"/></div>) });

// Helper function to get full country name
const getFullCountryName = (countryCode: string): string => {
  return countryCodeToName[countryCode] || countryCode;
};

export const dynamic = 'force-dynamic';

export default function MineralsHubPage() {
  const [lat, setLat] = useState<string>('');
  const [lon, setLon] = useState<string>('');
  const [radius, setRadius] = useState<number>(10000);
  const [submittedCoords, setSubmittedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [propertyLocation, setPropertyLocation] = useState<{ latitude: number; longitude: number; _fromProperty?: boolean } | null>(null);
  const [linkedE2UserId, setLinkedE2UserId] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<'description' | 'country' | 'tier' | 'tileCount'>('tileCount');
  const [page, setPage] = useState(1);
  const [bbox, setBbox] = useState<string | null>(null);
  const pageSize = 10;

  const { data, loading, error } = useMinerals(
    submittedCoords,
    {
      radius,
      enabled: !!submittedCoords || !!bbox,
    },
    bbox
  );

  const mineralsToShow = data;

  // fetch linked id
  useEffect(() => {
    let cancelled=false;
    async function fetchLinked(){
      try{
        const r=await fetch('/api/me/e2profile');
        if(!r.ok){
            if (!cancelled) setLoadingProps(false);
            return;
        }
        const j=await r.json();
        if(cancelled) return;
        if(j.e2_user_id){
            setLinkedE2UserId(j.e2_user_id);
        } else {
            if (!cancelled) setLoadingProps(false);
        }
      }catch{
        if (!cancelled) setLoadingProps(false);
      }
    }
    fetchLinked();
    return()=>{cancelled=true};
  },[]);

  // fetch cached properties
  useEffect(()=>{
    if(!linkedE2UserId) return;
    let cancelled=false;
    async function load(){
      setLoadingProps(true);
      try{
        const { get: idbGet } = await import('idb-keyval');
        const data:any = await idbGet(getCacheKey(linkedE2UserId!));
        if(cancelled) return;
        if(Array.isArray(data)){
          const transformed:Property[] = data.map((p:any)=>{
            // Extract country from location field
            const location = p.attributes.location || '';
            let country = '';
            if (location.includes(',')) {
              country = location.split(',').pop()?.trim() || '';
            } else {
              country = location.trim();
            }
            return {
            id:p.id,
            attributes:{
              center:p.attributes.center||'',
              description:p.attributes.description||'Unknown',
                location: location,
                country: country,
                landfieldTier:p.attributes.landfieldTier||1,
                tileCount:p.attributes.tileCount||0
            }
            };
          });
          setProperties(transformed);
        }
      }finally{if(!cancelled) setLoadingProps(false);}
    }
    load();
    return()=>{cancelled=true};
  },[linkedE2UserId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) return;
    const newCoords = { latitude: latNum, longitude: lonNum };
    setSubmittedCoords(newCoords);
    setPropertyLocation(newCoords);
    setBbox(null);
  };

  const handleSearchArea = (newBbox: string) => {
    setBbox(newBbox);
    setSubmittedCoords(null);
  };

  const handleShowMinerals = (prop: Property) => {
    const coords = parseCenter(prop.attributes.center);
    if (coords) {
      setSubmittedCoords(coords);
      setPropertyLocation({ ...coords, _fromProperty: true });
      setBbox(null);
    }
  };

  const handleClearProperty = () => {
    setPropertyLocation(null);
    // Keep the map open by maintaining submittedCoords or bbox
    // Only clear the property-specific location
  };

  const filteredProps = properties.filter(p=>
    p.attributes.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.attributes.country.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b)=>{
    switch(sortKey){
      case 'country': return a.attributes.country.localeCompare(b.attributes.country);
      case 'tier': return a.attributes.landfieldTier - b.attributes.landfieldTier;
      case 'tileCount': return b.attributes.tileCount - a.attributes.tileCount; // Descending by default
      default: return a.attributes.description.localeCompare(b.attributes.description);
    }
  });
  const totalPages = Math.max(1, Math.ceil(filteredProps.length/pageSize));
  const paginatedProps = filteredProps.slice((page-1)*pageSize, page*pageSize);

  const changePage=(n:number)=>{if(n>=1 && n<=totalPages) setPage(n);}

  return (
    <div className="space-y-6 p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-earthie-mint to-sky-300 inline-block text-transparent bg-clip-text">Mineral Resources Explorer</h1>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 bg-gray-800/50 p-4 rounded-lg border border-cyan-400/20">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-300" htmlFor="lat">Latitude</label>
          <Input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. -26.204" className="w-36" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-300" htmlFor="lon">Longitude</label>
          <Input id="lon" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="e.g. 28.047" className="w-36" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-300" htmlFor="radius">Radius (m)</label>
          <Input id="radius" type="number" value={radius} onChange={(e) => setRadius(parseInt(e.target.value, 10) || 10000)} className="w-32" />
        </div>
        <Button type="submit" className="bg-earthie-mint hover:bg-earthie-mint/80 text-gray-900 font-medium">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
        {error && <p className="text-red-400 text-sm ml-4">{error}</p>}
      </form>

      {/* Global Loader when fetching properties */}
      {loadingProps && properties.length===0 && (
        <div className="flex items-center gap-2 text-sm text-gray-300"><Loader2 className="h-4 w-4 animate-spin"/>Fetching your properties from cache...</div>
      )}

      {/* Map */}
      {submittedCoords || bbox ? (
        <div className="relative">
        <MineralsMap center={propertyLocation} minerals={mineralsToShow} loading={loading} onSearchArea={handleSearchArea} onClearProperty={handleClearProperty} />
        </div>
      ) : (
        <p className="text-gray-400">Enter coordinates and search to view mineral occurrences.</p>
      )}

      {/* Property List */}
      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Properties</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <Input placeholder="Search description or country" value={searchTerm} onChange={e=>{setSearchTerm(e.target.value); setPage(1);}} className="w-64" />
              <div className="flex items-center gap-2 text-sm text-gray-300">
                Sort by:
                <select value={sortKey} onChange={e=>setSortKey(e.target.value as any)} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white">
                  <option value="description">Description</option>
                  <option value="country">Country</option>
                  <option value="tier">Tier</option>
                  <option value="tileCount">Tile Count</option>
                </select>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Landfield Tier</TableHead>
                  <TableHead>Tile Count</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingProps ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`skel-${i}`}>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedProps.length > 0 ? (
                  paginatedProps.map((prop) => (
                    <TableRow key={prop.id}>
                      <TableCell>{prop.id}</TableCell>
                      <TableCell>{prop.attributes.description}</TableCell>
                      <TableCell>{getFullCountryName(prop.attributes.country)}</TableCell>
                      <TableCell>{prop.attributes.landfieldTier}</TableCell>
                      <TableCell>{prop.attributes.tileCount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge onClick={() => handleShowMinerals(prop)} className="cursor-pointer">
                          Show
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                   <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                          {linkedE2UserId
                            ? "No properties found. Visit the Logistics hub to sync."
                            : "Please link your account to see your properties."}
                      </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {/* Pagination */}
            {totalPages > 1 && !loadingProps && (
              <div className="flex justify-end items-center gap-4 mt-4">
                <Button variant="outline" size="sm" disabled={page===1} onClick={()=>changePage(page-1)}>Prev</Button>
                <span className="text-sm text-gray-300">Page {page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page===totalPages} onClick={()=>changePage(page+1)}>Next</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 