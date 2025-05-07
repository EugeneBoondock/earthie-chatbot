// Remove cookies and auth-helpers imports
// import { cookies } from 'next/headers';
// import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

// Import standard Supabase client
import { createClient } from '@supabase/supabase-js';

import { notFound } from 'next/navigation';
// Remove unused Lucide icons from here if ArticleDetailClient handles them
// import { ExternalLink, Calendar } from 'lucide-react'; 
import { Database } from '@/lib/database.types'; // Assuming type generation
import ArticleDetailClient from './ArticleDetailClient'; // Import the client component

interface ArticlePageProps {
  params: {
    articleId: string; // Route parameters are strings
  };
}

// Helper to format date strings
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
};

// Fetch a single article by its wp_post_id
async function getArticle(supabase: any, articleId: number) {
  const { data, error } = await supabase
    .from('e2_articles')
    .select('wp_post_id, title, content_html, content_text, url, published_at') // Added content_text
    .eq('wp_post_id', articleId)
    .single(); // Fetch a single record

  if (error) {
    console.error(`Error fetching article ${articleId}:`, error);
    return null;
  }
  return data;
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { articleId: articleIdString } = params; // Destructure first
  const articleId = parseInt(articleIdString, 10); // Then parse

  // Validate articleId
  if (isNaN(articleId)) {
    notFound(); // Render 404 if articleId is not a number
  }

  // Initialize standard client with Anon Key
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(`Supabase URL or Anon Key missing for article page ${articleId}.`);
    notFound(); // Can't fetch article without Supabase config
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  
  const article = await getArticle(supabase, articleId);

  // If article not found in DB, render 404
  if (!article) {
    notFound();
  }

  // The ArticleDetailClient expects the article object with specific fields including content_text
  // Ensure the fetched 'article' matches the 'Article' interface in ArticleDetailClient.tsx
  // If not, you might need to transform it here or adjust the interface.
  // For now, we assume 'article' from getArticle is compatible.

  return (
    // The outer container can remain if ArticleDetailClient doesn't provide its own full-page styling
    // Or, ArticleDetailClient can be the sole root element returned.
    // For now, let's assume ArticleDetailClient handles its internal layout.
    <ArticleDetailClient article={article} />
  );
}

// Optional: Generate static paths if desired (for SSG)
// export async function generateStaticParams() {
//   const cookieStore = cookies();
//   const supabase = createServerComponentClient({ cookies: () => cookieStore });
//   const { data: articles } = await supabase.from('e2_articles').select('wp_post_id');

//   return articles?.map((article) => ({
//     articleId: article.wp_post_id.toString(),
//   })) || [];
// } 