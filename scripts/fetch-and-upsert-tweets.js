import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const RAPIDAPI_KEY = process.env.X_RAPIDAPI_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchTweets() {
  const url = new URL('https://twitter241.p.rapidapi.com/search-v2');
  url.searchParams.append('type', 'Top');
  url.searchParams.append('count', '5');
  url.searchParams.append('query', '#earth2');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': 'twitter241.p.rapidapi.com'
    }
  });

  const data = await response.json();

  // Map tweets
  const entries = data?.result?.timeline?.instructions?.[0]?.entries || [];
  const tweets = entries
    .filter((e) => e.entryId && e.entryId.startsWith('tweet-'))
    .map((e) => {
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

  return tweets;
}

async function upsertTweets(tweets) {
  const { error } = await supabase
    .from('community_sentiment_x')
    .upsert(tweets, { onConflict: 'tweet_id' });

  if (error) {
    console.error('Supabase upsert error:', error);
    throw error;
  }
}

async function main() {
  try {
    const tweets = await fetchTweets();
    if (tweets.length === 0) {
      console.log('No tweets to upsert.');
      return;
    }
    await upsertTweets(tweets);
    console.log(`Upserted ${tweets.length} tweets to Supabase.`);
  } catch (err) {
    console.error('Error:', err);
  }
}

main(); 