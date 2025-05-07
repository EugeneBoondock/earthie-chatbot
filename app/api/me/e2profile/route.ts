import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data, error } = await supabase
      .from('user_e2_profiles')
      .select('e2_user_id')
      .eq('user_id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: no rows found, which is fine
      console.error('Error fetching E2 profile:', error);
      throw error;
    }

    return NextResponse.json({ e2_user_id: data?.e2_user_id || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch E2 profile' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { e2_user_id } = await request.json();

  if (!e2_user_id || typeof e2_user_id !== 'string') {
    return NextResponse.json({ error: 'Valid e2_user_id is required' }, { status: 400 });
  }

  // Basic UUID validation (Earth2 User IDs are UUIDs)
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(e2_user_id)) {
    return NextResponse.json({ error: 'Invalid E2 User ID format. Should be a UUID.' }, { status: 400 });
  }

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data, error } = await supabase
      .from('user_e2_profiles')
      .upsert(
        {
          user_id: session.user.id,
          e2_user_id: e2_user_id,
          updated_at: new Date().toISOString(), // Keep updated_at fresh
        },
        {
          onConflict: 'user_id', // If user_id exists, update e2_user_id
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error saving E2 profile:', error);
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save E2 profile' }, { status: 500 });
  }
} 