"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // Added
import { ArrowLeft, ArrowRight } from 'lucide-react'; // Added
import { format, parseISO } from 'date-fns';

// Interface remains the same
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

interface OwnerPerformanceTableProps {
    data: OwnerSummary[] | null; // This will be PAGINATED data
    currentPage: number;
    totalPages: number;
    setCurrentPage: (page: number | ((prev: number) => number)) => void;
    totalItems: number; // Total number of filtered items
}

export function OwnerPerformanceTable({
    data,
    currentPage,
    totalPages,
    setCurrentPage,
    totalItems
}: OwnerPerformanceTableProps) {

    const formatEther = (value: number) => value.toFixed(5);
    const formatPercentage = (value: number) => value.toFixed(1) + '%';
    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        try { return format(parseISO(dateString), 'yyyy-MM-dd HH:mm'); } catch { return 'Invalid Date'; }
    };

    return (
        <Card className="bg-card/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Owner Performance</CardTitle>
                <CardDescription>
                    Performance against unique target owners. Showing {data?.length ?? 0} of {totalItems} owners. Sorted by Total Raids Against (descending).
                </CardDescription>
            </CardHeader>
            <CardContent>
                 {/* Add filtering/sorting controls here later */}
                <div className="overflow-x-auto">
                    <Table className="min-w-full">
                         {/* TableHeader remains the same */}
                         <TableHeader>
  <TableRow className="border-b border-border/50 hover:bg-muted/50">
    <TableHead className="w-[200px] py-2 px-3">Owner Username</TableHead>
    <TableHead className="text-right py-2 px-3">Raids Against (W/L)</TableHead>
    <TableHead className="text-right py-2 px-3">Your Win Rate</TableHead>
    <TableHead className="text-right py-2 px-3">Total E-ther From</TableHead>
    <TableHead className="text-right py-2 px-3">Avg E/Win Against</TableHead>
    <TableHead className="text-right py-2 px-3">Unique Props Raided</TableHead>
    <TableHead className="py-2 px-3">Last Raid Against</TableHead>
  </TableRow>
</TableHeader>
                        <TableBody>
                             {(!data || data.length === 0) && (
                                <TableRow><TableCell colSpan={7} className="text-center py-4">No matching owners found.</TableCell></TableRow>
                            )}
                            {data && data.map((owner) => (
                                <TableRow key={owner.ownerId} className="text-xs border-b border-border/30 hover:bg-muted/50"><TableCell className="font-medium py-2 px-3">{owner.ownerUsername || owner.ownerId}</TableCell><TableCell className="text-right py-2 px-3"> {owner.totalRaidsAgainst} (<span className="text-green-500">{owner.winsAgainst}</span>/<span className="text-red-500">{owner.lossesAgainst}</span>) </TableCell><TableCell className="text-right py-2 px-3">{formatPercentage(owner.winRateAgainst)}</TableCell><TableCell className="text-right py-2 px-3 font-semibold text-yellow-500">{formatEther(owner.totalEtherFromOwner)}</TableCell><TableCell className="text-right py-2 px-3">{formatEther(owner.avgEtherPerWinAgainst)}</TableCell><TableCell className="text-right py-2 px-3">{owner.uniqueTargetProperties}</TableCell><TableCell className="py-2 px-3 text-muted-foreground whitespace-nowrap">{formatDate(owner.lastRaidAgainstTimestamp)}</TableCell></TableRow>
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