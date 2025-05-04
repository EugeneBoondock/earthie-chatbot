"use client";

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
    source_tile_count: number;
    source_tier: number;
    source_class: number | string; // Class can be number or '-'
    target_property_id: string;
    target_property_desc: string;
    target_location: string;
    target_owner_id: string;
    target_owner_username: string;
    target_tile_count: number;
    target_tier: number;
    target_class: number | string; // Class can be number or '-'
}
interface PropertySummary {
    id: string;
    description: string;
    location: string;
    tileCount: number;
    tier: number;
    class: number | string;
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
    tileCount: number;
    tier: number;
    class: number | string;
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
    tier: number;
    class: number | string;
    tileCount: number;
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
                'source_location', 'source_tile_count', 'source_tier', 'source_class',
                'target_property_id', 'target_property_desc', 'target_location',
                'target_owner_id', 'target_owner_username', 'target_tile_count',
                'target_tier', 'target_class'
            ];
            const records: RaidNotificationRow[] = parse(fileContent, {
                columns: columns, skip_empty_lines: true, trim: true,
                cast: (value, context) => {
                    if (context.column && typeof context.column === 'string') {
                        if (['ether_amount'].includes(context.column)) return parseFloat(value) || 0;
                        if (['cydroids_sent', 'source_tile_count', 'source_tier', 'target_tile_count', 'target_tier'].includes(context.column)) return parseInt(value, 10) || 0;
                        if (['source_class', 'target_class'].includes(context.column)) { const num = parseInt(value, 10); return isNaN(num) ? value : num; }
                        if (context.column === 'event_type' && !['DROID_RAID_SUCCESSFUL', 'DROID_RAID_FAILED'].includes(value)) throw new Error(`Invalid event_type "${value}"`);
                        if (context.column === 'timestamp') { try { parseISO(value); return value; } catch(e){ throw new Error(`Invalid timestamp format "${value}"`); } }
                    }
                    return value;
                },
                from_line: 2
            });
            if (!records || records.length === 0) throw new Error("CSV file is empty or invalid.");
            if (!records[0]?.source_property_id || !records[0]?.target_property_id || !records[0]?.timestamp) throw new Error("CSV missing essential columns.");
            records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            setRaidData(records);
        } catch (err: any) {
            console.error("CSV Parsing Error:", err);
            setError(`Failed to process CSV: ${err.message}. Check format.`);
            setRaidData(null);
        } finally {
            setIsLoading(false);
        }
    }, [file]);

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
        let earliestTimestamp = raidData[0]?.timestamp, latestTimestamp = raidData[raidData.length - 1]?.timestamp;
        raidData.forEach(raid => {
            if (raid.event_type === 'DROID_RAID_SUCCESSFUL') { wins++; totalEther += raid.ether_amount; } else { losses++; }
            sourceIds.add(raid.source_property_id); targetIds.add(raid.target_property_id); ownerIds.add(raid.target_owner_id);
        });
        const totalRaids = raidData.length;
        return { totalRaids, totalWins: wins, totalLosses: losses, overallWinRate: totalRaids > 0 ? (wins / totalRaids) * 100 : 0, totalEtherEarned: totalEther, avgEtherPerRaid: totalRaids > 0 ? totalEther / totalRaids : 0, avgEtherPerWin: wins > 0 ? totalEther / wins : 0, uniqueSourceProperties: sourceIds.size, uniqueTargetProperties: targetIds.size, uniqueOwnersRaided: ownerIds.size, dateRange: { start: earliestTimestamp ? format(parseISO(earliestTimestamp), 'yyyy-MM-dd HH:mm') : undefined, end: latestTimestamp ? format(parseISO(latestTimestamp), 'yyyy-MM-dd HH:mm') : undefined } };
    }, [raidData]);

    // Property Summaries (Base calculation)
    const propertySummaries = useMemo<Record<string, PropertySummary> | null>(() => {
        if (!raidData) return null;
        const summaries: Record<string, PropertySummary> = {};
        raidData.forEach(raid => {
            const sourceId = raid.source_property_id;
            if (!summaries[sourceId]) { summaries[sourceId] = { id: sourceId, description: raid.source_property_desc, location: raid.source_location, tileCount: raid.source_tile_count, tier: raid.source_tier, class: raid.source_class, totalRaidsSent: 0, wins: 0, losses: 0, winRate: 0, totalEtherGenerated: 0, avgEtherPerRaid: 0, avgEtherPerWin: 0, targets: {}, raids: [] }; }
            const propSummary = summaries[sourceId];
            propSummary.totalRaidsSent++; propSummary.raids.push(raid);
            const targetId = raid.target_property_id;
            if (!propSummary.targets[targetId]) { propSummary.targets[targetId] = { id: targetId, description: raid.target_property_desc, location: raid.target_location, ownerUsername: raid.target_owner_username, tileCount: raid.target_tile_count, tier: raid.target_tier, class: raid.target_class, totalRaidsReceived: 0, wins: 0, losses: 0, winRate: 0, totalEtherYield: 0, avgEtherPerRaid: 0, avgEtherPerWin: 0, raids: [], lastRaidTimestamp: raid.timestamp }; }
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
        const targetMap: Record<string, RankedTarget & { _totalCydroidsOnWins: number }> = {};
        const sortedData = [...raidData].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        sortedData.forEach(raid => {
            const targetId = raid.target_property_id;
            if (!targetMap[targetId]) { targetMap[targetId] = { id: targetId, description: raid.target_property_desc, ownerUsername: raid.target_owner_username, location: raid.target_location, tier: raid.target_tier, class: raid.target_class, tileCount: raid.target_tile_count, totalRaids: 0, totalWins: 0, totalLosses: 0, overallWinRate: 0, totalEtherYield: 0, avgEtherPerWin: 0, avgEtherPerRaid: 0, avgCydroidsSentOnWins: 0, lastRaidTimestamp: raid.timestamp, _totalCydroidsOnWins: 0 }; }
            const target = targetMap[targetId]; target.totalRaids++; target.description = raid.target_property_desc; target.ownerUsername = raid.target_owner_username; target.location = raid.target_location; target.tier = raid.target_tier; target.class = raid.target_class; target.tileCount = raid.target_tile_count; target.lastRaidTimestamp = raid.timestamp;
            if (raid.event_type === 'DROID_RAID_SUCCESSFUL') { target.totalWins++; target.totalEtherYield += raid.ether_amount; target._totalCydroidsOnWins += raid.cydroids_sent; } else { target.totalLosses++; }
        });
        const results: RankedTarget[] = Object.values(targetMap).map(target => {
            target.overallWinRate = target.totalRaids > 0 ? (target.totalWins / target.totalRaids) * 100 : 0; target.avgEtherPerWin = target.totalWins > 0 ? target.totalEtherYield / target.totalWins : 0; target.avgEtherPerRaid = target.totalRaids > 0 ? target.totalEtherYield / target.totalRaids : 0; target.avgCydroidsSentOnWins = target.totalWins > 0 ? target._totalCydroidsOnWins / target.totalWins : 0;
            const { _totalCydroidsOnWins, ...finalTarget } = target; return finalTarget;
        });
        return results.sort((a, b) => b.totalRaids - a.totalRaids); // Default sort
    }, [raidData]);

    // Filtered and Paginated Ranked Targets
    const filteredRankedTargets = useMemo<RankedTarget[]>(() => {
        if (!rankedTargets) return [];
        const term = targetSearchTerm.toLowerCase();
        if (!term) return rankedTargets;
        return rankedTargets.filter(target =>
            target.description.toLowerCase().includes(term) ||
            target.ownerUsername.toLowerCase().includes(term) ||
            target.location.toLowerCase().includes(term) ||
            target.id.toLowerCase().includes(term)
        );
    }, [rankedTargets, targetSearchTerm]);

    const targetTotalPages = useMemo(() => {
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

    const performanceByTargetTierClass = useMemo(() => {
         if (!rankedTargets) return [];
         const tiers: Record<string, { count: number, totalEther: number, totalWins: number, totalRaids: number }> = {};
         rankedTargets.forEach(target => {
             const key = `T${target.tier} C${target.class}`;
             if (!tiers[key]) { tiers[key] = { count: 0, totalEther: 0, totalWins: 0, totalRaids: 0 }; }
             tiers[key].count++; tiers[key].totalEther += target.totalEtherYield; tiers[key].totalWins += target.totalWins; tiers[key].totalRaids += target.totalRaids;
         });
         return Object.entries(tiers).map(([key, value]) => ({ name: key, AvgEtherPerWin: value.totalWins > 0 ? value.totalEther / value.totalWins : 0, AvgWinRate: value.totalRaids > 0 ? (value.totalWins / value.totalRaids) * 100 : 0, TotalEther: value.totalEther, TotalRaids: value.totalRaids}))
             .sort((a, b) => { const [tierA, classA] = a.name.match(/T(\d+) C(.+)/)?.slice(1) || ['0','0']; const [tierB, classB] = b.name.match(/T(\d+) C(.+)/)?.slice(1) || ['0','0']; if (tierA !== tierB) return parseInt(tierA) - parseInt(tierB); const classValA = classA === '-' ? 0 : parseInt(classA); const classValB = classB === '-' ? 0 : parseInt(classB); return classValA - classValB; });
    }, [rankedTargets]);

    const performanceByTileRange = useMemo(() => {
        if (!rankedTargets) return [];
        const ranges = { "1-50": { raids: 0, wins: 0, ether: 0 }, "51-100": { raids: 0, wins: 0, ether: 0 }, "101-200": { raids: 0, wins: 0, ether: 0 }, "201-400": { raids: 0, wins: 0, ether: 0 }, "401-700": { raids: 0, wins: 0, ether: 0 }, "701+": { raids: 0, wins: 0, ether: 0 }};
        rankedTargets.forEach(target => { let rangeKey: keyof typeof ranges = "701+"; if (target.tileCount <= 50) rangeKey = "1-50"; else if (target.tileCount <= 100) rangeKey = "51-100"; else if (target.tileCount <= 200) rangeKey = "101-200"; else if (target.tileCount <= 400) rangeKey = "201-400"; else if (target.tileCount <= 700) rangeKey = "401-700"; ranges[rangeKey].raids += target.totalRaids; ranges[rangeKey].wins += target.totalWins; ranges[rangeKey].ether += target.totalEtherYield; });
        return Object.entries(ranges).map(([range, data]) => ({ name: range, AvgEtherPerWin: data.wins > 0 ? data.ether / data.wins : 0, AvgWinRate: data.raids > 0 ? (data.wins / data.raids) * 100 : 0, TotalRaids: data.raids }));
    }, [rankedTargets]);

    const etherPerCydroidData = useMemo(() => {
        if (!raidData) return [];
        const successfulRaids = raidData.filter(r => r.event_type === 'DROID_RAID_SUCCESSFUL' && r.cydroids_sent > 0);
        if (successfulRaids.length === 0) return [];
        const efficiencyMap: Record<number, { totalEther: number, count: number }> = {};
        successfulRaids.forEach(raid => { const efficiency = raid.ether_amount / raid.cydroids_sent; const bin = Math.floor(efficiency * 10); if (!efficiencyMap[bin]) { efficiencyMap[bin] = { totalEther: 0, count: 0 }; } efficiencyMap[bin].count++; efficiencyMap[bin].totalEther += raid.ether_amount; });
        return Object.entries(efficiencyMap).map(([binKey, data]) => ({ name: `${(parseInt(binKey) / 10).toFixed(1)}-${((parseInt(binKey) + 1) / 10).toFixed(1)}`, count: data.count, AvgEtherInBin: data.totalEther / data.count })).sort((a,b)=> parseFloat(a.name.split('-')[0]) - parseFloat(b.name.split('-')[0]));
    },[raidData])


    // --- Render ---
    return (
        <div className="container mx-auto p-4 md:p-8 space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Earth2 Raid Helper</h1>
            <p className="text-muted-foreground">
                Upload your raid notification CSV file (generated by the console script) to visualize your raiding history and performance.
            </p>

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
                     <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="csv-upload">Raid CSV File</Label>
                        <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} />
                     </div>
                     {file && <p className="text-sm text-muted-foreground">Selected file: {file.name}</p>}
                     {error && (
                         <Alert variant="destructive">
                             <AlertCircle className="h-4 w-4" />
                             <AlertTitle>Error</AlertTitle>
                             <AlertDescription>{error}</AlertDescription>
                         </Alert>
                     )}
                     <Button onClick={processFile} disabled={!file || isLoading}>
                         {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                         {isLoading ? "Processing..." : "Process File"}
                     </Button>
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
                                    <TableHeader><TableRow><TableHead>Property</TableHead><TableHead className="text-right">Raids Sent</TableHead><TableHead className="text-right">Win Rate</TableHead><TableHead className="text-right">Total E-ther</TableHead><TableHead className="text-right">Avg E-ther/Win</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {paginatedSourceProperties.length === 0 && (<TableRow><TableCell colSpan={5} className="text-center">No matching properties found.</TableCell></TableRow>)}
                                        {paginatedSourceProperties.map((prop) => (
                                            <TableRow key={prop.id} onClick={() => setSelectedSourcePropertyId(prop.id === selectedSourcePropertyId ? null : prop.id)} className={`cursor-pointer hover:bg-muted/50 ${prop.id === selectedSourcePropertyId ? 'bg-muted' : ''}`}>
                                                <TableCell className="font-medium"><div>{prop.description}</div><div className="text-xs text-muted-foreground">{prop.location}</div><div className="text-xs text-muted-foreground">T{prop.tier} C{prop.class} ({prop.tileCount} tiles)</div></TableCell>
                                                <TableCell className="text-right">{prop.totalRaidsSent}</TableCell><TableCell className="text-right">{prop.winRate.toFixed(1)}%</TableCell><TableCell className="text-right text-yellow-500">{prop.totalEtherGenerated.toFixed(4)}</TableCell><TableCell className="text-right">{prop.avgEtherPerWin.toFixed(4)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                {sourceTotalPages > 1 && (
                                    <div className="flex justify-center items-center space-x-2 mt-4">
                                        <Button variant="outline" size="sm" onClick={() => setSourceCurrentPage(p => Math.max(1, p - 1))} disabled={sourceCurrentPage === 1}><ArrowLeft className="h-4 w-4 mr-1" /> Prev</Button>
                                        <span className="text-sm text-muted-foreground">Page {sourceCurrentPage} of {sourceTotalPages}</span>
                                        <Button variant="outline" size="sm" onClick={() => setSourceCurrentPage(p => Math.min(sourceTotalPages, p + 1))} disabled={sourceCurrentPage === sourceTotalPages}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        {/* Selected Property Detail View */}
                        {selectedPropertyData && (
                            <Card className="mt-6 border-primary/50 border-2 bg-card/80 backdrop-blur-sm">
                                <CardHeader><CardTitle>Details for: {selectedPropertyData.description}</CardTitle><CardDescription>{selectedPropertyData.location} (T{selectedPropertyData.tier} C{selectedPropertyData.class} - {selectedPropertyData.tileCount} tiles)</CardDescription></CardHeader>
                                <CardContent>
                                    <Tabs defaultValue="targets" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="targets">Targets Raided</TabsTrigger><TabsTrigger value="charts">Property Charts</TabsTrigger></TabsList>
                                        <TabsContent value="targets" className="mt-4">
                                            <h3 className="text-lg font-semibold mb-2">Targets Raided from this Property</h3>
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Target Property</TableHead><TableHead>Owner</TableHead><TableHead className="text-right">Raids (W/L)</TableHead><TableHead className="text-right">Win Rate</TableHead><TableHead className="text-right">Total E-ther</TableHead><TableHead className="text-right">Avg E-ther/Win</TableHead><TableHead>Last Raid</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {selectedPropertyTargetsSorted.length === 0 && (<TableRow><TableCell colSpan={7} className="text-center">No targets raided from this property.</TableCell></TableRow> )}
                                                    {selectedPropertyTargetsSorted.map((target) => (
                                                        <Accordion key={target.id} type="single" collapsible className="w-full hover:bg-muted/20">
                                                            <AccordionItem value={`item-${target.id}`} className="border-b"><AccordionTrigger className="hover:no-underline p-0 w-full">
                                                                <TableRow className="w-full flex justify-between items-center no-hover-effect">
                                                                    <TableCell className="font-medium w-[25%]"><div>{target.description}</div><div className="text-xs text-muted-foreground">{target.location} T{target.tier} C{target.class} ({target.tileCount})</div></TableCell>
                                                                    <TableCell className="w-[15%]">{target.ownerUsername}</TableCell><TableCell className="text-right w-[10%]">{target.wins}W/{target.losses}L</TableCell><TableCell className="text-right w-[10%]">{target.winRate.toFixed(1)}%</TableCell><TableCell className="text-right text-yellow-500 w-[15%]">{target.totalEtherYield.toFixed(4)}</TableCell><TableCell className="text-right w-[15%]">{target.avgEtherPerWin.toFixed(4)}</TableCell><TableCell className="w-[10%] text-xs">{target.lastRaidTimestamp ? format(parseISO(target.lastRaidTimestamp), 'MM/dd HH:mm') : 'N/A'}</TableCell>
                                                                </TableRow>
                                                            </AccordionTrigger><AccordionContent><div className="p-4 bg-muted/30 rounded-md">
                                                                <h4 className="font-semibold mb-2 text-sm">Raid History for {target.description}:</h4>
                                                                <Table><TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>Result</TableHead><TableHead className="text-right">E-ther</TableHead><TableHead className="text-right">Cydroids</TableHead></TableRow></TableHeader><TableBody>
                                                                    {target.raids.map(raid => (<TableRow key={raid.notification_id}><TableCell className="text-xs">{format(parseISO(raid.timestamp), 'yyyy-MM-dd HH:mm:ss')}</TableCell><TableCell>{raid.event_type === 'DROID_RAID_SUCCESSFUL' ? <span className="text-green-600 font-semibold flex items-center"><CheckCircle className="h-3 w-3 mr-1"/>Win</span> : <span className="text-red-600 font-semibold flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>Fail</span>}</TableCell><TableCell className="text-right text-yellow-500">{raid.ether_amount.toFixed(4)}</TableCell><TableCell className="text-right">{raid.cydroids_sent || '-'}</TableCell></TableRow>))}
                                                                </TableBody></Table>
                                                            </div></AccordionContent></AccordionItem>
                                                        </Accordion>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TabsContent>
                                        <TabsContent value="charts" className="mt-4 space-y-6">
                                            <h3 className="text-lg font-semibold mb-2">Charts for {selectedPropertyData.description}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <Card className="bg-card/80 backdrop-blur-sm"><CardHeader><CardTitle className="text-base">Win/Loss Ratio</CardTitle></CardHeader><CardContent className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={propertyWinLossData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{propertyWinLossData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}</Pie><Tooltip formatter={(value) => value}/></PieChart></ResponsiveContainer></CardContent></Card>
                                                <Card className="bg-card/80 backdrop-blur-sm"><CardHeader><CardTitle className="text-base">Top 10 Targets by E-ther Yield</CardTitle></CardHeader><CardContent className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={topTargetsByEtherData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={80} fontSize="10px" interval={0}/><Tooltip formatter={(value) => `${value.toFixed(5)} E-ther`}/><Legend /><Bar dataKey="ether" fill="#FFBB28" name="E-ther Yield"/></BarChart></ResponsiveContainer></CardContent></Card>
                                            </div>
                                            <Card className="bg-card/80 backdrop-blur-sm"><CardHeader><CardTitle className="text-base">Raids & E-ther Over Time (Daily)</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={propertyRaidsOverTimeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis yAxisId="left" label={{ value: 'Raids / Wins', angle: -90, position: 'insideLeft' }}/><YAxis yAxisId="right" orientation="right" label={{ value: 'E-ther', angle: 90, position: 'insideRight' }}/><Tooltip formatter={(value, name) => (name === 'ether' ? parseFloat(value as string).toFixed(4) : value)}/><Legend /><Line yAxisId="left" type="monotone" dataKey="raids" stroke="#8884d8" name="Total Raids" dot={false}/><Line yAxisId="left" type="monotone" dataKey="wins" stroke="#00C49F" name="Wins" dot={false}/><Line yAxisId="right" type="monotone" dataKey="ether" stroke="#FFBB28" name="E-ther Earned" dot={false}/></LineChart></ResponsiveContainer></CardContent></Card>
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
                               <Card className="bg-card/80 backdrop-blur-sm"><CardHeader><CardTitle className="text-base">Overall Win/Loss Ratio</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={overallWinLossData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{overallWinLossData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}</Pie><Tooltip formatter={(value) => value}/><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
                               {/* Added this placeholder back - needs source property tier data aggregation if wanted */}
                               <Card className="bg-card/80 backdrop-blur-sm"><CardHeader><CardTitle className="text-base">Avg E-ther/Win by Source Tier</CardTitle></CardHeader><CardContent className="h-[300px]"><p className="text-center text-muted-foreground h-full flex items-center justify-center">(Chart Placeholder)</p></CardContent></Card>
                           </div>
                           <Card className="bg-card/80 backdrop-blur-sm"><CardHeader><CardTitle className="text-base">Overall Raids & E-ther Over Time (Daily)</CardTitle></CardHeader><CardContent className="h-[350px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={raidsOverTimeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis yAxisId="left" label={{ value: 'Raids / Wins', angle: -90, position: 'insideLeft' }} /><YAxis yAxisId="right" orientation="right" label={{ value: 'E-ther', angle: 90, position: 'insideRight' }}/><Tooltip formatter={(value, name) => (name === 'ether' ? parseFloat(value as string).toFixed(4) : value)}/><Legend /><Line yAxisId="left" type="monotone" dataKey="raids" stroke="#8884d8" name="Total Raids" dot={false}/><Line yAxisId="left" type="monotone" dataKey="wins" stroke="#00C49F" name="Wins" dot={false}/><Line yAxisId="right" type="monotone" dataKey="ether" stroke="#FFBB28" name="E-ther Earned" dot={false}/></LineChart></ResponsiveContainer></CardContent></Card>
                           <h3 className="text-lg font-semibold pt-4 border-t border-border/30">Target Characteristic Analysis</h3>
                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                               <Card className="bg-card/80 backdrop-blur-sm"><CardHeader><CardTitle className="text-base">Performance by Target Tier & Class</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={performanceByTargetTierClass} margin={{ top: 5, right: 20, left: 5, bottom: 40 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" angle={-45} textAnchor="end" height={50} interval={0} fontSize={10}/><YAxis yAxisId="left" label={{ value: 'Avg Win Rate (%)', angle: -90, position: 'insideLeft' }} /><YAxis yAxisId="right" orientation="right" label={{ value: 'Avg E-ther/Win', angle: 90, position: 'insideRight' }} /><Tooltip formatter={(value: number, name) => (name.includes('Rate') ? `${value.toFixed(1)}%` : value.toFixed(5))}/><Legend verticalAlign="top" /><Bar yAxisId="left" dataKey="AvgWinRate" fill="#8884d8" name="Avg Win Rate" /><Bar yAxisId="right" dataKey="AvgEtherPerWin" fill="#82ca9d" name="Avg E-ther/Win"/></BarChart></ResponsiveContainer></CardContent></Card>
                               <Card className="bg-card/80 backdrop-blur-sm"><CardHeader><CardTitle className="text-base">Performance by Target Tile Range</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={performanceByTileRange} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={10}/><YAxis yAxisId="left" label={{ value: 'Avg Win Rate (%)', angle: -90, position: 'insideLeft' }} /><YAxis yAxisId="right" orientation="right" label={{ value: 'Avg E-ther/Win', angle: 90, position: 'insideRight' }} /><Tooltip formatter={(value: number, name) => (name.includes('Rate') ? `${value.toFixed(1)}%` : value.toFixed(5))}/><Legend verticalAlign="top" /><Bar yAxisId="left" dataKey="AvgWinRate" fill="#ffc658" name="Avg Win Rate" /><Bar yAxisId="right" dataKey="AvgEtherPerWin" fill="#ff8042" name="Avg E-ther/Win"/></BarChart></ResponsiveContainer></CardContent></Card>
                           </div>
                           <h3 className="text-lg font-semibold pt-4 border-t border-border/30">Efficiency Analysis</h3>
                           <Card className="bg-card/80 backdrop-blur-sm"><CardHeader><CardTitle className="text-base">E-ther per Cydroid Distribution (Successful Raids)</CardTitle><CardDescription>Shows how many successful raids fall into each efficiency bucket (E-ther / Cydroids Sent).</CardDescription></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={etherPerCydroidData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" name="E-ther/Cydroid Range" fontSize={10}/><YAxis label={{ value: 'Number of Raids', angle: -90, position: 'insideLeft' }} /><Tooltip formatter={(value: number) => value}/><Legend verticalAlign="top" /><Bar dataKey="count" fill="#00C49F" name="Raid Count"/></BarChart></ResponsiveContainer></CardContent></Card>
                     </TabsContent>
                </Tabs>
            )}

            {/* --- Preview Component --- */}
            {!file && !isLoading && !error && <RaidHelperPreview />}
        </div>
    );
}