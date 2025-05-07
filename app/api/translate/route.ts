import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { translateText } from '@/lib/genai_text_services'; // Updated import path
import { Database } from '@/lib/database.types'; // Your Supabase generated types

// Initialize Supabase client with Service Role Key
// Ensure these environment variables are set in your .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  console.error('Missing environment variable NEXT_PUBLIC_SUPABASE_URL');
  // Optionally throw an error or handle appropriately
}
if (!supabaseServiceKey) {
  console.error('Missing environment variable SUPABASE_SERVICE_KEY');
  // Optionally throw an error or handle appropriately
}

const supabase = supabaseUrl && supabaseServiceKey ? createClient<Database>(supabaseUrl, supabaseServiceKey) : null;

export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client not initialized. Check server logs.' }, { status: 500 });
  }

  try {
    const { 
      text, 
      targetLanguage, 
      articleId /* wp_post_id */ 
    } = await request.json();

    if (!text || !targetLanguage || !articleId) {
      return NextResponse.json({ error: 'Missing required fields: text, targetLanguage, and articleId' }, { status: 400 });
    }
    
    // Validate articleId is a number
    const numericArticleId = parseInt(articleId, 10);
    if (isNaN(numericArticleId)) {
        return NextResponse.json({ error: 'Invalid articleId: must be a number.' }, { status: 400 });
    }

    // 1. Check cache first
    const { data: cachedTranslation, error: cacheError } = await supabase
      .from('article_translations')
      .select('translated_content_text, translated_title') // Select title too if you plan to use it
      .eq('article_wp_post_id', numericArticleId)
      .eq('language_code', targetLanguage)
      .maybeSingle();

    if (cacheError) {
      console.error('Error fetching cached translation:', cacheError);
      // Log the error, but proceed to attempt fresh translation as a fallback
    } else if (cachedTranslation?.translated_content_text) {
      // Only if there was NO cacheError AND cachedTranslation has the content text
      console.log(`[API /translate] Returning cached translation for article ${numericArticleId} to ${targetLanguage}`);
      return NextResponse.json({ translatedText: cachedTranslation.translated_content_text, title: cachedTranslation.translated_title });
    }

    // If we reach here, it means either: 
    // 1. cacheError occurred (and we logged it),
    // 2. No cacheError, but cachedTranslation was null (no record found),
    // 3. No cacheError, cachedTranslation existed, but translated_content_text was null/empty.
    // In any of these cases, we proceed to fetch a fresh translation.

    // 2. If not in cache (or cache unusable), translate using Gemini
    console.log(`[API /translate] No cache hit for article ${numericArticleId} to ${targetLanguage}. Calling Gemini.`);
    const translatedText = await translateText(text, targetLanguage);
    // We are not translating title for now, but you could add a similar call for it.
    const translatedTitle = null; // Placeholder

    // 3. Store in cache
    const { error: insertError } = await supabase
      .from('article_translations')
      .upsert({
        article_wp_post_id: numericArticleId,
        language_code: targetLanguage,
        translated_content_text: translatedText,
        translated_title: translatedTitle, // Store null or the translated title
        // updated_at will be handled by the trigger or default to now() on insert
      });

    if (insertError) {
      console.error('Error caching translation:', insertError);
      // Don't fail the request if caching fails, but log it.
    }

    // 4. Attempt to save the successfully translated language name if it's potentially new
    // We don't need to check if it was predefined here, just try to insert.
    // The primary key constraint on custom_languages will prevent duplicates.
    const { error: langInsertError } = await supabase
        .from('custom_languages')
        .insert({ language_name: targetLanguage }); // Use ON CONFLICT DO NOTHING implicitly via PK

    if (langInsertError) {
        // Log this error but don't fail the overall request
        // Common error here would be duplicate key violation, which is expected and fine.
        if (!langInsertError.message.includes('duplicate key value violates unique constraint')) {
            console.error('Error saving custom language:', langInsertError);
        }
    }

    return NextResponse.json({ translatedText, title: translatedTitle });

  } catch (error: any) {
    console.error('[API /translate] Error:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred during translation.' }, { status: 500 });
  }
} 