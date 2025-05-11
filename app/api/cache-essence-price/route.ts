import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Earth2 Essence token address
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

// Helper function to save prices to Supabase
async function savePricesToSupabase(tokenAddress: string, prices: { date: string; price: number }[]) {
  try {
    const supabase = getSupabaseClient();
    const pricesToUpsert = prices.map(p => ({
      timestamp: new Date(p.date).toISOString(),
      price: p.price
    }));

    const { error } = await supabase
      .from('essence_hourly_prices')
      .upsert(
        pricesToUpsert,
        { 
          onConflict: 'timestamp',
          ignoreDuplicates: true 
        }
      );

    if (error) {
      console.error('[Supabase Save Error]', error);
    }
  } catch (err) {
    console.error('[Supabase Operation Error]', err);
  }
}

// GET: Fetch last N hours of price history (default: 720 = 30 days)
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
    // Parse ?hours=N from query
    const url = new URL(req.url);
    const hours = parseInt(url.searchParams.get('hours') || '720', 10); // default 720 = 30 days
    const now = new Date();
    const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

    // Fetch from Supabase
    const { data: rows, error } = await supabase
      .from('essence_hourly_prices')
      .select('timestamp, price')
      .gte('timestamp', cutoff.toISOString())
      .order('timestamp', { ascending: true });
    if (error) {
      throw error;
    }
    let prices = rows || [];

    // If latest hour is missing, attempt to fetch current price from Moralis
    const lastHour = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
    const lastCached = prices.length ? new Date(prices[prices.length - 1].timestamp) : null;

    if (!lastCached || lastCached.getTime() < lastHour.getTime()) {
      const moralisKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;

      if (moralisKey) {
        try {
          const priceRes = await fetch(
            `https://deep-index.moralis.io/api/v2/erc20/${ESSENCE_TOKEN_ADDRESS}/price?chain=eth`,
            { headers: { 'X-API-Key': moralisKey } }
          );

          if (priceRes.ok) {
            const priceJson = await priceRes.json();
            const usdPrice = priceJson.usdPrice;

            if (typeof usdPrice === 'number') {
              // Upsert to Supabase
              await supabase
                .from('essence_hourly_prices')
                .upsert({
                  timestamp: lastHour.toISOString(),
                  price: usdPrice
                }, { onConflict: 'timestamp' });

              prices.push({ timestamp: lastHour.toISOString(), price: usdPrice });
            }
          } else {
            console.warn('[Moralis Fetch Warning]', priceRes.status, priceRes.statusText);
          }
        } catch (fetchErr) {
          console.error('[Moralis Fetch Error]', fetchErr);
        }
      } else {
        // Moralis key missing; skip live fetch and just return cached data
        console.warn('[Moralis] API key not set – returning cached Essence prices only');
      }
    }
    return NextResponse.json({ prices: prices.map(p => ({ date: p.timestamp, price: p.price })) });
  } catch (err: any) {
    console.error('Error in cache-essence-price:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

// POST: Upsert current hour's price (for cron job)
export async function POST() {
  try {
    const supabase = getSupabaseClient();
    const moralisKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
    if (!moralisKey) {
      return NextResponse.json({ error: 'Missing Moralis API key' }, { status: 500 });
    }
    const now = new Date();
    const hour = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
    const priceRes = await fetch(
      `https://deep-index.moralis.io/api/v2/erc20/${ESSENCE_TOKEN_ADDRESS}/price?chain=eth`,
      { headers: { 'X-API-Key': moralisKey } }
    );
    if (!priceRes.ok) {
      throw new Error(`Moralis price fetch failed: ${priceRes.statusText}`);
    }
    const priceJson = await priceRes.json();
    const usdPrice = priceJson.usdPrice;
    if (typeof usdPrice !== 'number') {
      throw new Error('Invalid USD price from Moralis');
    }
    await supabase
      .from('essence_hourly_prices')
      .upsert({
        timestamp: hour.toISOString(),
        price: usdPrice
      }, { onConflict: 'timestamp' });
    // Also upsert daily for backward compatibility
    const today = hour.toISOString().split('T')[0];
    await supabase
      .from('essence_price_history')
      .upsert({ 
        date: today, 
        price: usdPrice,
        created_at: new Date().toISOString()
      }, { onConflict: 'date' });
    return NextResponse.json({ date: hour.toISOString(), price: usdPrice, success: true });
  } catch (err: any) {
    console.error('Error in cache-essence-price POST:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
