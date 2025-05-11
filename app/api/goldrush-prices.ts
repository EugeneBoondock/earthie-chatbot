import type { NextApiRequest, NextApiResponse } from 'next';

// This API route proxies requests to GoldRush.dev to avoid CORS issues and keep the API key secret
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { address, pointsCount = 30 } = req.query;
  const goldrushKey = process.env.NEXT_PUBLIC_GOLDRUSH_API_KEY;
  if (!goldrushKey) {
    res.status(500).json({ error: 'GoldRush API key not set' });
    return;
  }
  if (!address || typeof address !== 'string') {
    res.status(400).json({ error: 'Missing or invalid address' });
    return;
  }

  const url = `https://api.goldrush.dev/v1/pricing/historical_by_addresses_v2/eth-mainnet/USD/${address}?prices-at-asc=true`;
  try {
    const goldrushRes = await fetch(url, {
      headers: { Authorization: `Bearer ${goldrushKey}` },
    });
    if (!goldrushRes.ok) {
      const text = await goldrushRes.text();
      res.status(goldrushRes.status).json({ error: text });
      return;
    }
    const data = await goldrushRes.json();
    if (!Array.isArray(data.prices)) {
      res.status(500).json({ error: 'Malformed GoldRush response', data });
      return;
    }
    // Only return the last N points
    const prices = data.prices.slice(-Number(pointsCount));
    res.status(200).json({ prices });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'GoldRush proxy error' });
  }
}
