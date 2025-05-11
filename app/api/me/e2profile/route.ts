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
    console.log('[e2profile/GET] Starting request');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('[e2profile/GET] Session error:', sessionError.message);
      throw sessionError;
    }
    if (!session) {
      console.error('[e2profile/GET] No session found');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log(`[e2profile/GET] Valid session for user: ${session.user.id}`);

    // Get both the E2 profile and user profile
    const { data: e2Profile, error: e2Error } = await supabase
      .from('user_e2_profiles')
      .select('e2_user_id')
      .eq('user_id', session.user.id)
      .single();

    if (e2Error && e2Error.code !== 'PGRST116') { // PGRST116: no rows found, which is acceptable
      console.error('[e2profile/GET] Error fetching E2 profile:', e2Error);
      throw e2Error;
    }

    console.log(`[e2profile/GET] E2 profile fetch result:`, e2Profile);

    // Also get the user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', session.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('[e2profile/GET] Error fetching user profile:', profileError);
      throw profileError;
    }

    console.log(`[e2profile/GET] User profile fetch result:`, userProfile);

    // If a user profile exists but has no E2 profile, we should still return the user profile
    if (userProfile && (!e2Profile || !e2Profile.e2_user_id)) {
      console.log('[e2profile/GET] No E2 profile, but user profile exists - returning user profile');
      return NextResponse.json({
        e2_user_id: null,
        username: userProfile.username,
        avatar_url: userProfile.avatar_url
      });
    }

    // If we have an E2 user ID, fetch the latest info from Earth2
    let e2UserInfo = null;
    if (e2Profile?.e2_user_id) {
      try {
        const e2Response = await fetch(`https://app.earth2.io/api/v2/user_info/${e2Profile.e2_user_id}`);
        if (e2Response.ok) {
          e2UserInfo = await e2Response.json();
          
          // Update the profile with the latest username and avatar URL
          const imageUrl = e2UserInfo.customPhoto || e2UserInfo.picture;
          let avatar_url = null;

          try {
            // Fetch the image
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) throw new Error('Failed to fetch image');
            const imageBuffer = await imageResponse.arrayBuffer();

            // Generate a unique filename
            const fileExt = imageUrl.split('.').pop()?.split('?')[0] || 'png';
            const fileName = `avatars/${e2Profile.e2_user_id}_${Date.now()}.${fileExt}`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('publicpfp')
              .upload(fileName, imageBuffer, {
                contentType: `image/${fileExt}`,
                upsert: true
              });

            if (uploadError) throw uploadError;

            // Get the public URL
            const { data: { publicUrl } } = supabase.storage
              .from('publicpfp')
              .getPublicUrl(fileName);

            avatar_url = publicUrl;
          } catch (err) {
            console.error('Error uploading avatar:', err);
            // Fall back to original URL if upload fails
            avatar_url = imageUrl;
          }

          // Always update the profile with the latest username and avatar
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .upsert({
              id: session.user.id,
              username: e2UserInfo.username,
              avatar_url: avatar_url || imageUrl,
              updated_at: new Date().toISOString()
            });

          if (profileUpdateError) {
            console.error('Error updating profile:', profileUpdateError);
          }
        }
      } catch (e) {
        console.error('Error fetching E2 user info:', e);
      }
    }

    return NextResponse.json({
      e2_user_id: e2Profile?.e2_user_id || null,
      username: userProfile?.username || e2UserInfo?.username || null,
      avatar_url: e2UserInfo?.customPhoto || e2UserInfo?.picture || userProfile?.avatar_url || null
    });
  } catch (error: any) {
    console.error('Catch block error in GET E2 profile:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to fetch E2 profile' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  let e2_user_id: string | undefined;
  let username: string | undefined;
  let customPhoto: string | undefined;
  let picture: string | undefined;

  try {
    const body = await request.json();
    e2_user_id = body.e2_user_id;
    username = body.username;
    customPhoto = body.customPhoto;
    picture = body.picture;

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

    // First save the E2 profile
    const { error: e2Error } = await supabase
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
      );

    if (e2Error) throw e2Error;

    // Fetch user info from Earth2 API
    const e2Response = await fetch(`https://app.earth2.io/api/v2/user_info/${e2_user_id}`);
    if (!e2Response.ok) {
      throw new Error(`Failed to fetch E2 user info (status: ${e2Response.status})`);
    }
    const e2UserInfo = await e2Response.json();

    // Download and store the avatar image
    let avatar_url = null;
    const imageUrl = e2UserInfo.customPhoto || e2UserInfo.picture;
    if (imageUrl) {
      try {
        // Fetch the image
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) throw new Error('Failed to fetch image');
        const imageBuffer = await imageResponse.arrayBuffer();

        // Generate a unique filename
        const fileExt = imageUrl.split('.').pop()?.split('?')[0] || 'png';
        const fileName = `avatars/${e2_user_id}_${Date.now()}.${fileExt}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('publicpfp')
          .upload(fileName, imageBuffer, {
            contentType: `image/${fileExt}`,
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('publicpfp')
          .getPublicUrl(fileName);

        avatar_url = publicUrl;
      } catch (err) {
        console.error('Error uploading avatar:', err);
        // Fall back to original URL if upload fails
        avatar_url = imageUrl;
      }
    }
    
    // Create/update the user profile with the E2 username
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: session.user.id,
          username: e2UserInfo.username,
          avatar_url,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      );

    if (profileError) throw profileError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
      console.error('Error parsing JSON body in POST E2 profile:', error.message);
      return NextResponse.json({ error: 'Invalid JSON format in request body' }, { status: 400 });
    }
    console.error('Catch block error in POST E2 profile:', error.message);
    return NextResponse.json({ error: error.message || 'Failed to save E2 profile' }, { status: 500 });
  }
} 