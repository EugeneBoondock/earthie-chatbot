'use client';

import { useState } from 'react';
import { SearchIcon, FilterIcon, Calendar, Tag, BookOpen, GlobeIcon, SortAscIcon, Info } from 'lucide-react';

export default function E2PediaPage() {
  // State for articles, search term, filters
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Example filter categories
  const filterCategories = [
    { id: 'all', name: 'All Articles', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'updates', name: 'Game Updates', icon: <GlobeIcon className="h-4 w-4" /> },
    { id: 'development', name: 'Development', icon: <Info className="h-4 w-4" /> },
    { id: 'news', name: 'News', icon: <Calendar className="h-4 w-4" /> },
    { id: 'tutorial', name: 'Tutorials', icon: <BookOpen className="h-4 w-4" /> },
  ];

  // Sample articles (these would be fetched from knowledge files)
  const placeholderArticles = [
    {
      id: 1,
      title: 'Earth2 Releases Phase 2 of Resource Mining',
      category: 'updates',
      date: '2025-02-15',
      excerpt: 'The latest update introduces new resource mining mechanics to Earth2...',
    },
    {
      id: 2,
      title: 'How to Set Up Your First Holobuilding - Guide',
      category: 'tutorial',
      date: '2025-01-22',
      excerpt: 'A comprehensive guide to setting up and optimizing your first Holobuilding in Earth2...',
    },
    {
      id: 3,
      title: 'Developer Update: Infrastructure Improvements',
      category: 'development',
      date: '2025-03-10',
      excerpt: 'The Earth2 development team shares insights on recent infrastructure improvements...',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header Section with Glassmorphic Effect */}
      <div className="relative overflow-hidden rounded-2xl p-8 backdrop-blur-lg bg-gradient-to-br from-indigo-900/40 to-violet-900/30 border border-indigo-400/30 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 z-0"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-earthie-mint/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-300 to-purple-300 inline-block text-transparent bg-clip-text mb-4">
            E2pedia - Earth2 Knowledge Base
          </h1>
          <p className="text-lg text-cyan-200/90 max-w-3xl">
            A comprehensive collection of Earth2 announcements, tutorials, guides, and official communications.
          </p>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-indigo-400/20 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          {/* Search Box */}
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 border border-indigo-500/30 rounded-lg bg-earthie-dark-light/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 backdrop-blur-sm"
              placeholder="Search for articles, keywords, or topics..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter Dropdown (simplified for now) */}
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
        {placeholderArticles.length > 0 ? (
          placeholderArticles.map((article) => (
            <article 
              key={article.id}
              className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-indigo-400/20 hover:border-indigo-400/40 rounded-xl p-6 shadow-lg transition-all hover:shadow-indigo-500/10 hover:-translate-y-1"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-600/30 text-indigo-200 border border-indigo-500/30">
                  <Tag className="h-3.5 w-3.5 mr-1" />
                  {article.category.charAt(0).toUpperCase() + article.category.slice(1)}
                </span>
                <span className="text-xs text-gray-400">{article.date}</span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2 hover:text-indigo-300 transition-colors">{article.title}</h2>
              <p className="text-gray-300 text-sm mb-4">{article.excerpt}</p>
              <div className="flex justify-end">
                <button className="text-indigo-300 hover:text-indigo-200 text-sm flex items-center">
                  Read more <SortAscIcon className="h-4 w-4 ml-1 rotate-90" />
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="col-span-2 backdrop-blur-md bg-earthie-dark-light/50 border border-indigo-400/20 rounded-xl p-8 text-center">
            <p className="text-lg text-indigo-300/90 font-medium">No articles found matching your criteria.</p>
            <p className="text-sm text-gray-400 mt-2">Try adjusting your search terms or filters.</p>
          </div>
        )}
      </div>

      {/* Development Notice - will be removed once real data is available */}
      <div className="backdrop-blur-md bg-gray-900/50 border border-indigo-400/10 rounded-lg p-5 text-center">
        <p className="text-cyan-300/70 text-sm">E2pedia full article database is under development.</p>
        <p className="text-xs text-cyan-400/60 mt-1">Data will be sourced from internal knowledge files.</p>
      </div>
    </div>
  );
}