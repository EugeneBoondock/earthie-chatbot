import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';
import { Database } from '@/lib/database.types'; // Assuming you have this from `npx supabase gen types typescript > lib/database.types.ts`

// WordPress API setup
const WP_BASE_URL = "https://public-api.wordpress.com/rest/v1.1/sites/195754016/posts";
const ARTICLES_PER_REQUEST = 10; // Keep it reasonable

// Helper to strip HTML (basic version)
function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export async function GET(request: NextRequest) {
  // Secure this endpoint if needed, e.g., with a secret query parameter or by checking user role if triggered by an admin.
  // For a cron job, a secret in the URL is a common way.
  // const { searchParams } = new URL(request.url);
  // const secret = searchParams.get('cron_secret');
  // if (secret !== process.env.CRON_SECRET) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // IMPORTANT: Use non-public service role key

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Supabase URL or Service Key is missing for API route.");
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }
  
  // *** Use the standard Supabase client with Service Role Key ***
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false } // Prevent client from trying to store session info
  });

  let offset = 0;
  let total_found: number | null = null;
  const allPostsFromApi: any[] = []; // Type this properly later
  let fetchedCountInLoop = 0;

  console.log("Starting WordPress article fetch...");

  try {
    while (true) {
      const params = new URLSearchParams({
        number: String(ARTICLES_PER_REQUEST),
        offset: String(offset),
        category: "news",
        fields: "ID,title,content,URL,date,modified"
      });

      const response = await fetch(`${WP_BASE_URL}?${params.toString()}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`WordPress API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`WordPress API request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (total_found === null) {
        total_found = data.found ?? 0;
        console.log(`Total articles available according to API: ${total_found}`);
      }

      const posts = data.posts || [];
      if (posts.length === 0) {
        console.log("No more posts found from API. Exiting fetch loop.");
        break;
      }

      allPostsFromApi.push(...posts);
      fetchedCountInLoop += posts.length;
      console.log(`Fetched ${posts.length} posts. Total fetched in this run: ${fetchedCountInLoop}. Current API offset: ${offset}`);
      offset += ARTICLES_PER_REQUEST;

      if (total_found !== null && total_found > 0 && offset >= total_found) {
        console.log("Reached total_found count. Exiting fetch loop.");
        break;
      }
      if (total_found !== null && total_found === 0 && fetchedCountInLoop >= 2000) {
        console.warn("API reported 0 found, but fetched 2000 articles. Safety break.");
        break;
      }
      if (total_found !== null && total_found > 0 && fetchedCountInLoop >= (total_found + ARTICLES_PER_REQUEST * 2)) {
        console.warn(`Fetched significantly more than reported total_found (${total_found}). Safety break.`);
        break;
      }
    }
  } catch (error: any) {
    console.error("Error fetching articles from WordPress API:", error.message);
    return NextResponse.json({ error: "Failed to fetch articles from source.", details: error.message }, { status: 500 });
  }

  console.log(`\nFetched a total of ${allPostsFromApi.length} articles from WordPress API.`);
  if (allPostsFromApi.length === 0) {
    return NextResponse.json({ message: "No new articles to process." });
  }

  let upsertedCount = 0;
  let errorCount = 0;

  console.log("\nProcessing and saving articles to Supabase...");

  for (const post of allPostsFromApi) {
    const wp_post_id = post.ID;
    if (!wp_post_id) {
      console.warn("Skipping post due to missing ID:", post.title || "No Title");
      errorCount++;
      continue;
    }

    const articlePayload = {
      wp_post_id: wp_post_id,
      title: post.title || "No Title",
      content_html: post.content || "",
      content_text: stripHtml(post.content || ""),
      url: post.URL || null,
      published_at: post.date ? new Date(post.date).toISOString() : null,
      modified_at: post.modified ? new Date(post.modified).toISOString() : null,
      fetched_at: new Date().toISOString(),
    };

    try {
      const { error: upsertError } = await supabase
        .from('e2_articles')
        .upsert(articlePayload, { onConflict: 'wp_post_id' }); // Make sure onConflict matches your primary key

      if (upsertError) {
        console.error(`Error upserting article ID ${wp_post_id} to Supabase:`, upsertError.message);
        errorCount++;
      } else {
        upsertedCount++;
        // console.log(`Successfully upserted article ID ${wp_post_id}: ${articlePayload.title}`);
      }
    } catch (e: any) {
        console.error(`Exception during Supabase upsert for article ID ${wp_post_id}:`, e.message);
        errorCount++;
    }
  }

  const summary = `Article fetch and upsert complete. Upserted: ${upsertedCount}, Errors/Skipped: ${errorCount}.`;
  console.log(summary);
  return NextResponse.json({ message: "Article sync process finished.", summary });
}
