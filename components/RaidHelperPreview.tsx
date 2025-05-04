"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// --- Type Definitions (Copied from page.tsx for self-containment) ---
interface RaidNotificationRow {
    notification_id: string;
    event_type: 'DROID_RAID_SUCCESSFUL' | 'DROID_RAID_FAILED';
    timestamp: string;
    ether_amount: number;
    cydroids_sent: number;
    source_property_id: string;
    source_property_desc: string;
    source_location: string;
    source_tile_count: number;
    source_tier: number;
    source_class: number | string;
    target_property_id: string;
    target_property_desc: string;
    target_location: string;
    target_owner_id: string;
    target_owner_username: string;
    target_tile_count: number;
    target_tier: number;
    target_class: number | string;
}

interface TargetSummary {
    id: string;
    description: string;
    location: string;
    ownerUsername: string;
    tileCount: number;
    tier: number;
    class: number | string;
    totalRaidsReceived: number;
    wins: number; // Wins from *source's* perspective vs this target
    losses: number; // Losses from *source's* perspective vs this target
    winRate: number;
    totalEtherYield: number;
    avgEtherPerRaid: number;
    avgEtherPerWin: number;
    raids: RaidNotificationRow[];
    lastRaidTimestamp?: string;
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
    targets: Record<string, TargetSummary>;
    raids: RaidNotificationRow[];
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

// --- Sample Data --- 
const SAMPLE_RAID_DATA: RaidNotificationRow[] = [
    { notification_id: 'sample-1', event_type: 'DROID_RAID_SUCCESSFUL', timestamp: '2024-05-01T10:00:00Z', ether_amount: 0.015, cydroids_sent: 10, source_property_id: 'src-prop-A', source_property_desc: 'My Alpha Base', source_location: 'Alpha Centauri', source_tile_count: 100, source_tier: 1, source_class: 1, target_property_id: 'tgt-prop-X', target_property_desc: 'Rich Target X', target_location: 'Proxima B', target_owner_id: 'owner-1', target_owner_username: 'TargetOwner1', target_tile_count: 50, target_tier: 1, target_class: 2, },
    { notification_id: 'sample-2', event_type: 'DROID_RAID_FAILED', timestamp: '2024-05-01T11:30:00Z', ether_amount: 0, cydroids_sent: 8, source_property_id: 'src-prop-A', source_property_desc: 'My Alpha Base', source_location: 'Alpha Centauri', source_tile_count: 100, source_tier: 1, source_class: 1, target_property_id: 'tgt-prop-Y', target_property_desc: 'Tricky Target Y', target_location: 'Sirius C', target_owner_id: 'owner-2', target_owner_username: 'TargetOwner2', target_tile_count: 75, target_tier: 2, target_class: 1, },
    { notification_id: 'sample-3', event_type: 'DROID_RAID_SUCCESSFUL', timestamp: '2024-05-02T09:15:00Z', ether_amount: 0.022, cydroids_sent: 12, source_property_id: 'src-prop-B', source_property_desc: 'My Beta Outpost', source_location: 'Beta Hydri', source_tile_count: 20, source_tier: 1, source_class: 3, target_property_id: 'tgt-prop-X', target_property_desc: 'Rich Target X', target_location: 'Proxima B', target_owner_id: 'owner-1', target_owner_username: 'TargetOwner1', target_tile_count: 50, target_tier: 1, target_class: 2, },
];

const PIE_COLORS = ['#00C49F', '#FF8042']; // Green for Wins, Orange for Losses

// --- Reusable Component Sections (Simplified versions from page.tsx) ---

const PreviewOverallSummaryCard = ({ summary }: { summary: OverallSummary }) => (
    <Card className="bg-gray-800/50 border-gray-700 mb-4">
        <CardHeader>
            <CardTitle className="text-white">Overall Raid Summary</CardTitle>
             <CardDescription className="text-gray-400">
                 Summary based on sample data from {summary.dateRange.start ?? 'N/A'} to {summary.dateRange.end ?? 'N/A'}.
             </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div><span className="font-semibold text-gray-300">Total Raids:</span> {summary.totalRaids}</div>
                <div><span className="font-semibold text-gray-300">Total Wins:</span> <span className="text-green-500">{summary.totalWins}</span></div>
                <div><span className="font-semibold text-gray-300">Total Losses:</span> <span className="text-red-500">{summary.totalLosses}</span></div>
                <div><span className="font-semibold text-gray-300">Win Rate:</span> {summary.overallWinRate.toFixed(1)}%</div>
                <div><span className="font-semibold text-yellow-500">Total E-ther:</span> {summary.totalEtherEarned.toFixed(4)}</div>
                <div><span className="font-semibold text-gray-300">Avg E-ther/Win:</span> {summary.avgEtherPerWin.toFixed(4)}</div>
                <div><span className="font-semibold text-gray-300">Unique Sources:</span> {summary.uniqueSourceProperties}</div>
                <div><span className="font-semibold text-gray-300">Unique Targets:</span> {summary.uniqueTargetProperties}</div>
                <div><span className="font-semibold text-gray-300">Unique Owners:</span> {summary.uniqueOwnersRaided}</div>
            </div>
             {/* Optional: Include the Pie Chart here too */}
             <div className="mt-4 h-40">
                 <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                         <Pie
                             data={[{ name: 'Wins', value: summary.totalWins }, { name: 'Losses', value: summary.totalLosses }]}
                             cx="50%"
                             cy="50%"
                             labelLine={false}
                             outerRadius={60}
                             fill="#8884d8"
                             dataKey="value"
                             label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                         >
                             {[{ name: 'Wins', value: summary.totalWins }, { name: 'Losses', value: summary.totalLosses }].map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                             ))}
                         </Pie>
                         <Tooltip formatter={(value) => `${value} raids`} />
                         <Legend iconSize={10} />
                     </PieChart>
                 </ResponsiveContainer>
             </div>
        </CardContent>
    </Card>
);

const PreviewPropertySummaryAccordion = ({ summaries }: { summaries: Record<string, PropertySummary> }) => (
    <Accordion type="single" collapsible className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2 px-4 text-white">Source Property Performance (Sample Data)</h3>
        {Object.values(summaries).map((prop) => (
            <AccordionItem value={prop.id} key={prop.id} className="border-b border-gray-600 last:border-b-0">
                <AccordionTrigger className="hover:no-underline px-4 py-3 text-left w-full">
                    <div className="flex justify-between items-center w-full text-sm">
                        <div className="font-medium text-white">
                            {prop.description} <span className="text-xs text-gray-400">({prop.location})</span>
                            <div className="text-xs text-gray-400">T{prop.tier} C{prop.class} ({prop.tileCount} tiles)</div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span title="Wins/Losses">{prop.wins}W / {prop.losses}L</span>
                            <span title="Win Rate">{prop.winRate.toFixed(1)}%</span>
                            <span title="Total Ether" className="text-yellow-500">{prop.totalEtherGenerated.toFixed(4)} E</span>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pt-2 pb-4 bg-gray-700/30">
                     <h4 className="font-semibold mb-2 text-sm text-gray-300">Targets Raided from {prop.description}:</h4>
                     <Table>
                        <TableHeader>
                            <TableRow className="text-xs">
                                <TableHead className="w-[30%]">Target Property</TableHead>
                                <TableHead className="w-[20%]">Owner</TableHead>
                                <TableHead className="text-right">W/L</TableHead>
                                <TableHead className="text-right">Win %</TableHead>
                                <TableHead className="text-right">E-ther</TableHead>
                                <TableHead className="text-right">Avg E/Win</TableHead>
                                <TableHead>Last Raid</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.values(prop.targets).map(target => (
                                <TableRow key={target.id} className="text-xs">
                                    <TableCell className="font-medium">
                                        <div>{target.description}</div>
                                        <div className="text-muted-foreground">{target.location} T{target.tier} C{target.class} ({target.tileCount})</div>
                                    </TableCell>
                                    <TableCell>{target.ownerUsername}</TableCell>
                                    <TableCell className="text-right">{target.wins}W / {target.losses}L</TableCell>
                                    <TableCell className="text-right">{target.winRate.toFixed(1)}%</TableCell>
                                    <TableCell className="text-right text-yellow-500">{target.totalEtherYield.toFixed(4)}</TableCell>
                                    <TableCell className="text-right">{target.avgEtherPerWin.toFixed(4)}</TableCell>
                                    <TableCell className="text-xs">
                                        {target.lastRaidTimestamp ? format(parseISO(target.lastRaidTimestamp), 'MM/dd HH:mm') : 'N/A'}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                     </Table>
                 </AccordionContent>
            </AccordionItem>
        ))}
    </Accordion>
);

// --- Main Preview Component --- 
export default function RaidHelperPreview() {

    // --- Sample Data Processing --- 
    const sampleOverallSummary = useMemo<OverallSummary | null>(() => {
        const data = SAMPLE_RAID_DATA;
        if (data.length === 0) return null;
        let totalEther = 0, wins = 0, losses = 0;
        const sourceIds = new Set<string>(), targetIds = new Set<string>(), ownerIds = new Set<string>();
        const sortedData = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        let earliestTimestamp = sortedData[0]?.timestamp, latestTimestamp = sortedData[sortedData.length - 1]?.timestamp;
        data.forEach(raid => {
            if (raid.event_type === 'DROID_RAID_SUCCESSFUL') { wins++; totalEther += raid.ether_amount; } else { losses++; }
            sourceIds.add(raid.source_property_id); targetIds.add(raid.target_property_id); ownerIds.add(raid.target_owner_id);
        });
        const totalRaids = data.length;
        return {
            totalRaids, totalWins: wins, totalLosses: losses,
            overallWinRate: totalRaids > 0 ? (wins / totalRaids) * 100 : 0,
            totalEtherEarned: totalEther, avgEtherPerRaid: totalRaids > 0 ? totalEther / totalRaids : 0, avgEtherPerWin: wins > 0 ? totalEther / wins : 0,
            uniqueSourceProperties: sourceIds.size, uniqueTargetProperties: targetIds.size, uniqueOwnersRaided: ownerIds.size,
            dateRange: { start: earliestTimestamp ? format(parseISO(earliestTimestamp), 'yyyy-MM-dd HH:mm') : undefined, end: latestTimestamp ? format(parseISO(latestTimestamp), 'yyyy-MM-dd HH:mm') : undefined }
        };
    }, []);

    const samplePropertySummaries = useMemo<Record<string, PropertySummary> | null>(() => {
        const data = SAMPLE_RAID_DATA;
        if (data.length === 0) return null;
        const summaries: Record<string, PropertySummary> = {};
        data.forEach(raid => {
            if (!summaries[raid.source_property_id]) { summaries[raid.source_property_id] = { id: raid.source_property_id, description: raid.source_property_desc, location: raid.source_location, tileCount: raid.source_tile_count, tier: raid.source_tier, class: raid.source_class, totalRaidsSent: 0, wins: 0, losses: 0, winRate: 0, totalEtherGenerated: 0, avgEtherPerRaid: 0, avgEtherPerWin: 0, targets: {}, raids: [] }; }
            const sourceSummary = summaries[raid.source_property_id];
            sourceSummary.totalRaidsSent++; sourceSummary.raids.push(raid);
            if (!sourceSummary.targets[raid.target_property_id]) { sourceSummary.targets[raid.target_property_id] = { id: raid.target_property_id, description: raid.target_property_desc, location: raid.target_location, ownerUsername: raid.target_owner_username, tileCount: raid.target_tile_count, tier: raid.target_tier, class: raid.target_class, totalRaidsReceived: 0, wins: 0, losses: 0, winRate: 0, totalEtherYield: 0, avgEtherPerRaid: 0, avgEtherPerWin: 0, raids: [], lastRaidTimestamp: undefined }; }
            const targetSummary = sourceSummary.targets[raid.target_property_id];
            targetSummary.totalRaidsReceived++; targetSummary.raids.push(raid);
            targetSummary.lastRaidTimestamp = (!targetSummary.lastRaidTimestamp || new Date(raid.timestamp) > new Date(targetSummary.lastRaidTimestamp)) ? raid.timestamp : targetSummary.lastRaidTimestamp;
            if (raid.event_type === 'DROID_RAID_SUCCESSFUL') { sourceSummary.wins++; sourceSummary.totalEtherGenerated += raid.ether_amount; targetSummary.losses++; targetSummary.totalEtherYield += raid.ether_amount; } else { sourceSummary.losses++; targetSummary.wins++; }
        });
        Object.values(summaries).forEach(source => {
            source.winRate = source.totalRaidsSent > 0 ? (source.wins / source.totalRaidsSent) * 100 : 0;
            source.avgEtherPerRaid = source.totalRaidsSent > 0 ? source.totalEtherGenerated / source.totalRaidsSent : 0;
            source.avgEtherPerWin = source.wins > 0 ? source.totalEtherGenerated / source.wins : 0;
            Object.values(source.targets).forEach(target => {
                target.winRate = target.totalRaidsReceived > 0 ? (target.wins / target.totalRaidsReceived) * 100 : 0;
                target.avgEtherPerRaid = target.totalRaidsReceived > 0 ? target.totalEtherYield / target.totalRaidsReceived : 0;
                target.avgEtherPerWin = target.wins > 0 ? target.totalEtherYield / target.wins : 0;
                target.raids.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            });
            source.targets = Object.fromEntries( Object.entries(source.targets).sort(([, a], [, b]) => { if (!a.lastRaidTimestamp) return 1; if (!b.lastRaidTimestamp) return -1; return new Date(b.lastRaidTimestamp).getTime() - new Date(a.lastRaidTimestamp).getTime(); }) );
            source.raids.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        });
        const sortedSummaries = Object.entries(summaries).sort(([, a], [, b]) => b.totalRaidsSent - a.totalRaidsSent).reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {} as Record<string, PropertySummary>);
        return Object.keys(sortedSummaries).length > 0 ? sortedSummaries : null;
    }, []);

    if (!sampleOverallSummary || !samplePropertySummaries) {
        return <div className="text-center text-muted-foreground p-8">Loading Preview...</div>;
    }

    return (
        <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4 text-center text-muted-foreground">Analysis Preview (Using Sample Data)</h2>
            <PreviewOverallSummaryCard summary={sampleOverallSummary} />
            {/* Note: Time-based charts are omitted from preview for simplicity */}
            <PreviewPropertySummaryAccordion summaries={samplePropertySummaries} />
            {/* Note: Target Details Table is omitted from preview for simplicity */}
        </div>
    );
}
