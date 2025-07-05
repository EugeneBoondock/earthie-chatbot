"use client";

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Loader2, MapPin, Landmark, Globe, Mountain, Map, ArrowLeft, ExternalLink, 
  ChevronUp, ChevronDown, Search, Camera, Book, Users, Radio, Tv, Music, PlayCircle, X, Info, AlertCircle, Clock, History,
  Volume2, Youtube, Pause, Play, Sun, FileText, ArrowUpRight, Badge as LucideBadge, RefreshCw, Maximize2, Settings, VolumeX, Volume1, Minimize2
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAudioPlayer } from "@/contexts/AudioContext"; // Import the global audio player hook
import dynamic from 'next/dynamic';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Dynamic import for PropertyMap
const PropertyMap = dynamic(() => import("@/components/PropertyMap").then(mod => ({ default: mod.PropertyMap })), {
  ssr: false,
  loading: () => (
    <div className="aspect-video bg-gray-800/50 rounded-md border border-gray-700/50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-earthie-mint mx-auto mb-2" />
        <p className="text-sm text-gray-300">Loading map...</p>
      </div>
    </div>
  )
});

// Types for property data
interface PropertyData {
  id: string;
  description: string;
  location: string;
  country?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  // Add parsed location components
  locationParts?: {
    specificPlace?: string;
    city?: string;
    region?: string;
    country?: string;
  };
  owner?: {
    country?: string;
  };
  center?: string; // Add this line to include center field
}

// Types for location info
interface LocationInfo {
  summary?: string;
  extract?: string;
  image?: string;
  url?: string;
  title?: string;
  facts?: Record<string, string>;
  landmarks?: Array<{
    name: string;
    type?: string;
    distance?: string;
    description?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    dist?: number;
    rawType?: string;
  }>;
  climate?: string;
  history?: string;
  people?: {
    demographics?: string;
    notablePeople?: Array<{
      name: string;
      description: string;
      image?: string;
      historical?: boolean;
      indigenous?: boolean;
    }>;
    indigenousGroups?: Array<{
      name: string;
      description: string;
      image?: string;
    }>;
  };
  entertainment?: {
    radioStations?: Array<RadioStation>;
    tvStations?: Array<{
      name: string;
      description?: string;
      genre?: string;
      image?: string;
      url?: string;
      embedUrl?: string;
      country?: string;
      streamType?: string;
    }>;
  };
  videos?: Array<{
    id: string;
    title: string;
    thumbnail: string;
    channelTitle?: string;
    source?: string;
  }>;
}

// Interface for radio stations
interface RadioStation {
  id: string;
  name: string;
  url: string;
  streamUrl?: string;
  description?: string;
  genre?: string;
  image?: string;
  country?: string;
  codec?: string; // Add codec
}

interface IPTVStream {
  channel: string;
  url: string;
  // Add other properties that the stream objects might have
  [key: string]: any;
}

interface IPTVChannel {
  id: string;
  country?: string;
  name: string;
  [key: string]: any;
}

// Move getContinent and getApproxTimeZone to the top level, outside any function
const getContinent = (lat: number, lng: number): string => {
  if (lat > 34 && lng > -10 && lng < 40) return "Europe";
  if (lat > 8 && lng > 35 && lng < 60) return "Middle East";
  if (lat > 8 && lng >= 60 && lng < 150) return "Asia";
  if (lat < -10 && lng > 110 && lng < 180) return "Oceania";
  if (lat < 8 && lat > -35 && lng > -20 && lng < 60) return "Africa";
  if (lat > -60 && lat < 15 && lng > -90 && lng < -30) return "South America";
  if (lat > 15 && lng > -170 && lng < -30) return "North America";
  if (lat < -60) return "Antarctica";
  return "Unknown";
};
const getApproxTimeZone = (lng: number): string => {
  const hours = Math.round(lng / 15);
  const sign = hours >= 0 ? "+" : "";
  return `UTC${sign}${hours}`;
};

// Utility to clean Wikipedia cite error messages from HTML
function cleanWikipediaCiteErrors(html: string): string {
  if (!html) return html;
  // Remove cite error blocks (common patterns)
  // Remove <cite ...>...</cite> blocks with cite error
  html = html.replace(/<cite[^>]*cite error[^>]*>[\s\S]*?<\/cite>/gi, '');
  // Remove divs/spans with cite error
  html = html.replace(/<div[^>]*cite error[^>]*>[\s\S]*?<\/div>/gi, '');
  html = html.replace(/<span[^>]*cite error[^>]*>[\s\S]*?<\/span>/gi, '');
  // Remove the specific error message text if present
  html = html.replace(/Cite error: There are[\s\S]*?help page\)\./gi, '');
  return html;
}

// Helper to extract a short preview from HTML (first paragraph or first 300 chars)
function getHistoryPreview(html: string, maxLength = 300): string {
  if (!html) return '';
  // Try to extract the first <p>...</p>
  const match = html.match(/<p>([\s\S]*?)<\/p>/i);
  let text = '';
  if (match && match[1]) {
    text = match[1].replace(/<[^>]+>/g, '').trim();
  } else {
    // Fallback: strip all HTML and take the first maxLength chars
    text = html.replace(/<[^>]+>/g, '').trim();
  }
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...';
  }
  return text;
}

export default function KnowYourLandPage() {
  const [propertyId, setPropertyId] = useState("");
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [isLoadingProperty, setIsLoadingProperty] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentProperties, setRecentProperties] = useState<PropertyData[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

  // Debug logging for landmarks tab
  useEffect(() => {
    if (activeTab === "landmarks") {
      console.log('[KYL] Landmarks tab active, locationInfo:', locationInfo);
    }
  }, [activeTab, locationInfo]);
  const [showMoreHistory, setShowMoreHistory] = useState(false);
  const [showMoreOverview, setShowMoreOverview] = useState(false);
  const [currentTvStation, setCurrentTvStation] = useState<string | null>(null);
  const [showTVModal, setShowTVModal] = useState(false);
  const [currentTVEmbedUrl, setCurrentTVEmbedUrl] = useState<string | null>(null);
  const [currentTVStreamType, setCurrentTVStreamType] = useState<string | null>(null);
  const latestPropertyIdRef = useRef<string | null>(null);

  // Use the global audio player context
  const {
    currentStation: globalCurrentRadioStation,
    isPlaying: globalIsPlayingRadio,
    isLoading: globalIsRadioLoading,
    playStation: globalPlayRadioStation,
    stopRadio: globalStopRadio
  } = useAudioPlayer();

  const supabase = createClientComponentClient();

  // Fetch recent properties from localStorage
  useEffect(() => {
    const storedProps = localStorage.getItem('recentViewedProperties');
    if (storedProps) {
      try {
        let props = JSON.parse(storedProps);
        if (Array.isArray(props)) {
          // Ensure all properties have required fields
          let needsUpgrade = false;
          const validProps = props.slice(0, 5).map(prop => {
            if (!prop.country) needsUpgrade = true;
            return {
              ...prop,
              description: prop.description || prop.location || "Unknown Property",
              location: prop.location || "Unknown Location"
            };
          });
          if (!needsUpgrade) {
            setRecentProperties(validProps);
          } else {
            // If any property is missing country, fetch from API and upgrade
            Promise.all(validProps.map(async (prop) => {
              if (!prop.country && prop.id) {
                try {
                  const response = await fetch(`/api/e2/property/${prop.id}`);
                  if (response.ok) {
                    const data = await response.json();
                    return {
                      ...prop,
                      country: data.country || undefined,
                      description: data.description || data.location || prop.description || "Unknown Property",
                      location: data.location || prop.location || "Unknown Location",
                      center: data.center // Add this line to ensure center is saved
                    };
                  }
                } catch {}
              }
              return prop;
            })).then((upgradedProps) => {
              localStorage.setItem('recentViewedProperties', JSON.stringify(upgradedProps));
              setRecentProperties(upgradedProps);
            });
          }
        } else {
          setRecentProperties([]);
        }
      } catch (e) {
        console.error('Failed to parse recent properties', e);
        setRecentProperties([]);
      }
    }
  }, []);

  // Save property to recent list
  const saveToRecent = (property: PropertyData) => {
    if (!property.id) return;
    // Always include country field
    const propertyToSave = {
      ...property,
      country: property.country || undefined, // Ensure country is present (undefined if missing)
      description: property.description || property.location || "Unknown Property",
      location: property.location || "Unknown Location",
      center: property.center // Add this line to ensure center is saved
    };
    
    // Get existing or initialize empty array
    const existing = localStorage.getItem('recentViewedProperties');
    let props: PropertyData[] = [];
    if (existing) {
      try {
        props = JSON.parse(existing);
        if (!Array.isArray(props)) props = [];
      } catch (e) {
        console.error('Failed to parse recent properties', e);
      }
    }
    
    // Remove if already exists
    const filtered = props.filter(p => p.id !== propertyToSave.id);
    
    // Add to beginning and limit to 5
    const updated = [propertyToSave, ...filtered].slice(0, 5);
    localStorage.setItem('recentViewedProperties', JSON.stringify(updated));
    setRecentProperties(updated);
  };

  // Fetch property info from Earth2 API
  const fetchPropertyInfo = async (id: string) => {
    if (!id.trim()) return;
    latestPropertyIdRef.current = id;
    setIsLoadingProperty(true);
    setError(null);
    setLocationInfo(null);
    try {
      const response = await fetch(`/api/e2/property/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch property (${response.status})`);
      }
      const data = await response.json();
      
      // Add debugging
      console.log("E2 API response:", data);
      
      // Extract coordinates from center string
      let latitude, longitude;
      if (data.center && typeof data.center === 'string') {
        // Parse coordinates from format like "(25.540295, -33.936097)"
        const coordsMatch = data.center.match(/\(([^,]+),\s*([^)]+)\)/);
        if (coordsMatch && coordsMatch.length === 3) {
          // Parse as (latitude, longitude)
          latitude = parseFloat(coordsMatch[1]);
          longitude = parseFloat(coordsMatch[2]);
          console.log("Parsed coordinates:", { latitude, longitude });
        }
      }
      
      // Parse location into parts for more specific data fetching
      const locationParts = parseLocationString(data.location || "");
      
      // Extract the necessary information
      const property: PropertyData = {
        id: data.id,
        description: data.description || data.location || "Unknown Property",
        location: data.location || "Unknown Location",
        country: data.country,
        coordinates: latitude !== undefined && longitude !== undefined ? {
          latitude,
          longitude
        } : undefined,
        locationParts,
        owner: data.owner ? { country: data.owner.country } : undefined,
        center: data.center // Add this line to ensure center is included
      };
      
      console.log("Processed property data:", property);
      setPropertyData(property);
      saveToRecent(property);
      
      // Now fetch location info with the coordinates, using the freshly constructed property object
      if (property.coordinates?.latitude !== undefined && property.coordinates?.longitude !== undefined) {
        fetchLocationInfo(property.location, {
          latitude: property.coordinates.latitude,
          longitude: property.coordinates.longitude
        }, property.locationParts, property.id, property.country);
      } else {
        console.log("No valid coordinates found in property data");
      }
    } catch (error) {
      console.error("Error fetching property info:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch property information");
    } finally {
      setIsLoadingProperty(false);
    }
  };

  // Helper function to parse location string into components
  const parseLocationString = (location: string): PropertyData['locationParts'] => {
    if (!location || location === 'Unknown Location') {
      return {};
    }
    
    // Try to parse "Place, City, Region, Country" format
    const parts = location.split(',').map(part => part.trim());
    
    if (parts.length >= 4) {
      return {
        specificPlace: parts[0],
        city: parts[1],
        region: parts[2],
        country: parts[3]
      };
    } else if (parts.length === 3) {
      return {
        specificPlace: parts[0],
        city: parts[1],
        country: parts[2]
      };
    } else if (parts.length === 2) {
      return {
        city: parts[0],
        country: parts[1]
      };
    } else {
      return {
        specificPlace: parts[0]
      };
    }
  };

  // Fetch location info using Wikipedia and other APIs
  const fetchLocationInfo = async (
    locationName: string,
    coordinates: { latitude?: number, longitude?: number },
    locationParts?: PropertyData['locationParts'],
    propertyIdForThisFetch?: string,
    countryCodeArg?: string
  ) => {
    console.log('[KYL] fetchLocationInfo START', { locationName, coordinates, locationParts, propertyIdForThisFetch, latestPropertyId: latestPropertyIdRef.current });
    setLocationInfo(null); // Always reset at the start of a fetch
    setIsLoadingLocation(true);
    const hasValidCoords = coordinates?.latitude !== undefined && coordinates?.longitude !== undefined;
    const coordsText = hasValidCoords 
      ? `${coordinates.latitude!.toFixed(4)}°, ${coordinates.longitude!.toFixed(4)}°`
      : "unknown coordinates";
    try {
      // Helper to count sentences
      const countSentences = (text: string) => (text.match(/[.!?](\s|$)/g) || []).length;
      // Build fallback queries: full, no country, first word
      const queries: string[] = [];
      let mainQuery = locationName.replace("Elizaberth", "Elizabeth").trim();
      queries.push(mainQuery);
      // Remove country if present (e.g., 'Mashonaland West, Zimbabwe' -> 'Mashonaland West')
      if (mainQuery.includes(",")) {
        const noCountry = mainQuery.split(",")[0].trim();
        if (noCountry && !queries.includes(noCountry)) queries.push(noCountry);
      }
      // Add first word (e.g., 'Mashonaland')
      const firstWord = mainQuery.split(/\s+/)[0];
      if (firstWord.length > 2 && !queries.includes(firstWord)) queries.push(firstWord);
      // Add country as last fallback
      if (locationParts?.country && !queries.includes(locationParts.country)) queries.push(locationParts.country);
      // Try each query in order until we get a summary
      let foundSummary = '';
      let foundTitle = '';
      let foundImage = '';
      let foundUrl = '';
      let foundType = '';
      let foundHistoryHtml = '';
      let usedFallback = false;
      let summary404 = false;
      for (let i = 0; i < queries.length; ++i) {
        const q = queries[i];
        try {
          const wikiQuery = encodeURIComponent(q);
          const wikiUrlApi = `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiQuery}`;
          const wikiResponse = await fetch(wikiUrlApi, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            mode: 'cors',
          });
          if (wikiResponse.ok) {
            const wikiData = await wikiResponse.json();
            if (wikiData.extract) {
              foundSummary = wikiData.extract;
              foundTitle = wikiData.title || q;
              foundImage = wikiData.thumbnail?.source || '';
              foundUrl = wikiData.content_urls?.desktop?.page || '';
              foundType = wikiData.type || '';
              // Try to fetch history for this title
              foundHistoryHtml = await fetchWikipediaHistorySection(foundTitle) || '';
              break;
            }
          } else if (wikiResponse.status === 404) {
            summary404 = true;
            continue; // Try next fallback
          }
        } catch (err) {
          // Ignore and try next fallback
        }
      }
      // If all queries failed (404), show a friendly message
      if (!foundSummary && summary404) {
        foundSummary = `No Wikipedia summary found for this location.`;
      }
      // If the summary is short (<=5 sentences) and we have a next fallback, try to prepend it
      let finalSummary = foundSummary;
      let finalHistoryHtml = foundHistoryHtml;
      if (finalSummary && countSentences(finalSummary) <= 5) {
        // Try next fallback (if not already used)
        for (let i = 1; i < queries.length; ++i) {
          const q = queries[i];
          if (q === foundTitle) continue;
          try {
            const wikiQuery = encodeURIComponent(q);
            const wikiUrlApi = `https://en.wikipedia.org/api/rest_v1/page/summary/${wikiQuery}`;
            const wikiResponse = await fetch(wikiUrlApi, {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
              mode: 'cors',
            });
            if (wikiResponse.ok) {
              const wikiData = await wikiResponse.json();
              if (wikiData.extract && wikiData.extract !== finalSummary) {
                finalSummary = wikiData.extract + (finalSummary ? '\n\n' + finalSummary : '');
                // Also try to fetch history for this fallback
                const extraHistory = await fetchWikipediaHistorySection(wikiData.title || q) || '';
                if (extraHistory) {
                  finalHistoryHtml = extraHistory + (finalHistoryHtml ? '<hr/>' + finalHistoryHtml : '');
                }
                break;
              }
            }
          } catch (err) {}
        }
      }
      // Set the basic info we already have (show summary as soon as it's available)
      let facts: Record<string, string> = {
        "Location Type": foundType || "Geographic Location",
        "Coordinates": coordsText
      };
      // Add population if it's mentioned in the extract
      const populationMatch = finalSummary?.match(/population of (\d[\d,]+)/i);
      if (populationMatch) {
        facts["Estimated Population"] = populationMatch[1];
      }
      // Add more facts based on the location type
      if (foundTitle) {
        // Try to extract the continent
        const continentMatches = finalSummary?.match(/(Africa|Europe|Asia|North America|South America|Australia|Antarctica)/gi);
        if (continentMatches && continentMatches.length > 0) {
          facts["Continent"] = continentMatches[0];
        } else if (coordinates?.latitude !== undefined && coordinates?.longitude !== undefined) {
          facts["Continent"] = getContinent(coordinates.latitude, coordinates.longitude);
        }
        // Languages - common languages based on region or explicitly mentioned
        const languageMatches = finalSummary?.match(/languages? (is|are|include) ([^\.]+)/i);
        if (languageMatches && languageMatches.length > 2) {
          facts["Languages"] = languageMatches[2];
        }
        // Currency - if mentioned
        const currencyMatches = finalSummary?.match(/currency is ([^\.]+)/i);
        if (currencyMatches && currencyMatches.length > 1) {
          facts["Currency"] = currencyMatches[1];
        }
        // Time Zone based on longitude
        if (coordinates?.longitude !== undefined) {
          facts["Approximate Time Zone"] = getApproxTimeZone(coordinates.longitude);
        }
        // Area size if mentioned
        const areaMatches = finalSummary?.match(/area of ([\d,]+) (km²|square kilometers|sq km)/i);
        if (areaMatches && areaMatches.length > 1) {
          facts["Area"] = `${areaMatches[1]} ${areaMatches[2]}`;
        }
      }
      // Get country code for IPTV and other data
      const countryCode = countryCodeArg;
      // Set summary/facts immediately
      setLocationInfo(prev => {
        if (propertyIdForThisFetch && latestPropertyIdRef.current !== propertyIdForThisFetch) {
          return prev;
        }
        return {
          ...prev,
          title: foundTitle || locationName,
          summary: finalSummary || `This location is situated at ${coordsText}. While detailed information is limited, you can explore this area's unique characteristics through its geographical position and natural features.`,
          image: foundImage,
          url: foundUrl,
          facts: facts,
          history: finalHistoryHtml,
          videos: prev?.videos || [], // Preserve videos if already set
        };
      });
      // Fetch radio and TV in parallel, update as soon as each is ready
      if (countryCode && countryCode.length === 2) {
        const radioUrl = `https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/${countryCode}?limit=30&order=clickcount&reverse=true&hidebroken=true`;
        console.log('[KYL] Fetching radio stations for country:', countryCode, 'URL:', radioUrl);
        fetchRadioBrowserStations(countryCode, locationParts?.region).then(radioStations => {
          setLocationInfo(prev => {
            if (propertyIdForThisFetch && latestPropertyIdRef.current !== propertyIdForThisFetch) return prev;
            return {
              ...prev,
              entertainment: {
                ...prev?.entertainment,
                radioStations: radioStations && radioStations.length > 0 ? radioStations : [],
                tvStations: prev?.entertainment?.tvStations || [],
              },
              videos: prev?.videos || [],
            };
          });
        });
        fetchIPTVChannels(countryCode).then(tvStations => {
          setLocationInfo(prev => {
            if (propertyIdForThisFetch && latestPropertyIdRef.current !== propertyIdForThisFetch) return prev;
            return {
              ...prev,
              entertainment: {
                ...prev?.entertainment,
                tvStations: tvStations && tvStations.length > 0 ? tvStations : [],
                radioStations: prev?.entertainment?.radioStations || [],
              },
              videos: prev?.videos || [],
            };
          });
        });
      } else {
        // No valid country code, show message
        setLocationInfo(prev => {
          if (propertyIdForThisFetch && latestPropertyIdRef.current !== propertyIdForThisFetch) return prev;
          return {
            ...prev,
            entertainment: {
              ...prev?.entertainment,
              radioStations: [],
              tvStations: [],
            },
            videos: prev?.videos || [],
          };
        });
      }
      // Fetch videos and notable people in parallel
      Promise.all([
        fetchNotablePeopleData(locationParts || { specificPlace: locationName }, coordinates),
        (async () => {
          const videos: any[] = [];
          await searchYouTubeVideos(locationName, locationParts, (video) => {
            videos.push(video);
            setLocationInfo(prev => {
              if (propertyIdForThisFetch && latestPropertyIdRef.current !== propertyIdForThisFetch) return prev;
              return {
                ...prev,
                videos: [...videos],
              };
            });
          });
          return videos;
        })()
      ]).then(([notablePeople, videos]) => {
        setLocationInfo(prev => {
          if (propertyIdForThisFetch && latestPropertyIdRef.current !== propertyIdForThisFetch) return prev;
          return {
            ...prev,
            people: {
              demographics: generateDemographics(foundTitle || locationName, finalSummary),
              notablePeople: notablePeople,
              indigenousGroups: generateIndigenousGroups(coordinates)
            },
            videos: videos,
            entertainment: {
              ...prev?.entertainment,
            },
          };
        });
      });
      // Fetch landmarks if coordinates are valid
      if (hasValidCoords) {
        fetchAdditionalLocationData(locationName, { latitude: coordinates.latitude!, longitude: coordinates.longitude! });
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to fetch location information");
      setLocationInfo(prev => {
        if (propertyIdForThisFetch && latestPropertyIdRef.current !== propertyIdForThisFetch) {
          return prev;
        }
        const info = {
          title: locationName,
          summary: `This location is situated at ${coordsText}. While detailed information is limited, you can explore this area's unique characteristics through its geographical position and natural features.`,
          facts: {
            "Location Type": "Geographic Area",
            "Coordinates": coordsText,
            "Continent": hasValidCoords ? getContinent(coordinates.latitude!, coordinates.longitude!) : "Unknown",
            "Approximate Time Zone": hasValidCoords ? getApproxTimeZone(coordinates.longitude!) : "Unknown"
          }
        };
        return info;
      });
    } finally {
      if (!propertyIdForThisFetch || latestPropertyIdRef.current === propertyIdForThisFetch) {
        setIsLoadingLocation(false);
      }
      // else: do not set, let the latest fetch handle it
    }
  };

  // Function to get country code from location name or coordinates
  const getCountryCodeFromLocation = (locationName: string, coordinates?: { latitude?: number, longitude?: number }): string => {
    // Try to extract country code from the location name
    const locationParts = locationName.split(',').map(part => part.trim());
    const countryName = locationParts[locationParts.length - 1];
    // Map of common country names to ISO codes
    const countryMap: Record<string, string> = {
      'USA': 'US', 'United States': 'US', 'America': 'US',
      'UK': 'GB', 'United Kingdom': 'GB', 'England': 'GB', 'Britain': 'GB',
      'France': 'FR', 'Germany': 'DE', 'Italy': 'IT', 'Spain': 'ES',
      'Canada': 'CA', 'Australia': 'AU', 'Japan': 'JP', 'China': 'CN',
      'India': 'IN', 'Brazil': 'BR', 'Russia': 'RU', 'South Africa': 'ZA',
      'Cyprus': 'CY', 'Greece': 'GR'
    };
    // Check if we have a mapping
    if (countryName && countryMap[countryName]) {
      return countryMap[countryName];
    }
    // If not, use coordinate-based approximation (very rough, fallback only)
    if (coordinates?.latitude !== undefined && coordinates?.longitude !== undefined) {
      const lat = coordinates.latitude;
      const lng = coordinates.longitude;
      if (lat > 25 && lat < 50 && lng > -10 && lng < 30) return "FR"; // Western Europe fallback
      if (lat > 25 && lat < 50 && lng < -50) return "US";
      if (lat < 0 && lng > 10 && lng < 40) return "ZA";
      if (lat > 0 && lat < 15 && lng > 30 && lng < 50) return "ET";
      if (lat > 10 && lat < 40 && lng > 100 && lng < 150) return "JP";
      return "INT";
    }
    return 'INT'; // Default international code if we can't determine
  };

  // Function to fetch notable people data from Wikidata
  const fetchNotablePeopleData = async (
    locationParts: Partial<PropertyData['locationParts']>,
    coordinates?: { latitude?: number, longitude?: number }
  ): Promise<Array<{ name: string; description: string; image?: string; historical?: boolean; indigenous?: boolean }>> => {
    const initialSearchTerm = locationParts?.specificPlace || locationParts?.city || locationParts?.country || "Unknown Location";
    console.log("Attempting to fetch notable people from Wikidata for base location:", initialSearchTerm);

    // Prioritized list of terms to search for a Wikidata QID
    const searchTerms: string[] = [];
    if (locationParts?.specificPlace) searchTerms.push(locationParts.specificPlace); 
    if (locationParts?.city && locationParts.city !== locationParts.specificPlace) searchTerms.push(locationParts.city);
    // Correct common misspellings like Port Elizabeth
    if (locationParts?.city?.toLowerCase() === "port elizaberth") {
      searchTerms.push("Port Elizabeth"); // Add corrected version
    }
    if (locationParts?.country && !searchTerms.includes(locationParts.country)) searchTerms.push(locationParts.country); 

    if (searchTerms.length === 0) {
      console.log("No usable search terms for Wikidata QID lookup.");
      return [];
    }
    
    console.log("Wikidata QID search priority:", searchTerms);

    let placeQid: string | null = null;

    for (const term of searchTerms) {
      if (!term || term.trim() === "") continue;
      console.log(`Searching Wikidata QID for: "${term}"`);
      try {
        const qidResponse = await fetch(
          `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(term)}&language=en&limit=1&format=json&origin=*`
        );
        if (qidResponse.ok) {
          const qidData = await qidResponse.json();
          if (qidData.search && qidData.search.length > 0 && qidData.search[0].id) {
            placeQid = qidData.search[0].id;
            console.log(`Found Wikidata QID for "${term}": ${placeQid}`);
            break; // Found a QID, stop searching
          }
        } else {
          console.warn(`Wikidata QID search for "${term}" failed: ${qidResponse.status}`);
        }
      } catch (error) {
        console.error(`Error during Wikidata QID search for "${term}":`, error);
      }
    }

    if (!placeQid) {
      console.warn("No Wikidata QID found for any search terms for:", initialSearchTerm);
      return [];
    }

    // 2. Construct and execute SPARQL query with the found QID
    try {
      const sparqlQuery = `
        SELECT ?person ?personLabel ?personDescription ?image ?birthDate ?deathDate WHERE {
          {
            ?person wdt:P19 wd:${placeQid} .  # P19 (place of birth)
          } UNION {
            # Optionally, include people associated with a broader region if placeQid is a region/country
            # ?person wdt:P27 wd:${placeQid} . # P27 (country of citizenship) - might be too broad
          }
          ?person wdt:P31 wd:Q5 . # Q5 (human)
          OPTIONAL { ?person wdt:P18 ?image . }
          OPTIONAL { ?person wdt:P569 ?birthDate . }
          OPTIONAL { ?person wdt:P570 ?deathDate . }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
        ORDER BY DESC(?birthDate) # Order by most recently born, or some other criteria
        LIMIT 5
      `;

      const endpointUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
      console.log(`Executing SPARQL query for QID ${placeQid} (${initialSearchTerm})`);

      const sparqlResponse = await fetch(endpointUrl, {
        headers: { Accept: 'application/sparql-results+json' },
      });

      if (!sparqlResponse.ok) {
        const errorText = await sparqlResponse.text(); // Read error text
        console.warn(`SPARQL query for QID ${placeQid} failed: ${sparqlResponse.status}. Details: ${errorText}`);
        return [];
      }

      const sparqlData = await sparqlResponse.json();
      if (sparqlData.results && sparqlData.results.bindings && sparqlData.results.bindings.length > 0) {
        const people = sparqlData.results.bindings.map((binding: any) => {
          const birthYear = binding.birthDate?.value ? new Date(binding.birthDate.value).getFullYear() : null;
          const deathYear = binding.deathDate?.value ? new Date(binding.deathDate.value).getFullYear() : null;
          let description = binding.personDescription?.value || 'Notable person from this area.';
          if (birthYear) description += ` (Born ${birthYear}${deathYear ? ` - Died ${deathYear}` : ''})`;

          return {
            name: binding.personLabel?.value || 'Unknown Name',
            description: description,
            image: binding.image?.value,
            historical: !!binding.deathDate?.value || (birthYear ? birthYear < 1940 : false), // Crude historical check
          };
        });
        console.log(`Fetched ${people.length} notable people from Wikidata for ${initialSearchTerm}`);
        return people;
      } else {
        console.log("No notable people found in SPARQL results for QID:", placeQid);
        return [];
      }
    } catch (error) {
      console.error(`Error executing SPARQL query for ${initialSearchTerm} (QID ${placeQid}):`, error);
      return [];
    }
  };

  // Helper to parse m3u/m3u8 and pls playlists for radio and TV
  const parsePlaylist = async (url: string): Promise<string[]> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const text = await res.text();
      // m3u: lines that are not comments and look like URLs
      if (url.endsWith('.m3u') || url.endsWith('.m3u8')) {
        return text.split('\n').filter(line => line.trim() && !line.startsWith('#') && (line.startsWith('http') || line.startsWith('https')));
      }
      // pls: lines like File1=http://...
      if (url.endsWith('.pls')) {
        return text.split('\n').filter(line => line.trim().toLowerCase().startsWith('file')).map(line => line.split('=')[1]);
      }
      return [];
    } catch (e) {
      console.error('Failed to fetch/parse playlist:', url, e);
      return [];
    }
  };

  // --- Radio: Use direct stream, parse playlist if needed ---
  const getPlayableRadioStream = async (url: string): Promise<string | null> => {
    if (!url) return null;
    if (url.endsWith('.m3u') || url.endsWith('.pls')) {
      const urls = await parsePlaylist(url);
      // Prefer mp3/aac/ogg/hls
      const direct = urls.find(u => /\.(mp3|aac|ogg|m3u8)$/i.test(u));
      return direct || urls[0] || null;
    }
    return url;
  };

  // --- TV: Ensure fetchIPTVChannels robustly fetches and returns TV stations ---
  // (already handled in previous edit, but add extra logging)

  // --- History: Fetch Wikipedia \'History\' section ---
  const fetchWikipediaHistorySection = async (title: string): Promise<string | null> => {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=sections&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const historySection = data.parse?.sections?.find((s: any) => 
        s.line.toLowerCase().includes('history') && 
        !s.line.toLowerCase().includes('etymology') && 
        !s.line.toLowerCase().includes('prehistory') &&
        s.toclevel === 1
      );
      
      let sectionIndex = historySection?.index;

      if (!sectionIndex) {
        const generalHistorySection = data.parse?.sections?.find((s: any) => s.line.toLowerCase().includes('history'));
        sectionIndex = generalHistorySection?.index;
      }
      if (!sectionIndex) {
         console.warn(`No suitable \'History\' section found for ${title}.`);
         return null;
      }

      const contentUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&section=${sectionIndex}&prop=text&format=json&origin=*`;
      const contentRes = await fetch(contentUrl);
      if (!contentRes.ok) return null;
      const contentData = await contentRes.json();
      const html = contentData.parse?.text['*'] || '';
      
      if (typeof window === 'undefined' || !html) return null;

      const div = document.createElement('div');
      div.innerHTML = html;

      // Remove unwanted elements: scripts, styles, edit links, navboxes, infoboxes, sidebars, reflists, etc.
      div.querySelectorAll(
        `style, script, link[rel="stylesheet"], .mw-editsection, .hatnote, 
        .reflist, .reference, .rt-commented-out, .citation, .infobox, .infobox_v2, 
        .sidebar, .sistersitebox, .navbox, .metadata, .vertical-navbox, table.ambox, 
        .mw-references-wrap, .references, .noprint, .mwe-math-fallback-image-inline, 
        .thumbcaption .magnify, .IPA, .audio-description, .spoken-wikipedia-button, 
        #toc, .toc, .mw-headline-anchor, .mw-jump-link, .extiw, .plainlinks.nourlexpansion, 
        table.wikitable, div.thumb, div.gallerybox, sup.reference, span.mw-reflink-text` // More specific removals
      ).forEach(el => el.remove());

      // Clean up remaining [edit] spans if any
      div.querySelectorAll('span').forEach(span => {
        if (span.textContent?.trim().toLowerCase() === '[edit]') {
          span.remove();
        }
      });

      // Convert relative Wikipedia links to absolute and make them open in a new tab
      div.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        if (href) {
          if (href.startsWith('/wiki/')) {
            a.setAttribute('href', 'https://en.wikipedia.org' + href);
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
          } else if (href.startsWith('#cite_note-') || href.startsWith('#endnote_')) {
            // Replace internal citation links (like [1], [2]) with just their text content or remove if just a number
            const text = a.textContent?.trim();
            if (text?.match(/^\d+$/) || text?.match(/^\[\d+\]$/)) { // If it's just a number like "1" or "[1]"
              a.outerHTML = ''; // Remove the link entirely
            } else {
              a.outerHTML = text || ''; // Replace link with its text (e.g., "citation needed")
            }
          } else if (href.startsWith('http://') || href.startsWith('https://')) {
            // External links
            a.setAttribute('target', '_blank');
            a.setAttribute('rel', 'noopener noreferrer');
          }
        }
      });
      
      // Remove empty elements that might have become empty after cleaning
      div.querySelectorAll('p, div, span, li, h1, h2, h3, h4, h5, h6').forEach(el => {
        if (!el.textContent?.trim() && !el.children.length && !el.querySelector('img')) { // Keep if it has an image
          el.remove();
        }
      });
      
      let cleanedHtml = div.innerHTML.trim();

      // Remove redundant top-level "History" heading if it's the very start of the content
      const tempWrapper = document.createElement('div');
      tempWrapper.innerHTML = cleanedHtml; // Use a temporary div to parse the current cleanedHtml
      const firstMeaningfulChild = tempWrapper.firstElementChild;
      if (firstMeaningfulChild && 
         (firstMeaningfulChild.tagName === 'H1' || firstMeaningfulChild.tagName === 'H2') && 
         firstMeaningfulChild.textContent?.trim().toLowerCase() === 'history') {
        firstMeaningfulChild.remove();
        cleanedHtml = tempWrapper.innerHTML.trim();
      }
      
      return cleanedHtml || null;

    } catch (e) {
      console.error('Failed to fetch Wikipedia history section:', e);
      return null;
    }
  };

  // --- People: Improve Wikidata and Wikipedia fetching for notable people and demographics ---
  // (Keep fetchNotablePeopleData as is, but add fallback to Wikipedia 'Notable people' section if Wikidata fails)
  const fetchWikipediaNotablePeopleSection = async (title: string): Promise<Array<{ name: string; description: string; image?: string }>> => {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=sections&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const peopleSection = data.parse?.sections?.find((s: any) => s.line.toLowerCase().includes('notable people') || s.line.toLowerCase().includes('famous people'));
      if (!peopleSection) return [];
      const sectionIndex = peopleSection.index;
      const contentUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&section=${sectionIndex}&prop=text&format=json&origin=*`;
      const contentRes = await fetch(contentUrl);
      if (!contentRes.ok) return [];
      const contentData = await contentRes.json();
      const html = contentData.parse?.text['*'] || '';
      // Extract names from HTML (very basic, just get <li> items)
      const div = document.createElement('div');
      div.innerHTML = html;
      const lis = Array.from(div.querySelectorAll('li'));
      return lis.map(li => ({ name: li.textContent || '', description: '' })).filter(p => p.name);
    } catch (e) {
      console.error('Failed to fetch Wikipedia notable people section:', e);
      return [];
    }
  };

  // Update fetchIPTVChannels to handle m3u/m3u8 playlists with better country code handling
  const fetchIPTVChannels = async (countryCode: string): Promise<NonNullable<NonNullable<LocationInfo['entertainment']>['tvStations']>> => {
    if (!countryCode) {
      console.log('[IPTV] No country code provided, cannot fetch channels');
      return [];
    }
    
    // Map of common country codes to match IPTV-org's format
    const countryCodeMap: Record<string, string> = {
      'US': 'USA',
      'GB': 'UK',
      'FR': 'FRA',
      'DE': 'DEU',
      'IT': 'ITA',
      'ES': 'ESP',
      'JP': 'JPN',
      'CA': 'CAN',
      'AU': 'AUS',
      'BR': 'BRA',
      'IN': 'IND',
      'CN': 'CHN',
      'RU': 'RUS',
      'MX': 'MEX',
      'ZA': 'ZAF',
      'NG': 'NGA',
      'ET': 'ETH',
      'EG': 'EGY',
      'KE': 'KEN',
      'MA': 'MAR',
      'DZ': 'DZA',
      'TZ': 'TZA',
      'GH': 'GHA',
      'UG': 'UGA',
      'MZ': 'MOZ',
      'MG': 'MDG',
      'CM': 'CMR',
      'CI': 'CIV',
      'NE': 'NER',
      'BF': 'BFA',
      'ML': 'MLI',
      'MW': 'MWI',
      'ZM': 'ZMB',
      'SN': 'SEN',
      'TD': 'TCD',
      'SO': 'SOM',
      'ZW': 'ZWE',
      'RW': 'RWA',
      'BJ': 'BEN',
      'BI': 'BDI',
      'TN': 'TUN',
      'SS': 'SSD',
      'CF': 'CAF',
      'TG': 'TGO',
      'LY': 'LBY',
      'LR': 'LBR',
      'CG': 'COG',
      'CD': 'COD',
      'GA': 'GAB',
      'ER': 'ERI',
      'SL': 'SLE',
      'AO': 'AGO',
      'GM': 'GMB',
      'GW': 'GNB',
      'MR': 'MRT',
      'NA': 'NAM',
      'BW': 'BWA',
      'LS': 'LSO',
      'GQ': 'GNQ',
      'SC': 'SYC',
      'DJ': 'DJI',
      'KM': 'COM',
      'CV': 'CPV',
      'ST': 'STP',
      'EH': 'ESH',
    };

    // Get the mapped country code or use the original
    const mappedCountryCode = countryCodeMap[countryCode] || countryCode;
    
    try {
      const [channelsResponse, streamsResponse] = await Promise.all([
        fetch('https://iptv-org.github.io/api/channels.json'),
        fetch('https://iptv-org.github.io/api/streams.json')
      ]);
      
      if (!channelsResponse.ok || !streamsResponse.ok) {
        console.error('[IPTV] Failed to fetch IPTV data:', { 
          channelsStatus: channelsResponse.status, 
          streamsStatus: streamsResponse.status 
        });
        return [];
      }
      
      const channels = await channelsResponse.json() as IPTVChannel[];
      const streams = await streamsResponse.json() as IPTVStream[];
      
      // Create Map with explicit type parameters
      const streamMap = new globalThis.Map<string, IPTVStream>();
      streams.forEach((stream: IPTVStream) => {
        streamMap.set(stream.channel, stream);
      });
      const tvStations: NonNullable<LocationInfo['entertainment']>['tvStations'] = [];
      const seenChannels = new Set<string>();

      console.log(`[IPTV] Found ${channels.length} total channels, ${streams.length} streams`);
      
      // First pass: Try exact country code match
      for (const channel of channels) {
        if (!channel.country) continue;
        
        // Check if channel's country code matches (case insensitive)
        if (channel.country.toLowerCase() === mappedCountryCode.toLowerCase()) {
          const stream = streamMap.get(channel.id);
          if (stream?.url) {
            const channelKey = `${channel.name}_${channel.country}`.toLowerCase();
            if (!seenChannels.has(channelKey)) {
              seenChannels.add(channelKey);
              tvStations.push({
                name: channel.name,
                description: channel.name,
                genre: channel.categories?.[0] || "General",
                image: channel.logo || `https://via.placeholder.com/150?text=${encodeURIComponent(channel.name)}`,
                url: channel.website || stream.url,
                embedUrl: stream.url,
                country: channel.country,
                streamType: stream.url.endsWith('.m3u8') ? 'hls' : 'http',
              });
            }
          }
        }
      }

      // If we found channels, return them
      if (tvStations.length > 0) {
        console.log(`[IPTV] Found ${tvStations.length} channels for country code: ${mappedCountryCode}`);
        return tvStations;
      }

      // Second pass: If no channels found, try with the original country code (if different)
      if (mappedCountryCode !== countryCode) {
        for (const channel of channels) {
          if (channel.country?.toLowerCase() === countryCode.toLowerCase()) {
            const stream = streamMap.get(channel.id);
            if (stream?.url) {
              const channelKey = `${channel.name}_${channel.country}`.toLowerCase();
              if (!seenChannels.has(channelKey)) {
                seenChannels.add(channelKey);
                tvStations.push({
                  name: channel.name,
                  description: channel.name,
                  genre: channel.categories?.[0] || "General",
                  image: channel.logo || `https://via.placeholder.com/150?text=${encodeURIComponent(channel.name)}`,
                  url: channel.website || stream.url,
                  embedUrl: stream.url,
                  country: channel.country,
                  streamType: 'hls',
                });
              }
            } else if (stream?.url?.startsWith('http')) {
              const channelKey = `${channel.name}_${channel.country}`.toLowerCase();
              if (!seenChannels.has(channelKey)) {
                seenChannels.add(channelKey);
                tvStations.push({
                  name: channel.name,
                  description: channel.categories?.join(", ") || "TV Channel",
                  genre: channel.categories?.[0] || "General",
                  image: channel.logo || `https://via.placeholder.com/150?text=${encodeURIComponent(channel.name)}`,
                  url: channel.website || stream.url,
                  embedUrl: stream.url,
                  country: channel.country || "International",
                  streamType: stream.url.endsWith('.m3u8') ? 'hls' : 'http',
                });
              }
            }
          }
        }
      }
      return tvStations;
    } catch (error) {
      console.error("[IPTV] Error fetching IPTV channels:", error);
      return [];
    }
  };

  // Update YouTube video fetching to progressively render videos
  const searchYouTubeVideos = async (
    locationName: string,
    locationParts: PropertyData['locationParts'] | undefined,
    onVideoFetched?: (video: { id: string; title: string; thumbnail: string; channelTitle?: string, source?: string }) => void
  ): Promise<Array<{ id: string; title: string; thumbnail: string; channelTitle?: string, source?: string }>> => {
    const query = [
      locationParts?.specificPlace || locationName,
      locationParts?.city,
      locationParts?.country,
      'travel guide'
    ].filter(Boolean).join(' ');
    try {
      const response = await fetch(`/api/invidious-search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        console.error('[YouTube API] Error:', response.status);
        return [];
      }
      const data = await response.json();
      if (!data.videos || !Array.isArray(data.videos) || data.videos.length === 0) {
        return [];
      }
      // Progressive rendering: as each video is ready, call onVideoFetched
      const videos = data.videos.slice(0, 2).map((v: any) => ({
        id: v.videoId,
        title: v.videoData?.title || '',
        thumbnail: v.videoData?.thumbnails?.[0]?.url || '',
        channelTitle: v.videoData?.author || '',
        source: 'youtube',
      }));
      if (onVideoFetched) {
        for (const video of videos) {
          onVideoFetched(video);
          // Optionally, add a small delay to allow UI to update (not required, but can help UX)
          // await new Promise(res => setTimeout(res, 50));
        }
      }
      return videos;
    } catch (error) {
      console.error('[YouTube API] Error fetching videos:', error);
      return [];
    }
  };

  // Invidious fallback function
  async function searchInvidiousVideos(query: string) {
    // Use local API route to avoid CORS
    const localApiUrl = `/api/invidious-search?q=${encodeURIComponent(query)}`;
    try {
      const response = await fetch(localApiUrl);
      if (!response.ok) {
        console.error('[Invidious] API error:', response.status);
        return [];
      }
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        console.warn('[Invidious] No videos found for query:', query);
        return [];
      }
      // Map Invidious results to the same format
      return data.filter((v: any) => v.type === 'video').slice(0, 4).map((v: any) => ({
        id: v.videoId,
        title: v.title,
        thumbnail: v.videoThumbnails?.[0]?.url || '',
        channelTitle: v.author,
        source: 'invidious',
      }));
    } catch (e) {
      console.error('[Invidious] Error fetching videos:', e);
      return [];
    }
  }

  // Function to fetch radio stations using Radio Browser API
  // Uses owner.country (ISO 3166-1 alpha-2) as the country code
  const fetchRadioBrowserStations = async (countryCode?: string, stateOrRegion?: string): Promise<RadioStation[]> => {
    try {
      let url = '';
      const requestLimit = 30;
      let stationsFromApi: any[] = [];
      let tried = [];
      // Only try by country code (and optionally state)
      if (countryCode) {
        url = `https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/${countryCode}?limit=${requestLimit}&order=clickcount&reverse=true&hidebroken=true`;
        if (stateOrRegion) {
          url += `&state=${encodeURIComponent(stateOrRegion)}`;
        }
        const response = await fetch(url);
        tried.push(url);
        if (response.ok) {
          stationsFromApi = await response.json();
        }
      }
      if (!Array.isArray(stationsFromApi)) {
        console.error('[RadioBrowser] API response is not an array:', stationsFromApi, 'Tried:', tried);
        return [];
      }
      const allFetchedStations: RadioStation[] = stationsFromApi
        .filter((s: any) => s.url_resolved && s.name && s.name.trim() !== "" && ["MP3", "AAC", "OGG"].includes((s.codec || '').toUpperCase()))
        .map((s: any) => ({
          id: s.stationuuid,
          name: s.name.trim(),
          url: s.homepage || s.url_resolved,
          streamUrl: s.url_resolved,
          description: s.tags || '',
          genre: s.tags?.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag)[0] || '',
          image: s.favicon || undefined,
          country: s.countrycode || countryCode || '',
          codec: s.codec || '', // Add codec to RadioStation type
        }));
      const uniqueStationsByName: RadioStation[] = [];
      const seenNames = new Set<string>();
      for (const station of allFetchedStations) {
        if (!seenNames.has(station.name.toLowerCase())) {
          seenNames.add(station.name.toLowerCase());
          uniqueStationsByName.push(station);
        }
      }
      if (uniqueStationsByName.length === 0) {
        console.warn('[RadioBrowser] No stations found for', countryCode, stateOrRegion, 'Tried:', tried);
      }
      return uniqueStationsByName.slice(0, 8);
    } catch (e) {
      console.error('Error fetching from Radio-Browser API:', e);
      return [];
    }
  };

  // Additional location data fetching
  const fetchAdditionalLocationData = async (locationName: string, coordinates: { latitude: number, longitude: number }) => {
    // Define constants at the top so they're in scope for the whole function
    const MAX_LANDMARK_DISTANCE_KM = 1000000; // Increased from 10km to 10,000km to include all landmarks
    const MAX_LANDMARKS = 12;
    console.log("fetchAdditionalLocationData called with:", { locationName, coordinates });
    try {
      const weatherApiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || 'placeholder';
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${coordinates.latitude}&lon=${coordinates.longitude}&appid=${weatherApiKey}`;
      const weatherPromise = fetch(weatherUrl)
        .then(res => res.ok ? res.json() : null);

      // --- OSM Overpass API for landmarks ---
      const overpassRadius = 10000; // meters (10km)
      const overpassQuery = `
        [out:json];
        (
          node(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[tourism];
          way(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[tourism];
          relation(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[tourism];
          node(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[historic];
          way(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[historic];
          relation(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[historic];
          node(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[natural];
          way(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[natural];
          relation(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[natural];
          node(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[leisure=park];
          way(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[leisure=park];
          relation(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[leisure=park];
          node(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[amenity=place_of_worship];
          way(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[amenity=place_of_worship];
          relation(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[amenity=place_of_worship];
          node(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[building=church];
          way(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[building=church];
          relation(around:${overpassRadius},${coordinates.longitude},${coordinates.latitude})[building=church];
        );
        out center 20;
      `;
      const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
      console.log('[KYL] Overpass API URL:', overpassUrl);
      let overpassData = null;
      try {
        const overpassRes = await fetch(overpassUrl);
        if (!overpassRes.ok) {
          console.error('[KYL] Overpass API fetch failed:', overpassRes.status, overpassRes.statusText);
        } else {
          overpassData = await overpassRes.json();
          console.log('[KYL] Overpass API response:', overpassData);
        }
      } catch (err) {
        console.error('[KYL] Overpass API fetch error:', err);
      }

      // Wikipedia GeoSearch fallback
      const geoNamesUsername = process.env.NEXT_PUBLIC_GEONAMES_USERNAME || 'demo';
      const wikiGeoUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${coordinates.latitude}|${coordinates.longitude}&gsradius=5000&gslimit=10&format=json&origin=*`;
      const wikiGeoPromise = fetch(wikiGeoUrl).then(res => res.ok ? res.json() : null);

      const [weatherData, wikiGeoData] = await Promise.all([weatherPromise, wikiGeoPromise]);

      // --- Parse OSM landmarks ---
      console.log('[KYL] Parsing Overpass data:', overpassData);
      let osmLandmarks: any[] = [];
      if (overpassData && Array.isArray(overpassData.elements) && overpassData.elements.length > 0) {
        osmLandmarks = overpassData.elements
          .map((el: any) => {
            try {
              // For nodes, use lat/lon; for ways/relations, use center
              const lat = el.lat || el.center?.lat;
              const lon = el.lon || el.center?.lon;
              if (lat === undefined || lon === undefined) {
                console.log('[KYL] Skipping element with missing coordinates:', el);
                return null;
              }
              
              // Calculate distance
              let dist = 0;
              try {
                dist = getDistanceFromLatLonInKm(coordinates.latitude, coordinates.longitude, lat, lon);
              } catch (e) {
                console.error('[KYL] Error calculating distance:', e);
                // Don't filter out if distance calculation fails
                dist = 0;
              }
              
              const name = el.tags?.name || el.tags?.['name:en'] || el.tags?.tourism || 
                         el.tags?.historic || el.tags?.natural || el.tags?.amenity || 
                         el.tags?.building || 'Unnamed Landmark';
                          
              const description = [];
              if (el.tags?.description) description.push(el.tags.description);
              if (el.tags?.tourism) description.push(`Tourism: ${el.tags.tourism}`);
              if (el.tags?.historic) description.push(`Historic: ${el.tags.historic}`);
              if (el.tags?.natural) description.push(`Natural: ${el.tags.natural}`);
              if (el.tags?.amenity) description.push(`Amenity: ${el.tags.amenity}`);
              if (el.tags?.building) description.push(`Building: ${el.tags.building}`);
              
              // Map OSM tags to more user-friendly display names
              const getLandmarkType = (tags: any): { displayType: string; rawType: string } => {
                if (!tags) {
                  return { displayType: 'Point of Interest', rawType: 'landmark' };
                }
                
                // Check each tag category in order of priority
                if (tags.tourism) {
                  const typeMap: Record<string, string> = {
                    'viewpoint': 'Viewpoint',
                    'attraction': 'Attraction',
                    'hotel': 'Hotel',
                    'museum': 'Museum',
                    'information': 'Information',
                    'gallery': 'Art Gallery'
                    // Add more mappings as needed
                  };
                  const rawType = tags.tourism;
                  const displayType = typeMap[rawType] || 
                    rawType.charAt(0).toUpperCase() + rawType.slice(1);
                  return { displayType, rawType };
                }
                
                if (tags.historic) return { displayType: 'Historic Site', rawType: 'historic' };
                if (tags.natural) return { displayType: 'Natural Feature', rawType: 'natural' };
                if (tags.amenity) return { displayType: 'Amenity', rawType: 'amenity' };
                if (tags.building) return { displayType: 'Building', rawType: 'building' };
                
                return { displayType: 'Point of Interest', rawType: 'landmark' };
              };
              
              // Get the type information
              const { displayType, rawType } = getLandmarkType(el.tags || {});
                               
              return {
                name: name.trim(),
                type: displayType,
                description: description.join(' • '),
                coordinates: { latitude: lat, longitude: lon },
                dist, // Keep distance for sorting
                rawType // Keep original type for reference
              };
            } catch (e) {
              console.error('[KYL] Error processing landmark:', e, el);
              return null;
            }
          })
          .filter((lm: any) => {
            const hasRequiredFields = lm && lm.name && lm.coordinates;
            if (!hasRequiredFields) {
              console.log('[KYL] Filtering out invalid landmark (missing required fields):', lm);
              return false;
            }
            
            // Only log if we're filtering due to distance
            if (lm.dist !== undefined && lm.dist > MAX_LANDMARK_DISTANCE_KM) {
              console.log(`[KYL] Landmark '${lm.name}' is ${lm.dist.toFixed(1)}km away (max: ${MAX_LANDMARK_DISTANCE_KM}km)`);
              return false;
            }
            
            return true;
          })
          .sort((a: any, b: any) => (a.dist || 0) - (b.dist || 0))
          .slice(0, MAX_LANDMARKS);
        console.log('[KYL] Parsed landmarks:', osmLandmarks);
      }
      // --- Parse Wikipedia GeoSearch landmarks ---
      let wikiLandmarks: any[] = [];
      if (wikiGeoData?.query?.geosearch && wikiGeoData.query.geosearch.length > 0) {
        wikiLandmarks = wikiGeoData.query.geosearch
          .map((poi: any) => {
            const dist = getDistanceFromLatLonInKm(coordinates.latitude, coordinates.longitude, poi.lat, poi.lon);
            return {
              name: poi.title || 'Unnamed Landmark',
              distance: `${Math.round(dist * 10) / 10} km`,
              description: '',
              coordinates: { latitude: poi.lat, longitude: poi.lon },
              dist
            };
          })
          .filter((lm: any) => lm.name && lm.coordinates && lm.dist <= MAX_LANDMARK_DISTANCE_KM)
          .sort((a: any, b: any) => a.dist - b.dist)
          .slice(0, MAX_LANDMARKS);
      }
      // --- Combine, deduplicate, sort, and limit ---
      const combinedLandmarks = [...osmLandmarks, ...wikiLandmarks]
        .filter((lm, idx, arr) =>
          arr.findIndex(other =>
            other.name === lm.name &&
            other.coordinates.latitude === lm.coordinates.latitude &&
            other.coordinates.longitude === lm.coordinates.longitude
          ) === idx
        )
        .sort((a, b) => a.dist - b.dist)
        .slice(0, MAX_LANDMARKS);

      // After parsing and combining landmarks, set them in locationInfo immediately
      console.log('[KYL] Setting landmarks:', combinedLandmarks);
      setLocationInfo(prev => {
        const updatedInfo = prev ? { ...prev } : {};
        if (combinedLandmarks.length > 0) {
          console.log('[KYL] Setting landmarks in locationInfo');
          return {
            ...updatedInfo,
            landmarks: combinedLandmarks
          };
        } else {
          console.log('[KYL] No landmarks found, setting empty array');
          return {
            ...updatedInfo,
            landmarks: []
          };
        }
      });
      // Then continue with weather and other updates as needed
      if (weatherData) {
        const weather = weatherData;
        setLocationInfo(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            climate: `The current weather is ${weather.weather?.[0]?.description || 'not available'}. Temperature is around ${Math.round((weather.main?.temp || 0) - 273.15)}°C.`
          };
        });
      }
    } catch (error) {
      console.error("Error fetching additional location data:", error);
      setLocationInfo(prev => prev ? { ...prev, climate: undefined, landmarks: [] } : prev);
    }
  };
  // Helper to calculate distance between two lat/lon points in km
  function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      0.5 - Math.cos(dLat)/2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      (1 - Math.cos(dLon))/2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  // Helper function to generate demographics text based on location
  const generateDemographics = (locationName: string, extract?: string) => {
    if (extract && extract.toLowerCase().includes("population")) {
      const demographicSection = extract.split(/\. /).find(s => 
        s.toLowerCase().includes("population") || 
        s.toLowerCase().includes("demographic") ||
        s.toLowerCase().includes("ethnic")
      );
      if (demographicSection) {
        return demographicSection + ".";
      }
    }
    return `${locationName} has a diverse population with a mix of different cultural backgrounds. The local communities maintain their unique traditions while adapting to modern lifestyles. Family structures tend to be close-knit, with strong community bonds.`;
  };
  
  // Helper function to generate indigenous groups based on location
  const generateIndigenousGroups = (coordinates?: { latitude?: number, longitude?: number }) => {
    if (!coordinates?.latitude || !coordinates?.longitude) return [];
    const continent = getContinent(coordinates.latitude, coordinates.longitude);
    const indigenousGroups: Array<{name: string, description: string, image?: string}> = [];
    switch (continent) {
      case "Africa":
        if (coordinates.latitude < 0 && coordinates.longitude > 15) {
          indigenousGroups.push({
            name: "San People",
            description: "The San are among the oldest indigenous peoples of Southern Africa. Known for their deep understanding of the land, tracking skills, and rich cultural traditions including rock art that dates back thousands of years.",
            image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Ju%27hoan_men_after_successful_hunt.jpg/640px-Ju%27hoan_men_after_successful_hunt.jpg"
          });
        }
        if (coordinates.latitude < 5 && coordinates.latitude > -10 && coordinates.longitude > 10 && coordinates.longitude < 45) {
          indigenousGroups.push({
            name: "Maasai",
            description: "The Maasai are a Nilotic ethnic group inhabiting parts of East Africa. They have maintained many of their traditional practices and are known for their distinctive customs, dress, and connection to their cattle.",
            image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Maasai_tribe.jpg/640px-Maasai_tribe.jpg"
          });
        }
        break;
      case "North America":
        if (coordinates.latitude > 30 && coordinates.longitude < -90) {
          indigenousGroups.push({
            name: "Cherokee",
            description: "The Cherokee are one of the indigenous peoples of the Southeastern United States. Their language is part of the Iroquoian language family, and they developed their own writing system in the 19th century.",
            image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Chief_Youngdeer_in_traditional_clothing.jpg/640px-Chief_Youngdeer_in_traditional_clothing.jpg"
          });
        }
        if (coordinates.latitude > 40 && coordinates.longitude < -100) {
          indigenousGroups.push({
            name: "Lakota",
            description: "The Lakota are a Native American tribe who form part of the Great Sioux Nation. Historically, they were known for their buffalo hunting and warrior culture on the Great Plains.",
            image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Chief-red-cloud.jpg/640px-Chief-red-cloud.jpg"
          });
        }
        break;
      case "South America":
        if (coordinates.latitude < 0 && coordinates.longitude > -70) {
          indigenousGroups.push({
            name: "Yanomami",
            description: "The Yanomami are indigenous people living in the Amazon rainforest on the border between Venezuela and Brazil. They are known for their knowledge of the rainforest and sustainable relationship with it.",
            image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Yanomami_Woman_%26_Child.jpg/640px-Yanomami_Woman_%26_Child.jpg"
          });
        }
        break;
      case "Asia":
        if (coordinates.latitude > 50 && coordinates.longitude > 100) {
          indigenousGroups.push({
            name: "Ainu",
            description: "The Ainu are an indigenous people of Japan and Russia. They maintained a distinct culture, language, and religion centered around bear worship and a deep connection to nature.",
            image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Ainu_man.jpg/640px-Ainu_man.jpg"
          });
        }
        if (coordinates.latitude < 20 && coordinates.longitude > 90 && coordinates.longitude < 130) {
          indigenousGroups.push({
            name: "Hmong",
            description: "The Hmong are an ethnic group from the mountainous regions of China, Vietnam, Laos, and Thailand. They are known for their intricate needlework, textile arts, and agricultural techniques.",
            image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Hmong_girls_in_traditional_dress.jpg/640px-Hmong_girls_in_traditional_dress.jpg"
          });
        }
        break;
      case "Oceania":
        indigenousGroups.push({
          name: "Aboriginal Australians",
          description: "Aboriginal Australians have the longest continuous cultural history in the world, spanning over 65,000 years. Their complex knowledge systems include Dreamtime stories, intricate art, and sustainable land management practices.",
          image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Aboriginal_ceremonial_dancers.jpg/640px-Aboriginal_ceremonial_dancers.jpg"
        });
        break;
      case "Europe":
        if (coordinates.latitude > 60 && coordinates.longitude > 10) {
          indigenousGroups.push({
            name: "Sami",
            description: "The Sami are an indigenous people inhabiting the Arctic regions of Norway, Sweden, Finland, and Russia. They are known for their traditional reindeer herding, distinctive clothing, and joik singing tradition.",
            image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Sami_Family_1900.jpg/640px-Sami_Family_1900.jpg"
          });
        }
        break;
    }
    return indigenousGroups;
  };

  // --- Radio: Play logic --- (Updated to use global context)
  const handlePlayRadio = async (station: RadioStation) => { // Expect full station object
    // The global playStation function now handles play/pause/new station logic
    globalPlayRadioStation(station);
  };

  // State for the TV player
  const [currentStream, setCurrentStream] = useState<{
    url: string;
    type: string;
    name: string;
    error: boolean;
    loading: boolean;
  } | null>(null);

  // Function to handle TV station playing
  const handleShowTV = (embedUrl?: string) => {
    if (embedUrl) {
      setCurrentTVEmbedUrl(embedUrl);
      setShowTVModal(true);
    } else {
      toast.error('No stream available for this station.');
    }
  };

  // TV Stream Player Component
  const TVStreamPlayer = ({ url, onClose }: { url: string; onClose: () => void; }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const hlsRef = useRef<any>(null);
    const [levels, setLevels] = useState<any[]>([]);
    const [currentLevel, setCurrentLevel] = useState(-1); // -1 for auto

    const [isPlaying, setIsPlaying] = useState(true);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const showControls = () => {
      setControlsVisible(true);
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
      inactivityTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    };

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const playerElement = playerContainerRef.current;
      if(playerElement) {
        playerElement.addEventListener('mousemove', showControls);
        playerElement.addEventListener('mouseleave', () => {
          if (inactivityTimeoutRef.current) {
            clearTimeout(inactivityTimeoutRef.current);
          }
          if (isPlaying) {
            setControlsVisible(false);
          }
        });
      }

      const setupPlayer = async () => {
        setLoading(true);
        setError(null);
        setLevels([]);
        setCurrentLevel(-1);
        setIsPlaying(true);
        setCurrentTime(0);
        setDuration(0);

        if (url.endsWith('.m3u8')) {
          try {
            const Hls = (await import('hls.js')).default;
            if (Hls.isSupported()) {
              if (hlsRef.current) {
                hlsRef.current.destroy();
              }
              const hls = new Hls({
                // Ensure high quality streams can be loaded
                maxBufferSize: 0, // no limit
                maxBufferLength: 30,
          enableWorker: true,
              });
              hlsRef.current = hls;
              hls.loadSource(url);
              hls.attachMedia(video);

              hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          setLoading(false);
                setLevels(data.levels);
                video.play().catch(() => {});
              });
              hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                  setError('Failed to load the video stream.');
                  setLoading(false);
                }
              });
          } else {
              setError('HLS playback is not supported in your browser.');
              setLoading(false);
            }
          } catch {
            setError('Failed to load HLS player.');
            setLoading(false);
        }
      } else {
          video.src = url;
          video.addEventListener('loadeddata', () => setLoading(false));
          video.addEventListener('error', () => {
            setError('Failed to load the video.');
            setLoading(false);
          });
          video.play().catch(() => {});
        }
      };

      setupPlayer();
      
      const handleTimeUpdate = () => setCurrentTime(video.currentTime);
      const handleDurationChange = () => setDuration(video.duration);
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleVolumeChange = () => {
        setVolume(video.volume);
        setIsMuted(video.muted);
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('durationchange', handleDurationChange);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('volumechange', handleVolumeChange);

      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('durationchange', handleDurationChange);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('volumechange', handleVolumeChange);
        document.removeEventListener('fullscreenchange', handleFullscreenChange);

        if(playerElement) {
          playerElement.removeEventListener('mousemove', showControls);
          playerElement.removeEventListener('mouseleave', () => {
            if (inactivityTimeoutRef.current) {
              clearTimeout(inactivityTimeoutRef.current);
            }
             if (isPlaying) {
              setControlsVisible(false);
            }
          });
        }
      };
    }, [url, isPlaying]);

    const handleLevelChange = (levelIndex: number) => {
      if (hlsRef.current) {
        setCurrentLevel(levelIndex);
        hlsRef.current.currentLevel = levelIndex;
      }
    };

    const togglePlay = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        video.play();
        showControls();
      } else {
        video.pause();
        // Keep controls visible when paused
        if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
        setControlsVisible(true);
      }
      setIsPlaying(!video.paused);
    };

    const handleVolumeChangeSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) return;
      const newVolume = parseFloat(e.target.value);
      video.volume = newVolume;
      setVolume(newVolume);
      if (newVolume > 0) {
        video.muted = false;
        setIsMuted(false);
      }
    };
    
    const toggleMute = () => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = !video.muted;
      setIsMuted(video.muted);
      if (!video.muted && video.volume === 0) {
        video.volume = 1;
        setVolume(1);
      }
    };

    const seek = (offset: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime += offset;
    };

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) return;
      const newTime = parseFloat(e.target.value);
      video.currentTime = newTime;
      setCurrentTime(newTime);
    };

    const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const toggleFullscreen = () => {
      const playerElement = playerContainerRef.current;
      if (!playerElement) return;

      if (!document.fullscreenElement) {
        playerElement.requestFullscreen().then(() => {
          const orientation: any = (window.screen as any).orientation;
          if (orientation && typeof orientation.lock === 'function') {
            orientation.lock('landscape').catch(() => {});
          }
        }).catch((err) => {
          toast.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
      } else {
        document.exitFullscreen?.().then(() => {
          const orientation: any = (window.screen as any).orientation;
          if (orientation && typeof orientation.unlock === 'function') {
            orientation.unlock();
          }
        });
      }
    };

      return (
      <div ref={playerContainerRef} className="relative aspect-video bg-black rounded-md overflow-hidden group">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-earthie-mint" />
            </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 z-10 text-center p-4">
            <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-red-300">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          controls={false} // Always hide default controls
          autoPlay
          playsInline
          muted={isMuted}
          style={{ display: loading || error ? 'none' : 'block' }}
          onClick={togglePlay} // Play/pause on video click
        />
        
        {/* Custom Controls Overlay */}
        {!loading && !error && (
          <div 
            className={cn(
              "absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-2 transition-opacity duration-300",
              (controlsVisible || !isPlaying) ? "opacity-100" : "opacity-0"
            )}
          >
            {/* Scrubber */}
            <div className="w-full px-2">
               <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleProgressChange}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm"
                style={{
                  background: `linear-gradient(to right, #6EE7B7 ${((currentTime) / (duration || 1)) * 100}%, #4B5563 ${((currentTime) / (duration || 1)) * 100}%)`
                }}
              />
            </div>
            {/* Controls Row */}
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={togglePlay}>
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </Button>
                 <Button variant="ghost" size="icon" onClick={() => seek(-10)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17l-5-5 5-5"/><path d="M18 17l-5-5 5-5"/></svg>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => seek(10)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 17l5-5-5-5"/><path d="M6 17l5-5-5-5"/></svg>
                </Button>
                <div className="flex items-center gap-2">
                   <Button variant="ghost" size="icon" onClick={toggleMute}>
                    {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : volume < 0.5 ? <Volume1 className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChangeSlider}
                    className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm"
                     style={{
                      background: `linear-gradient(to right, #FFFFFF ${isMuted ? 0 : volume * 100}%, #4B5563 ${isMuted ? 0 : volume * 100}%)`
                    }}
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
                 {levels.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Settings className="h-5 w-5 text-white" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      container={playerContainerRef.current}
                      className="w-48 bg-gray-950/90 border-gray-700 text-white"
                    >
                      <div className="space-y-2">
                        <h4 className="font-medium leading-none">Quality</h4>
                        <div className="flex flex-col space-y-1">
                          <Button
                              variant="ghost"
                              className={`justify-start text-left ${currentLevel === -1 ? 'bg-earthie-mint/20 text-earthie-mint' : ''}`}
                              onClick={() => handleLevelChange(-1)}
                            >
                              Auto
                            </Button>
                          {levels.map((level, index) => (
                            <Button
                              key={index}
                              variant="ghost"
                              className={`justify-start text-left ${currentLevel === index ? 'bg-earthie-mint/20 text-earthie-mint' : ''}`}
                              onClick={() => handleLevelChange(index)}
                            >
                              {level.height}p
                            </Button>
                          ))}
            </div>
          </div>
                    </PopoverContent>
                  </Popover>
                 )}
                <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </Button>
        </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Helper function to get an indigenous group for a location
  const getIndigenousGroup = (coordinates: { latitude: number; longitude: number }) => {
    // Get the first indigenous group from our existing function
    const groups = generateIndigenousGroups(coordinates);
    return groups.length > 0 ? groups[0] : null;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId.trim()) return;
    fetchPropertyInfo(propertyId);
  };

  // Handle selecting a recent property
  const handleSelectRecent = async (property: PropertyData) => {
    setPropertyId(property.id);
    setPropertyData(property);
    latestPropertyIdRef.current = property.id;
    // If country is missing, fetch from API first
    if (!property.country) {
      try {
        const response = await fetch(`/api/e2/property/${property.id}`);
        if (response.ok) {
          const data = await response.json();
          const upgradedProperty: PropertyData = {
            ...property,
            country: data.country || undefined,
            description: data.description || data.location || property.description || "Unknown Property",
            location: data.location || property.location || "Unknown Location",
            coordinates: property.coordinates,
            locationParts: property.locationParts,
            owner: data.owner ? { country: data.owner.country } : property.owner,
            center: data.center // Add this line to ensure center is included
          };
          setPropertyData(upgradedProperty);
          saveToRecent(upgradedProperty);
          if (upgradedProperty.coordinates?.latitude !== undefined && upgradedProperty.coordinates?.longitude !== undefined) {
            fetchLocationInfo(upgradedProperty.location, {
              latitude: upgradedProperty.coordinates.latitude,
              longitude: upgradedProperty.coordinates.longitude
            }, upgradedProperty.locationParts, upgradedProperty.id, upgradedProperty.country);
          } else {
            fetchPropertyInfo(upgradedProperty.id);
          }
          return;
        }
      } catch {}
    }
    if (property.coordinates?.latitude !== undefined && property.coordinates?.longitude !== undefined) {
      fetchLocationInfo(property.location, {
        latitude: property.coordinates.latitude,
        longitude: property.coordinates.longitude
      }, property.locationParts, property.id, property.country);
    } else {
      fetchPropertyInfo(property.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl p-8 backdrop-blur-lg bg-gradient-to-br from-earthie-dark/80 to-earthie-dark-light/70 border border-earthie-mint/30 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 to-cyan-500/5 z-0"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-earthie-mint/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-sky-400/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-earthie-mint to-sky-300 inline-block text-transparent bg-clip-text mb-4">
            Know Your Land
          </h1>
          <p className="text-lg text-cyan-200/90 max-w-3xl mx-auto">
            Discover the history, geography, and fascinating facts about your Earth2 property's real-world location
          </p>
        </div>
      </div>

      {/* Property Search Section */}
      <Card className="backdrop-blur-md bg-gradient-to-br from-gray-900/70 to-gray-800/60 border border-sky-400/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-earthie-mint" />
            Search Property
          </CardTitle>
          <CardDescription>
            Enter an Earth2 property ID to discover information about its real-world location
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[250px]">
              <Input
                placeholder="Enter Property ID"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-400"
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoadingProperty || !propertyId.trim()}
              className="bg-earthie-mint hover:bg-earthie-mint/80 text-gray-900 font-medium"
            >
              {isLoadingProperty ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                </>
              ) : (
                'Explore'
              )}
            </Button>
          </form>

          {/* Recent Properties */}
          {recentProperties.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Recently Viewed Properties</h3>
              <div className="flex flex-wrap gap-2">
                {recentProperties.map((prop) => (
                  <Button
                    key={prop.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectRecent(prop)}
                    className="bg-gray-800/70 border-gray-700 hover:bg-gray-700/70 hover:border-gray-600 text-sm flex items-center gap-1"
                  >
                    <MapPin className="h-3 w-3 text-earthie-mint" />
                    {prop.description && prop.description.length > 20
                      ? `${prop.description.substring(0, 20)}...`
                      : prop.description || prop.location || "Unknown"}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive" className="backdrop-blur-md bg-red-900/20 border border-red-500/30">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Property & Location Information */}
      {propertyData && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Property Info Card */}
          <Card className="backdrop-blur-md bg-gradient-to-br from-gray-900/70 to-gray-800/60 border border-sky-400/20 shadow-lg lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-earthie-mint" />
                Property Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{propertyData.description || propertyData.location || "Unknown Property"}</h3>
                <p className="text-cyan-200/80 flex items-center gap-1 mt-1">
                  <Globe className="h-4 w-4" />
                  {propertyData.location || "Unknown Location"}
                </p>
                {propertyData.country && (
                  <Badge variant="secondary" className="mt-2 bg-earthie-mint/20 text-earthie-mint border border-earthie-mint/30">
                    {propertyData.country}
                  </Badge>
                )}
              </div>
              
              {propertyData.coordinates?.latitude !== undefined && propertyData.coordinates?.longitude !== undefined && (
                <div className="pt-2">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Coordinates</h4>
                  <div className="flex items-center justify-between text-sm bg-gray-800/50 p-2 rounded-md border border-gray-700/50">
                    <span className="text-gray-300">Latitude</span>
                    <span className="text-white font-mono">{propertyData.coordinates.latitude.toFixed(6)}°</span>
                  </div>
                  <div className="flex items-center justify-between text-sm bg-gray-800/50 p-2 mt-1 rounded-md border border-gray-700/50">
                    <span className="text-gray-300">Longitude</span>
                    <span className="text-white font-mono">{propertyData.coordinates.longitude.toFixed(6)}°</span>
                  </div>
                </div>
              )}
              
              {/* Map View Card */}
              <Card className="bg-gray-800/50 border-gray-700/50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-medium text-gray-300">Map View</h4>
                    {propertyData.coordinates && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${propertyData.coordinates.longitude},${propertyData.coordinates.latitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-earthie-mint hover:underline flex items-center gap-1"
                      >
                        Open in Google Maps
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="relative aspect-video rounded-md overflow-hidden bg-gray-700/50 border border-gray-600/50">
                    <PropertyMap 
                      coordinates={propertyData.coordinates || null} 
                      locationName={propertyData.location || 'Property location'}
                    />
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
          
          {/* Location Information */}
          <Card className="backdrop-blur-md bg-gradient-to-br from-gray-900/70 to-gray-800/60 border border-sky-400/20 shadow-lg lg:col-span-3 h-full">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-earthie-mint" />
                  Location Information
                </CardTitle>
                {isLoadingLocation && (
                  <div className="flex items-center gap-2 text-sm text-cyan-200/80">
                    <Loader2 className="h-4 w-4 animate-spin" /> 
                    Loading information...
                  </div>
                )}
              </div>
              
              {locationInfo?.title && (
                <CardDescription className="flex justify-between items-center">
                  <span>{locationInfo.title}</span>
                  {locationInfo.url && (
                    <Link 
                      href={locationInfo.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-earthie-mint hover:text-earthie-mint/80 flex items-center gap-1 text-xs"
                    >
                      <span>View on Wikipedia</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </CardDescription>
              )}
            </CardHeader>
            
            <CardContent className="space-y-4">
              {isLoadingLocation && !locationInfo ? (
                <>
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-2/3 bg-gray-800/70" />
                    <Skeleton className="h-4 w-full bg-gray-800/70" />
                    <Skeleton className="h-4 w-full bg-gray-800/70" />
                    <Skeleton className="h-4 w-4/5 bg-gray-800/70" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <Skeleton className="h-32 w-full bg-gray-800/70" />
                    <Skeleton className="h-32 w-full bg-gray-800/70" />
                  </div>
                </>
              ) : locationInfo ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="hidden md:block">
                    <TabsList className="w-full grid grid-cols-7 bg-gray-800/30 rounded-lg p-1">
                      <TabsTrigger value="overview" className="py-2 text-sm">Overview</TabsTrigger>
                      <TabsTrigger value="history" className="py-2 text-sm">History</TabsTrigger>
                      <TabsTrigger value="landmarks" className="py-2 text-sm">Landmarks</TabsTrigger>
                      <TabsTrigger value="people" className="py-2 text-sm">People</TabsTrigger>
                      <TabsTrigger value="videos" className="py-2 text-sm">Videos</TabsTrigger>
                      <TabsTrigger value="entertainment" className="py-2 text-sm">Entertainment</TabsTrigger>
                      <TabsTrigger value="facts" className="py-2 text-sm">Facts</TabsTrigger>
                    </TabsList>
                  </div>
                  <div className="md:hidden mb-4">
                    <Select onValueChange={(value) => setActiveTab(value)} defaultValue="overview">
                      <SelectTrigger className="w-full bg-gray-800/30 border-gray-600">
                        <SelectValue placeholder="Select a section" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="overview">Overview</SelectItem>
                        <SelectItem value="history">History</SelectItem>
                        <SelectItem value="landmarks">Landmarks</SelectItem>
                        <SelectItem value="people">People</SelectItem>
                        <SelectItem value="videos">Videos</SelectItem>
                        <SelectItem value="entertainment">Entertainment</SelectItem>
                        <SelectItem value="facts">Facts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Overview Tab */}
                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="pt-2">
                          {locationInfo.summary ? (
                            <div className="space-y-2">
                              <p className="text-gray-200 leading-relaxed">
                                {showMoreOverview 
                                  ? locationInfo.summary 
                                  : `${locationInfo.summary.substring(0, 250)}${locationInfo.summary.length > 250 ? '...' : ''}`}
                              </p>
                              
                              {locationInfo.summary.length > 250 && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setShowMoreOverview(!showMoreOverview)}
                                  className="text-earthie-mint border-earthie-mint/30 hover:bg-earthie-mint/10"
                                >
                                  {showMoreOverview 
                                    ? <><ChevronUp className="mr-2 h-4 w-4" /> Read Less</> 
                                    : <><ChevronDown className="mr-2 h-4 w-4" /> Read More</>}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <p className="text-gray-400">No summary information available for this location.</p>
                          )}
                        </div>
                        
                        {locationInfo.climate && (
                          <div className="pt-2">
                            <h4 className="flex items-center gap-2 text-sm font-medium text-earthie-mint mb-2">
                              <Info className="h-4 w-4" /> Climate
                            </h4>
                            <p className="text-gray-200">{locationInfo.climate}</p>
                          </div>
                        )}
                      </div>
                      
                      {locationInfo.image ? (
                        <div className="relative h-[200px] md:h-[250px] w-full overflow-hidden rounded-md border border-gray-700/50">
                          <Image 
                            src={locationInfo.image.replace(/\/\d+px-/, '/800px-')}
                            alt={locationInfo.title || "Location image"}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 50vw"
                            quality={90}
                          />
                        </div>
                      ) : (
                        <div className="h-[200px] md:h-[250px] w-full flex items-center justify-center bg-gray-800/50 rounded-md border border-gray-700/50">
                          <p className="text-sm text-gray-400 flex flex-col items-center">
                            <Camera className="h-8 w-8 mb-2 opacity-50" />
                            No image available
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  {/* History Tab */}
                  <TabsContent value="history" className="space-y-4">
                    {locationInfo.history ? (
                      <div className="pt-2">
                        <h3 className="flex items-center gap-2 text-lg font-medium text-white mb-3">
                          <Clock className="h-5 w-5 text-earthie-mint" /> Historical Background
                        </h3>
                        {/* Render preview or full HTML depending on showMoreHistory */}
                        {showMoreHistory ? (
                          <div
                            className="prose prose-sm prose-invert max-w-none text-gray-200 leading-relaxed kyl-html-content"
                            dangerouslySetInnerHTML={{ __html: cleanWikipediaCiteErrors(locationInfo.history) }}
                          />
                        ) : (
                          <div className="text-gray-200 leading-relaxed kyl-html-content">
                            {getHistoryPreview(cleanWikipediaCiteErrors(locationInfo.history))}
                          </div>
                        )}
                        {/* Button to toggle visibility */}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowMoreHistory(!showMoreHistory)}
                          className="text-earthie-mint border-earthie-mint/30 hover:bg-earthie-mint/10 mt-3"
                        >
                          {showMoreHistory 
                            ? <><ChevronUp className="mr-2 h-4 w-4" /> Show Less</> 
                            : <><ChevronDown className="mr-2 h-4 w-4" /> Read More</>}
                        </Button>
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <Book className="h-10 w-10 mx-auto text-gray-500 mb-4" />
                        <p className="text-gray-400">No historical information available for this location.</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Landmarks Tab */}
                  <TabsContent value="landmarks" className="space-y-4">
                    <h3 className="flex items-center gap-2 text-lg font-medium text-white mb-3">
                      <Landmark className="h-5 w-5 text-earthie-mint" /> Nearby Points of Interest
                    </h3>
                    
                    {isLoadingLocation ? (
                      <div className="py-10 text-center">
                        <Loader2 className="h-10 w-10 mx-auto text-earthie-mint animate-spin mb-4" />
                        <p className="text-gray-400">Loading nearby landmarks...</p>
                      </div>
                    ) : locationInfo?.landmarks && locationInfo.landmarks.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {locationInfo.landmarks.map((landmark, index) => (
                          <Card key={`${landmark.name}-${index}`} className="bg-gray-800/50 border-gray-700/50">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">{landmark.name}</CardTitle>
                              {landmark.type && (
                                <CardDescription className="flex items-center gap-1 text-xs text-gray-400">
                                  <MapPin className="h-3 w-3" /> {landmark.type}
                                </CardDescription>
                              )}
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <p className="text-sm text-gray-300">{landmark.description}</p>
                              
                              {landmark.coordinates && (
                                <div className="flex justify-end">
                                  <Link 
                                    href={`https://app.earth2.io/?lat=${landmark.coordinates.latitude}&lng=${landmark.coordinates.longitude}#`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs bg-earthie-mint hover:bg-earthie-mint/90 text-gray-900 px-2 py-1 rounded-md transition-colors"
                                  >
                                    <Globe className="h-3 w-3" /> View on Earth2
                                  </Link>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <MapPin className="h-10 w-10 mx-auto text-gray-500 mb-4" />
                        <p className="text-gray-400">No landmark information available for this location.</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* People Tab */}
                  <TabsContent value="people" className="space-y-4">
                    <h3 className="flex items-center gap-2 text-lg font-medium text-white mb-3">
                      <Users className="h-5 w-5 text-earthie-mint" /> Local Population
                    </h3>
                    
                    {locationInfo.people ? (
                      <div className="space-y-6">
                        {/* Demographics section */}
                        <div className="bg-gray-800/50 rounded-md border border-gray-700/50 p-4">
                          <h4 className="text-base font-medium text-gray-200 mb-2">Demographics</h4>
                          <p className="text-gray-300">{locationInfo.people.demographics}</p>
                        </div>
                        
                        {/* Indigenous groups section */}
                        {locationInfo.people.indigenousGroups && locationInfo.people.indigenousGroups.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-base font-medium text-gray-200 flex items-center gap-2">
                              <History className="h-4 w-4 text-earthie-mint" />
                              Indigenous & Historical Groups
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {locationInfo.people.indigenousGroups.map((group, index) => (
                                <Card key={index} className="bg-gray-800/50 border-gray-700/50">
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                      {group.name}
                                      <Badge className="bg-amber-950/30 text-amber-400 border-amber-700/50 text-xs">
                                        Indigenous
                                      </Badge>
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    {group.image && (
                                      <div className="relative h-[180px] w-full overflow-hidden rounded-md">
                                        <Image 
                                          src={group.image}
                                          alt={group.name}
                                          fill
                                          className="object-cover"
                                          sizes="(max-width: 768px) 100vw, 50vw"
                                        />
                                      </div>
                                    )}
                                    <p className="text-sm text-gray-300">{group.description}</p>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Notable people section */}
                        {locationInfo.people.notablePeople && locationInfo.people.notablePeople.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-base font-medium text-gray-200">Notable People</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {locationInfo.people.notablePeople.map((person, index) => (
                                <Card key={index} className={`bg-gray-800/50 border-gray-700/50 ${person.historical ? 'border-l-4 border-l-amber-600' : ''}`}>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                      {person.name}
                                      {person.historical && (
                                        <Badge variant="outline" className="bg-amber-950/30 text-amber-400 border-amber-700/50 text-xs">
                                          Historical
                                        </Badge>
                                      )}
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    {person.image && (
                                      <div className="relative h-[150px] w-full overflow-hidden rounded-md">
                                        <Image 
                                          src={person.image}
                                          alt={person.name}
                                          fill
                                          className="object-cover"
                                          sizes="(max-width: 768px) 100vw, 33vw"
                                        />
                                      </div>
                                    )}
                                    <p className="text-sm text-gray-300">{person.description}</p>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <Users className="h-10 w-10 mx-auto text-gray-500 mb-4" />
                        <p className="text-gray-400">No demographic information available for this location.</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Videos Tab */}
                  <TabsContent value="videos" className="space-y-4">
                    <h3 className="flex items-center gap-2 text-lg font-medium text-white mb-3">
                      <PlayCircle className="h-5 w-5 text-earthie-mint" /> Location Videos
                    </h3>
                    {isLoadingLocation && (!locationInfo?.videos || locationInfo.videos.length === 0) ? (
                      <div className="space-y-6">
                        {[1, 2].map((_, idx) => (
                          <div key={idx} className="bg-gray-800/50 rounded-md border border-gray-700/50 overflow-hidden">
                            <Skeleton className="aspect-video w-full bg-gray-800/70" />
                            <div className="p-4">
                              <Skeleton className="h-5 w-1/2 bg-gray-800/70 mb-2" />
                              <Skeleton className="h-4 w-1/3 bg-gray-800/70" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : locationInfo?.videos && locationInfo.videos.length > 0 ? (
                      <div className="space-y-6">
                        {locationInfo.videos.some(v => v.source === 'invidious') && (
                          <div className="text-xs text-yellow-400 pb-2">Results provided by Invidious (YouTube fallback, may be less accurate)</div>
                        )}
                        {locationInfo.videos.map((video, index) => (
                          <div key={index} className="bg-gray-800/50 rounded-md border border-gray-700/50 overflow-hidden">
                            <div className="aspect-video w-full">
                              <iframe
                                className="w-full h-full"
                                src={`https://www.youtube.com/embed/${video.id}`}
                                title={video.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                loading="lazy"
                              ></iframe>
                            </div>
                            <div className="p-4">
                              <h4 className="text-base font-medium text-white">{video.title}</h4>
                              {video.channelTitle && (
                                <p className="text-sm text-gray-400 mt-1">{video.channelTitle}</p>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-center pt-4">
                          <Link
                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(locationInfo.title || propertyData?.location || "travel")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
                          >
                            <span>View more on YouTube</span>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-800/50 rounded-md border border-gray-700/50 p-8 text-center">
                        <PlayCircle className="h-12 w-12 mx-auto text-gray-500 mb-4" />
                        <p className="text-gray-400 mb-6">{isLoadingLocation ? "Searching for videos about this location..." : "No videos found for this location."}</p>
                        <Link
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(locationInfo?.title || propertyData?.location || 'travel')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
                        >
                          <span>Search on YouTube</span>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Entertainment Tab */}
                  <TabsContent value="entertainment" className="space-y-6">
                    <h3 className="flex items-center gap-2 text-lg font-medium text-white mb-3">
                      <Music className="h-5 w-5 text-earthie-mint" /> Local Entertainment
                    </h3>
                    
                    {/* Radio stations section */}
                    <div className="space-y-4">
                      <h4 className="text-base font-medium text-gray-200 flex items-center gap-2">
                        <Radio className="h-4 w-4 text-earthie-mint" />
                        Radio Stations
                        <span className="text-xs text-gray-400">(powered by Radio-Browser)</span>
                      </h4>
                      
                      {locationInfo.entertainment?.radioStations && locationInfo.entertainment.radioStations.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {locationInfo.entertainment.radioStations.map((station, index) => (
                            <Card key={index} className="bg-gray-800/50 border-gray-700/50">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center justify-between">
                                  <span className="flex items-center gap-2">
                                    {station.name}
                                    {station.country && (
                                      <Badge variant="outline" className="bg-gray-800/80 text-gray-300 border-gray-600 text-xs">
                                        {station.country}
                                      </Badge>
                                    )}
                                    {station.codec && (
                                      <Badge variant="outline" className="bg-gray-700/80 text-gray-200 border-gray-600 text-xs ml-1">
                                        {station.codec.toUpperCase()}
                                      </Badge>
                                    )}
                                  </span>
                                  {station.genre && (
                                    <Badge variant="secondary" className="bg-earthie-mint/20 text-earthie-mint border border-earthie-mint/30">
                                      {station.genre}
                                    </Badge>
                                  )}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div className="flex gap-4">
                                  {station.image ? (
                                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
                                      <Image 
                                        src={station.image}
                                        alt={station.name}
                                        fill
                                        className="object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-gray-700/50 flex items-center justify-center">
                                      <Radio className="h-8 w-8 text-gray-400" />
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <p className="text-sm text-gray-300">{station.description}</p>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    {globalIsPlayingRadio && globalCurrentRadioStation?.id === station.id && (
                                      <div className="flex items-center gap-2">
                                        <div className="relative h-3 w-3">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-earthie-mint opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-3 w-3 bg-earthie-mint"></span>
                                        </div>
                                        <span className="text-xs text-earthie-mint">
                                          {globalIsRadioLoading ? 'Loading...' : 'Now Playing'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => handlePlayRadio(station)} // Ensured this is a function call
                                      disabled={globalIsRadioLoading && globalCurrentRadioStation?.id === station.id}
                                      className={cn(
                                        "flex items-center gap-1",
                                        (globalIsPlayingRadio && globalCurrentRadioStation?.id === station.id) ? 
                                          'bg-earthie-mint text-gray-900 hover:bg-earthie-mint/80' : 
                                          'text-earthie-mint border-earthie-mint/30 hover:bg-earthie-mint/10'
                                      )}
                                    >
                                      {(globalIsPlayingRadio && globalCurrentRadioStation?.id === station.id) ? (
                                        // Case: This station is the one currently active in the global player
                                        <>
                                          {(globalIsRadioLoading && globalCurrentRadioStation?.id === station.id) ? (
                                            // Subcase: It's loading
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            // Subcase: It's playing or paused (but selected) - show Stop button
                                            <>
                                              <span>Stop</span>
                                              <X className="h-3 w-3" />
                                            </>
                                          )}
                                        </>
                                      ) : (
                                        // Case: This station is NOT the one active - show Play button
                                        <>
                                          <span>Play</span>
                                          <PlayCircle className="h-3 w-3" />
                                        </>
                                      )}
                                    </Button>
                                    
                                    <Link
                                      href={station.url || "#"}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs bg-earthie-mint hover:bg-earthie-mint/90 text-gray-900 px-3 py-1 rounded-md transition-colors"
                                    >
                                      <span>Open</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </Link>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-gray-800/50 rounded-md border border-gray-700/50 p-4 text-center">
                          <Radio className="h-10 w-10 mx-auto text-gray-500 mb-4" />
                          <p className="text-gray-400">No radio stations available for this location.</p>
                        </div>
                      )}
                    </div>
                    
                    {/* TV stations section */}
                    <div className="space-y-4 mt-6">
                      <h4 className="text-base font-medium text-gray-200 flex items-center gap-2">
                        <Tv className="h-4 w-4 text-earthie-mint" />
                        TV Stations
                        <span className="text-xs text-gray-400">(powered by iptv.org)</span>
                      </h4>
                      
                      {locationInfo.entertainment?.tvStations && locationInfo.entertainment.tvStations.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {locationInfo.entertainment.tvStations.map((station, index) => (
                            <Card key={index} className="bg-gray-800/50 border-gray-700/50">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center justify-between">
                                  <span className="flex items-center gap-2">
                                    {station.name}
                                    {station.country && (
                                      <Badge variant="outline" className="bg-gray-800/80 text-gray-300 border-gray-600 text-xs">
                                        {station.country}
                                      </Badge>
                                    )}
                                  </span>
                                  {station.genre && (
                                    <Badge variant="secondary" className="bg-earthie-mint/20 text-earthie-mint border border-earthie-mint/30">
                                      {station.genre}
                                    </Badge>
                                  )}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div className="flex gap-4">
                                  {station.image && (
                                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
                                      <Image 
                                        src={station.image}
                                        alt={station.name}
                                        fill
                                        className="object-cover"
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <p className="text-sm text-gray-300">{station.description}</p>
                                  </div>
                                </div>
                                
                                {/* Show embedded player when expanded */}
                                {currentTvStation === station.name && station.embedUrl && (
                                  <div className="mt-2 w-full rounded-md overflow-hidden">
                                    {station.streamType === 'hls' || station.embedUrl.endsWith('.m3u8') ? (
                                      <div className="text-sm text-center p-2 bg-gray-800/50 rounded-md">
                                        <span>Opening stream player...</span>
                                      </div>
                                    ) : station.streamType === 'youtube' || station.streamType === 'twitch' ? (
                                      <div className="aspect-video">
                                        <iframe
                                          src={station.embedUrl}
                                          title={station.name}
                                          className="w-full h-full"
                                          allow="autoplay; encrypted-media"
                                          allowFullScreen
                                        ></iframe>
                                      </div>
                                    ) : (
                                      <div className="text-sm text-center p-2 bg-gray-800/50 rounded-md">
                                        <p>Unsupported stream type.</p>
                                        <Button variant="link" onClick={() => window.open(station.embedUrl, '_blank')}>
                                            Open in New Tab
                                          </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-end gap-2">
                                  {station.embedUrl && (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => handleShowTV(station.embedUrl)}
                                      className="text-earthie-mint border-earthie-mint/30 hover:bg-earthie-mint/10"
                                    >
                                      {station.streamType === 'hls' ? 'Open Stream' : 'Watch'}
                                    </Button>
                                  )}
                                  
                                  <Link
                                    href={station.url || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs bg-earthie-mint hover:bg-earthie-mint/90 text-gray-900 px-3 py-1 rounded-md transition-colors"
                                  >
                                    <span>Open</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-gray-800/50 rounded-md border border-gray-700/50 p-4 text-center">
                          <Tv className="h-10 w-10 mx-auto text-gray-500 mb-4" />
                          <p className="text-gray-400">No TV stations available for this location.</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  {/* Facts Tab */}
                  <TabsContent value="facts" className="space-y-4">
                    <h3 className="flex items-center gap-2 text-lg font-medium text-white mb-3">
                      <Info className="h-5 w-5 text-earthie-mint" /> Location Facts
                    </h3>
                    
                    {locationInfo.facts && Object.keys(locationInfo.facts).length > 0 ? (
                      <div className="bg-gray-800/50 rounded-md border border-gray-700/50 divide-y divide-gray-700/50">
                        {Object.entries(locationInfo.facts).map(([key, value]) => (
                          <div key={key} className="flex justify-between py-3 px-4">
                            <span className="text-gray-300">{key}</span>
                            <span className="text-gray-100 font-medium">{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <AlertCircle className="h-10 w-10 mx-auto text-gray-500 mb-4" />
                        <p className="text-gray-400">No fact information available for this location.</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="py-10 text-center">
                  <Globe className="h-10 w-10 mx-auto text-gray-500 mb-4" />
                  <p className="text-gray-400">Select a property to view location information</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Help Section */}
      <Card className="backdrop-blur-md bg-gradient-to-br from-gray-900/70 to-gray-800/60 border border-earthie-mint/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-earthie-mint" />
            About "Know Your Land"
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-300">
            "Know Your Land" helps you discover fascinating information about the real-world locations of your Earth2 properties. Simply enter a property ID to explore historical facts, geographical details, and more. This feature uses multiple data sources to provide comprehensive information about your virtual land's actual location on Earth.
          </p>
        </CardContent>
      </Card>

      {showTVModal && currentTVEmbedUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowTVModal(false)}>
          <div className="bg-gray-900 border border-earthie-mint/30 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">TV Stream</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowTVModal(false)}>
                  <X className="h-6 w-6" />
                </Button>
              </div>
              <TVStreamPlayer 
                url={currentTVEmbedUrl}
                onClose={() => setShowTVModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
