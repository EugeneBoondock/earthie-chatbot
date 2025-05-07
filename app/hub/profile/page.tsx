'use client';

import { useState, useEffect } from 'react';
// Assuming these are imported from your UI library, e.g., @/components/ui/card
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; 
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, MapPin, Maximize, Building, Zap, Tag, Landmark, CheckCircle, XCircle, Gem, ShieldCheck } from 'lucide-react';

// --- Interfaces for Earth2 API responses ---
interface E2UserInfo {
  id: string;
  picture?: string;
  customPhoto?: string;
  username: string;
  description?: string;
  customFlag?: string;
  countryCode?: string;
  userNetworth?: {
    networth: number;
    totalTiles: number;
    spent: number;
  };
  userLandfieldCount?: number;
  is_t1_owner?: boolean;
}

interface E2PropertyAttribute {
  description: string;
  location: string;
  country?: string;
  tileCount: number;
  tileClass?: number | string | null;
  price: number;
  purchaseValue?: number;
  currentValue: number;
  tradingValue?: number;
  landfieldTier: number;
  epl?: string | null;
  forSale: boolean;
  thumbnail?: string;
  claimedEssenceBalance?: string;
  hasMentar?: boolean;
  hasHolobuilding?: boolean;
  activeResourceClaimsCount?: number;
  lastEdited?: string;
}

interface E2Property {
  id: string;
  type: string;
  attributes: E2PropertyAttribute;
}

interface E2PropertiesResponse {
  data: E2Property[];
  meta?: {
    count: number;
    // ... other meta fields
  };
  links?: {
    next?: string;
    // ... other links
  };
}

// --- Helper function to extract E2 User ID ---
const extractE2UserId = (input: string): string | null => {
  if (!input) return null;
  const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
  const match = input.match(uuidRegex);
  return match ? match[0] : null;
};

export default function ProfilePage() {
  const [e2ProfileInput, setE2ProfileInput] = useState(''); // Input field value
  const [linkedE2UserId, setLinkedE2UserId] = useState<string | null>(null); // Persisted E2 User ID
  
  const [userInfo, setUserInfo] = useState<E2UserInfo | null>(null);
  const [properties, setProperties] = useState<E2Property[]>([]);
  const [propertiesMeta, setPropertiesMeta] = useState<E2PropertiesResponse['meta'] | null>(null);
  const [propertiesCurrentPage, setPropertiesCurrentPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch linked E2 User ID on mount
  useEffect(() => {
    const fetchLinkedId = async () => {
      setLinkingLoading(true);
      try {
        const response = await fetch('/api/me/e2profile');
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch linked E2 ID');
        }
        const data = await response.json();
        if (data.e2_user_id) {
          setLinkedE2UserId(data.e2_user_id);
          setE2ProfileInput(data.e2_user_id); // Pre-fill input
          // Optionally, trigger data fetch if ID is already linked
          // fetchE2Data(data.e2_user_id); 
        }
      } catch (err: any) {
        console.error('Error fetching linked E2 ID:', err);
        // Not setting a user-facing error here, as it might be normal not to have one linked
      } finally {
        setLinkingLoading(false);
      }
    };
    fetchLinkedId();
  }, []);

  // Fetch E2 data when linkedE2UserId changes and is valid
  useEffect(() => {
    if (linkedE2UserId) {
      fetchE2Data(linkedE2UserId, 1); // Fetch first page initially
    }
  }, [linkedE2UserId]); // Re-run if linkedE2UserId changes

  const fetchE2Data = async (userId: string, page: number = 1) => {
    if (!userId) return;
    setDataLoading(true);
    setError(null);
    setUserInfo(null); // Clear previous user info
    if (page === 1) setProperties([]); // Clear properties only if fetching first page

    try {
      // Fetch User Info
      const userInfoRes = await fetch(`https://app.earth2.io/api/v2/user_info/${userId}`);
      if (!userInfoRes.ok) throw new Error(`Failed to fetch E2 user info (status: ${userInfoRes.status})`);
      const userInfoData: E2UserInfo = await userInfoRes.json();
      setUserInfo(userInfoData);

      // Fetch Properties (paginated)
      const propertiesRes = await fetch(`https://r.earth2.io/landfields?page=${page}&perPage=12&userId=${userId}`);
      if (!propertiesRes.ok) throw new Error(`Failed to fetch E2 properties (status: ${propertiesRes.status})`);
      const propertiesData: E2PropertiesResponse = await propertiesRes.json();
      
      if (page === 1) {
        setProperties(propertiesData.data || []);
      } else {
        setProperties(prev => [...prev, ...(propertiesData.data || [])]);
      }
      setPropertiesMeta(propertiesData.meta || null);
      setPropertiesCurrentPage(page);

    } catch (err: any) {
      console.error('Error fetching E2 data:', err);
      setError(err.message || 'Failed to fetch data from Earth2 APIs.');
      setUserInfo(null);
      setProperties([]);
      setPropertiesMeta(null);
    } finally {
      setDataLoading(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const extractedId = extractE2UserId(e2ProfileInput);

    if (!extractedId) {
      setError('Invalid Earth2 Profile Link or User ID format. Please ensure it contains a valid UUID.');
      return;
    }

    setLinkingLoading(true);
    try {
      const response = await fetch('/api/me/e2profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ e2_user_id: extractedId }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to link E2 profile via API');
      }
      setLinkedE2UserId(extractedId); // Update state to trigger data fetch via useEffect
      // Data fetching will now be handled by the useEffect listening to linkedE2UserId
    } catch (err: any) {
      console.error('Error linking E2 profile:', err);
      setError(err.message);
    } finally {
      setLinkingLoading(false);
    }
  };
  
  const isLoading = linkingLoading || dataLoading;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-sky-300 mb-6">Your Earth2 Profile</h1>
      <p className="text-lg text-cyan-200/90 mb-4">
        Link your Earth2 profile to view your details and properties.
      </p>

      <Card className="shadow-xl bg-gray-800/40 border-sky-500/30">
        <CardHeader>
          <CardTitle>Link Your Earth2 Profile</CardTitle>
          <CardDescription>Paste your Earth2 profile link or just your User ID to fetch and display your public data.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLinkSubmit} className="flex flex-col sm:flex-row gap-3">
            <Input
              type="text"
              placeholder="e.g., https://app.earth2.io/#profile/YOUR_USER_ID"
              value={e2ProfileInput}
              onChange={(e) => setE2ProfileInput(e.target.value)}
              className="flex-grow bg-gray-800/70 border-sky-600/50"
              disabled={linkingLoading}
            />
            <Button type="submit" disabled={isLoading || !e2ProfileInput || e2ProfileInput === linkedE2UserId}>
              {linkingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {linkedE2UserId === extractE2UserId(e2ProfileInput) && !dataLoading ? 'Re-fetch Data' : 'Link & Fetch Data'}
            </Button>
          </form>
          {error && !dataLoading && <p className="text-sm text-red-400 mt-3 flex items-center"><AlertCircle className="h-4 w-4 mr-2" />{error}</p>}
        </CardContent>
      </Card>

      {dataLoading && !userInfo && (
        <div className="flex flex-col items-center justify-center py-12 text-sky-300">
          <Loader2 className="h-12 w-12 animate-spin text-sky-400 mb-4" />
          <p className="text-xl">Fetching Your Earth2 Data...</p>
          <p className="text-sm text-sky-400/70">This might take a moment.</p>
        </div>
      )}

      {userInfo && (
        <Card className="shadow-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/70 border-sky-400/40 overflow-hidden">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-6 bg-gray-900/50">
            {(userInfo.picture || userInfo.customPhoto) && (
              <img 
                src={userInfo.customPhoto || userInfo.picture} 
                alt={userInfo.username} 
                className="w-24 h-24 rounded-full border-4 border-sky-500 object-cover shadow-lg flex-shrink-0"
              />
            )}
            <div className="flex-grow">
              <CardTitle className="text-3xl font-bold text-sky-200 tracking-tight">{userInfo.username}</CardTitle>
              {userInfo.description && <CardDescription className="text-cyan-200/80 mt-1 text-sm max-w-prose">{userInfo.description}</CardDescription>}
            </div>
            {userInfo.customFlag && (
                <img src={userInfo.customFlag} alt="User Flag" className="w-10 h-auto object-contain rounded-sm shadow-md self-start sm:self-center"/>
            )}
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
            {[ 
              { label: 'Networth', value: userInfo.userNetworth?.networth, prefix: '$', icon: <Landmark className="w-4 h-4 mr-1.5 text-sky-400"/> },
              { label: 'Properties', value: userInfo.userLandfieldCount, icon: <Building className="w-4 h-4 mr-1.5 text-sky-400"/> },
              { label: 'Total Tiles', value: userInfo.userNetworth?.totalTiles, icon: <Maximize className="w-4 h-4 mr-1.5 text-sky-400"/> },
              { label: 'Country', value: userInfo.countryCode?.toUpperCase(), icon: <MapPin className="w-4 h-4 mr-1.5 text-sky-400"/> },
            ].map(stat => stat.value !== undefined && stat.value !== null && (
              <div key={stat.label} className="flex items-center">
                {stat.icon}
                <div>
                    <p className="text-xs text-sky-400/70 uppercase tracking-wider">{stat.label}</p>
                    <p className="text-lg font-semibold text-sky-100">
                        {stat.prefix}{typeof stat.value === 'number' ? stat.value.toLocaleString(undefined, stat.label === 'Networth' ? {minimumFractionDigits: 2, maximumFractionDigits: 2} : {}) : stat.value}
                    </p>
                </div>
              </div>
            ))}
            {userInfo.is_t1_owner && (
              <div className="flex items-center col-span-full sm:col-span-1 mt-2 sm:mt-0">
                <ShieldCheck className="w-5 h-5 mr-2 text-emerald-400"/> 
                <span className="text-sm bg-emerald-600/40 text-emerald-200 px-3 py-1 rounded-full border border-emerald-500/70 font-medium">Tier 1 Owner</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {properties.length > 0 && (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-sky-200">Your Earth2 Properties ({propertiesMeta?.count ? propertiesMeta.count.toLocaleString() : properties.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {properties.map((prop) => {
                const attr = prop.attributes;
                return (
                  <Card key={prop.id} className="bg-gray-800/60 border-sky-600/40 hover:border-sky-500/70 transition-all duration-300 ease-in-out shadow-lg hover:shadow-sky-500/20 flex flex-col">
                    {attr.thumbnail && (
                      <img src={attr.thumbnail} alt={attr.description || 'Property'} className="w-full h-48 object-cover rounded-t-lg" />
                    )}
                    <CardHeader className="pb-3 pt-4 px-5 flex-shrink-0">
                      <CardTitle className="text-lg leading-tight text-sky-200 hover:text-sky-100 transition-colors truncate" title={attr.description}>{attr.description || 'Unnamed Property'}</CardTitle>
                      <CardDescription className="text-xs text-cyan-300/70 truncate flex items-center mt-1">
                        <MapPin className="w-3 h-3 mr-1.5 text-sky-400/80 flex-shrink-0" /> {attr.location || 'Unknown Location'}{attr.country && `, ${attr.country}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm px-5 pb-4 space-y-2 text-cyan-100/90 flex-grow">
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                            {[ 
                                { label: 'Value', value: attr.currentValue, prefix: '$', icon: <Landmark size={14} className="text-sky-400/90"/>, formatOpts: {minimumFractionDigits:2, maximumFractionDigits:2} },
                                { label: 'Tiles', value: attr.tileCount, icon: <Maximize size={14} className="text-sky-400/90"/> },
                                { label: 'Tier', value: attr.landfieldTier, icon: <Building size={14} className="text-sky-400/90"/> },
                                { label: 'Class', value: attr.tileClass, icon: <Tag size={14} className="text-sky-400/90"/> },
                                { label: 'Price', value: attr.forSale ? attr.price : undefined, prefix: '$', icon: <Tag size={14} className="text-sky-400/90"/> },
                                { label: 'Purchase Value', value: attr.purchaseValue, prefix: '$', icon: <Tag size={14} className="text-sky-400/90"/> },
                                { label: 'Trading Value', value: attr.tradingValue, prefix: '$', icon: <Zap size={14} className="text-sky-400/90"/> },
                                { label: 'Essence', value: attr.claimedEssenceBalance, icon: <Gem size={14} className="text-sky-400/90"/> },
                            ].map(item => item.value !== undefined && item.value !== null && (
                                <div key={item.label} className="flex items-center space-x-1.5">
                                    {item.icon} <span className="text-sky-400/80">{item.label}:</span> 
                                    <span className="font-medium text-sky-200">{item.prefix}{typeof item.value === 'number' ? item.value.toLocaleString(undefined, item.formatOpts) : item.value}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 text-xs border-t border-sky-700/30 mt-2">
                            {attr.forSale && <span className="bg-green-600/30 text-green-200 px-2 py-0.5 rounded-full border border-green-500/50 flex items-center"><CheckCircle size={12} className="mr-1"/> For Sale</span>}
                            {attr.hasMentar && <span className="bg-purple-600/30 text-purple-200 px-2 py-0.5 rounded-full border border-purple-500/50 flex items-center"><Zap size={12} className="mr-1"/> Mentar</span>}
                            {attr.hasHolobuilding && <span className="bg-indigo-600/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-500/50 flex items-center"><Building size={12} className="mr-1"/> Holo</span>}
                            {attr.epl && <span className="bg-yellow-600/30 text-yellow-200 px-2 py-0.5 rounded-full border border-yellow-500/50 truncate max-w-[100px]" title={attr.epl}><Tag size={12} className="mr-1"/>{attr.epl}</span>}
                        </div>
                    </CardContent>
                  </Card>
                )}
              )}
            </div>
            {propertiesMeta && propertiesMeta.count > properties.length && (
                <div className="mt-8 text-center">
                    <Button 
                        onClick={() => fetchE2Data(linkedE2UserId!, propertiesCurrentPage + 1)}
                        disabled={dataLoading} className="bg-sky-600 hover:bg-sky-500 shadow-lg"
                    >
                        {dataLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Load More Properties (Page {propertiesCurrentPage + 1})
                    </Button>
                </div>
            )}
        </div>
      )}

      {linkedE2UserId && !userInfo && !dataLoading && !error && (
        <p className="text-center text-lg text-cyan-300/80 py-8">No data found for linked E2 User ID: {linkedE2UserId}. It might be an invalid ID or the APIs are temporarily unavailable.</p>
      )}
    </div>
  );
} 