'use client';

import { useState, useMemo } from 'react';
import { SearchIcon, FilterIcon, Calendar, Tag, BookOpen, GlobeIcon, SortAscIcon, Info, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Article } from './page'; // Assuming Article type is exported from page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button'; // Import Button for pagination

interface E2PediaClientContentProps {
  initialArticles: Article[];
  currentPage: number;
  totalPages: number;
}

// Helper to format date strings (can be more sophisticated)
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch (e) {
    return dateString; // Fallback to original string if parsing fails
  }
};

export default function E2PediaClientContent({ initialArticles, currentPage, totalPages }: E2PediaClientContentProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // Example filter state

  // Example filter categories - you might want to derive these from article data or pass them as props
  const filterCategories = [
    { id: 'all', name: 'All Articles', icon: <BookOpen className="h-4 w-4" /> },
    // { id: 'updates', name: 'Game Updates', icon: <GlobeIcon className="h-4 w-4" /> }, // Example, adapt as needed
    // { id: 'development', name: 'Development', icon: <Info className="h-4 w-4" /> },
    { id: 'news', name: 'News', icon: <Calendar className="h-4 w-4" /> }, // Assuming all fetched are 'news' for now
    // { id: 'tutorial', name: 'Tutorials', icon: <BookOpen className="h-4 w-4" /> },
  ];

  const filteredArticles = useMemo(() => {
    let articles = initialArticles;
    if (!articles) return [];

    // Filter by search term (title and content_text)
    if (searchTerm) {
      articles = articles.filter(article => 
        article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (article.content_text && article.content_text.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by active category (example, assumes all are 'news' or 'all' is selected)
    // You'll need a proper category field in your articles or more sophisticated logic here
    // if (activeFilter !== 'all') {
    //   articles = articles.filter(article => article.category === activeFilter); 
    // }

    return articles;
  }, [initialArticles, searchTerm, activeFilter]);

  const getExcerpt = (text: string | null, maxLength = 150) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl p-8 backdrop-blur-lg bg-gradient-to-br from-indigo-900/40 to-violet-900/30 border border-indigo-400/30 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 z-0"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-earthie-mint/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-300 to-purple-300 inline-block text-transparent bg-clip-text mb-4">
            E2pedia - Earth2 Knowledge Base
          </h1>
          <p className="text-lg text-cyan-200/90 max-w-3xl">
            A comprehensive collection of Earth2 announcements, fetched from official sources.
          </p>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-indigo-400/20 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 border border-indigo-500/30 rounded-lg bg-earthie-dark-light/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-sm"
              placeholder="Search articles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Filter buttons - simplified for now as category data is not in Supabase table yet */}
          <div className="flex overflow-x-auto pb-2 md:pb-0 space-x-2 md:justify-end">
            {filterCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveFilter(category.id)}
                className={`flex items-center px-4 py-2 rounded-lg border transition-all ${activeFilter === category.id 
                  ? 'bg-indigo-600/40 text-white border-indigo-500/70' 
                  : 'bg-earthie-dark/40 text-gray-300 border-indigo-500/20 hover:bg-indigo-600/30'}`}
              >
                <span className="mr-2">{category.icon}</span>
                <span>{category.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Articles Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredArticles.length > 0 ? (
          filteredArticles.map((article) => (
            <article 
              key={article.wp_post_id} 
              className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-indigo-400/20 hover:border-indigo-400/40 rounded-xl p-6 shadow-lg transition-all hover:shadow-indigo-500/10 hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-600/30 text-indigo-200 border border-indigo-500/30">
                    <Tag className="h-3.5 w-3.5 mr-1.5" />
                    News Article 
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(article.published_at)}</span>
                </div>
                {/* Link the title to the detail page */}
                <Link href={`/hub/e2pedia/${article.wp_post_id}`} className="block mb-2 group">
                  <h2 className="text-xl font-semibold text-white group-hover:text-indigo-300 transition-colors">
                    {article.title}
                  </h2>
                </Link>
                <p className="text-gray-300 text-sm mb-4">{getExcerpt(article.content_text)}</p>
              </div>
              {article.url && (
                <div className="flex justify-end mt-auto">
                  <a 
                    href={article.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    title="View original article on Earth2 website"
                    className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center opacity-80 hover:opacity-100 transition-opacity"
                  >
                    Original Source <ExternalLink className="h-3.5 w-3.5 ml-1" />
                  </a>
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="col-span-1 lg:col-span-2 backdrop-blur-md bg-earthie-dark-light/50 border border-indigo-400/20 rounded-xl p-8 text-center">
            <p className="text-lg text-indigo-300/90 font-medium">No articles found matching your criteria.</p>
            <p className="text-sm text-gray-400 mt-2">Try adjusting your search terms or filters, or wait for new articles to be fetched.</p>
          </div>
        )}
      </div>

      {/* Pagination Controls Section */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4 mt-12">
          <Link 
            href={currentPage > 1 ? `/hub/e2pedia?page=${currentPage - 1}` : '#'} 
            passHref
            legacyBehavior // Added for compatibility if Button isn't directly wrapping <a>
          >
            <Button 
              variant="outline" 
              size="icon" 
              disabled={currentPage <= 1}
              aria-label="Previous Page"
              className={currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : ''}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          
          <span className="text-sm font-medium text-gray-300">
            Page {currentPage} of {totalPages}
          </span>
          
          <Link 
            href={currentPage < totalPages ? `/hub/e2pedia?page=${currentPage + 1}` : '#'} 
            passHref
            legacyBehavior
          >
            <Button 
              variant="outline" 
              size="icon" 
              disabled={currentPage >= totalPages}
              aria-label="Next Page"
              className={currentPage >= totalPages ? 'opacity-50 cursor-not-allowed' : ''}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
} 