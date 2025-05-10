import { NextResponse } from 'next/server';

// Proxy route to fetch Earth2 global metrics from the r.earth2.io endpoint. Doing this server-side avoids CORS issues when the client requests the metrics directly.
const METRICS_URL = 'https://r.earth2.io/landing/metrics';

export async function GET() {
  try {
    console.log(`[API Route] Fetching Earth2 global metrics from ${METRICS_URL}`);
    // The request is done from the Next.js server runtime, so CORS is not a problem.
    const response = await fetch(METRICS_URL, {
      // Explicitly set no-cache to ensure fresh data but still allow browser/client to cache this route if desired.
      // Headers are generally not required for this public endpoint.
      // You can add 'Accept: application/json' if the upstream cares.
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const bodyText = await response.text();
      console.error(`[API Route] Upstream metrics fetch failed (${response.status}). Body:`, bodyText);
      return NextResponse.json({ error: `Failed to fetch metrics (${response.status})` }, { status: response.status });
    }

    // Attempt to parse as JSON first; if that fails, fall back to plain text so the client can handle it.
    let data: any = null;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch (err) {
      // Not valid JSON – return raw text.
      data = text;
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[API Route] Unexpected error while fetching metrics:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err?.message }, { status: 500 });
  }
} 