import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface E2UserInfo {
  id: string;
  picture?: string;
  customPhoto?: string;
  username: string;
}

export async function submitE2Profile(userId: string, e2UserId: string, e2UserInfo: E2UserInfo) {
  const supabase = createClientComponentClient();

  // First save the E2 profile
  const { error: e2Error } = await supabase
    .from('user_e2_profiles')
    .upsert({
      user_id: userId,
      e2_user_id: e2UserId,
      updated_at: new Date().toISOString()
    });

  if (e2Error) throw e2Error;

  // Then create the user profile
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      username: e2UserInfo.username,
      avatar_url: e2UserInfo.customPhoto || e2UserInfo.picture || null,
      updated_at: new Date().toISOString()
    });

  if (profileError) throw profileError;

  return { success: true };
} 