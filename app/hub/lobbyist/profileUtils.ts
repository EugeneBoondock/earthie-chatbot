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
    console.log(`[fetchUserProfile] Fetching profile for user ${userId}`);
    // Call the API that returns the linked E2 user id for the current user
    const res = await fetch('/api/me/e2profile');
    
    if (!res.ok) {
      console.error(`[fetchUserProfile] API responded with status ${res.status}: ${res.statusText}`);
      return null;
    }
    
    const data = await res.json();
    console.log('[fetchUserProfile] API Response:', data);
    
    if (!data.e2_user_id) {
      console.log('[fetchUserProfile] No E2 user ID found in API response');
      
      // Fall back to checking for username without E2 ID
      if (data.username && data.avatar_url) {
        console.log('[fetchUserProfile] Using username/avatar from API response without E2 ID');
        return {
          id: userId, // Use Supabase ID as fallback
          username: data.username,
          avatar: data.avatar_url,
        };
      }
      
      return null;
    }

    // If we have the profile data from the API, use it
    if (data.username && data.avatar_url) {
      console.log('[fetchUserProfile] Using profile data from API response');
      return {
        id: data.e2_user_id,
        username: data.username,
        avatar: data.avatar_url,
      };
    }

    // Otherwise fetch from Earth2 API
    console.log(`[fetchUserProfile] Fetching from Earth2 API for user ID ${data.e2_user_id}`);
    const e2Res = await fetch(`https://app.earth2.io/api/v2/user_info/${data.e2_user_id}`);
    
    if (!e2Res.ok) {
      console.error(`[fetchUserProfile] Earth2 API responded with status ${e2Res.status}: ${e2Res.statusText}`);
      return null;
    }
    
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
