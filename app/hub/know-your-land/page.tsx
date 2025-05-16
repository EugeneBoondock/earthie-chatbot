"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Search, Globe, History, Book, Landmark, Camera, AlertCircle, Loader2, X, ChevronDown, ChevronUp, ExternalLink, Info, Users, Radio, Tv, Music, PlayCircle } from "lucide-react";
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { cn } from "@/lib/utils";
import Image from 'next/image';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAudioPlayer } from "@/contexts/AudioContext"; // Import the global audio player hook

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
    distance?: string;
    description?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
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

export default function KnowYourLandPage() {
  const [propertyId, setPropertyId] = useState("");
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [isLoadingProperty, setIsLoadingProperty] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentProperties, setRecentProperties] = useState<PropertyData[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [showMoreHistory, setShowMoreHistory] = useState(false);
  const [showMoreOverview, setShowMoreOverview] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentTvStation, setCurrentTvStation] = useState<string | null>(null);

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
        const props = JSON.parse(storedProps);
        if (Array.isArray(props)) {
          // Ensure all properties have required fields
          const validProps = props.slice(0, 5).map(prop => ({
            ...prop,
            description: prop.description || prop.location || "Unknown Property",
            location: prop.location || "Unknown Location"
          }));
          setRecentProperties(validProps);
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
    
    // Ensure property has all required fields
    const propertyToSave = {
      ...property,
      description: property.description || property.location || "Unknown Property",
      location: property.location || "Unknown Location"
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
        locationParts
      };
      
      console.log("Processed property data:", property);
      setPropertyData(property);
      saveToRecent(property);
      
      // Now fetch location info with the coordinates
      if (property.coordinates?.latitude !== undefined && property.coordinates?.longitude !== undefined) {
        console.log("Calling fetchLocationInfo with coordinates:", property.coordinates);
        fetchLocationInfo(property.location, {
          latitude: property.coordinates.latitude,
          longitude: property.coordinates.longitude
        }, property.locationParts);
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
  const fetchLocationInfo = async (locationName: string, coordinates: { latitude?: number, longitude?: number }, locationParts?: PropertyData['locationParts']) => {
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
      // Try each query in order until we get a summary
      let foundSummary = '';
      let foundTitle = '';
      let foundImage = '';
      let foundUrl = '';
      let foundType = '';
      let foundHistoryHtml = '';
      let usedFallback = false;
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
          }
        } catch (err) {
          // Ignore and try next fallback
        }
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
      // Set the basic info we already have
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
      const countryCode = getCountryCodeFromLocation(locationName, coordinates);
      // Calculate actual functions in parallel
      const [
        notablePeoplePromise, 
        videoSearchPromise, 
        tvChannelsPromise, 
        radioStationsPromise,
        historyPromise // Added historyPromise
      ] = await Promise.allSettled([
        fetchNotablePeopleData(locationParts || { specificPlace: locationName }, coordinates),
        searchYouTubeVideos(locationName, locationParts),
        fetchIPTVChannels(countryCode),
        fetchRadioBrowserStations(countryCode, coordinates),
        Promise.resolve(finalHistoryHtml) // Use our composed history
      ]);
      setLocationInfo({
        title: foundTitle || locationName,
        summary: finalSummary || `This location is situated at ${coordsText}. While detailed information is limited, you can explore this area's unique characteristics through its geographical position and natural features.`,
        image: foundImage,
        url: foundUrl,
        facts: facts,
        history: historyPromise.status === 'fulfilled' && historyPromise.value ? historyPromise.value : undefined,
        people: {
          demographics: generateDemographics(foundTitle || locationName, finalSummary),
          notablePeople: notablePeoplePromise.status === 'fulfilled' ? notablePeoplePromise.value : [],
          indigenousGroups: generateIndigenousGroups(coordinates)
        },
        entertainment: {
          radioStations: radioStationsPromise.status === 'fulfilled' ? radioStationsPromise.value : await fetchRadioBrowserStations(countryCode, coordinates),
          tvStations: tvChannelsPromise.status === 'fulfilled' ? tvChannelsPromise.value : await fetchIPTVChannels(countryCode)
        },
        videos: videoSearchPromise.status === 'fulfilled' ? videoSearchPromise.value : []
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to fetch location information");
      setLocationInfo({
        title: locationName,
        summary: `This location is situated at ${coordsText}. While detailed information is limited, you can explore this area's unique characteristics through its geographical position and natural features.`,
        facts: {
          "Location Type": "Geographic Area",
          "Coordinates": coordsText,
          "Continent": hasValidCoords ? getContinent(coordinates.latitude!, coordinates.longitude!) : "Unknown",
          "Approximate Time Zone": hasValidCoords ? getApproxTimeZone(coordinates.longitude!) : "Unknown"
        }
      });
    } finally {
      setIsLoadingLocation(false);
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

  // Update fetchIPTVChannels to handle m3u/m3u8 playlists
  const fetchIPTVChannels = async (countryCode: string): Promise<NonNullable<NonNullable<LocationInfo['entertainment']>['tvStations']>> => {
    console.log(`[IPTV] Fetching channels for country code: "${countryCode}"`);
    try {
      const [channelsResponse, streamsResponse] = await Promise.all([
        fetch('https://iptv-org.github.io/api/channels.json'),
        fetch('https://iptv-org.github.io/api/streams.json')
      ]);
      if (!channelsResponse.ok || !streamsResponse.ok) {
        return [];
      }
      const channels = await channelsResponse.json();
      const streams = await streamsResponse.json();
      let filteredChannels = channels.filter((channel: any) => channel.country === countryCode && channel.name);
      if (filteredChannels.length === 0 && countryCode !== 'INT') {
        filteredChannels = channels.filter((channel: any) => (channel.country === undefined || channel.country === "INT") && channel.name);
      }
      if (filteredChannels.length === 0) return [];
      let tvStations: any[] = [];
      for (const channel of filteredChannels.slice(0, 6)) {
        const channelStreams = streams.filter((stream: any) => stream.channel === channel.id && stream.url);
        for (const stream of channelStreams) {
          if (stream.url.endsWith('.m3u') || stream.url.endsWith('.m3u8')) {
            // Parse playlist and add all HLS streams
            const urls = await parsePlaylist(stream.url);
            for (const hlsUrl of urls) {
              if (hlsUrl.endsWith('.m3u8')) {
                tvStations.push({
                  name: channel.name,
                  description: channel.categories?.join(", ") || "TV Channel",
                  genre: channel.categories?.[0] || "General",
                  image: channel.logo || `https://via.placeholder.com/150?text=${encodeURIComponent(channel.name)}`,
                  url: channel.website || hlsUrl,
                  embedUrl: hlsUrl,
                  country: channel.country || "International",
                  streamType: 'hls',
                });
              }
            }
          } else if (stream.url.startsWith('http')) {
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
      return tvStations;
    } catch (error) {
      console.error("[IPTV] Error fetching IPTV channels:", error);
      return [];
    }
  };

  // Update YouTube video fetching to always return 2 relevant videos
  const searchYouTubeVideos = async (
    locationName: string, 
    locationParts?: PropertyData['locationParts']
  ): Promise<Array<{ id: string; title: string; thumbnail: string; channelTitle?: string }>> => {
    console.log(`[YouTube] Initiating search for \"${locationName}\"`, "Parts:", locationParts);
    
    // --- Define types for YouTube API items ---
    interface YouTubeThumbnail {
      url: string;
      width?: number;
      height?: number;
    }

    interface YouTubeThumbnails {
      default?: YouTubeThumbnail;
      medium?: YouTubeThumbnail;
      high?: YouTubeThumbnail;
      standard?: YouTubeThumbnail;
      maxres?: YouTubeThumbnail;
    }

    interface YouTubeSearchItemSnippet {
      publishedAt?: string;
      channelId?: string;
      title: string;
      description?: string;
      thumbnails: YouTubeThumbnails;
      channelTitle?: string;
      liveBroadcastContent?: string;
    }

    interface YouTubeSearchItemId {
      kind?: string;
      videoId: string; // videoId is essential
      channelId?: string;
      playlistId?: string;
    }

    interface YouTubeSearchItem {
      kind?: string;
      etag?: string;
      id: YouTubeSearchItemId;
      snippet: YouTubeSearchItemSnippet;
    }
    
    interface ProcessedYouTubeVideo {
        id: string;
        title: string;
        thumbnail: string;
        channelTitle?: string;
        relevance: number;
    }
    // --- End of YouTube types ---

    // Build a single, more focused query
    const query = [
      locationParts?.specificPlace || locationName,
      locationParts?.city,
      locationParts?.country,
      'travel guide'
    ].filter(Boolean).join(' ');
    
    try {
      const apiUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      apiUrl.searchParams.append('part', 'snippet');
      apiUrl.searchParams.append('q', query);
      apiUrl.searchParams.append('type', 'video');
      apiUrl.searchParams.append('maxResults', '10'); // Increased from 5 to get more options
      apiUrl.searchParams.append('videoEmbeddable', 'true');
      apiUrl.searchParams.append('relevanceLanguage', 'en');
      apiUrl.searchParams.append('videoDuration', 'medium'); // Favor medium-length videos
      apiUrl.searchParams.append('order', 'relevance'); // Sort by relevance
      apiUrl.searchParams.append('key', process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || '');
      
      console.log(`[YouTube] Fetching videos for query: "${query}"`);
      const response = await fetch(apiUrl.toString());
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[YouTube] API error for query "${query}". Status: ${response.status}. Response:`, errorText);
        throw new Error(`YouTube API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.warn(`[YouTube] No videos found for query "${query}"`);
        return [];
      }
      
      // Filter and select the most relevant videos
      const videos = (data.items as YouTubeSearchItem[])
        .filter((item: YouTubeSearchItem) => item.id?.videoId)
        .map((item: YouTubeSearchItem): ProcessedYouTubeVideo => ({
          id: item.id.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
          channelTitle: item.snippet.channelTitle,
          // Add a relevance score based on title and description
          relevance: (item.snippet.title.toLowerCase().includes('travel') ? 1 : 0) + 
                     (item.snippet.title.toLowerCase().includes('guide') ? 1 : 0) + 
                     (item.snippet.title.toLowerCase().includes('tour') ? 1 : 0)
        }))
        .sort((a: ProcessedYouTubeVideo, b: ProcessedYouTubeVideo) => b.relevance - a.relevance) // Sort by relevance
        .slice(0, 2) // Take top 2 most relevant videos
        .map((video: ProcessedYouTubeVideo) => ({ // No need to re-type video here if correctly typed before
          id: video.id,
          title: video.title,
          thumbnail: video.thumbnail,
          channelTitle: video.channelTitle
        }));
      
      console.log(`[YouTube] Found ${videos.length} relevant videos for "${locationName}"`);
      return videos;
      
    } catch (error) {
      console.error(`[YouTube] Error fetching videos for query "${query}":`, error);
      return [];
    }
  };

  // Function to fetch radio stations using Radio Garden API
  const fetchRadioBrowserStations = async (countryCode?: string, coordinates?: { latitude?: number, longitude?: number }): Promise<RadioStation[]> => {
    try {
      let url = '';
      // Fetch more stations initially to have a larger pool for deduplication
      const requestLimit = 30; // Increased from implicit small limit + slice(0,8)
      if (countryCode) {
        // Note: Radio Browser API's bycountrycodeexact might not support a limit parameter directly in the path
        // It usually returns all stations for the country code. We'll fetch all and then process.
        url = `https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/${countryCode}?limit=${requestLimit}&order=clickcount&reverse=true&hidebroken=true`;
      } else if (coordinates) {
        // Fallback to top clicked stations if no country code, as geo search isn't direct
        url = `https://de1.api.radio-browser.info/json/stations/topclick/${requestLimit}?hidebroken=true`;
      } else {
        // Default fallback
        url = `https://de1.api.radio-browser.info/json/stations/topclick/${requestLimit / 2}?hidebroken=true`; // Fetch slightly fewer if no context
      }
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[RadioBrowser] API error: ${response.status} for URL: ${url}`);
        return [];
      }
      const stationsFromApi = await response.json();

      if (!Array.isArray(stationsFromApi)) {
        console.error('[RadioBrowser] API response is not an array:', stationsFromApi);
        return [];
      }

      // Filter for working streams and basic info, then map to our RadioStation type
      const allFetchedStations: RadioStation[] = stationsFromApi
        .filter((s: any) => s.url_resolved && s.name && s.name.trim() !== "" && s.codec === "MP3") // Ensure stream URL and name exist, prefer MP3
        .map((s: any) => ({
          id: s.stationuuid,
          name: s.name.trim(), // Trim whitespace from name for better deduplication
          url: s.homepage || s.url_resolved,
          streamUrl: s.url_resolved, // Use url_resolved as it's more likely to be the direct stream
          description: s.tags || '',
          genre: s.tags?.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag)[0] || '', // Clean up genre
          image: s.favicon || undefined,
          country: s.countrycode || countryCode || '',
        }));

      // Deduplicate stations by name
      const uniqueStationsByName: RadioStation[] = [];
      const seenNames = new Set<string>();
      for (const station of allFetchedStations) {
        if (!seenNames.has(station.name.toLowerCase())) { // Case-insensitive check for name
          seenNames.add(station.name.toLowerCase());
          uniqueStationsByName.push(station);
        }
      }
      
      // Return the top 8 unique stations
      return uniqueStationsByName.slice(0, 8);

    } catch (e) {
      console.error('Error fetching from Radio-Browser API:', e);
      return [];
    }
  };

  // Additional location data fetching
  const fetchAdditionalLocationData = async (locationName: string, coordinates: { latitude: number, longitude: number }) => {
    console.log("fetchAdditionalLocationData called with:", { locationName, coordinates });
    try {
      const weatherApiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || 'placeholder';
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${coordinates.latitude}&lon=${coordinates.longitude}&appid=${weatherApiKey}`;
      const weatherPromise = fetch(weatherUrl)
        .then(res => res.ok ? res.json() : null);
      const geoNamesUsername = process.env.NEXT_PUBLIC_GEONAMES_USERNAME || 'demo';
      const geoNamesUrl = `https://secure.geonames.org/findNearbyWikipediaJSON?lat=${coordinates.latitude}&lng=${coordinates.longitude}&username=${geoNamesUsername}&radius=10`;
      const geoNamesPromise = fetch(geoNamesUrl).then(res => res.ok ? res.json() : null);
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=geosearch&gscoord=${coordinates.latitude}|${coordinates.longitude}&gsradius=5000&gslimit=10&format=json&origin=*`;
      const commonsPromise = fetch(commonsUrl, {
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        mode: 'cors',
      }).then(res => res.ok ? res.json() : null);
      const [weatherData, geoNamesData] = await Promise.all([weatherPromise, geoNamesPromise]);
      setLocationInfo(prev => {
        if (!prev) return prev;
        let climate = undefined;
        let landmarks: {name: string, distance?: string, description?: string, coordinates?: {latitude: number, longitude: number}}[] = [];
        if (weatherData) {
          const weather = weatherData;
          climate = `The current weather is ${weather.weather?.[0]?.description || 'not available'}. Temperature is around ${Math.round((weather.main?.temp || 0) - 273.15)}°C.`;
        }
        if (geoNamesData?.geonames) {
          landmarks = geoNamesData.geonames.slice(0, 5).map((poi: any) => ({
            name: poi.title || 'Unnamed Landmark',
            distance: poi.distance ? `${Math.round(poi.distance * 10) / 10} km` : undefined,
            description: poi.summary || '',
            coordinates: { latitude: poi.lat, longitude: poi.lng }
          }));
        }
        return {
          ...prev,
          climate,
          landmarks
        };
      });
    } catch (error) {
      console.error("Error fetching additional location data:", error);
      setLocationInfo(prev => prev ? { ...prev, climate: undefined, landmarks: [] } : prev);
    }
  };

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

  // Function to handle TV station playing
  const handleShowTV = (stationId: string, embedUrl?: string, streamType?: string) => {
    if (currentTvStation === stationId) {
      setCurrentTvStation(null);
      return;
    }
    
    console.log("Playing TV station:", stationId, embedUrl, streamType);
    
    if (!embedUrl) {
      alert('No stream available for this station');
      return;
    }
    
    if (streamType === 'hls' && embedUrl.endsWith('.m3u8')) {
      // For HLS streams, open in a player that supports HLS
      window.open(`https://iptv-org.github.io/player/?url=${encodeURIComponent(embedUrl)}`, '_blank');
    } else if (streamType === 'youtube' || streamType === 'twitch') {
      // For YouTube or Twitch, we can embed
      setCurrentTvStation(stationId);
    } else {
      // For other types, open in new window
      window.open(embedUrl, '_blank');
    }
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
  const handleSelectRecent = (property: PropertyData) => {
    setPropertyId(property.id);
    setPropertyData(property);
    if (property.coordinates?.latitude !== undefined && property.coordinates?.longitude !== undefined) {
      fetchLocationInfo(property.location, {
        latitude: property.coordinates.latitude,
        longitude: property.coordinates.longitude
      });
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Property Info Card */}
          <Card className="backdrop-blur-md bg-gradient-to-br from-gray-900/70 to-gray-800/60 border border-sky-400/20 shadow-lg lg:col-span-1">
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
              <div className="pt-2">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Map View</h4>
                {propertyData.coordinates?.latitude && propertyData.coordinates?.longitude ? (
                  <div className="relative h-[200px] w-full overflow-hidden rounded-md border border-gray-700/50">
                    <Image 
                      src={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${propertyData.coordinates.longitude},${propertyData.coordinates.latitude},10,0/600x400@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoiZWFydGgyZ2FtZSIsImEiOiJja2t5OWQxMmgwdWNiMnVxbXN3YnM0NDV5In0.sfQHXPkZpNNrT2ancTXj_A'}`}
                      alt={`Map of ${propertyData.location}`}
                      fill
                      className="object-cover"
                      onLoad={() => setMapLoaded(true)}
                    />
                    {!mapLoaded && (
                      <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 text-earthie-mint animate-spin" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-4 h-4 rounded-full bg-earthie-mint shadow-lg shadow-earthie-mint/50 animate-pulse"></div>
                    </div>
                  </div>
                ) : (
                  <div className="h-[200px] w-full flex items-center justify-center bg-gray-800/50 rounded-md border border-gray-700/50">
                    <p className="text-sm text-gray-400">Map data not available</p>
                  </div>
                )}
              </div>
              
              {/* Property ID */}
              <div className="pt-2">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Property ID</h4>
                <div className="flex items-center justify-between text-sm bg-gray-800/50 p-2 rounded-md border border-gray-700/50 font-mono">
                  <span className="text-gray-400">{propertyData.id}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Information */}
          <Card className="backdrop-blur-md bg-gradient-to-br from-gray-900/70 to-gray-800/60 border border-sky-400/20 shadow-lg lg:col-span-2">
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
                <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-7 bg-gray-800/50">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    <TabsTrigger value="landmarks">Landmarks</TabsTrigger>
                    <TabsTrigger value="people">People</TabsTrigger>
                    <TabsTrigger value="videos">Videos</TabsTrigger>
                    <TabsTrigger value="entertainment">Entertainment</TabsTrigger>
                    <TabsTrigger value="facts">Facts</TabsTrigger>
                  </TabsList>
                  
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
                          <History className="h-5 w-5 text-earthie-mint" /> Historical Background
                        </h3>
                        {/* Render HTML if showMoreHistory is true */}
                        {showMoreHistory && (
                          <div
                            className="prose prose-sm prose-invert max-w-none text-gray-200 leading-relaxed kyl-html-content"
                            dangerouslySetInnerHTML={{ __html: locationInfo.history }}
                          />
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
                    
                    {locationInfo.landmarks && locationInfo.landmarks.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {locationInfo.landmarks.map((landmark, index) => (
                          <Card key={index} className="bg-gray-800/50 border-gray-700/50">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">{landmark.name}</CardTitle>
                              {landmark.distance && (
                                <CardDescription className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> {landmark.distance} away
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
                                      <Badge variant="outline" className="bg-amber-950/30 text-amber-400 border-amber-700/50 text-xs">
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
                    
                    {locationInfo?.videos && locationInfo.videos.length > 0 ? (
                      <div className="space-y-6">
                        {locationInfo.videos.map((video, index) => (
                          <div key={index} className="bg-gray-800/50 rounded-md border border-gray-700/50 overflow-hidden">
                            <div className="aspect-video w-full">
                              <iframe
                                className="w-full h-full"
                                src={`https://www.youtube.com/embed/${video.id}`}
                                title={video.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
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
                        <p className="text-gray-400 mb-6">Searching for videos about this location...</p>
                        
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
                        <span className="text-xs text-gray-400">(powered by Radio Garden)</span>
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
                                {currentTvStation === station.name && station.embedUrl && 
                                  (station.streamType === 'youtube' || station.streamType === 'twitch') && (
                                  <div className="mt-2 aspect-video w-full rounded-md overflow-hidden">
                                    <iframe
                                      src={station.embedUrl}
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                      className="w-full h-full"
                                    ></iframe>
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-end gap-2">
                                  {station.embedUrl && (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => handleShowTV(station.name, station.embedUrl, station.streamType)}
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
    </div>
  );
} 