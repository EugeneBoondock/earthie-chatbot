import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Add dynamic route configuration
export const dynamic = 'force-dynamic';

const ESSENCE_TOKEN_ADDRESS = "0x2c0687215aca7f5e2792d956e170325e92a02aca";
const EARTH2_WITHDRAWAL_ADDRESS = "0x68d332EC97800Aa1a112160195cc281978eC8Eea";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface EthplorerTransaction {
  timestamp: number;
  transactionHash: string;
  value: string;
  address?: string;
  from?: string;
  to?: string;
  type: string;
}

export async function GET(request: Request) {
  try {
    console.log('\n=== Starting issuances data fetch ===');
    
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get('timestamp') || '0';
    console.log('Timestamp:', timestamp);
    
    // Fetch issuances from Ethplorer
    console.log('Fetching issuances and burns from Ethplorer...');
    const ethplorerApiKey = process.env.NEXT_PUBLIC_ETHPLORER_API_KEY || 'freekey';
    
    // First, fetch mints with type=issuance
    const mintUrl = `https://api.ethplorer.io/getTokenHistory/${ESSENCE_TOKEN_ADDRESS}?apiKey=${ethplorerApiKey}&type=issuance&limit=500&timestamp=${timestamp}`;
    console.log('Mint URL:', mintUrl);
    
    const mintResponse = await fetch(mintUrl);
    
    if (!mintResponse.ok) {
      console.error('Ethplorer mint response error:', mintResponse.status, mintResponse.statusText);
      throw new Error(`Ethplorer API error: ${mintResponse.statusText}`);
    }
    
    const mintData = await mintResponse.json();
    
    if (!mintData.operations || !Array.isArray(mintData.operations)) {
      console.error('Unexpected Ethplorer mint response format:', mintData);
      throw new Error('Invalid mint response format from Ethplorer');
    }
    
    console.log(`Found ${mintData.operations.length} mint operations`);
    
    // Next, fetch burns (using type=burn)
    const burnUrl = `https://api.ethplorer.io/getTokenHistory/${ESSENCE_TOKEN_ADDRESS}?apiKey=${ethplorerApiKey}&type=burn&limit=500&timestamp=${timestamp}`;
    console.log('Burn URL:', burnUrl);
    
    const burnResponse = await fetch(burnUrl);
    
    if (!burnResponse.ok) {
      console.error('Ethplorer burn response error:', burnResponse.status, burnResponse.statusText);
      throw new Error(`Ethplorer API error: ${burnResponse.statusText}`);
    }
    
    const burnData = await burnResponse.json();
    
    if (!burnData.operations || !Array.isArray(burnData.operations)) {
      console.error('Unexpected Ethplorer burn response format:', burnData);
      throw new Error('Invalid burn response format from Ethplorer');
    }
    
    console.log(`Found ${burnData.operations.length} burn operations`);

    // Process all transactions
    const mintTransactions = mintData.operations.map((tx: EthplorerTransaction) => {
      return {
        transaction_hash: tx.transactionHash,
        block_number: 0, // Not provided by Ethplorer
        timestamp: new Date(tx.timestamp * 1000).toISOString(),
        from_address: ZERO_ADDRESS.toLowerCase(), // Mints come from zero address
        to_address: EARTH2_WITHDRAWAL_ADDRESS.toLowerCase(), // Mints go to Earth2
        value: tx.value.toString(), // Store value as string to avoid numeric overflow
        transaction_type: 'MINT',
        gas_used: '0',
        gas_price: '0', 
        method_id: '',
        method_name: ''
      };
    });
    
    const burnTransactions = burnData.operations.map((tx: EthplorerTransaction) => {
      return {
        transaction_hash: tx.transactionHash,
        block_number: 0,
        timestamp: new Date(tx.timestamp * 1000).toISOString(),
        from_address: EARTH2_WITHDRAWAL_ADDRESS.toLowerCase(), // Burns come from Earth2
        to_address: ZERO_ADDRESS.toLowerCase(), // Burns go to zero address
        value: tx.value.toString(),
        transaction_type: 'BURN',
        gas_used: '0',
        gas_price: '0',
        method_id: '',
        method_name: ''
      };
    });
    
    // Combine both types
    const allTransactions = [...mintTransactions, ...burnTransactions];
    
    // Sort by timestamp to ensure proper pagination
    allTransactions.sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
    
    console.log(`Total: ${allTransactions.length} transactions (${mintTransactions.length} mints, ${burnTransactions.length} burns)`);
    console.log('Issuances processed, starting database operations...');
    
    // Insert transactions into Supabase in smaller batches
    if (allTransactions.length > 0) {
      const batchSize = 50;
      console.log(`Inserting ${allTransactions.length} issuance transactions in batches of ${batchSize}...`);
      
      for (let i = 0; i < allTransactions.length; i += batchSize) {
        const batch = allTransactions.slice(i, i + batchSize);
        console.log(`Inserting batch ${i / batchSize + 1} of ${Math.ceil(allTransactions.length / batchSize)}...`);
        
        const { error } = await supabase
          .from('essence_transactions_history')
          .upsert(batch, {
            onConflict: 'transaction_hash',
            ignoreDuplicates: true
          });
          
        if (error) {
          console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
          throw new Error(`Supabase insert error: ${error.message}`);
        }
        
        console.log(`Successfully inserted batch ${i / batchSize + 1}`);
        
        // Add a delay between batches
        if (i + batchSize < allTransactions.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log('All issuance transaction batches inserted successfully');

      // Update the sync status for issuances
      if (allTransactions.length > 0) {
        const { error } = await supabase
          .from('essence_sync_status')
          .upsert({
            id: 2, // Using a different ID for issuances
            last_sync: new Date().toISOString(),
            last_timestamp: Math.floor(new Date(allTransactions[allTransactions.length - 1].timestamp).getTime() / 1000),
            transactions_processed: allTransactions.length,
            has_more: allTransactions.length >= 1000 // If we got 1000 transactions, there are likely more
          }, {
            onConflict: 'id'
          });

        if (error) {
          console.error('Error updating sync status:', error);
        }
      }
    }
    
    // Get the timestamp of the last transaction for pagination
    const lastTimestamp = allTransactions.length > 0 
      ? Math.floor(new Date(allTransactions[allTransactions.length - 1].timestamp).getTime() / 1000)
      : parseInt(timestamp);
    
    console.log('=== Issuances data fetch complete ===\n');
    
    return NextResponse.json({
      success: true,
      message: `Processed ${allTransactions.length} issuance transactions (${mintTransactions.length} mints, ${burnTransactions.length} burns)`,
      hasMore: allTransactions.length >= 1000, // If we hit our limit, there are likely more
      lastTimestamp,
      transactionsCount: allTransactions.length,
      mintCount: mintTransactions.length,
      burnCount: burnTransactions.length
    });
    
  } catch (error: any) {
    console.error('Error processing issuances data:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 