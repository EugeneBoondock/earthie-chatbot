import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const ESSENCE_TOKEN_ADDRESS = "0x2c0687215aca7f5e2792d956e170325e92a02aca";

interface ApiResponse {
  success: boolean;
  error?: string;
  transactionsCount: number;
  hasMore: boolean;
  lastTimestamp: number;
  message?: string;
}

interface SyncStatus {
  id: number;
  last_sync: string;
  last_timestamp: number;
  transactions_processed: number;
  has_more: boolean;
}

async function getLastProcessedTimestamp(supabase: any): Promise<number> {
  const { data, error } = await supabase
    .from('essence_sync_status')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    console.log('No sync status found, starting from timestamp 0');
    return 0;
  }

  const status = data as SyncStatus;
  return status.has_more ? status.last_timestamp : 0;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkServerPort(): Promise<number> {
  // Try port 3000 first
  try {
    const response = await fetch('http://localhost:3000/api/essence/fetch-historical?timestamp=0');
    if (response.ok) return 3000;
  } catch {}

  // Try port 3001 if 3000 fails
  try {
    const response = await fetch('http://localhost:3001/api/essence/fetch-historical?timestamp=0');
    if (response.ok) return 3001;
  } catch {}

  throw new Error('Could not connect to server on port 3000 or 3001');
}

interface FetchOptions {
  startTimestamp: number;
  maxBatches?: number;
}

async function fetchInitialData(options: FetchOptions) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    console.log('Starting initial data fetch...');
    console.log(`Starting from timestamp: ${options.startTimestamp}`);
    if (options.maxBatches) console.log(`Will stop after ${options.maxBatches} batches`);
    
    // Check which port the server is running on
    const port = await checkServerPort();
    console.log(`Server detected on port ${port}`);
    const baseUrl = `http://localhost:${port}`;
    
    let timestamp = options.startTimestamp;
    let hasMore = true;
    let totalProcessed = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;
    let batchesProcessed = 0;

    while (hasMore && (!options.maxBatches || batchesProcessed < options.maxBatches)) {
      try {
        console.log(`\nFetching transactions from timestamp ${timestamp}...`);
        
        // Add delay between requests (Ethplorer free tier allows 2 requests per second)
        await sleep(500); // 500ms delay = 2 requests per second
        
        const response = await fetch(
          `${baseUrl}/api/essence/fetch-historical?timestamp=${timestamp}`,
          { method: 'GET' }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch from timestamp ${timestamp}: ${response.statusText}`);
        }

        const data = await response.json() as ApiResponse;
        
        if (!data.success) {
          throw new Error(`API error at timestamp ${timestamp}: ${data.error}`);
        }

        totalProcessed += data.transactionsCount;
        console.log(`Processed ${data.transactionsCount} transactions`);
        console.log(`Total transactions processed so far: ${totalProcessed}`);
        console.log(`Has more transactions: ${data.hasMore}`);
        if (data.message) console.log(`Server message: ${data.message}`);
        
        hasMore = data.hasMore;
        if (hasMore) {
          timestamp = data.lastTimestamp;
          batchesProcessed++;
          consecutiveErrors = 0; // Reset error count on success
          
          // Update sync status
          await supabase
            .from('essence_sync_status')
            .upsert([{
              id: 1,
              last_sync: new Date().toISOString(),
              last_timestamp: timestamp,
              transactions_processed: totalProcessed,
              has_more: hasMore
            }], {
              onConflict: 'id'
            });
        }
      } catch (error) {
        console.error(`Error processing batch:`, error);
        consecutiveErrors++;
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.log(`\nStopping due to ${maxConsecutiveErrors} consecutive errors.`);
          console.log(`To continue from this point, run: npm run ts-node scripts/fetch-initial-essence-data.ts ${timestamp}`);
          break;
        }
        
        // Exponential backoff
        const backoffTime = Math.min(1000 * Math.pow(2, consecutiveErrors), 10000);
        console.log(`Waiting ${backoffTime}ms before retrying...`);
        await sleep(backoffTime);
        continue; // Retry the same timestamp
      }
    }

    console.log('\nData fetch session complete!');
    console.log(`Last timestamp processed: ${timestamp}`);
    console.log(`Total transactions processed in this session: ${totalProcessed}`);

  } catch (error) {
    console.error('Error fetching initial data:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const startTimestamp = parseInt(process.argv[2] || '0');
const maxBatches = process.argv[3] ? parseInt(process.argv[3]) : undefined;

fetchInitialData({ startTimestamp, maxBatches }); 