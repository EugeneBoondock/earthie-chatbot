import { useState, useEffect, useRef } from 'react';
import LiveStreamModal from './LiveStreamModal';
import { PlayCircle, User, Eye, Radio, Video, Loader2, RefreshCw, ExternalLink, Play, Pause, Volume2, Maximize2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Hls from 'hls.js';
import React, { useCallback } from 'react';

interface Stream {
  id: string;
  name: string;
  userId?: string;
  isActive?: boolean;
  viewerCount?: number;
  playbackUrl?: string;
  livepeerTvUrl?: string;
  playbackId?: string;
  sessions?: any[];
}

interface Vod {
  title: string;
  playbackId: string;
  hlsUrl: string;
  createdAt: number;
  duration?: number;
  playbackSources?: any[];
}

function HLSPlayer({ url, onError }: { url: string; onError?: () => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [hlsInstance, setHlsInstance] = React.useState<Hls | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState('');
  const maxRetries = 3;
  const retryDelay = 1000;

  // Helper function to format time (mm:ss)
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle HLS initialization and error recovery
  const initHLS = useCallback(() => {
    if (!videoRef.current) return () => {};
    const video = videoRef.current;
    let hls: Hls | null = null;
    const canPlayNativeHLS = video.canPlayType('application/vnd.apple.mpegurl');
    if (canPlayNativeHLS) {
      video.src = url;
      setLoading(false);
      const handleError = () => {
        setError(true);
        setErrorMessage('Failed to load stream using native player');
        onError && onError();
      };
      video.addEventListener('error', handleError);
      return () => video.removeEventListener('error', handleError);
    }
    if (Hls.isSupported()) {
      hls = new Hls({
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        xhrSetup: (xhr: XMLHttpRequest) => { xhr.withCredentials = false; },
        fragLoadingMaxRetry: 6,
        fragLoadingMaxRetryTimeout: 64000,
        fragLoadingRetryDelay: 1000,
        enableWorker: true,
        enableSoftwareAES: true,
        startLevel: -1,
      } as any);
      hls.on(Hls.Events.MANIFEST_PARSED, (event: any, data: any) => {
        setLoading(false);
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((e: Error) => {
            handlePlaybackError('playback_failed', e.message);
          });
        }
      });
      hls.on(Hls.Events.ERROR, (event: any, data: any) => {
        if (data.fatal) {
          handleFatalError(data);
        }
      });
      try {
        hls.loadSource(url);
        hls.attachMedia(video);
        setHlsInstance(hls);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        handleFatalError({ type: 'init_error', details: errorMessage, fatal: true });
      }
    } else {
      setError(true);
      setErrorMessage('Your browser does not support HLS streaming');
      onError && onError();
    }
    return () => { if (hls) hls.destroy(); };
  }, [url, retryCount]);

  // Handle fatal HLS errors
  const handleFatalError = useCallback((errorData: any) => {
    let errorMsg = 'Failed to load stream';
    switch (errorData.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        errorMsg = 'Network error. Please check your connection.';
        if (retryCount < maxRetries) {
          const delay = retryDelay * (retryCount + 1);
          setTimeout(() => { setRetryCount(prev => prev + 1); }, delay);
          return;
        }
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        errorMsg = 'Media error. The stream may be corrupted or unsupported.';
        if (hlsInstance) {
          hlsInstance.recoverMediaError();
          return;
        }
        break;
      case Hls.ErrorTypes.OTHER_ERROR:
        errorMsg = 'An unexpected error occurred';
        break;
    }
    setError(true);
    setErrorMessage(errorMsg);
    onError && onError();
  }, [hlsInstance, retryCount]);

  // Handle playback errors (e.g., autoplay blocked)
  const handlePlaybackError = useCallback((errorType: string, message: string) => {
    if (errorType === 'autoplay_denied') {
      setErrorMessage('Autoplay was blocked. Please click play to start the stream.');
      setLoading(false);
      return;
    }
    if (retryCount < maxRetries) {
      const delay = retryDelay * (retryCount + 1);
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        videoRef.current?.load();
        videoRef.current?.play().catch(() => {});
      }, delay);
    } else {
      setError(true);
      setErrorMessage('Failed to play the stream. Please try again later.');
      onError && onError();
    }
  }, [retryCount]);

  React.useEffect(() => {
    const cleanup = initHLS();
    return () => {
      cleanup?.();
      if (hlsInstance) {
        hlsInstance.destroy();
        setHlsInstance(null);
      }
    };
  }, [url, retryCount]);

  if (error) {
    return (
      <div className="aspect-video bg-gray-800 rounded-md flex items-center justify-center">
        <div className="text-center p-4 max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-100 mb-1">Stream Unavailable</h3>
          <p className="text-gray-300 text-sm mb-4">
            {errorMessage || 'Failed to load the stream. Please try again later.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button 
              variant="outline" 
              className="text-sky-400 border-sky-400/30 hover:bg-sky-400/10"
              onClick={() => {
                setError(false);
                setRetryCount(0);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button 
              variant="ghost" 
              className="text-gray-300 hover:bg-gray-700/50"
              onClick={() => { window.open(url, '_blank'); }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
          {retryCount > 0 && (
            <p className="text-xs text-gray-500 mt-3">
              Attempt {Math.min(retryCount, maxRetries)} of {maxRetries}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video bg-black rounded-md overflow-hidden group">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 z-10">
          <Loader2 className="h-10 w-10 animate-spin text-sky-400 mb-3" />
          <p className="text-gray-300 text-sm">
            {retryCount > 0 
              ? `Attempting to connect (${retryCount}/${maxRetries})...` 
              : 'Loading stream...'}
          </p>
          {retryCount > 0 && (
            <button 
              onClick={() => setRetryCount(0)}
              className="mt-2 text-xs text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        autoPlay
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        preload="auto"
        onError={(e) => {
          handlePlaybackError('video_error', 'Video playback failed');
        }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onStalled={() => setLoading(true)}
        onEmptied={() => setLoading(true)}
      />
      {/* Custom controls overlay (optional, can be extended) */}
    </div>
  );
}

export default function LiveStreamsPanel({ user }: { user: any }) {
  const [liveStreams, setLiveStreams] = useState<Stream[]>([]);
  const [vods, setVods] = useState<Vod[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/livepeer')
      .then(r => r.json())
      .then(data => {
        setLiveStreams(Array.isArray(data.live) ? data.live : []);
        // If vods is empty, generate fallback VODs from non-active streams with playbackId
        if (Array.isArray(data.vods) && data.vods.length > 0) {
          setVods(data.vods);
        } else if (Array.isArray(data.live)) {
          // Fallback: use non-active streams with playbackId
          const fallbackVods = data.live
            .filter((s: any) => !s.isActive && s.playbackId)
            .map((s: any) => ({
              title: s.name || 'Past Stream',
              playbackId: s.playbackId,
              hlsUrl: `https://livepeercdn.studio/hls/${s.playbackId}/index.m3u8`,
              createdAt: s.createdAt || 0,
              duration: s.transcodedSegmentsDuration || s.sourceSegmentsDuration || 0,
              playbackSources: [],
            }));
          setVods(fallbackVods);
        } else {
          setVods([]);
        }
      })
      .catch(() => {
        setLiveStreams([]);
        setVods([]);
      })
      .finally(() => setLoading(false));
  }, [modalOpen]);

  const liveNow = liveStreams.filter(s => s.isActive);

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
        ) : liveNow.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            No one is live right now.<br />
            <span className="text-sky-400 font-semibold">Be the first to go live!</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {liveNow.map((s) => (
              <div key={s.id} className="group rounded-xl overflow-hidden bg-gradient-to-br from-sky-900/60 to-indigo-900/60 border border-sky-400/10 shadow hover:scale-[1.02] transition-transform cursor-pointer flex items-center gap-3 p-2" onClick={() => { setSelectedStream(s); setModalOpen(true); }}>
                <div className="w-20 h-14 bg-black flex items-center justify-center rounded-lg">
                  {s.playbackId ? (
                    <img
                      src={`https://image.livepeer.studio/thumbnail/${s.playbackId}/storyboard.jpg`}
                      alt="Stream thumbnail"
                      className="w-20 h-14 object-cover rounded"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <PlayCircle className="text-emerald-400 w-8 h-8 animate-pulse" />
                  )}
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
        {vods.length === 0 ? (
          <div className="py-4 text-center text-gray-400">
            No past streams yet.<br />
            <span className="text-sky-400 font-semibold">Your VODs will appear here!</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {vods.map((vod) => (
              <div key={vod.playbackId} className="group rounded-xl overflow-hidden bg-gradient-to-br from-slate-800/60 to-sky-900/60 border border-sky-400/10 shadow hover:scale-[1.02] transition-transform flex flex-col gap-2 p-2">
                <div className="font-bold text-sky-100 truncate">{vod.title}</div>
                <div className="aspect-video w-full rounded-md overflow-hidden bg-black">
                  <iframe
                    src={`https://lvpr.tv?v=${vod.playbackId}`}
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full min-h-[200px] rounded-md border-0"
                    title={`VOD: ${vod.title}`}
                    loading="lazy"
                    frameBorder="0"
                  />
                </div>
                {/* Optionally show duration, createdAt, etc. */}
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