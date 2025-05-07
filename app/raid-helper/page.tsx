"use client";

import React from "react";
import { useState, useCallback, useMemo } from "react";
import { parse } from 'csv-parse/browser/esm/sync';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Loader2, AlertCircle, Upload, CheckCircle, Copy, Download, ArrowLeft, ArrowRight } from 'lucide-react';
import RaidHelperPreview from '@/components/RaidHelperPreview';
import { TargetRankingTable } from '@/components/TargetRankingTable'; // Ensure this component is updated for pagination
import { OwnerPerformanceTable } from '@/components/OwnerPerformanceTable'; // Ensure this component is updated for pagination

// --- Constants ---
const ITEMS_PER_PAGE = 5; // Changed to 5
const SCRIPT_PATH = '/scripts/raid-exporter.js';

// --- Data Structures ---
interface RaidNotificationRow {
    notification_id: string;
    event_type: 'DROID_RAID_SUCCESSFUL' | 'DROID_RAID_FAILED';
    timestamp: string; // ISO 8601 format
    ether_amount: number;
    cydroids_sent: number;
    source_property_id: string;
    source_property_desc: string;
    source_location: string;
    target_property_id: string;
    target_property_desc: string;
    target_location: string;
    target_owner_id: string;
    target_owner_username: string;
}
interface PropertySummary {
    id: string;
    description: string;
    location: string;
    totalRaidsSent: number;
    wins: number;
    losses: number;
    winRate: number;
    totalEtherGenerated: number;
    avgEtherPerRaid: number;
    avgEtherPerWin: number;
    targets: Record<string, TargetSummary>; // Key: target_property_id
    raids: RaidNotificationRow[]; // All raids sent FROM this property
}
interface TargetSummary {
    id: string;
    description: string;
    location: string;
    ownerUsername: string;
    totalRaidsReceived: number; // From the specific source property
    wins: number;
    losses: number;
    winRate: number;
    totalEtherYield: number;
    avgEtherPerRaid: number;
    avgEtherPerWin: number;
    raids: RaidNotificationRow[]; // Raids from the specific source property TO this target
    lastRaidTimestamp?: string;
}
interface OverallSummary {
    totalRaids: number;
    totalWins: number;
    totalLosses: number;
    overallWinRate: number;
    totalEtherEarned: number;
    avgEtherPerRaid: number;
    avgEtherPerWin: number;
    uniqueSourceProperties: number;
    uniqueTargetProperties: number;
    uniqueOwnersRaided: number;
    dateRange: { start?: string, end?: string };
}
interface RankedTarget {
    id: string;
    description: string;
    ownerUsername: string;
    location: string;
    totalRaids: number;
    totalWins: number;
    totalLosses: number;
    overallWinRate: number;
    totalEtherYield: number;
    avgEtherPerWin: number;
    avgEtherPerRaid: number;
    avgCydroidsSentOnWins: number;
    lastRaidTimestamp?: string;
}
interface OwnerSummary {
    ownerId: string;
    ownerUsername: string;
    totalRaidsAgainst: number;
    winsAgainst: number; // Wins from *player's* perspective
    lossesAgainst: number; // Losses from *player's* perspective
    winRateAgainst: number;
    totalEtherFromOwner: number;
    avgEtherPerWinAgainst: number;
    uniqueTargetProperties: number;
    lastRaidAgainstTimestamp?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const PIE_COLORS = ['#00C49F', '#FF8042']; // Green for Wins, Orange for Losses

export default function RaidHelperPage() {
    // --- Track if localStorage has data (for SSR-safe conditional rendering) ---
    const [hasStoredData, setHasStoredData] = useState(false);
    const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
    React.useEffect(() => {
        // Only run on client
        try {
            const stored = window.localStorage.getItem('raidHelperRaidData');
            if (stored) {
                const parsed = JSON.parse(stored);
                setHasStoredData(Array.isArray(parsed) && parsed.length > 0);
            } else {
                setHasStoredData(false);
            }
        } catch {
            setHasStoredData(false);
        }
        setHasCheckedStorage(true);
    }, []);
    // --- Expandable Target Row State for Property Detail Table ---
    const [expandedTargetIdx, setExpandedTargetIdx] = useState<number | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [raidData, setRaidData] = useState<RaidNotificationRow[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedSourcePropertyId, setSelectedSourcePropertyId] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState<string | null>(null);
    const [copyError, setCopyError] = useState<string | null>(null);

    // --- Pagination State ---
    const [sourceCurrentPage, setSourceCurrentPage] = useState(1); // Renamed for clarity
    const [targetCurrentPage, setTargetCurrentPage] = useState(1);
    const [ownerCurrentPage, setOwnerCurrentPage] = useState(1);

    // --- Search State ---
    const [sourceSearchTerm, setSourceSearchTerm] = useState("");
    const [targetSearchTerm, setTargetSearchTerm] = useState("");
    const [ownerSearchTerm, setOwnerSearchTerm] = useState("");

    // --- Handlers for File Change/Processing ---
    // Load any previously saved raid data from localStorage on mount
    React.useEffect(() => {
        const stored = typeof window !== 'undefined' && window.localStorage.getItem('raidHelperRaidData');
        if (stored) {
            try {
                const parsed: RaidNotificationRow[] = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setRaidData(parsed);
                }
            } catch {}
        }
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const uploadedFile = event.target.files[0];
            if (uploadedFile.type === 'text/csv') {
                setFile(uploadedFile);
                setError(null);
                setRaidData(null);
                setSelectedSourcePropertyId(null);
                // Reset all state on new file
                setSourceCurrentPage(1);
                setTargetCurrentPage(1);
                setOwnerCurrentPage(1);
                setSourceSearchTerm("");
                setTargetSearchTerm("");
                setOwnerSearchTerm("");
                setCopySuccess(null);
                setCopyError(null);
            } else {
                setError("Invalid file type. Please upload a CSV file.");
                setFile(null);
            }
        }
    };


    const processFile = useCallback(async () => {
        if (!file) {
            setError("Please select a file first.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setRaidData(null);
        setSelectedSourcePropertyId(null);
        // Reset state on processing start
        setSourceCurrentPage(1);
        setTargetCurrentPage(1);
        setOwnerCurrentPage(1);
        setSourceSearchTerm("");
        setTargetSearchTerm("");
        setOwnerSearchTerm("");
        try {
            const fileContent = await file.text();
            const columns = [
                'notification_id', 'event_type', 'timestamp', 'ether_amount',
                'cydroids_sent', 'source_property_id', 'source_property_desc',
                'source_location', 'target_property_id', 'target_property_desc',
                'target_location', 'target_owner_id', 'target_owner_username'
            ];
            const records: RaidNotificationRow[] = parse(fileContent, {
                columns: columns, skip_empty_lines: true, trim: true, from_line: 2,
                cast: (value, context) => {
                    if (context.column && typeof context.column === 'string') {
                        if (['ether_amount'].includes(context.column)) return parseFloat(value) || 0;
                        if (['cydroids_sent'].includes(context.column)) return parseInt(value, 10) || 0;
                        if (context.column === 'event_type' && !['DROID_RAID_SUCCESSFUL', 'DROID_RAID_FAILED'].includes(value)) throw new Error(`Invalid event_type "${value}"`);
                        if (context.column === 'timestamp') { try { parseISO(value); return value; } catch(e){ throw new Error(`Invalid timestamp format "${value}"`); } }
                    }
                    return value;
                },
            });
            // Filter out any records that are missing notification_id (invalid rows)
            const validRecords = records.filter(r => !!r.notification_id);

            // Check if we need to clear existing data
            const existingData = window.localStorage.getItem('raidHelperRaidData');
            if (existingData) {
                try {
                    const parsed = JSON.parse(existingData);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const shouldClear = window.confirm(
                            "There is existing raid data in storage. Would you like to clear it before adding the new data? " +
                            "If you choose not to clear, the new data will be merged with the existing data."
                        );
                        if (shouldClear) {
                            window.localStorage.removeItem('raidHelperRaidData');
                        }
                    }
                } catch (e) {
                    // If there's an error parsing existing data, clear it
                    window.localStorage.removeItem('raidHelperRaidData');
                }
            }

            // Try to save the data with error handling
            try {
                const dataToStore = JSON.stringify(validRecords);
                if (dataToStore.length > 4 * 1024 * 1024) { // 4MB limit
                    throw new Error("Data is too large to store in localStorage. Please process a smaller file or clear existing data first.");
                }
                window.localStorage.setItem('raidHelperRaidData', dataToStore);
                setRaidData(validRecords);
                setHasStoredData(true);
            } catch (storageError) {
                if (storageError instanceof Error && storageError.message.includes('quota')) {
                    setError("The data is too large to store. Please clear existing data first or process a smaller file.");
                } else {
                    setError("Failed to store data: " + (storageError instanceof Error ? storageError.message : String(storageError)));
                }
                return;
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : "Failed to process CSV file");
        } finally {
            setIsLoading(false);
        }
    }, [file]);

    // Add a function to clear stored data
    const clearStoredData = useCallback(() => {
        if (window.confirm("Are you sure you want to clear all stored raid data? This action cannot be undone.")) {
            window.localStorage.removeItem('raidHelperRaidData');
            setRaidData(null);
            setHasStoredData(false);
            setSelectedSourcePropertyId(null);
            setSourceCurrentPage(1);
            setTargetCurrentPage(1);
            setOwnerCurrentPage(1);
            setSourceSearchTerm("");
            setTargetSearchTerm("");
            setOwnerSearchTerm("");
        }
    }, []);

    // --- Script Copy/Download Logic ---
    const handleCopyScript = async () => {
        setCopySuccess(null);
        setCopyError(null);
        try {
            const response = await fetch(SCRIPT_PATH);
            if (!response.ok) {
                throw new Error(`Failed to fetch script: ${response.statusText}`);
            }
            const scriptText = await response.text();
            await navigator.clipboard.writeText(scriptText);
            setCopySuccess("Script copied to clipboard!");
            setTimeout(() => setCopySuccess(null), 3000); // Hide message after 3s
        } catch (err: any) {
            console.error("Failed to copy script:", err);
            setCopyError(`Error copying script: ${err.message}`);
        }
    };

    // --- Data Processing & Memoization ---

    // Overall Summary
    const overallSummary = useMemo<OverallSummary | null>(() => {
        if (!raidData) return null;
        let totalEther = 0, wins = 0, losses = 0;
        const sourceIds = new Set<string>(), targetIds = new Set<string>(), ownerIds = new Set<string>();
        let minTimestamp: string | undefined = undefined;
        let maxTimestamp: string | undefined = undefined;
        raidData.forEach(raid => {
            if (raid.event_type === 'DROID_RAID_SUCCESSFUL') { wins++; totalEther += raid.ether_amount; } else { losses++; }
            sourceIds.add(raid.source_property_id); targetIds.add(raid.target_property_id); ownerIds.add(raid.target_owner_id);
            if (!minTimestamp || new Date(raid.timestamp) < new Date(minTimestamp)) minTimestamp = raid.timestamp;
            if (!maxTimestamp || new Date(raid.timestamp) > new Date(maxTimestamp)) maxTimestamp = raid.timestamp;
        });
        const totalRaids = raidData.length;
        return { totalRaids, totalWins: wins, totalLosses: losses, overallWinRate: totalRaids > 0 ? (wins / totalRaids) * 100 : 0, totalEtherEarned: totalEther, avgEtherPerRaid: totalRaids > 0 ? totalEther / totalRaids : 0, avgEtherPerWin: wins > 0 ? totalEther / wins : 0, uniqueSourceProperties: sourceIds.size, uniqueTargetProperties: targetIds.size, uniqueOwnersRaided: ownerIds.size, dateRange: { start: minTimestamp ? format(parseISO(minTimestamp), 'yyyy-MM-dd HH:mm') : undefined, end: maxTimestamp ? format(parseISO(maxTimestamp), 'yyyy-MM-dd HH:mm') : undefined } };
    }, [raidData]);

    // Property Summaries (Base calculation)
    const propertySummaries = useMemo<Record<string, PropertySummary> | null>(() => {
        if (!raidData) return null;
        const summaries: Record<string, PropertySummary> = {};
        raidData.forEach(raid => {
            const sourceId = raid.source_property_id;
            if (!summaries[sourceId]) { summaries[sourceId] = { id: sourceId, description: raid.source_property_desc, location: raid.source_location, totalRaidsSent: 0, wins: 0, losses: 0, winRate: 0, totalEtherGenerated: 0, avgEtherPerRaid: 0, avgEtherPerWin: 0, targets: {}, raids: [] }; }
            const propSummary = summaries[sourceId];
            propSummary.totalRaidsSent++; propSummary.raids.push(raid);
            const targetId = raid.target_property_id;
            if (!propSummary.targets[targetId]) { propSummary.targets[targetId] = { id: targetId, description: raid.target_property_desc, location: raid.target_location, ownerUsername: raid.target_owner_username, totalRaidsReceived: 0, wins: 0, losses: 0, winRate: 0, totalEtherYield: 0, avgEtherPerRaid: 0, avgEtherPerWin: 0, raids: [], lastRaidTimestamp: raid.timestamp }; }
            const targetSummary = propSummary.targets[targetId];
            targetSummary.totalRaidsReceived++; targetSummary.raids.push(raid); targetSummary.lastRaidTimestamp = raid.timestamp;
            if (raid.event_type === 'DROID_RAID_SUCCESSFUL') { propSummary.wins++; propSummary.totalEtherGenerated += raid.ether_amount; targetSummary.wins++; targetSummary.totalEtherYield += raid.ether_amount; } else { propSummary.losses++; targetSummary.losses++; }
        });
        Object.values(summaries).forEach(prop => {
            prop.winRate = prop.totalRaidsSent > 0 ? (prop.wins / prop.totalRaidsSent) * 100 : 0; prop.avgEtherPerRaid = prop.totalRaidsSent > 0 ? prop.totalEtherGenerated / prop.totalRaidsSent : 0; prop.avgEtherPerWin = prop.wins > 0 ? prop.totalEtherGenerated / prop.wins : 0;
            Object.values(prop.targets).forEach(target => { target.winRate = target.totalRaidsReceived > 0 ? (target.wins / target.totalRaidsReceived) * 100 : 0; target.avgEtherPerRaid = target.totalRaidsReceived > 0 ? target.totalEtherYield / target.totalRaidsReceived : 0; target.avgEtherPerWin = target.wins > 0 ? target.totalEtherYield / target.wins : 0; target.raids.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); });
        });
        return summaries;
    }, [raidData]);

    // Sorted Source Properties (Base for filtering/pagination)
    const sortedPropertySummaries = useMemo(() => {
        if (!propertySummaries) return [];
        return Object.values(propertySummaries).sort((a, b) => b.totalEtherGenerated - a.totalEtherGenerated || a.description.localeCompare(b.description));
    }, [propertySummaries]);

    // Data for Selected Source Property (for detail view)
    const selectedPropertyData = useMemo(() => {
        if (!selectedSourcePropertyId || !propertySummaries) return null;
        return propertySummaries[selectedSourcePropertyId];
    }, [selectedSourcePropertyId, propertySummaries]);

    // Sorted Targets within Selected Source Property
    const selectedPropertyTargetsSorted = useMemo(() => {
        if (!selectedPropertyData) return [];
        return Object.values(selectedPropertyData.targets).sort((a, b) => b.totalEtherYield - a.totalEtherYield || a.description.localeCompare(b.description));
    }, [selectedPropertyData]);

    // Filtered and Paginated Source Properties
    const filteredSourceProperties = useMemo(() => {
        if (!propertySummaries) return [];
        const term = sourceSearchTerm.toLowerCase();
        const baseList = sortedPropertySummaries; // Start with the sorted list
        if (!term) return baseList;
        return baseList.filter(prop =>
            prop.description.toLowerCase().includes(term) ||
            prop.location.toLowerCase().includes(term) ||
            prop.id.toLowerCase().includes(term)
        );
    }, [propertySummaries, sortedPropertySummaries, sourceSearchTerm]);

    const sourceTotalPages = useMemo(() => {
        return Math.ceil(filteredSourceProperties.length / ITEMS_PER_PAGE);
    }, [filteredSourceProperties]);

    const paginatedSourceProperties = useMemo(() => {
        const startIndex = (sourceCurrentPage - 1) * ITEMS_PER_PAGE;
        return filteredSourceProperties.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredSourceProperties, sourceCurrentPage]);


    // Overall Ranked Targets (Base Calculation)
    const rankedTargets = useMemo<RankedTarget[] | null>(() => {
        if (!raidData || raidData.length === 0) return null;
        const targetMap: Record<string, {
            id: string;
            description: string;
            ownerUsername: string;
            location: string;
            totalRaids: number;
            totalWins: number;
            totalLosses: number;
            totalEtherYield: number;
            cydroidsSentOnWins: number; // Sum of cydroids for successful raids
            successfulRaidsCount: number; // Count of successful raids
            lastRaidTimestamp?: string;
        }> = {};

        raidData.forEach(raid => {
            const targetId = raid.target_property_id;
            if (!targetMap[targetId]) {
                targetMap[targetId] = {
                    id: targetId,
                    description: raid.target_property_desc,
                    ownerUsername: raid.target_owner_username,
                    location: raid.target_location,
                    totalRaids: 0,
                    totalWins: 0,
                    totalLosses: 0,
                    totalEtherYield: 0,
                    cydroidsSentOnWins: 0,
                    successfulRaidsCount: 0,
                    lastRaidTimestamp: raid.timestamp, // Initialize with first encountered
                };
            }

            const target = targetMap[targetId];
            target.totalRaids++;
            // Always update with the latest raid's details for mutable fields like owner/description
            target.description = raid.target_property_desc;
            target.ownerUsername = raid.target_owner_username;
            target.location = raid.target_location;

            if (new Date(raid.timestamp) > new Date(target.lastRaidTimestamp || 0)) {
                target.lastRaidTimestamp = raid.timestamp;
            }

            if (raid.event_type === 'DROID_RAID_SUCCESSFUL') {
                target.totalWins++;
                target.totalEtherYield += raid.ether_amount;
                target.cydroidsSentOnWins += raid.cydroids_sent;
                target.successfulRaidsCount++;
            } else {
                target.totalLosses++;
            }
        });

        return Object.values(targetMap).map(target => ({
            ...target,
            overallWinRate: target.totalRaids > 0 ? (target.totalWins / target.totalRaids) * 100 : 0,
            avgEtherPerWin: target.totalWins > 0 ? target.totalEtherYield / target.totalWins : 0,
            avgEtherPerRaid: target.totalRaids > 0 ? target.totalEtherYield / target.totalRaids : 0,
            avgCydroidsSentOnWins: target.successfulRaidsCount > 0 ? target.cydroidsSentOnWins / target.successfulRaidsCount : 0,
            // Ensure lastRaidTimestamp is formatted, handle undefined case for clarity
            lastRaidTimestamp: target.lastRaidTimestamp ? format(parseISO(target.lastRaidTimestamp), 'yyyy-MM-dd HH:mm') : 'N/A',
        })).sort((a, b) => b.totalEtherYield - a.totalEtherYield); // Default sort by most ether yield
    }, [raidData]);

    const filteredRankedTargets = useMemo(() => {
        if (!rankedTargets) return [];
        const term = targetSearchTerm.toLowerCase();
        if (!term) return rankedTargets; // Already sorted by default
        return rankedTargets.filter(target =>
            target.description.toLowerCase().includes(term) ||
            target.ownerUsername.toLowerCase().includes(term) ||
            target.location.toLowerCase().includes(term) ||
            target.id.toLowerCase().includes(term)
        );
    }, [rankedTargets, targetSearchTerm]);

    const targetTotalPages = useMemo(() => {
        if (!filteredRankedTargets) return 0;
        return Math.ceil(filteredRankedTargets.length / ITEMS_PER_PAGE);
    }, [filteredRankedTargets]);

    const paginatedRankedTargets = useMemo(() => {
        const startIndex = (targetCurrentPage - 1) * ITEMS_PER_PAGE;
        return filteredRankedTargets.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredRankedTargets, targetCurrentPage]);


     // Owner Performance (Base Calculation)
     const ownerSummaries = useMemo<OwnerSummary[] | null>(() => {
        if (!raidData || raidData.length === 0) return null;
        const ownerMap: Record<string, OwnerSummary & { targetPropertyIds: Set<string> }> = {};
        const sortedData = [...raidData].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        sortedData.forEach(raid => {
            const ownerId = raid.target_owner_id;
            if (!ownerMap[ownerId]) { ownerMap[ownerId] = { ownerId: ownerId, ownerUsername: raid.target_owner_username, totalRaidsAgainst: 0, winsAgainst: 0, lossesAgainst: 0, winRateAgainst: 0, totalEtherFromOwner: 0, avgEtherPerWinAgainst: 0, uniqueTargetProperties: 0, lastRaidAgainstTimestamp: raid.timestamp, targetPropertyIds: new Set<string>()}; }
            const owner = ownerMap[ownerId]; owner.totalRaidsAgainst++; owner.ownerUsername = raid.target_owner_username; owner.lastRaidAgainstTimestamp = raid.timestamp; owner.targetPropertyIds.add(raid.target_property_id);
            if (raid.event_type === 'DROID_RAID_SUCCESSFUL') { owner.winsAgainst++; owner.totalEtherFromOwner += raid.ether_amount; } else { owner.lossesAgainst++; }
        });
        const results: OwnerSummary[] = Object.values(ownerMap).map(owner => {
            owner.winRateAgainst = owner.totalRaidsAgainst > 0 ? (owner.winsAgainst / owner.totalRaidsAgainst) * 100 : 0; owner.avgEtherPerWinAgainst = owner.winsAgainst > 0 ? owner.totalEtherFromOwner / owner.winsAgainst : 0; owner.uniqueTargetProperties = owner.targetPropertyIds.size;
            const { targetPropertyIds, ...finalOwner } = owner; return finalOwner;
        });
        return results.sort((a, b) => b.totalRaidsAgainst - a.totalRaidsAgainst); // Default sort
    }, [raidData]);

    // Filtered and Paginated Owner Summaries
     const filteredOwnerSummaries = useMemo<OwnerSummary[]>(() => {
        if (!ownerSummaries) return [];
        const term = ownerSearchTerm.toLowerCase();
        if (!term) return ownerSummaries;
        return ownerSummaries.filter(owner =>
            owner.ownerUsername.toLowerCase().includes(term) ||
            owner.ownerId.toLowerCase().includes(term)
        );
    }, [ownerSummaries, ownerSearchTerm]);

    const ownerTotalPages = useMemo(() => {
        return Math.ceil(filteredOwnerSummaries.length / ITEMS_PER_PAGE);
    }, [filteredOwnerSummaries]);

    const paginatedOwnerSummaries = useMemo(() => {
        const startIndex = (ownerCurrentPage - 1) * ITEMS_PER_PAGE;
        return filteredOwnerSummaries.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredOwnerSummaries, ownerCurrentPage]);


    // --- Chart Data Preparation ---
    const raidsOverTimeData = useMemo(() => {
         if (!raidData) return [];
         const dailySummary: Record<string, { date: string, raids: number, ether: number, wins: number }> = {};
         raidData.forEach(raid => { const dateStr = format(parseISO(raid.timestamp), 'yyyy-MM-dd'); if (!dailySummary[dateStr]) { dailySummary[dateStr] = { date: dateStr, raids: 0, ether: 0, wins: 0 }; } dailySummary[dateStr].raids++; if (raid.event_type === 'DROID_RAID_SUCCESSFUL') { dailySummary[dateStr].ether += raid.ether_amount; dailySummary[dateStr].wins++; } });
         return Object.values(dailySummary).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
     }, [raidData]);

     const propertyRaidsOverTimeData = useMemo(() => {
         if (!selectedPropertyData) return [];
         const dailySummary: Record<string, { date: string, raids: number, ether: number, wins: number }> = {};
         selectedPropertyData.raids.forEach(raid => { const dateStr = format(parseISO(raid.timestamp), 'yyyy-MM-dd'); if (!dailySummary[dateStr]) { dailySummary[dateStr] = { date: dateStr, raids: 0, ether: 0, wins: 0 }; } dailySummary[dateStr].raids++; if (raid.event_type === 'DROID_RAID_SUCCESSFUL') { dailySummary[dateStr].ether += raid.ether_amount; dailySummary[dateStr].wins++; } });
         return Object.values(dailySummary).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
     }, [selectedPropertyData]);

     const overallWinLossData = useMemo(() => overallSummary ? [{ name: 'Wins', value: overallSummary.totalWins }, { name: 'Losses', value: overallSummary.totalLosses }] : [], [overallSummary]);
     const propertyWinLossData = useMemo(() => selectedPropertyData ? [{ name: 'Wins', value: selectedPropertyData.wins }, { name: 'Losses', value: selectedPropertyData.losses }] : [], [selectedPropertyData]);
     const topTargetsByEtherData = useMemo(() => {
         if (!selectedPropertyData) return [];
         return selectedPropertyTargetsSorted.slice(0, 10).map(target => ({ name: target.description.length > 15 ? target.description.substring(0, 12) + '...' : target.description, ether: parseFloat(target.totalEtherYield.toFixed(3)), id: target.id }));
     }, [selectedPropertyData, selectedPropertyTargetsSorted]);

    const etherPerCydroidData = useMemo(() => {
        if (!raidData) return [];
        const successfulRaids = raidData.filter(r => r.event_type === 'DROID_RAID_SUCCESSFUL' && r.cydroids_sent > 0);
        if (successfulRaids.length === 0) return [];
        const efficiencyMap: Record<number, { totalEther: number, count: number }> = {};
        successfulRaids.forEach(raid => {
            const efficiency = raid.ether_amount / raid.cydroids_sent;
            const bin = Math.floor(efficiency * 10);
            if (!efficiencyMap[bin]) {
                efficiencyMap[bin] = { totalEther: 0, count: 0 };
            }
            efficiencyMap[bin].count++;
            efficiencyMap[bin].totalEther += raid.ether_amount;
        });
        return Object.entries(efficiencyMap)
            .map(([binKey, data]) => ({
                name: `${(parseInt(binKey) / 10).toFixed(1)}-${((parseInt(binKey) + 1) / 10).toFixed(1)}`,
                count: data.count,
                AvgEtherInBin: data.totalEther / data.count
            }))
            .sort((a, b) => parseFloat(a.name.split('-')[0]) - parseFloat(b.name.split('-')[0]));
    }, [raidData]);

    // --- Render ---
    if (!hasCheckedStorage) {
        // Prevent SSR/client mismatch and flicker
        return null;
    }
    return (
        <>
            <div className="container mx-auto p-4 md:p-8 space-y-6">
                {/* --- Raid Helper Info & Upload Section (ALWAYS SHOW) --- */}
                {/* --- Get Script Card --- */}
                <Card className="bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Get Console Script</CardTitle>
                        <CardDescription>Run this script in your browser console while logged into Earth2 to generate the necessary CSV file.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-4 items-start">
                        <div className="flex-grow">
                            <p className="text-sm text-muted-foreground mb-2">
                                1. Log in to Earth2 (app.earth2.io).<br />
                                2. Open browser developer console (usually F12).<br />
                                3. Go to the 'Console' tab.<br />
                                4. Copy the script using the button below.<br />
                                5. Paste the script into the console and press Enter.<br />
                                6. Wait for the script to finish and download the CSV.
                            </p>
                        </div>
                        <div className="flex flex-col space-y-2 w-full sm:w-auto">
                            <Button onClick={handleCopyScript} variant="outline">
                                <Copy className="mr-2 h-4 w-4" /> Copy Script
                            </Button>
                            <Button asChild variant="outline">
                                <a href={SCRIPT_PATH} download="raid-exporter.js">
                                    <Download className="mr-2 h-4 w-4" /> Download Script
                                </a>
                            </Button>
                        </div>
                    </CardContent>
                    {(copySuccess || copyError) && (
                        <CardContent>
                            {copySuccess && <p className="text-sm text-green-500">{copySuccess}</p>}
                            {copyError && <p className="text-sm text-red-500">{copyError}</p>}
                        </CardContent>
                    )}
                </Card>
                {/* --- Upload Card --- */}
                <Card className="bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Upload Raid Data</CardTitle>
                        <CardDescription>Select the CSV file exported from the Earth2 console script.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                <Input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                    className="max-w-sm"
                                />
                                <Button
                                    onClick={processFile}
                                    disabled={!file || isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        'Process File'
                                    )}
                                </Button>
                                {hasStoredData && (
                                    <Button
                                        variant="destructive"
                                        onClick={clearStoredData}
                                    >
                                        Clear Stored Data
                                    </Button>
                                )}
                            </div>
                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </CardContent>
                </Card>
                {/* --- Loading Indicator --- */}
                {isLoading && (
                    <div className="flex justify-center items-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="ml-2">Loading and processing data...</p>
                    </div>
                )}

                {/* --- Data Display Tabs --- */}
                {/* Render only when all necessary data is calculated */}
                {raidData && overallSummary && propertySummaries && rankedTargets && ownerSummaries && (
                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-muted/70 backdrop-blur-sm">
                            <TabsTrigger value="overview">Overall</TabsTrigger>
                            <TabsTrigger value="properties">By Source</TabsTrigger>
                            <TabsTrigger value="targets">By Target</TabsTrigger>
                            <TabsTrigger value="owners">By Owner</TabsTrigger>
                            <TabsTrigger value="insights">Insights</TabsTrigger>
                        </TabsList>

                        {/* --- Overall Summary Tab --- */}
                        <TabsContent value="overview" className="mt-4">
                            <Card className="bg-card/80 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle>Overall Raid Performance</CardTitle>
                                    {overallSummary.dateRange.start && overallSummary.dateRange.end && (<CardDescription>Data from {overallSummary.dateRange.start} to {overallSummary.dateRange.end}</CardDescription>)}
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                                    <div><span className="font-semibold">Total Raids:</span> {overallSummary.totalRaids}</div>
                                    <div className="text-green-600"><span className="font-semibold">Wins:</span> {overallSummary.totalWins}</div>
                                    <div className="text-red-600"><span className="font-semibold">Losses:</span> {overallSummary.totalLosses}</div>
                                    <div><span className="font-semibold">Win Rate:</span> {overallSummary.overallWinRate.toFixed(1)}%</div>
                                    <div className="text-yellow-500"><span className="font-semibold">Total E-ther:</span> {overallSummary.totalEtherEarned.toFixed(4)}</div>
                                    <div><span className="font-semibold">Avg E/Raid:</span> {overallSummary.avgEtherPerRaid.toFixed(4)}</div>
                                    <div><span className="font-semibold">Avg E/Win:</span> {overallSummary.avgEtherPerWin.toFixed(4)}</div>
                                    <div><span className="font-semibold">Unique Sources:</span> {overallSummary.uniqueSourceProperties}</div>
                                    <div><span className="font-semibold">Unique Targets:</span> {overallSummary.uniqueTargetProperties}</div>
                                    <div><span className="font-semibold">Unique Owners:</span> {overallSummary.uniqueOwnersRaided}</div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* --- By Source Property Tab --- */}
                        <TabsContent value="properties" className="mt-4 space-y-4">
                            <div className="flex justify-end">
                                <Input type="search" placeholder="Search sources (name, loc, id)..." value={sourceSearchTerm} onChange={(e) => {setSourceSearchTerm(e.target.value); setSourceCurrentPage(1);}} className="max-w-sm bg-background/80" />
                            </div>
                            <Card className="bg-card/80 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle>Performance by Source Property</CardTitle>
                                    <CardDescription>Click a row for details. Showing {paginatedSourceProperties.length} of {filteredSourceProperties.length} properties.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[20%]">Property</TableHead>
                                                <TableHead className="text-right">Raids (W/L)</TableHead>
                                                <TableHead className="text-right">Win Rate</TableHead>
                                                <TableHead className="text-right">Total E-ther</TableHead>
                                                <TableHead className="text-right">Avg E-ther/Win</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedSourceProperties.length === 0 && (
                                                <TableRow><TableCell colSpan={5} className="text-center">No source properties found.</TableCell></TableRow>
                                            )}
                                            {paginatedSourceProperties.map((prop) => (
                                                <TableRow key={prop.id} onClick={() => setSelectedSourcePropertyId(prop.id)} className="cursor-pointer hover:bg-muted/50">
                                                    <TableCell className="font-medium">
                                                        <div>{prop.description}</div>
                                                        <div className="text-xs text-muted-foreground">{prop.location}</div>
                                                    </TableCell>
                                                    <TableCell className="text-right">{prop.wins}W/{prop.losses}L</TableCell>
                                                    <TableCell className="text-right">{prop.winRate.toFixed(1)}%</TableCell>
                                                    <TableCell className="text-right text-yellow-500">{prop.totalEtherGenerated.toFixed(4)}</TableCell>
                                                    <TableCell className="text-right">{prop.avgEtherPerWin.toFixed(4)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <div className="flex items-center justify-end space-x-2 py-4">
                                        <Button variant="outline" size="sm" onClick={() => setSourceCurrentPage(p => Math.max(1, p - 1))} disabled={sourceCurrentPage === 1}>Previous <ArrowLeft className="h-4 w-4 ml-1" /></Button>
                                        <span className="text-sm text-muted-foreground">Page {sourceCurrentPage} of {sourceTotalPages}</span>
                                        <Button variant="outline" size="sm" onClick={() => setSourceCurrentPage(p => Math.min(sourceTotalPages, p + 1))} disabled={sourceCurrentPage === sourceTotalPages}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
                                    </div>
                                </CardContent>
                            </Card>
                            {/* Selected Property Detail View (restored structure) */}
                            {selectedPropertyData && (
                                <Card className="mt-6 border-primary/50 border-2 bg-card/80 backdrop-blur-sm">
                                    <CardHeader><CardTitle>Details for: {selectedPropertyData.description}</CardTitle><CardDescription>{selectedPropertyData.location}</CardDescription></CardHeader>
                                    <CardContent>
                                        <Tabs defaultValue="targets" className="w-full">
                                            <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="targets">Targets Raided</TabsTrigger><TabsTrigger value="charts">Property Charts</TabsTrigger></TabsList>
                                            <TabsContent value="targets" className="mt-4">
                                                <h3 className="text-lg font-semibold mb-2">Targets Raided from this Property</h3>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Target Property</TableHead>
                                                            <TableHead>Owner</TableHead>
                                                            <TableHead className="text-right">Raids (W/L)</TableHead>
                                                            <TableHead className="text-right">Win Rate</TableHead>
                                                            <TableHead className="text-right">Total E-ther</TableHead>
                                                            <TableHead className="text-right">Avg E-ther/Win</TableHead>
                                                            <TableHead>Last Raid</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {selectedPropertyTargetsSorted.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={7} className="text-center">
                                                                    No targets raided from this property.
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                        {selectedPropertyTargetsSorted.map((target, idx) => (
                                                            <React.Fragment key={`${target.id}-${idx}`}>
                                                                <TableRow
                                                                    className={`cursor-pointer hover:bg-muted/50 ${expandedTargetIdx === idx ? 'bg-muted' : ''}`}
                                                                    onClick={() => setExpandedTargetIdx(expandedTargetIdx === idx ? null : idx)}
                                                                >
                                                                    <TableCell className="font-medium w-[25%]">
                                                                        <div>{target.description}</div>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            {target.location}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="w-[15%]">{target.ownerUsername}</TableCell>
                                                                    <TableCell className="text-right w-[10%]">{target.wins}W/{target.losses}L</TableCell>
                                                                    <TableCell className="text-right w-[10%]">{target.winRate.toFixed(1)}%</TableCell>
                                                                    <TableCell className="text-right text-yellow-500 w-[15%]">{target.totalEtherYield.toFixed(4)}</TableCell>
                                                                    <TableCell className="text-right w-[15%]">{target.avgEtherPerWin.toFixed(4)}</TableCell>
                                                                    <TableCell className="w-[10%] text-xs">{target.lastRaidTimestamp ? format(parseISO(target.lastRaidTimestamp), 'MM/dd HH:mm') : 'N/A'}</TableCell>
                                                                </TableRow>
                                                                {expandedTargetIdx === idx && (
                                                                    <TableRow>
                                                                        <TableCell colSpan={7} className="p-0">
                                                                            <div className="p-4 bg-muted/30 rounded-md">
                                                                                <h4 className="font-semibold mb-2 text-sm">Raid History for {target.description}:</h4>
                                                                                <Table>
                                                                                    <TableHeader>
                                                                                        <TableRow>
                                                                                            <TableHead>Timestamp</TableHead>
                                                                                            <TableHead>Result</TableHead>
                                                                                            <TableHead className="text-right">E-ther</TableHead>
                                                                                            <TableHead className="text-right">Cydroids</TableHead>
                                                                                        </TableRow>
                                                                                    </TableHeader>
                                                                                    <TableBody>
                                                                                        {target.raids.map((raid, raidIdx) => (
                                                                                            <TableRow key={raid.notification_id + '-' + raidIdx}>
                                                                                                <TableCell className="text-xs">{format(parseISO(raid.timestamp), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                                                                                                <TableCell>{raid.event_type === 'DROID_RAID_SUCCESSFUL' ? <span className="text-green-600 font-semibold flex items-center"><CheckCircle className="h-3 w-3 mr-1"/>Win</span> : <span className="text-red-600 font-semibold flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>Fail</span>}</TableCell>
                                                                                                <TableCell className="text-right text-yellow-500">{raid.ether_amount.toFixed(4)}</TableCell>
                                                                                                <TableCell className="text-right">{raid.cydroids_sent || '-'}</TableCell>
                                                                                            </TableRow>
                                                                                        ))}
                                                                                    </TableBody>
                                                                                </Table>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </React.Fragment>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TabsContent>
                                            <TabsContent value="charts" className="mt-4 space-y-4">
                                                <Card className="bg-card/80 backdrop-blur-sm">
                                                    <CardHeader>
                                                        <CardTitle className="text-base">Win/Loss Ratio</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="h-[250px]">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <PieChart>
                                                                <Pie data={propertyWinLossData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                                                    {propertyWinLossData.map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip formatter={(value) => typeof value === 'number' ? value.toFixed(5) : value}/>
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </CardContent>
                                                </Card>
                                                <Card className="bg-card/80 backdrop-blur-sm">
                                                    <CardHeader>
                                                        <CardTitle className="text-base">Top 10 Targets by E-ther Yield</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="h-[250px]">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={topTargetsByEtherData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                                <CartesianGrid strokeDasharray="3 3" />
                                                                <XAxis type="number" />
                                                                <YAxis dataKey="name" type="category" width={80} fontSize="10px" interval={0}/>
                                                                <Tooltip formatter={(value) => typeof value === 'number' ? value.toFixed(5) : value}/>
                                                                <Legend />
                                                                <Bar dataKey="ether" fill="#FFBB28" name="E-ther Yield"/>
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </CardContent>
                                                </Card>
                                                <Card className="bg-card/80 backdrop-blur-sm">
                                                    <CardHeader>
                                                        <CardTitle className="text-base">Raids & E-ther Over Time (Daily)</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="h-[300px]">
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <LineChart data={propertyRaidsOverTimeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                                                <CartesianGrid strokeDasharray="3 3" />
                                                                <XAxis dataKey="date" />
                                                                <YAxis yAxisId="left" label={{ value: 'Raids / Wins', angle: -90, position: 'insideLeft' }}/>
                                                                <YAxis yAxisId="right" orientation="right" label={{ value: 'E-ther', angle: 90, position: 'insideRight' }}/>
                                                                <Tooltip formatter={(value, name) => (typeof value === 'number' ? value.toFixed(5) : value)}/>
                                                                <Legend />
                                                                <Line yAxisId="left" type="monotone" dataKey="raids" stroke="#8884d8" name="Total Raids" dot={false}/>
                                                                <Line yAxisId="left" type="monotone" dataKey="wins" stroke="#00C49F" name="Wins" dot={false}/>
                                                                <Line yAxisId="right" type="monotone" dataKey="ether" stroke="#FFBB28" name="E-ther Earned" dot={false}/>
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    </CardContent>
                                                </Card>
                                            </TabsContent>
                                        </Tabs>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        {/* --- By Target Tab --- */}
                        <TabsContent value="targets" className="mt-4 space-y-4">
                            <div className="flex justify-end">
                                <Input type="search" placeholder="Search targets (name, owner, loc, id)..." value={targetSearchTerm} onChange={(e) => {setTargetSearchTerm(e.target.value); setTargetCurrentPage(1);}} className="max-w-sm bg-background/80"/>
                            </div>
                            <TargetRankingTable data={paginatedRankedTargets} currentPage={targetCurrentPage} totalPages={targetTotalPages} setCurrentPage={setTargetCurrentPage} totalItems={filteredRankedTargets.length}/>
                        </TabsContent>

                        {/* --- By Owner Tab --- */}
                        <TabsContent value="owners" className="mt-4 space-y-4">
                            <div className="flex justify-end">
                                <Input type="search" placeholder="Search owners (name, id)..." value={ownerSearchTerm} onChange={(e) => {setOwnerSearchTerm(e.target.value); setOwnerCurrentPage(1);}} className="max-w-sm bg-background/80"/>
                            </div>
                            <OwnerPerformanceTable data={paginatedOwnerSummaries} currentPage={ownerCurrentPage} totalPages={ownerTotalPages} setCurrentPage={setOwnerCurrentPage} totalItems={filteredOwnerSummaries.length}/>
                        </TabsContent>

                        {/* --- Insights Tab --- */}
                        <TabsContent value="insights" className="mt-4 space-y-6">
                            <h2 className="text-xl font-semibold">Raid Insights & Performance Analysis</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card className="bg-card/80 backdrop-blur-sm"><CardHeader><CardTitle className="text-base">Overall Win/Loss Ratio</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={overallWinLossData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{overallWinLossData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}</Pie><Tooltip formatter={(value) => typeof value === 'number' ? value.toFixed(5) : value}/><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
                                <Card className="bg-card/80 backdrop-blur-sm"><CardHeader><CardTitle className="text-base">Avg E-ther/Win by Source Tier</CardTitle></CardHeader><CardContent className="h-[300px]"><p className="text-center text-muted-foreground h-full flex items-center justify-center">(Chart Placeholder)</p></CardContent></Card>
                            </div>
                            <Card className="bg-card/80 backdrop-blur-sm"><CardHeader><CardTitle className="text-base">Overall Raids & E-ther Over Time (Daily)</CardTitle></CardHeader><CardContent className="h-[350px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={raidsOverTimeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis yAxisId="left" label={{ value: 'Raids / Wins', angle: -90, position: 'insideLeft' }} /><YAxis yAxisId="right" orientation="right" label={{ value: 'E-ther', angle: 90, position: 'insideRight' }}/><Tooltip formatter={(value, name) => (typeof value === 'number' ? value.toFixed(5) : value)}/><Legend /><Line yAxisId="left" type="monotone" dataKey="raids" stroke="#8884d8" name="Total Raids" dot={false}/><Line yAxisId="left" type="monotone" dataKey="wins" stroke="#00C49F" name="Wins" dot={false}/><Line yAxisId="right" type="monotone" dataKey="ether" stroke="#FFBB28" name="E-ther Earned" dot={false}/></LineChart></ResponsiveContainer></CardContent></Card>
                            <h3 className="text-lg font-semibold pt-4 border-t border-border/30">Target Characteristic Analysis</h3>
                            <Card className="bg-card/80 backdrop-blur-sm"><CardHeader><CardTitle className="text-base">Efficiency Analysis</CardTitle><CardDescription>Shows how many successful raids fall into each efficiency bucket (E-ther / Cydroids Sent).</CardDescription></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={etherPerCydroidData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" name="E-ther/Cydroid Range" fontSize={10}/><YAxis label={{ value: 'Number of Raids', angle: -90, position: 'insideLeft' }} /><Tooltip formatter={(value: number) => typeof value === 'number' ? value.toFixed(5) : value}/><Legend verticalAlign="top" /><Bar dataKey="count" fill="#00C49F" name="Raid Count"/></BarChart></ResponsiveContainer></CardContent></Card>
                        </TabsContent>
                    </Tabs>
                )}

                {/* --- Preview Component (Single instance with updated condition) --- */}
                {!file && (!raidData || raidData.length === 0) && !isLoading && !error && <RaidHelperPreview />}
            </div>
        </>
    );
}