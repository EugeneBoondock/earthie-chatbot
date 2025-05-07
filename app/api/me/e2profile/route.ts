import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies as nextHeadersCookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function createSupabaseServerClient() {
  const cookieStore = await nextHeadersCookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            console.error(`Error setting cookie ${name}:`, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 });
          } catch (error) {
            console.error(`Error removing cookie ${name}:`, error);
          }
        },
      },
    }
  );
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error in GET E2 profile:', sessionError.message);
      throw sessionError;
    }
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_e2_profiles')
      .select('e2_user_id')
      .eq('user_id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: no rows found, which is acceptable
      console.error('Error fetching E2 profile (GET):', error);
      throw error;
    }

    return NextResponse.json({ e2_user_id: data?.e2_user_id || null });
  } catch (error: any) {
    console.error('Catch block error in GET E2 profile:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to fetch E2 profile' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  let e2_user_id: string | undefined;

  try {
    const body = await request.json();
    e2_user_id = body.e2_user_id;

  if (!e2_user_id || typeof e2_user_id !== 'string') {
      return NextResponse.json({ error: 'Valid e2_user_id (string) is required in JSON body' }, { status: 400 });
  }

  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(e2_user_id)) {
    return NextResponse.json({ error: 'Invalid E2 User ID format. Should be a UUID.' }, { status: 400 });
  }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error in POST E2 profile:', sessionError.message);
      throw sessionError;
    }
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_e2_profiles')
      .upsert(
        {
          user_id: session.user.id,
          e2_user_id: e2_user_id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error saving/upserting E2 profile (POST):', error);
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        console.error('Error parsing JSON body in POST E2 profile:', error.message);
        return NextResponse.json({ error: 'Invalid JSON format in request body' }, { status: 400 });
    }
    console.error('Catch block error in POST E2 profile:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to save E2 profile' }, { status: 500 });
  }
} 