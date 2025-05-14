import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(__dirname, '../.env.local') });

interface ApiResponse {
  success: boolean;
  error?: string;
  transactionsCount: number;
  hasMore: boolean;
  lastTimestamp: number;
  message?: string;
  mintCount?: number;
  burnCount?: number;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkServerPort(): Promise<number> {
  // Check if APP_URL env variable is set and use it
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      console.log(`Using server URL from environment: ${appUrl}`);
      
      // Test the connection
      const response = await fetch(`${appUrl}/api/essence/fetch-issuances?timestamp=0`);
      if (response.ok) {
        return parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
      }
    } catch (e: any) {
      console.warn(`Could not connect to server at ${appUrl}: ${e.message}`);
      console.log('Trying fallback ports...');
    }
  }

  // Try a wider range of ports
  const portsToTry = [3001, 3000, 3002, 8000];
  
  for (const port of portsToTry) {
    try {
      console.log(`Trying to connect to port ${port}...`);
      const timeout = 5000; // 5 second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`http://localhost:${port}/api/essence/fetch-issuances?timestamp=0`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`Successfully connected to server on port ${port}`);
        return port;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log(`Connection to port ${port} timed out`);
      } else {
        console.log(`Could not connect to port ${port}: ${err.message}`);
      }
    }
  }

  throw new Error('Could not connect to server. Make sure your Next.js server is running.');
}

interface FetchOptions {
  startTimestamp: number;
  maxBatches?: number;
}

async function fetchIssuancesData(options: FetchOptions) {
  try {
    console.log('Starting issuances data fetch...');
    console.log(`Starting from timestamp: ${options.startTimestamp}`);
    if (options.maxBatches) console.log(`Will stop after ${options.maxBatches} batches`);
    
    // Check which port the server is running on
    const port = await checkServerPort();
    console.log(`Server detected on port ${port}`);
    const baseUrl = `http://localhost:${port}`;
    
    let timestamp = options.startTimestamp;
    let hasMore = true;
    let totalProcessed = 0;
    let totalMintCount = 0;
    let totalBurnCount = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;
    let batchesProcessed = 0;

    while (hasMore && (!options.maxBatches || batchesProcessed < options.maxBatches)) {
      try {
        console.log(`\nFetching issuance transactions from timestamp ${timestamp}...`);
        
        // Add delay between requests (Ethplorer free tier allows 2 requests per second)
        await sleep(500); // 500ms delay = 2 requests per second
        
        const response = await fetch(
          `${baseUrl}/api/essence/fetch-issuances?timestamp=${timestamp}`,
          { method: 'GET' }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch issuances from timestamp ${timestamp}: ${response.statusText}`);
        }

        const data = await response.json() as ApiResponse;
        
        if (!data.success) {
          throw new Error(`API error at timestamp ${timestamp}: ${data.error}`);
        }

        totalProcessed += data.transactionsCount;
        if (data.mintCount) totalMintCount += data.mintCount;
        if (data.burnCount) totalBurnCount += data.burnCount;
        
        console.log(`Processed ${data.transactionsCount} issuance transactions`);
        if (data.mintCount !== undefined && data.burnCount !== undefined) {
          console.log(`This batch: ${data.mintCount} mints, ${data.burnCount} burns`);
        }
        console.log(`Total issuance transactions processed so far: ${totalProcessed}`);
        console.log(`Total mints: ${totalMintCount}, Total burns: ${totalBurnCount}`);
        console.log(`Has more issuance transactions: ${data.hasMore}`);
        if (data.message) console.log(`Server message: ${data.message}`);
        
        hasMore = data.hasMore;
        if (hasMore) {
          timestamp = data.lastTimestamp;
          batchesProcessed++;
          consecutiveErrors = 0; // Reset error count on success
        }
      } catch (error) {
        console.error(`Error processing batch:`, error);
        consecutiveErrors++;
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.log(`\nStopping due to ${maxConsecutiveErrors} consecutive errors.`);
          console.log(`To continue from this point, run: npx ts-node scripts/fetch-essence-issuances.ts ${timestamp}`);
          break;
        }
        
        // Exponential backoff
        const backoffTime = Math.min(1000 * Math.pow(2, consecutiveErrors), 10000);
        console.log(`Waiting ${backoffTime}ms before retrying...`);
        await sleep(backoffTime);
        continue; // Retry the same timestamp
      }
    }

    console.log('\nIssuances data fetch session complete!');
    console.log(`Last timestamp processed: ${timestamp}`);
    console.log(`Total issuance transactions processed in this session: ${totalProcessed}`);
    console.log(`Final counts - Mints: ${totalMintCount}, Burns: ${totalBurnCount}`);

  } catch (error) {
    console.error('Error fetching issuances data:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const startTimestamp = parseInt(process.argv[2] || '0');
const maxBatches = process.argv[3] ? parseInt(process.argv[3]) : undefined;

fetchIssuancesData({ startTimestamp, maxBatches }); 