import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to save prices to Supabase
async function savePricesToSupabase(tokenAddress: string, prices: { date: string; price: number }[]) {
  try {
    const pricesToUpsert = prices.map(p => ({
      date: new Date(p.date).toISOString(),
      price: p.price,
      token_address: tokenAddress.toLowerCase()
    }));

    const { error } = await supabase
      .from('essence_hourly_prices')
      .upsert(
        pricesToUpsert,
        { 
          onConflict: 'token_address,date',
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

// Earth2 Essence token address
const ESSENCE_TOKEN_ADDRESS = '0x2c0687215Aca7F5e2792d956E170325e92A02aCA'.toLowerCase();

// GET: Fetch last N hours of price history (default: 720 = 30 days)
export async function GET(req: NextRequest) {
  try {
    const moralisKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
    if (!moralisKey) {
      return NextResponse.json({ error: 'Missing Moralis API key' }, { status: 500 });
    }
    // Parse ?hours=N from query
    const url = new URL(req.url);
    const hours = parseInt(url.searchParams.get('hours') || '720', 10); // default 720 = 30 days
    const now = new Date();
    const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

    // Fetch from Supabase
    const { data: rows, error } = await supabase
      .from('essence_hourly_prices')
      .select('date, price')
      .eq('token_address', ESSENCE_TOKEN_ADDRESS)
      .gte('date', cutoff.toISOString())
      .order('date', { ascending: true });
    if (error) {
      throw error;
    }
    let prices = rows || [];

    // If latest hour is missing, fetch from Moralis and upsert
    const lastHour = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
    const lastCached = prices.length ? new Date(prices[prices.length - 1].date) : null;
    if (!lastCached || lastCached.getTime() < lastHour.getTime()) {
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
              date: lastHour.toISOString(),
              price: usdPrice,
              token_address: ESSENCE_TOKEN_ADDRESS
            }, { onConflict: 'token_address,date' });
          prices.push({ date: lastHour.toISOString(), price: usdPrice });
        }
      }
    }
    return NextResponse.json({ prices });
  } catch (err: any) {
    console.error('Error in cache-essence-price:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

// POST: Upsert current hour's price (for cron job)
export async function POST() {
  try {
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
        date: hour.toISOString(),
        price: usdPrice,
        token_address: ESSENCE_TOKEN_ADDRESS
      }, { onConflict: 'token_address,date' });
    // Also upsert daily for backward compatibility
    const today = hour.toISOString().split('T')[0];
    await supabase
      .from('essence_daily_prices')
      .upsert({ date: today, price: usdPrice }, { onConflict: 'date' });
    return NextResponse.json({ date: hour.toISOString(), price: usdPrice, success: true });
  } catch (err: any) {
    console.error('Error in cache-essence-price POST:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
