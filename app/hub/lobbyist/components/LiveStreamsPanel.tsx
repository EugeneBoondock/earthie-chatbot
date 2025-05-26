import { useState, useEffect } from 'react';
import LiveStreamModal from './LiveStreamModal';
import { PlayCircle, User, Eye, Radio, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Stream {
  id: string;
  name: string;
  userId?: string;
  isActive?: boolean;
  viewerCount?: number;
  playbackUrl?: string;
  livepeerTvUrl?: string;
}

export default function LiveStreamsPanel({ user }: { user: any }) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/livepeer')
      .then(r => r.json())
      .then(data => setStreams(Array.isArray(data) ? data : data.data || []))
      .catch(() => setStreams([]))
      .finally(() => setLoading(false));
  }, [modalOpen]);

  const liveStreams = streams.filter(s => s.isActive);
  const pastStreams = streams.filter(s => !s.isActive && s.playbackUrl);

  return (
    <>
      {/* Live Now Panel */}
      <div className="mt-6 mb-4 rounded-2xl bg-gradient-to-br from-sky-900/80 to-indigo-900/80 border border-sky-400/20 shadow-xl p-4 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-lg font-bold text-sky-200">
            <Video className="w-6 h-6 text-sky-400" /> Live Now
          </div>
          <Button onClick={() => { setModalOpen(true); setSelectedStream(null); }} className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold px-4 py-1.5 rounded-full shadow hover:scale-105 transition-all">
            🎥 Go Live
          </Button>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sky-300 animate-pulse">Loading streams...</div>
        ) : liveStreams.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            No one is live right now.<br />
            <span className="text-sky-400 font-semibold">Be the first to go live!</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {liveStreams.map((s) => (
              <div key={s.id} className="group rounded-xl overflow-hidden bg-gradient-to-br from-sky-900/60 to-indigo-900/60 border border-sky-400/10 shadow hover:scale-[1.02] transition-transform cursor-pointer flex items-center gap-3 p-2" onClick={() => { setSelectedStream(s); setModalOpen(true); }}>
                <div className="w-20 h-14 bg-black flex items-center justify-center rounded-lg">
                  <PlayCircle className="text-emerald-400 w-8 h-8 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sky-100 truncate">{s.name}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <User className="w-4 h-4" /> {s.userId || 'Unknown'}
                    <Eye className="w-4 h-4 ml-2" /> {s.viewerCount || 0}
                  </div>
                  {s.livepeerTvUrl && (
                    <a href={s.livepeerTvUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 underline mt-1 inline-block">Watch on Livepeer.tv</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Past Streams Panel */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-slate-900/80 to-sky-900/80 border border-sky-400/20 shadow-xl p-4 relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2 text-sky-300 font-semibold text-base">
          <Radio className="w-5 h-5 text-sky-400" /> Past Streams
        </div>
        {pastStreams.length === 0 ? (
          <div className="py-4 text-center text-gray-400">
            No past streams yet.<br />
            <span className="text-sky-400 font-semibold">Your VODs will appear here!</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {pastStreams.map((s) => (
              <div key={s.id} className="group rounded-xl overflow-hidden bg-gradient-to-br from-slate-800/60 to-sky-900/60 border border-sky-400/10 shadow hover:scale-[1.02] transition-transform cursor-pointer flex items-center gap-3 p-2" onClick={() => { setSelectedStream(s); setModalOpen(true); }}>
                <div className="w-20 h-14 bg-black flex items-center justify-center rounded-lg">
                  <PlayCircle className="text-sky-400 w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sky-100 truncate">{s.name}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <User className="w-4 h-4" /> {s.userId || 'Unknown'}
                  </div>
                  {s.playbackUrl && (
                    <video controls width="100%" height="60" className="rounded mt-2">
                      <source src={s.playbackUrl} type="application/x-mpegURL" />
                      Your browser does not support the video tag.
                    </video>
                  )}
                  {s.livepeerTvUrl && (
                    <a href={s.livepeerTvUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 underline mt-1 inline-block">Watch on Livepeer.tv</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <LiveStreamModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedStream(null); }}
        user={user}
        selectedStream={selectedStream}
        setSelectedStream={setSelectedStream}
      />
    </>
  );
} 