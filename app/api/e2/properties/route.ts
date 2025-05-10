import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

const E2_API_URL = 'https://r.earth2.io/landfields';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const page = searchParams.get('page') || '1';
  const perPage = searchParams.get('perPage') || '12';
  const sort = searchParams.get('sort');
  const search = searchParams.get('search');
  const searchTerms = searchParams.getAll('searchTerms[]');
  const letter = searchParams.get('letter');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }

  const fetchUrl = new URL(E2_API_URL);
  fetchUrl.searchParams.set('page', page);
  fetchUrl.searchParams.set('perPage', perPage);
  fetchUrl.searchParams.set('userId', userId);
  if (sort) {
    fetchUrl.searchParams.set('sort', sort);
  }
  if (search) {
    fetchUrl.searchParams.set('search', search);
  }
  if (searchTerms && searchTerms.length > 0) {
    for (const term of searchTerms) {
      fetchUrl.searchParams.append('searchTerms[]', term);
    }
  }
  if (letter) {
    fetchUrl.searchParams.set('letter', letter);
  }

  try {
    console.log(`[API Route] Fetching E2 properties from: ${fetchUrl.toString()}`);
    const response = await fetch(fetchUrl.toString(), {
      // You might need to mimic headers if the E2 API expects specific ones,
      // but often none are needed for public data.
      // headers: {
      //   'Accept': 'application/json',
      // }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[API Route] Error fetching from E2 API (${response.status}):`, errorBody);
      return NextResponse.json({ error: `Failed to fetch from Earth2 API: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    console.log(`[API Route] Successfully fetched E2 properties for user ${userId}.`);
    // Forward the successful response from E2 API
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("[API Route] Error in fetch-e2-properties handler:", error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
} 