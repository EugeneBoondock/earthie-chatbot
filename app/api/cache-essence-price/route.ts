import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabaseClient';

// Earth2 Essence token address
const ESSENCE_TOKEN_ADDRESS = '0x2c0687215Aca7F5e2792d956E170325e92A02aCA'.toLowerCase();

export async function GET() {
  try {
    const moralisKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY;
    if (!moralisKey) {
      return NextResponse.json({ error: 'Missing Moralis API key' }, { status: 500 });
    }
    // Determine today's date in YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // Fetch latest price from Moralis
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

    // Upsert today's price into Supabase (table 'essence_daily_prices')
    const { error } = await supabase
      .from('essence_daily_prices')
      .upsert({ date: today, price: usdPrice }, { onConflict: 'date' });
    if (error) {
      throw error;
    }

    return NextResponse.json({ date: today, price: usdPrice, success: true });
  } catch (err: any) {
    console.error('Error in cache-essence-price:', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
