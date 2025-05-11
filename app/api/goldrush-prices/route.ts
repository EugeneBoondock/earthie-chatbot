import { NextRequest } from 'next/server';

// Base URL for the Covalent API
const COVALENT_API_BASE_URL = 'https://api.covalenthq.com/v1';

// Helper function to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tokenAddress = searchParams.get('address');
  const pointsCount = Number(searchParams.get('pointsCount') || 30);
  const goldrushKey = process.env.NEXT_PUBLIC_GOLDRUSH_API_KEY;

  if (!goldrushKey) {
    return new Response(JSON.stringify({ error: 'GoldRush API key not set' }), { status: 500 });
  }
  if (!tokenAddress) {
    return new Response(JSON.stringify({ error: 'Missing address' }), { status: 400 });
  }

  // Using eth-mainnet and USD as per common usage; chain might need mapping in a real app
  const chainName = 'eth-mainnet'; 
  const quoteCurrency = 'USD';

  const toDate = new Date();
  const fromDate = new Date();
  // Ensure pointsCount is at least 1 to avoid issues with setDate
  const daysToSubtract = pointsCount > 0 ? pointsCount -1 : 0; 
  fromDate.setDate(toDate.getDate() - daysToSubtract);

  const toDateFormatted = formatDate(toDate);
  const fromDateFormatted = formatDate(fromDate);

  const url = `${COVALENT_API_BASE_URL}/pricing/historical_by_addresses_v2/${chainName}/${quoteCurrency}/${tokenAddress}/?key=${goldrushKey}&from=${fromDateFormatted}&to=${toDateFormatted}`;

  try {
    const goldrushRes = await fetch(url, {
      method: 'GET',
      headers: {
        // The key is passed as a query param, but some APIs use Authorization Bearer token.
        // Covalent's pricing API uses the key in the query string.
        // If an Auth header was needed: 'Authorization': `Bearer ${goldrushKey}`
      },
    });

    if (!goldrushRes.ok) {
      const errorBody = await goldrushRes.text();
      console.error(`[GoldRush API Fetch Error] Status: ${goldrushRes.status}`, { tokenAddress, url, errorBody });
      return new Response(JSON.stringify({ error: `GoldRush API request failed with status ${goldrushRes.status}`, details: errorBody }), {
        status: goldrushRes.status,
      });
    }

    const jsonResponse = await goldrushRes.json();

    if (jsonResponse.error) {
      console.error('[GoldRush API Error Response]', { tokenAddress, url, errorCode: jsonResponse.error_code, errorMessage: jsonResponse.error_message });
      return new Response(JSON.stringify({ error: jsonResponse.error_message || 'GoldRush API error', code: jsonResponse.error_code }), {
        status: jsonResponse.error_code ? 400 : 500, // Attempt to use a more specific status if available
      });
    }

    if (!jsonResponse.data || !Array.isArray(jsonResponse.data) || jsonResponse.data.length === 0 || !jsonResponse.data[0] || !Array.isArray(jsonResponse.data[0].prices)) {
      console.error('[GoldRush API Error] Malformed response: Expected jsonResponse.data[0].prices to be an array.', { tokenAddress, url, responseData: jsonResponse.data });
      return new Response(JSON.stringify({ error: 'Malformed GoldRush API response structure' }), { status: 500 });
    }

    const rawPrices = jsonResponse.data[0].prices;

    if (rawPrices.length === 0) {
      return new Response(JSON.stringify({ prices: [] }), { status: 200 });
    }

    // Sort by date ascending if not already (API docs suggest prices-at-asc=true, but let's be safe or assume default)
    // Covalent historical_by_addresses_v2 returns prices sorted by date descending by default.
    // To get the latest N points, we take from the start of the array if it's descending.
    // If it were ascending, we would take from the end.
    // Let's assume it's descending (latest first) as per default Covalent behavior.
    const sortedPrices = rawPrices.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const selectedPrices = sortedPrices.slice(0, pointsCount).reverse(); // Take latest N, then reverse to make it ascending for charts


    const prices = selectedPrices.map((item: any) => ({
      time: item.date, // Use item.date directly (should be YYYY-MM-DD)
      price: item.price,
    }));

    return new Response(JSON.stringify({ prices }), { status: 200 });

  } catch (err: any) {
    console.error('[GoldRush API General Catch Error]', { tokenAddress, url, errorMessage: err?.message, errorStack: err?.stack });
    return new Response(JSON.stringify({ error: err?.message || 'GoldRush API general processing error' }), { status: 500 });
  }
}
