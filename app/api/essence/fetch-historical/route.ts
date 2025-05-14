import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Add dynamic route configuration
export const dynamic = 'force-dynamic';

const ESSENCE_TOKEN_ADDRESS = "0x2c0687215aca7f5e2792d956e170325e92a02aca";
const EARTH2_WITHDRAWAL_ADDRESS = "0x68d332EC97800Aa1a112160195cc281978eC8Eea";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TREASURY_ADDRESS_1 = "0x5086d1e7314d9c24A9c4386dcedEEC5549502989";
const TREASURY_ADDRESS_2 = "0x40399dE3a3ca6a9dF0D04C62d20DD08b8EAfe280";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface EthploperTransaction {
  timestamp: number;
  transactionHash: string;
  value: string;
  from: string;
  to: string;
  input: string;
  success: boolean;
  type: string;
}

// Helper function to determine transaction type
function determineTransactionType(tx: EthploperTransaction): 'MINT' | 'BURN' | 'WITHDRAWAL' | 'DEPOSIT' | 'BUY' | 'SELL' | 'TRANSFER' | 'TREASURY' {
  const fromLower = tx.from.toLowerCase();
  const toLower = tx.to.toLowerCase();
  const earth2Lower = EARTH2_WITHDRAWAL_ADDRESS.toLowerCase();
  const zeroLower = ZERO_ADDRESS.toLowerCase();
  const treasury1Lower = TREASURY_ADDRESS_1.toLowerCase();
  const treasury2Lower = TREASURY_ADDRESS_2.toLowerCase();

  // Check if this is a transfer between treasury wallets
  if ((fromLower === treasury1Lower && toLower === treasury2Lower) || 
      (fromLower === treasury2Lower && toLower === treasury1Lower)) {
    return 'TREASURY';
  }
  
  // Check for MINT (from zero address to Earth2)
  if (fromLower === zeroLower && toLower === earth2Lower) {
    return 'MINT';
  }
  
  // Check for BURN (from Earth2 to zero address)
  if (fromLower === earth2Lower && toLower === zeroLower) {
    return 'BURN';
  }
  
  // Check for TREASURY transactions (from Earth2 to treasury wallets)
  if (fromLower === earth2Lower && (toLower === treasury1Lower || toLower === treasury2Lower)) {
    return 'TREASURY';
  }
  
  // Check for WITHDRAWAL (from Earth2 to other wallets, excluding treasury)
  if (fromLower === earth2Lower) {
    return 'WITHDRAWAL';
  }
  
  // Check for DEPOSIT (from other wallets to Earth2)
  if (toLower === earth2Lower && fromLower !== zeroLower) {
    return 'DEPOSIT';
  }
  
  // Special case for transfers involving treasury wallets
  if (fromLower === treasury1Lower || fromLower === treasury2Lower || 
      toLower === treasury1Lower || toLower === treasury2Lower) {
    return 'TREASURY';
  }
  
  // Check for BUY/SELL based on Earth2 involvement
  if (fromLower === earth2Lower) {
    return 'SELL';
  } else if (toLower === earth2Lower) {
    return 'BUY';
  }
  
  return 'TRANSFER';
}

export async function GET(request: Request) {
  try {
    console.log('\n=== Starting historical data fetch ===');
    
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get('timestamp') || '0';
    console.log('Timestamp:', timestamp);
    
    // Fetch transactions from Ethplorer
    console.log('Fetching from Ethplorer...');
    const ethplorerApiKey = process.env.NEXT_PUBLIC_ETHPLORER_API_KEY || 'freekey';
    
    // Use Ethplorer's getTokenHistory endpoint
    const ethplorerUrl = `https://api.ethplorer.io/getTokenHistory/${ESSENCE_TOKEN_ADDRESS}?apiKey=${ethplorerApiKey}&type=transfer&limit=1000&timestamp=${timestamp}`;
    console.log('Ethplorer URL:', ethplorerUrl);
    
    const response = await fetch(ethplorerUrl);
    
    if (!response.ok) {
      console.error('Ethplorer response error:', response.status, response.statusText);
      throw new Error(`Ethplorer API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.operations || !Array.isArray(data.operations)) {
      console.error('Unexpected Ethplorer response format:', data);
      throw new Error('Invalid response format from Ethplorer');
    }

    console.log(`Processing ${data.operations.length} transactions...`);

    // Process transactions
    const transactions = data.operations.map((tx: EthploperTransaction) => ({
      transaction_hash: tx.transactionHash,
      block_number: 0, // Ethplorer doesn't provide block numbers directly
      timestamp: new Date(tx.timestamp * 1000).toISOString(),
      from_address: tx.from.toLowerCase(),
      to_address: tx.to.toLowerCase(),
      value: tx.value.toString(), // Store value as string to avoid numeric overflow
      transaction_type: determineTransactionType(tx),
      gas_used: '0', // Not provided by Ethplorer in this endpoint
      gas_price: '0', // Not provided by Ethplorer in this endpoint
      method_id: '', // Not provided by Ethplorer in this endpoint
      method_name: '' // Not provided by Ethplorer in this endpoint
    }));
    
    console.log('Transactions processed, starting database operations...');
    
    // Insert transactions into Supabase in smaller batches
    if (transactions.length > 0) {
      const batchSize = 50;
      console.log(`Inserting ${transactions.length} transactions in batches of ${batchSize}...`);
      
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize);
        console.log(`Inserting batch ${i / batchSize + 1} of ${Math.ceil(transactions.length / batchSize)}...`);
        
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
        if (i + batchSize < transactions.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log('All transaction batches inserted successfully');
    }
    
    // Get the timestamp of the last transaction for pagination
    const lastTimestamp = transactions.length > 0 
      ? Math.floor(new Date(transactions[transactions.length - 1].timestamp).getTime() / 1000)
      : parseInt(timestamp);
    
    console.log('=== Historical data fetch complete ===\n');
    
    return NextResponse.json({
      success: true,
      message: `Processed ${transactions.length} transactions`,
      hasMore: transactions.length === 1000, // Ethplorer returns max 1000 transactions
      lastTimestamp,
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