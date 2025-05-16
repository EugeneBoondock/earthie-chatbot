import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface E2LandfieldAttributes {
  description: string;
  location: string;
  country?: string;
  center?: string; 
  thumbnail?: string;
  // Add other relevant fields from the actual r.earth2.io/landfields/{id} response
  // For example, based on your provided JSON:
  created?: string;
  epl?: string | null;
  sid?: number;
  price?: number;
  currentValue?: number;
  forSale?: boolean;
  hasMentar?: boolean;
  tileCount?: number;
  landfieldTier?: number;
  // ... and so on for any fields the frontend might need or you want to pass through
}

interface TransformedAttributes extends E2LandfieldAttributes {
  center_point?: string; 
  location_human_friendly?: string;
  name?: string;
  country_code?: string;
}

interface TransformedResponse {
  id: string;
  type: string;
  attributes: TransformedAttributes;
}

interface ErrorResponse {
  error: string;
  details?: string;
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
    console.log(`[API /e2/property/[id]] Fetching property ${id} from E2 API: ${E2_SINGLE_PROPERTY_API_URL}`);
    
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
      console.error(`[API /e2/property/[id]] E2 API error for ${id}: ${response.status}`, errorBody);
      return NextResponse.json({ 
        error: `Failed to fetch property from Earth2 API. Status: ${response.status}`,
        details: errorBody.message || JSON.stringify(errorBody)
      }, { status: response.status });
    }

    const data: E2LandfieldAttributes = await response.json();

    if (!data) {
        console.error(`[API /e2/property/[id]] Malformed response from E2 API for ${id}:`, data);
        return NextResponse.json({ error: 'Received malformed data from Earth2 API.' }, { status: 500 });
    }
    
    const transformedAttributes: TransformedAttributes = {
      ...data,
      center_point: data.center ? data.center.replace(/[()]/g, '') : undefined, // Convert "(lat,lng)" to "lat,lng"
      location_human_friendly: data.location, 
      name: data.description, 
      country_code: data.country,
    };

    const responseData: TransformedResponse = {
      id: id,
      type: 'landfield', // Consistent type
      attributes: transformedAttributes
    };

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error(`[API /e2/property/[id]] Internal server error for ${id}:`, error);
    return NextResponse.json({ 
      error: 'Internal server error while fetching property.',
      details: error.message 
    }, { status: 500 });
  }
}
