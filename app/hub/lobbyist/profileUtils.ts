import { User } from '@supabase/supabase-js';

export interface UserProfileData {
  id: string;
  username: string;
  avatar: string;
}

/**
 * Fetches the Earth2 profile for the given Supabase user id, returning username and avatar.
 * @param userId Supabase user id
 */
export async function fetchUserProfile(userId: string): Promise<UserProfileData | null> {
  try {
    // Call the API that returns the linked E2 user id for the current user
    const res = await fetch('/api/me/e2profile');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.e2_user_id) return null;

    // If we have the profile data from the API, use it
    if (data.username && data.avatar_url) {
      return {
        id: data.e2_user_id,
        username: data.username,
        avatar: data.avatar_url,
      };
    }

    // Otherwise fetch from Earth2 API
    const e2Res = await fetch(`https://app.earth2.io/api/v2/user_info/${data.e2_user_id}`);
    if (!e2Res.ok) return null;
    const e2User = await e2Res.json();
    
    console.log('[fetchUserProfile] E2 User Data:', {
      username: e2User.username,
      picture: e2User.picture,
      customPhoto: e2User.customPhoto
    });
    
    return {
      id: data.e2_user_id,
      username: e2User.username,
      avatar: e2User.customPhoto || e2User.picture || '',
    };
  } catch (err) {
    console.error('[fetchUserProfile] Error:', err);
    return null;
  }
}
