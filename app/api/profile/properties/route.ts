import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
// Use relative path to ensure correct file is imported
import type { Database } from '../../../../lib/database.types'; 

// Helper interface for E2 property data structure (subset relevant for saving)
// Matches structure from https://r.earth2.io/landfields/{propertyId}
interface E2PropertyDetails {
    id: string;
    description?: string | null;
    thumbnail?: string | null;
    tileCount?: number | null;
    owner?: {
        id: string;
        username?: string;
    } | null;
    // Add other fields you want to save from the E2 API response
    location?: string | null;
    country?: string | null;
    tileClass?: number | string | null;
    landfieldTier?: number | null;
    currentValue?: number | string | null;
    purchaseValue?: number | string | null;
    epl?: string | null;
}

// Interface for the structure of the paginated response from E2 API
interface E2PropertyData {
    id: string;
    type: string;
    attributes: E2PropertyDetails; // Reuse details, assuming attributes match
}

interface E2PropertiesResponse {
  data: E2PropertyData[];
  meta?: {
    count: number;
    current_page?: number;
    last_page?: number;
    per_page?: number;
  };
  links?: {
    first?: string;
    last?: string;
    prev?: string | null;
    next?: string | null;
  };
}

// --- GET Handler: Fetch tracked properties for the logged-in user ---
export async function GET(request: Request) {
  const cookieStore = cookies(); // Get cookie store directly
  const supabase = createServerClient( // Initialize directly
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Note: Server components/Route Handlers might not need set/remove
        // as they often operate on read-only headers after middleware.
        // Keep them for completeness for now, but they might be removable.
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            console.error(`[API GET] Error setting cookie ${name}:`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            console.error(`[API GET] Error removing cookie ${name}:`, error);
          }
        },
      },
    }
  );
  console.log('[API GET /profile/properties] Received request.'); // Log entry

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // Log session status
    if (sessionError) {
        console.error('[API GET /profile/properties] Session Error:', sessionError.message);
    } else {
        console.log('[API GET /profile/properties] Session found:', !!session);
        if (session) {
            console.log('[API GET /profile/properties] User ID:', session.user.id);
        } else {
             console.log('[API GET /profile/properties] No active session found in cookies.');
        }
    }

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: trackedProperties, error: selectError } = await supabase
      .from('user_tracked_properties') // Ensure this table name matches yours
      .select('property_id, description, thumbnail_url') // Select desired columns
      .eq('user_id', session.user.id);

    if (selectError) {
      console.error('[API GET /profile/properties] Supabase select error:', selectError);
      throw selectError;
    }

    return NextResponse.json(trackedProperties || []);

  } catch (error: any) {
    console.error('[API GET /profile/properties] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

// --- POST Handler: Sync ALL properties for the user ---
export async function POST(request: Request) {
  const cookieStore = cookies(); // Get cookie store directly
  const supabase = createServerClient( // Initialize directly
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { /* ... same cookie handlers as in GET ... */ 
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            console.error(`[API POST] Error setting cookie ${name}:`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            console.error(`[API POST] Error removing cookie ${name}:`, error);
          }
        },
      }
    }
  );
  console.log('[API POST /profile/properties] Received request.');

  // ------------------------------------------------------------
  // 1) QUICK PATH: Single property add when body contains { propertyId }
  // ------------------------------------------------------------
  try {
    const maybeBodyText = await request.text();
    let maybeJson: any = null;
    if (maybeBodyText) {
      try { maybeJson = JSON.parse(maybeBodyText); } catch (_) { /* ignore parse error */ }
    }

    if (maybeJson && typeof maybeJson.propertyId === 'string') {
      const singlePropertyId = maybeJson.propertyId.trim();
      console.log(`[API POST /profile/properties] Single-add flow for property ${singlePropertyId}`);

      // Authenticate user
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !session) {
        console.error('[API POST /profile/properties] Auth error (single-add):', sessionErr?.message || 'No session');
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      // Try to fetch minimal property details for nicer display (non-fatal if fails)
      let propDescription: string | null = null;
      let propThumb: string | null = null;
      let propTileCount: number | null = null;
      try {
        const detailRes = await fetch(`https://r.earth2.io/landfields/${singlePropertyId}`);
        if (detailRes.ok) {
          const detailJson: any = await detailRes.json();
          const details = detailJson?.data?.attributes || detailJson?.attributes || detailJson;
          propDescription = details?.description || null;
          propThumb = details?.thumbnail || null;
          propTileCount = typeof details?.tileCount === 'number' ? details.tileCount : null;
        } else {
          console.warn(`[API POST /profile/properties] Could not fetch property details (${detailRes.status}). Continuing with basic insert.`);
        }
      } catch (fetchErr) {
        console.warn('[API POST /profile/properties] Property detail fetch failed:', fetchErr);
      }

      // Upsert into table
      const { error: insertErr } = await supabase
        .from('user_tracked_properties')
        .upsert({
          user_id: session.user.id,
          property_id: singlePropertyId,
          description: propDescription,
          thumbnail_url: propThumb,
          tile_count: propTileCount,
        }, { onConflict: 'user_id, property_id' });

      if (insertErr) {
        console.error('[API POST /profile/properties] Supabase upsert error (single-add):', insertErr);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, propertyId: singlePropertyId, propertyName: propDescription });
    }
  } catch (quickPathErr: any) {
    console.error('[API POST /profile/properties] Quick-path handler error:', quickPathErr);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // ------------------------------------------------------------
  // 2) SYNC PATH: Full portfolio sync when no propertyId provided
  // ------------------------------------------------------------
  let sessionUserId: string | null = null;

  try {
    // Step 0: Authentication
    console.log('[API SYNC /profile/properties] Checking session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('[API SYNC /profile/properties] Authentication failed:', sessionError?.message || 'No session');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    sessionUserId = session.user.id;
    console.log(`[API SYNC /profile/properties] User authenticated: ${sessionUserId}`);

    // Step 1: Get user's linked E2 ID
    console.log(`[API SYNC /profile/properties] Fetching linked E2 ID for user: ${sessionUserId}`);
    const { data: profileData, error: profileError } = await supabase
      .from('user_e2_profiles') 
      .select('e2_user_id') 
      .eq('user_id', sessionUserId) 
      .single();

    if (profileError || !profileData?.e2_user_id) {
      console.error('[API SYNC /profile/properties] Profile/E2 ID fetch error:', profileError?.message || 'Profile or E2 ID not found');
      return NextResponse.json({ error: 'Could not find linked Earth2 User ID for your profile.' }, { status: 404 });
    }
    const userE2Id = profileData.e2_user_id;
    console.log(`[API SYNC /profile/properties] Found linked E2 ID: ${userE2Id}`);

    // Step 2: Fetch ALL properties from Earth2 API via pagination
    let currentPage = 1;
    let fetchedAll = false;
    const allE2Properties: E2PropertyDetails[] = [];
    const PER_PAGE = 60; // E2 API page size
    let totalCountFromMeta: number | undefined = undefined;

    console.log(`[API SYNC /profile/properties] Starting E2 API fetch loop for user E2 ID: ${userE2Id}`);

    do {
      const e2ApiUrl = new URL('https://r.earth2.io/landfields');
      e2ApiUrl.searchParams.set('userId', userE2Id);
      e2ApiUrl.searchParams.set('page', String(currentPage));
      e2ApiUrl.searchParams.set('perPage', String(PER_PAGE));

      console.log(`[API SYNC /profile/properties] Fetching E2 page ${currentPage}: ${e2ApiUrl.toString()}`);
      const e2Response = await fetch(e2ApiUrl.toString());

      if (!e2Response.ok) {
        // Handle specific errors like 422 - maybe log and stop, or try skipping?
        const errorText = await e2Response.text();
        console.error(`[API SYNC /profile/properties] E2 API Error on page ${currentPage} (${e2Response.status}):`, errorText);
        // Decide how to handle partial fetches on error. For now, stop the process.
        throw new Error(`Failed to fetch property page ${currentPage} from Earth2 API (${e2Response.status})`); 
      }

      const pageData: E2PropertiesResponse = await e2Response.json();

      if (pageData.data && pageData.data.length > 0) {
         // Explicitly type 'prop' here
         pageData.data.forEach((prop: E2PropertyData) => { 
             // Combine attributes with the top-level id
             const details: E2PropertyDetails = {
                 ...prop.attributes, // Spread attributes
                 id: prop.id,       // Ensure top-level ID is included
                 owner: prop.attributes?.owner // Ensure owner is included if it's nested in attributes
             };
             allE2Properties.push(details); 
         }); 
      }

      if (totalCountFromMeta === undefined && pageData.meta?.count !== undefined) {
        totalCountFromMeta = pageData.meta.count;
        console.log(`[API SYNC /profile/properties] E2 Meta Total Count: ${totalCountFromMeta}`);
      }

      const itemsInLastFetch = pageData.data ? pageData.data.length : 0;
      console.log(`[API SYNC /profile/properties] Fetched ${itemsInLastFetch} properties on page ${currentPage}. Total accumulated: ${allE2Properties.length}`);

      // Pagination Logic (Robust)
      let shouldContinuePaging = false;
      if (itemsInLastFetch === 0) {
          shouldContinuePaging = false;
      } else if (totalCountFromMeta !== undefined && allE2Properties.length >= totalCountFromMeta) {
          shouldContinuePaging = false;
      } else if (pageData.links?.next) {
          shouldContinuePaging = true;
      } else if (totalCountFromMeta !== undefined && allE2Properties.length < totalCountFromMeta) {
          shouldContinuePaging = true; // No next link, but haven't reached total
      } else if (totalCountFromMeta === undefined && itemsInLastFetch === PER_PAGE) {
          shouldContinuePaging = true; // No next link or total, assume more if full page received
      } else {
          shouldContinuePaging = false; // Stop otherwise
      }

      if (shouldContinuePaging) {
          currentPage++;
          fetchedAll = false;
      } else {
          fetchedAll = true;
          console.log(`[API SYNC /profile/properties] Finished E2 fetch loop. Total properties fetched: ${allE2Properties.length}`);
      }

    } while (!fetchedAll);

    // Step 3: Prepare data for Supabase Upsert
    const propertiesToUpsert = allE2Properties.map(prop => ({
      user_id: sessionUserId!, // sessionUserId is guaranteed non-null here
      property_id: prop.id,      // Use the id from E2PropertyDetails
      description: prop.description,
      thumbnail_url: prop.thumbnail,
      tile_count: prop.tileCount,
    }));

    if (propertiesToUpsert.length === 0) {
        console.log('[API SYNC /profile/properties] No properties found/fetched from E2 to upsert.');
        return NextResponse.json({ success: true, message: "No properties found to sync.", count: 0 });
    }

    console.log(`[API SYNC /profile/properties] Preparing to upsert ${propertiesToUpsert.length} properties into Supabase...`);

    // Step 4: Upsert ALL fetched properties into Supabase
    const { error: upsertError } = await supabase
      .from('user_tracked_properties') 
      .upsert(propertiesToUpsert, { onConflict: 'user_id, property_id' }); 

    if (upsertError) {
      console.error('[API SYNC /profile/properties] Supabase upsert FAILED:', upsertError);
      throw upsertError; 
    }

    console.log(`[API SYNC /profile/properties] Supabase upsert SUCCEEDED for ${propertiesToUpsert.length} properties.`);
    // Optionally: Clean up properties in DB that are no longer owned (more complex)

    return NextResponse.json({ success: true, count: propertiesToUpsert.length });

  } catch (error: any) {
    console.error('[API SYNC /profile/properties] Handler CATCH block error:', error);
    const errorMessage = error.message.includes('Failed to fetch') ? error.message : 'Internal Server Error while syncing properties';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// --- DELETE Handler: Remove a tracked property ---
export async function DELETE(request: Request) {
  const cookieStore = cookies(); // Get cookie store directly
  const supabase = createServerClient( // Initialize directly
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { /* ... same cookie handlers as in GET ... */ 
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            console.error(`[API DELETE] Error setting cookie ${name}:`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            console.error(`[API DELETE] Error removing cookie ${name}:`, error);
          }
        },
      }
    }
  );
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get('propertyId');

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!propertyId || typeof propertyId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid propertyId parameter' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('user_tracked_properties') // Ensure this table name matches yours
      .delete()
      .eq('user_id', session.user.id)
      .eq('property_id', propertyId);

    if (deleteError) {
      console.error('[API DELETE /profile/properties] Supabase delete error:', deleteError);
      throw deleteError;
    }

    console.log(`[API DELETE /profile/properties] Successfully deleted property ${propertyId} for user ${session.user.id}`);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[API DELETE /profile/properties] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
} 