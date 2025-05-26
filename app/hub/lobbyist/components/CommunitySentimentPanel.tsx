import { useEffect, useState } from 'react';
import { MessageCircle, X as XIcon, Loader2 } from 'lucide-react';
import { linkify } from '@/utils/linkify';

export default function CommunitySentimentPanel() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/community-sentiment')
      .then(r => r.json())
      .then(data => setPosts(Array.isArray(data) ? data : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-900/80 to-indigo-900/80 border border-sky-400/20 shadow-xl p-4 relative overflow-hidden mb-8">
      <div className="flex items-center gap-2 mb-3 text-lg font-bold text-sky-200">
        <MessageCircle className="w-6 h-6 text-sky-400" /> Community Sentiment
      </div>
      {loading ? (
        <div className="py-8 text-center text-sky-300 animate-pulse flex flex-col items-center">
          <Loader2 className="animate-spin h-8 w-8 mb-2" /> Loading sentiment...
        </div>
      ) : posts.length === 0 ? (
        <div className="py-8 text-center text-gray-400">No recent #earth2 posts found.<br /><span className="text-sky-400 font-semibold">Check back soon!</span></div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((p) => (
            <div key={p.tweet_id} className="flex gap-3 items-start bg-sky-900/40 border border-sky-400/10 rounded-lg p-3 hover:bg-sky-900/60 transition-all">
              <img src={p.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${p.username || 'User'}`} alt="avatar" className="w-10 h-10 rounded-full border border-sky-400/20" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sky-200 text-sm truncate">{p.author || p.username || 'User'}</span>
                  <span className="text-xs text-gray-400">@{p.username}</span>
                  <span className="text-xs text-gray-400 ml-2">{new Date(p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  <a href={`https://x.com/${p.username}/status/${p.tweet_id}`} target="_blank" rel="noopener noreferrer" className="ml-2"><XIcon className="w-4 h-4 text-sky-400" /></a>
                </div>
                <div className="text-white text-sm break-words whitespace-pre-line" dangerouslySetInnerHTML={{ __html: linkify(p.content) }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 