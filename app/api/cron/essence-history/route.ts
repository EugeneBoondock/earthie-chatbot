import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  try {
    // Verify CRON secret to ensure this is called by the CRON job
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET_TOKEN}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the last sync status
    const { data: syncStatus } = await supabase
      .from('essence_sync_status')
      .select('*')
      .eq('id', 1)
      .single();

    // Since we only get 2 executions per day on free tier,
    // we'll fetch 5 pages per execution (5000 transactions)
    const maxPages = 5;
    let page = syncStatus?.pages_processed ? syncStatus.pages_processed + 1 : 1;
    let hasMore = true;
    const results = [];

    while (hasMore && results.length < maxPages) {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/essence/fetch-historical?page=${page}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch page ${page}: ${response.statusText}`);
      }

      const data = await response.json();
      results.push(data);
      
      hasMore = data.hasMore;
      if (hasMore) {
        page++;
        // Add a delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Refresh materialized view after all transactions are processed
    await supabase.rpc('refresh_essence_total_stats');

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${results.length} pages of transactions`,
      hasMore,
      results
    });

  } catch (error: any) {
    console.error('Error in CRON job:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 