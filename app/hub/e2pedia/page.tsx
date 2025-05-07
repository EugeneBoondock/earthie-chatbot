'use client';

export default function E2PediaPage() {
  // State for articles, search term, filters

  // TODO: Fetch and parse app/knowledge/earth2_all_articles.txt

  return (
    <div>
      <h1 className="text-3xl font-bold text-sky-300 mb-6">E2pedia - Earth2 Announcements</h1>
      <p className="text-lg text-cyan-200/90 mb-4">
        A centralized hub for Earth2 announcements, summaries, and translations.
      </p>
      {/* Search, filters, and article display will go here */}
      <div className="bg-gray-900/70 border border-sky-400/30 shadow-xl rounded-lg p-6">
        <p className="text-cyan-300/70">E2pedia articles will appear here. This feature is under development.</p>
        <p className="text-xs text-cyan-400/60 mt-2">Data will be sourced from internal knowledge files.</p>
      </div>
    </div>
  );
} 