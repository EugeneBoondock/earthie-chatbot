import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const ESSENCE_TOKEN_ADDRESS = "0x2c0687215aca7f5e2792d956e170325e92a02aca";
const EARTH2_WITHDRAWAL_ADDRESS = "0x68d332EC97800Aa1a112160195cc281978eC8Eea";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface EtherscanTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  methodId: string;
  functionName: string;
}

// Helper function to determine transaction type
function determineTransactionType(tx: EtherscanTransaction): 'MINT' | 'BURN' | 'WITHDRAWAL' | 'DEPOSIT' | 'BUY' | 'SELL' | 'TRANSFER' {
  const fromLower = tx.from.toLowerCase();
  const toLower = tx.to.toLowerCase();
  const earth2Lower = EARTH2_WITHDRAWAL_ADDRESS.toLowerCase();
  const zeroLower = ZERO_ADDRESS.toLowerCase();

  // Check for MINT (from zero address to Earth2)
  if (fromLower === zeroLower && toLower === earth2Lower) {
    return 'MINT';
  }
  
  // Check for BURN (from Earth2 to zero address)
  if (fromLower === earth2Lower && toLower === zeroLower) {
    return 'BURN';
  }
  
  // Check for WITHDRAWAL (from Earth2 to other wallets with TransferBatch)
  if (fromLower === earth2Lower && tx.methodId === '0x4a39dc06') {
    return 'WITHDRAWAL';
  }
  
  // Check for DEPOSIT (from other wallets to Earth2)
  if (toLower === earth2Lower && fromLower !== zeroLower) {
    return 'DEPOSIT';
  }
  
  // Check for BUY/SELL
  if (tx.methodId === '0x') { // Add specific method IDs for buys/sells if known
    return fromLower === earth2Lower ? 'SELL' : 'BUY';
  }
  
  return 'TRANSFER';
}

export async function GET(request: Request) {
  try {
    console.log('Starting historical data fetch...');
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    console.log('Page:', page);
    
    // Get the latest processed block from Supabase
    console.log('Fetching latest processed block from Supabase...');
    const { data: latestTxs, error: supabaseError } = await supabase
      .from('essence_transactions_history')
      .select('block_number')
      .order('block_number', { ascending: false })
      .limit(1);
      
    if (supabaseError) {
      console.error('Supabase error:', supabaseError);
      throw new Error(`Supabase query error: ${supabaseError.message}`);
    }
    
    const startBlock = latestTxs && latestTxs.length > 0 ? latestTxs[0].block_number + 1 : 0;
    console.log('Start block:', startBlock);
    
    // Fetch transactions from Etherscan
    console.log('Fetching from Etherscan...');
    const etherscanApiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
    if (!etherscanApiKey) {
      throw new Error('Missing Etherscan API key');
    }
    
    const etherscanUrl = `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${ESSENCE_TOKEN_ADDRESS}&startblock=${startBlock}&endblock=999999999&page=${page}&offset=1000&sort=asc&apikey=${etherscanApiKey}`;
    console.log('Etherscan URL:', etherscanUrl);
    
    const response = await fetch(etherscanUrl);
    
    if (!response.ok) {
      console.error('Etherscan response error:', response.status, response.statusText);
      throw new Error(`Etherscan API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Etherscan response status:', data.status, 'message:', data.message);
    
    if (data.status !== '1') {
      throw new Error(`Etherscan API error: ${data.message}`);
    }

    if (!Array.isArray(data.result)) {
      console.error('Unexpected Etherscan response format:', data);
      throw new Error('Invalid response format from Etherscan');
    }
    
    console.log(`Processing ${data.result.length} transactions...`);
    
    // Process transactions
    const transactions = data.result.map((tx: EtherscanTransaction) => {
      try {
        const txType = determineTransactionType(tx);
        return {
          transaction_hash: tx.hash,
          block_number: parseInt(tx.blockNumber),
          timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
          from_address: tx.from.toLowerCase(),
          to_address: tx.to.toLowerCase(),
          value: (parseInt(tx.value) / 1e18).toString(), // Convert from wei to ESS
          transaction_type: txType.toString(), // Convert enum to string
          gas_used: tx.gasUsed,
          gas_price: tx.gasPrice,
          method_id: tx.methodId,
          method_name: tx.functionName
        };
      } catch (error) {
        console.error('Error processing transaction:', tx, error);
        throw error;
      }
    });
    
    // Insert transactions into Supabase in batches to avoid conflicts
    if (transactions.length > 0) {
      console.log('Inserting transactions in batches...');
      const batchSize = 100;
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(transactions.length / batchSize)}`);
        
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
        
        // Add a small delay between batches
        if (i + batchSize < transactions.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Update daily stats
      console.log('Updating daily stats...');
      await updateDailyStats(transactions);
    }
    
    // Update sync status
    console.log('Updating sync status...');
    const { error: syncError } = await supabase
      .from('essence_sync_status')
      .upsert([{
        id: 1,
        last_sync: new Date().toISOString(),
        pages_processed: page,
        transactions_processed: transactions.length,
        has_more: transactions.length === 1000
      }], { 
        onConflict: 'id',
        ignoreDuplicates: true 
      });

    if (syncError) {
      console.error('Error updating sync status:', syncError);
    }
    
    return NextResponse.json({
      success: true,
      message: `Processed ${transactions.length} transactions`,
      hasMore: transactions.length === 1000,
      transactionsCount: transactions.length
    });
    
  } catch (error: any) {
    console.error('Error processing historical data:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

async function updateDailyStats(transactions: any[]) {
  // Group transactions by date
  const dailyStats = transactions.reduce((acc: any, tx: any) => {
    const date = tx.timestamp.split('T')[0];
    if (!acc[date]) {
      acc[date] = {
        total_minted: 0,
        total_burned: 0,
        total_withdrawn: 0,
        total_deposited: 0,
        total_bought: 0,
        total_sold: 0,
        unique_buyers: new Set(),
        unique_sellers: new Set(),
        transaction_count: 0
      };
    }
    
    const value = parseFloat(tx.value);
    switch (tx.transaction_type) {
      case 'MINT':
        acc[date].total_minted += value;
        break;
      case 'BURN':
        acc[date].total_burned += value;
        break;
      case 'WITHDRAWAL':
        acc[date].total_withdrawn += value;
        break;
      case 'DEPOSIT':
        acc[date].total_deposited += value;
        break;
      case 'BUY':
        acc[date].total_bought += value;
        acc[date].unique_buyers.add(tx.from_address);
        break;
      case 'SELL':
        acc[date].total_sold += value;
        acc[date].unique_sellers.add(tx.from_address);
        break;
    }
    acc[date].transaction_count++;
    return acc;
  }, {});
  
  // Prepare daily stats for upsert
  const statsToUpsert = Object.entries(dailyStats).map(([date, stats]: [string, any]) => ({
    date,
    ...stats,
    unique_buyers: stats.unique_buyers.size,
    unique_sellers: stats.unique_sellers.size
  }));
  
  // Upsert daily stats
  if (statsToUpsert.length > 0) {
    const { error } = await supabase
      .from('essence_stats_daily')
      .upsert(statsToUpsert, {
        onConflict: 'date'
      });
      
    if (error) {
      console.error('Error updating daily stats:', error);
    }
  }
} 