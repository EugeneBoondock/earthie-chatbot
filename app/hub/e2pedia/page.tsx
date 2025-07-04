// Remove cookies and auth-helpers imports
// import { cookies } from 'next/headers';
// import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

// Import standard Supabase client
import { createClient } from '@supabase/supabase-js';

import E2PediaClientContent from './E2PediaClientContent';
import { Database } from '@/lib/database.types'; // Assuming type generation
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "E2Pedia | The Official Earth 2 Knowledge Base & Announcements",
  description: "Explore E2Pedia, the comprehensive knowledge base for Earth 2. Find official announcements, articles, and updates to stay informed on all aspects of the metaverse.",
};

// Define a type for our articles fetched from Supabase
export interface Article {
  wp_post_id: number;
  title: string;
  content_text: string | null; // Or string, depending on your DB schema
  url: string | null;
  published_at: string | null; // Timestamptz will come as string
  // Add other fields you might need, like content_html if you want to render full HTML
}

const ARTICLES_PER_PAGE = 4;

// Updated function to fetch paginated articles and total count
async function getPaginatedArticles(supabase: any, page: number) {
  const pageNum = Math.max(1, page); // Ensure page is at least 1
  const rangeFrom = (pageNum - 1) * ARTICLES_PER_PAGE;
  const rangeTo = rangeFrom + ARTICLES_PER_PAGE - 1;

  // Fetch articles for the current page
  const { data, error, count } = await supabase
    .from('e2_articles')
    .select('wp_post_id, title, content_text, url, published_at', { 
        count: 'exact' // Request total count along with the data
     })
    .order('published_at', { ascending: false })
    .range(rangeFrom, rangeTo);

  if (error) {
    console.error(`Error fetching articles (page ${pageNum}):`, error);
    // Return empty results and 0 count on error
    return { articles: [], totalCount: 0 };
  }

  // count will contain the total number of rows in the table matching the query (before range/limit)
  return { articles: data || [], totalCount: count ?? 0 };
}

// Add searchParams to the component props
export default async function E2PediaPage({ 
    searchParams 
}: {
    searchParams?: { [key: string]: string | string[] | undefined }
}) {
  // Get current page from searchParams, default to 1
  const currentPage = parseInt(searchParams?.page as string ?? '1', 10);
  if (isNaN(currentPage) || currentPage < 1) {
      // Handle invalid page number, maybe redirect to page 1 or show error
      // For now, default to 1
      // redirect('/hub/e2pedia?page=1'); // Needs import { redirect } from 'next/navigation';
  }
  const validCurrentPage = Math.max(1, currentPage); // Ensure it's at least 1

  // Initialize Supabase client (same as before)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase URL or Anon Key missing for E2Pedia page.");
    return <E2PediaClientContent initialArticles={[]} currentPage={1} totalPages={1} />;
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  
  // Fetch paginated articles and total count
  const { articles, totalCount } = await getPaginatedArticles(supabase, validCurrentPage);

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / ARTICLES_PER_PAGE);

  console.log(`[E2PediaPage] Fetched ${articles.length} articles for page ${validCurrentPage}/${totalPages} (Total: ${totalCount}).`);

  // Pass pagination data to the client component
  return (
      <E2PediaClientContent 
          initialArticles={articles} 
          currentPage={validCurrentPage} 
          totalPages={totalPages} 
      />
  );
}