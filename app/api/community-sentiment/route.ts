import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const RAPIDAPI_KEY = process.env.X_RAPIDAPI_KEY;
  if (!RAPIDAPI_KEY) {
    return NextResponse.json({ error: 'Missing X_RAPIDAPI_KEY in environment.' }, { status: 500 });
  }

  const url = new URL('https://twitter241.p.rapidapi.com/search-v2');
  url.searchParams.append('type', 'Top');
  url.searchParams.append('count', '5'); // Fetch 5 posts
  url.searchParams.append('query', '#earth2'); // Always search for #earth2

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'twitter241.p.rapidapi.com'
      }
    });

    const data = await response.json();

    // Extract tweets from the nested structure
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

    // Upsert tweets to Supabase
    if (tweets.length > 0) {
      await supabase.from('community_sentiment_x').upsert(
        tweets,
        { onConflict: 'tweet_id' }
      );
    }

    // Fetch latest 5 tweets from Supabase
    const { data: latest, error } = await supabase
      .from('community_sentiment_x')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(latest);
  } catch (err) {
    let message = 'Unknown error';
    if (err instanceof Error) {
      message = err.message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 