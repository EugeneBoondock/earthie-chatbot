import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { summarizeText } from '@/lib/genai_text_services'; // Correct path
import { Database } from '@/lib/database.types'; // Correct path

// Initialize Supabase client with Service Role Key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  console.error('Missing environment variable NEXT_PUBLIC_SUPABASE_URL');
}
if (!supabaseServiceKey) {
  console.error('Missing environment variable SUPABASE_SERVICE_KEY');
}

const supabase = supabaseUrl && supabaseServiceKey ? createClient<Database>(supabaseUrl, supabaseServiceKey) : null;

export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client not initialized. Check server logs.' }, { status: 500 });
  }

  try {
    const {
      text,
      language, // e.g., "English", "Spanish"
      articleId /* wp_post_id */
    } = await request.json();

    if (!text?.trim() || !language?.trim() || !articleId) {
      return NextResponse.json({ error: 'Missing required fields: text, language, and articleId' }, { status: 400 });
    }

    // Validate articleId is a number
    const numericArticleId = parseInt(articleId, 10);
    if (isNaN(numericArticleId)) {
        return NextResponse.json({ error: 'Invalid articleId: must be a number.' }, { status: 400 });
    }

    // 1. Check cache first
    console.log(`[API /summarize] Checking cache for article ${numericArticleId} in language ${language}`);
    const { data: cachedSummary, error: cacheError } = await supabase
      .from('article_summaries')
      .select('summary_text')
      .eq('article_wp_post_id', numericArticleId)
      .eq('language', language)
      .maybeSingle();

    if (cacheError) {
      console.error('Error fetching cached summary:', cacheError);
      // Proceed to summarize, don't let cache read error block functionality
    }

    if (cachedSummary?.summary_text) {
      console.log(`[API /summarize] Returning cached summary for article ${numericArticleId} in ${language}`);
      return NextResponse.json({ summary: cachedSummary.summary_text });
    }

    // 2. If not in cache, summarize using Gemini
    console.log(`[API /summarize] No cache hit for article ${numericArticleId} in ${language}. Calling Gemini.`);
    // Pass the text to the existing summarizeText function.
    // It doesn't strictly need the language, but the context is known.
    const summaryText = await summarizeText(text);

    // 3. Store in cache
    console.log(`[API /summarize] Caching summary for article ${numericArticleId} in ${language}`);
    const { error: insertError } = await supabase
      .from('article_summaries')
      .upsert({
        article_wp_post_id: numericArticleId,
        language: language,
        summary_text: summaryText,
        // updated_at will be handled by the trigger or default to now() on insert
      });

    if (insertError) {
      console.error('Error caching summary:', insertError);
      // Don't fail the request if caching fails, but log it.
    }

    return NextResponse.json({ summary: summaryText });

  } catch (error: any) {
    console.error('[API /summarize] Error:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred during summarization.' }, { status: 500 });
  }
} 