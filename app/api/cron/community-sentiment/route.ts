import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  // Secure with CRON secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const rapidApiKey = process.env.X_RAPIDAPI_KEY;

  if (!supabaseUrl || !supabaseServiceKey || !rapidApiKey) {
    return NextResponse.json({ error: 'Missing environment variables' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch tweets from RapidAPI
  const url = new URL('https://twitter241.p.rapidapi.com/search-v2');
  url.searchParams.append('type', 'Top');
  url.searchParams.append('count', '10');
  url.searchParams.append('query', '#earth2');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-rapidapi-key': rapidApiKey,
      'x-rapidapi-host': 'twitter241.p.rapidapi.com'
    }
  });

  const data = await response.json();
  const entries = data?.result?.timeline?.instructions?.[0]?.entries || [];
  const tweets = entries
    .filter((e: any) => e.entryId && e.entryId.startsWith('tweet-'))
    .map((e: any) => {
      const tweet = e.content?.itemContent?.tweet_results?.result;
      if (!tweet) return null;
      return {
        tweet_id: tweet.rest_id,
        author: tweet.core?.user_results?.result?.legacy?.name || null,
        username: tweet.core?.user_results?.result?.legacy?.screen_name || null,
        avatar: tweet.core?.user_results?.result?.legacy?.profile_image_url_https || null,
        content: tweet.legacy?.full_text || null,
        created_at: tweet.legacy?.created_at ? new Date(tweet.legacy.created_at).toISOString() : null,
        raw_json: tweet,
      };
    })
    .filter(Boolean);

  // Upsert tweets into Supabase
  const { error } = await supabase.from('community_sentiment_x').upsert(tweets, { onConflict: 'tweet_id' });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: tweets.length });
} 