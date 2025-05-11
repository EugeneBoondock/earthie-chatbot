// This API route allows you to backfill the last 30 days of hourly prices
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ESSENCE_TOKEN_ADDRESS = '0x2c0687215Aca7F5e2792d956E170325e92A02aCA'.toLowerCase();

// Helper function to initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required environment variables for Supabase connection');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function POST() {
  try {
    const supabase = getSupabaseClient();
    const moralisKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
    if (!moralisKey) {
      return NextResponse.json({ error: 'Missing Moralis API key' }, { status: 500 });
    }
    const now = new Date();
    // 30 days = 720 hours
    let successCount = 0;
    for (let i = 0; i < 720; i++) {
      const dt = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hour = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), dt.getUTCHours()));
      // Check if already exists
      const { data: exists } = await supabase
        .from('essence_hourly_prices')
        .select('timestamp')
        .eq('timestamp', hour.toISOString());
      if (exists && exists.length > 0) continue;
      const priceRes = await fetch(
        `https://deep-index.moralis.io/api/v2/erc20/${ESSENCE_TOKEN_ADDRESS}/price?chain=eth`,
        { headers: { 'X-API-Key': moralisKey } }
      );
      if (!priceRes.ok) continue;
      const priceJson = await priceRes.json();
      const usdPrice = priceJson.usdPrice;
      if (typeof usdPrice !== 'number') continue;
      await supabase
        .from('essence_hourly_prices')
        .upsert({
          timestamp: hour.toISOString(),
          price: usdPrice
        }, { onConflict: 'timestamp' });
      successCount++;
      await new Promise(res => setTimeout(res, 350)); // avoid rate limits
    }
    return NextResponse.json({ success: true, hoursBackfilled: successCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
