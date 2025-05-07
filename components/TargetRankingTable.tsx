"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // Added
import { ArrowLeft, ArrowRight } from 'lucide-react'; // Added
import { format, parseISO } from 'date-fns';

// Interface remains the same
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

interface TargetRankingTableProps {
    data: RankedTarget[] | null; // This will now be the PAGINATED data
    currentPage: number;
    totalPages: number;
    setCurrentPage: (page: number | ((prev: number) => number)) => void;
    totalItems: number; // Total number of filtered items
}

export function TargetRankingTable({
    data,
    currentPage,
    totalPages,
    setCurrentPage,
    totalItems
}: TargetRankingTableProps) {

    const formatEther = (value: number) => value.toFixed(5);
    const formatPercentage = (value: number) => value.toFixed(1) + '%';
    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        try { return format(parseISO(dateString), 'yyyy-MM-dd HH:mm'); } catch { return 'Invalid Date'; }
    };

    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Target Ranking</CardTitle>
                <CardDescription>
                    Overall performance against unique targets. Showing {data?.length ?? 0} of {totalItems} targets. Sorted by Total Raids (descending).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table className="min-w-full">
                         {/* TableHeader remains the same */}
                         <TableHeader><TableRow className="border-b border-border/50 hover:bg-muted/50"><TableHead className="w-[200px] py-2 px-3">Target Property</TableHead><TableHead className="py-2 px-3">Owner</TableHead><TableHead className="py-2 px-3">Location</TableHead><TableHead className="text-right py-2 px-3">Raids (W/L)</TableHead><TableHead className="text-right py-2 px-3">Win Rate</TableHead><TableHead className="text-right py-2 px-3">Total E-ther</TableHead><TableHead className="text-right py-2 px-3">Avg E/Win</TableHead><TableHead className="text-right py-2 px-3">Avg E/Raid</TableHead><TableHead className="text-right py-2 px-3">Avg Droids/Win</TableHead><TableHead className="py-2 px-3">Last Raided</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {(!data || data.length === 0) && (
                                <TableRow><TableCell colSpan={10} className="text-center py-4">No matching targets found.</TableCell></TableRow>
                            )}
                            {data && data.map((target) => (
                                // TableRow logic remains the same
                                <TableRow key={target.id} className="text-xs border-b border-border/30 hover:bg-muted/50"><TableCell className="font-medium py-2 px-3">{target.description || target.id}</TableCell><TableCell className="py-2 px-3">{target.ownerUsername || 'N/A'}</TableCell><TableCell className="py-2 px-3 text-muted-foreground">{target.location || 'N/A'}</TableCell><TableCell className="text-right py-2 px-3">{target.totalRaids} (<span className="text-green-500">{target.totalWins}</span>/<span className="text-red-500">{target.totalLosses}</span>)</TableCell><TableCell className="text-right py-2 px-3">{formatPercentage(target.overallWinRate)}</TableCell><TableCell className="text-right py-2 px-3 font-semibold text-yellow-500">{formatEther(target.totalEtherYield)}</TableCell><TableCell className="text-right py-2 px-3">{formatEther(target.avgEtherPerWin)}</TableCell><TableCell className="text-right py-2 px-3">{formatEther(target.avgEtherPerRaid)}</TableCell><TableCell className="text-right py-2 px-3">{target.avgCydroidsSentOnWins.toFixed(1)}</TableCell><TableCell className="py-2 px-3 text-muted-foreground whitespace-nowrap">{formatDate(target.lastRaidTimestamp)}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center space-x-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            <ArrowLeft className="h-4 w-4 mr-1" /> Prev
                        </Button>
                        <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                            Next <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}