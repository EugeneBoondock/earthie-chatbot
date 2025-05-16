import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Helper interface for E2 property data structure (subset relevant for saving)
interface E2PropertyDetails {
    id: string;
    description?: string | null;
    thumbnail?: string | null;
    tileCount?: number | null;
    owner?: {
        id: string;
        username?: string;
    } | null;
    location?: string | null;
    country?: string | null;
    tileClass?: number | string | null;
    landfieldTier?: number | null;
    currentValue?: number | string | null;
    purchaseValue?: number | string | null;
    epl?: string | null;
    center?: string | null;
    // Add other fields as needed
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  if (!id || !/^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid property ID format. Expected UUID.' }, { status: 400 });
  }

  const E2_SINGLE_PROPERTY_API_URL = `https://r.earth2.io/landfields/${id}`;

  try {
    const response = await fetch(E2_SINGLE_PROPERTY_API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (e) {
        errorBody = { message: response.statusText };
      }
      return NextResponse.json({ 
        error: `Failed to fetch property from Earth2 API. Status: ${response.status}`,
        details: errorBody.message || JSON.stringify(errorBody)
      }, { status: response.status });
    }

    // The E2 API returns a flat object, not wrapped in 'data' or 'attributes'
    const data: E2PropertyDetails = await response.json();

    if (!data || !data.id) {
      return NextResponse.json({ error: 'Received malformed data from Earth2 API.' }, { status: 500 });
    }

    // Return the flat property data
    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Internal server error while fetching property.',
      details: error.message 
    }, { status: 500 });
  }
}
