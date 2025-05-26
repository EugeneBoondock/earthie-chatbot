import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Video, Radio, UploadCloud, X, PlayCircle, User, Eye, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Helper: fetch with error handling
async function fetchJson(url: string, opts?: RequestInit): Promise<any> {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

interface LiveStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { id: string; name?: string } | null;
  selectedStream?: Stream | null;
  setSelectedStream?: (s: Stream | null) => void;
}

interface Stream {
  id: string;
  name: string;
  userId?: string;
  isActive?: boolean;
  viewerCount?: number;
  playbackUrl?: string;
}

interface AlertState {
  msg: string;
  type: 'info' | 'success' | 'error';
}

const REACTIONS = [
  { emoji: '🔥', label: 'Hyped' },
  { emoji: '💡', label: 'Smart' },
  { emoji: '💜', label: 'Love' },
  { emoji: '👀', label: 'Watching' },
  { emoji: '🪩', label: 'Earthie' },
  { emoji: '🎉', label: 'Celebrate' },
  { emoji: '🤯', label: 'Mind-blown' },
];

export default function LiveStreamModal({ isOpen, onClose, user, selectedStream: selectedStreamProp, setSelectedStream }: LiveStreamModalProps) {
  const [tab, setTab] = useState<'discover'|'golive'|'watch'>('discover');
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [streamName, setStreamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [myStream, setMyStream] = useState<any>(null);
  const [selectedStream, setSelectedStreamState] = useState<Stream | null>(null);
  const [browserStream, setBrowserStream] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [reactions, setReactions] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [vodStart, setVodStart] = useState<Date | null>(null);
  const [vodCurrent, setVodCurrent] = useState<number>(0);
  const vodIntervalRef = useRef<any>(null);

  // Sync selectedStream prop to state
  useEffect(() => {
    if (selectedStreamProp) {
      setSelectedStreamState(selectedStreamProp);
      setTab('watch');
    }
  }, [selectedStreamProp]);

  // When closing, clear selectedStream in parent if provided
  const handleClose = () => {
    if (setSelectedStream) setSelectedStream(null);
    setSelectedStreamState(null);
    onClose();
  };

  // Fetch all live streams
  useEffect(() => {
    if (!isOpen) return;
    setLoadingStreams(true);
    fetch('/api/livepeer')
      .then(r => r.json())
      .then(data => setStreams(Array.isArray(data) ? data : data.data || []))
      .catch(() => setStreams([]))
      .finally(() => setLoadingStreams(false));
  }, [isOpen, myStream]);

  // Fetch chat and reactions for the stream (live or VOD)
  useEffect(() => {
    if (!selectedStream) return;
    const fetchChatAndReactions = async () => {
      const { data: chat } = await supabase
        .from('lobbyist_stream_chats')
        .select('*')
        .eq('stream_id', selectedStream.id)
        .order('created_at', { ascending: true });
      setChatMessages(chat || []);
      const { data: reacts } = await supabase
        .from('lobbyist_stream_reactions')
        .select('*')
        .eq('stream_id', selectedStream.id)
        .order('created_at', { ascending: true });
      setReactions(reacts || []);
      // For VOD, set start time
      if (!selectedStream.isActive && chat && chat.length > 0) {
        setVodStart(new Date(chat[0].created_at));
      } else {
        setVodStart(null);
      }
    };
    fetchChatAndReactions();
  }, [selectedStream]);

  // Subscribe to realtime chat/reactions for live
  useEffect(() => {
    if (!selectedStream || !selectedStream.isActive) return;
    const chatSub = supabase
      .channel('lobbyist_stream_chats')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobbyist_stream_chats', filter: `stream_id=eq.${selectedStream.id}` }, payload => {
        setChatMessages(msgs => [...msgs, payload.new]);
      })
      .subscribe();
    const reactSub = supabase
      .channel('lobbyist_stream_reactions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lobbyist_stream_reactions', filter: `stream_id=eq.${selectedStream.id}` }, payload => {
        setReactions(rs => [...rs, payload.new]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(chatSub);
      supabase.removeChannel(reactSub);
    };
  }, [selectedStream]);

  // VOD: Replay chat/reactions in sync with video
  useEffect(() => {
    if (!selectedStream || selectedStream.isActive || !vodStart) return;
    setVodCurrent(0);
    if (vodIntervalRef.current) clearInterval(vodIntervalRef.current);
    vodIntervalRef.current = setInterval(() => {
      const video = document.getElementById('vod-player') as HTMLVideoElement;
      if (video) setVodCurrent(video.currentTime);
    }, 500);
    return () => vodIntervalRef.current && clearInterval(vodIntervalRef.current);
  }, [selectedStream, vodStart]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Send chat message
  const sendChat = async () => {
    if (!chatInput.trim() || !user || !selectedStream) return;
    setSending(true);
    const username = user.name || 'Earth2 Profile Required';
    const avatar = (user as any).avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name || 'anonymous'}`;
    await supabase.from('lobbyist_stream_chats').insert({
      stream_id: selectedStream.id,
      user_id: user.id,
      username,
      avatar,
      message: chatInput.trim(),
    });
    setChatInput('');
    setSending(false);
  };

  // Send reaction
  const sendReaction = async (emoji: string) => {
    if (!user || !selectedStream) return;
    await supabase.from('lobbyist_stream_reactions').insert({
      stream_id: selectedStream.id,
      user_id: user.id,
      reaction: emoji,
    });
  };

  // Filter chat/reactions for VOD replay
  let displayedChat = chatMessages;
  let displayedReactions = reactions;
  if (selectedStream && !selectedStream.isActive && vodStart) {
    const vodStartTime = vodStart.getTime();
    displayedChat = chatMessages.filter(m => (new Date(m.created_at).getTime() - vodStartTime) / 1000 <= vodCurrent);
    displayedReactions = reactions.filter(r => (new Date(r.created_at).getTime() - vodStartTime) / 1000 <= vodCurrent);
  }

  // Reaction counts (last 30s for live, all for VOD)
  const now = Date.now();
  const reactionCounts = REACTIONS.reduce((acc, r) => {
    acc[r.emoji] = displayedReactions.filter(rx => r.emoji === rx.reaction && (selectedStream?.isActive ? now - new Date(rx.created_at).getTime() < 30000 : true)).length;
    return acc;
  }, {} as Record<string, number>);

  // Animated alert
  const showAlert = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3500);
  };

  // Create a new stream
  const handleCreateStream = async (browser = false) => {
    if (!streamName.trim()) {
      showAlert('Please enter a stream title', 'error');
      return;
    }
    setCreating(true);
    try {
      const data = await fetchJson('/api/livepeer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: streamName, userId: user?.id || 'anon' })
      });
      setMyStream(data);
      setTab('golive');
      setBrowserStream(browser);
      showAlert('Stream created! Copy your stream key or start browser streaming.', 'success');
    } catch (e: any) {
      showAlert(e?.message || 'Unknown error', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Start browser streaming (webcam)
  useEffect(() => {
    if (!browserStream || !myStream || !videoRef.current) return;
    let mediaStream: MediaStream | undefined;
    (async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
        showAlert('Webcam preview started. (Streaming to Livepeer requires additional integration)', 'info');
      } catch (e: any) {
        showAlert(e?.message || 'Could not access webcam/mic', 'error');
      }
    })();
    return () => { mediaStream && mediaStream.getTracks().forEach(t => t.stop()); };
  }, [browserStream, myStream]);

  // UI
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-sky-900/90 to-indigo-900/90 border border-sky-400/30 shadow-2xl text-white rounded-2xl p-0 overflow-hidden">
        {/* Animated Alert */}
        {alert && (
          <div className={`fixed z-50 left-1/2 -translate-x-1/2 top-8 px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 text-white animate-fade-in-up ${alert.type==='error' ? 'bg-red-600/90' : alert.type==='success' ? 'bg-emerald-600/90' : 'bg-sky-700/90'}`}> 
            {alert.type==='error' ? <AlertCircle /> : alert.type==='success' ? <UploadCloud /> : <Radio />} 
            <span className="font-semibold">{alert.msg}</span>
          </div>
        )}
        <DialogHeader className="p-6 pb-2 flex flex-row items-center justify-between bg-gradient-to-r from-sky-800/80 to-indigo-800/80">
          <DialogTitle className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Video className="text-sky-400" /> Lobbyist Live
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full hover:bg-sky-900/30">
            <X />
          </Button>
        </DialogHeader>
        <div className="flex flex-col md:flex-row gap-0 md:gap-6 p-6 pt-2">
          {/* Left: Tabs/Actions */}
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 mb-4">
              <Button onClick={()=>setTab('discover')} variant={tab==='discover'?'default':'ghost'} className="rounded-full px-4">Discover</Button>
              <Button onClick={()=>setTab('golive')} variant={tab==='golive'?'default':'ghost'} className="rounded-full px-4">Go Live</Button>
            </div>
            {tab==='discover' && (
              <div>
                <h3 className="text-xl font-semibold mb-4">Live Now</h3>
                {loadingStreams ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-sky-400" /></div>
                ) : streams.length === 0 ? (
                  <div className="text-center text-gray-400 py-10">No one is live right now. Be the first to go live!</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {streams.map((s) => (
                      <div key={s.id} className="relative group rounded-xl overflow-hidden bg-gradient-to-br from-sky-900/60 to-indigo-900/60 border border-sky-400/20 shadow-lg hover:scale-[1.03] transition-transform cursor-pointer" onClick={()=>{setSelectedStreamState(s);setTab('watch');}}>
                        <div className="aspect-video bg-black flex items-center justify-center">
                          {s.isActive ? <PlayCircle className="text-emerald-400 w-12 h-12 animate-pulse" /> : <Radio className="text-gray-500 w-10 h-10" />}
                        </div>
                        <div className="absolute top-2 left-2 bg-sky-700/80 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><User className="w-4 h-4" />{s.userId || 'Unknown'}</div>
                        <div className="absolute top-2 right-2 bg-emerald-600/80 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Eye className="w-4 h-4" />{s.viewerCount || 0}</div>
                        <div className="p-3 pb-2">
                          <div className="font-bold text-lg truncate text-sky-200">{s.name}</div>
                          <div className="text-xs text-gray-400">Stream ID: {s.id.slice(0,8)}...</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab==='golive' && !myStream && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-1">Stream Title</label>
                  <Input value={streamName} onChange={e=>setStreamName(e.target.value)} placeholder="Give your stream a catchy title!" className="bg-sky-900/30 border-sky-400/20" maxLength={80} />
                </div>
                <div className="flex gap-4">
                  <Button onClick={()=>handleCreateStream(false)} disabled={creating} className="flex-1 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700">RTMP (OBS, etc.)</Button>
                  <Button onClick={()=>handleCreateStream(true)} disabled={creating} className="flex-1 bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-700 hover:to-sky-700">Browser Stream</Button>
                </div>
                {creating && <div className="flex items-center gap-2 text-sky-400"><Loader2 className="animate-spin" /> Creating stream...</div>}
              </div>
            )}
            {tab==='golive' && myStream && !browserStream && (
              <div className="space-y-4">
                <div className="bg-sky-900/40 border border-sky-400/20 rounded-lg p-4">
                  <div className="font-bold text-lg mb-2">RTMP Stream Details</div>
                  <div className="mb-2"><span className="font-semibold">Ingest URL:</span> <span className="text-sky-300 select-all">rtmp://rtmp.livepeer.com/live</span></div>
                  <div className="mb-2"><span className="font-semibold">Stream Key:</span> <span className="text-sky-300 select-all">{myStream.streamKey || '...'}</span></div>
                  <div className="mb-2 text-xs text-gray-400">Use OBS, Streamlabs, or any RTMP software. Your stream will appear in the Live grid above when you go live!</div>
                  <Button onClick={()=>{setMyStream(null);setStreamName('');}} variant="ghost" className="mt-2">Done</Button>
                </div>
              </div>
            )}
            {tab==='golive' && myStream && browserStream && (
              <div className="space-y-4">
                <div className="bg-sky-900/40 border border-sky-400/20 rounded-lg p-4">
                  <div className="font-bold text-lg mb-2">Browser Streaming (Webcam)</div>
                  <video ref={videoRef} className="rounded-lg w-full aspect-video bg-black mb-2" autoPlay muted playsInline />
                  <div className="mb-2 text-xs text-gray-400">This is a preview. (To actually stream to Livepeer, integrate the Livepeer JS SDK or push the stream from your browser.)</div>
                  <Button onClick={()=>{setMyStream(null);setStreamName('');setBrowserStream(false);}} variant="ghost" className="mt-2">Done</Button>
                </div>
              </div>
            )}
            {tab==='watch' && selectedStream && (
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="bg-sky-900/40 border border-sky-400/20 rounded-lg p-4 mb-4">
                    <div className="font-bold text-lg mb-2">Now Watching: {selectedStream.name}</div>
                    <video
                      id={selectedStream.isActive ? undefined : 'vod-player'}
                      src={selectedStream.playbackUrl || selectedStream.playbackUrl || ''}
                      controls
                      autoPlay
                      className="rounded-lg w-full aspect-video bg-black mb-2"
                    />
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <User className="w-4 h-4" /> {selectedStream.userId || 'Unknown'}
                      <Eye className="w-4 h-4 ml-4" /> {selectedStream.viewerCount || 0}
                    </div>
                  </div>
                </div>
                {/* Chat & Reactions */}
                <div className="w-full md:w-80 flex flex-col gap-2">
                  {/* Reactions Bar */}
                  <div className="flex gap-2 justify-center md:justify-end mb-2">
                    {REACTIONS.map(r => (
                      <button
                        key={r.emoji}
                        className="relative text-2xl hover:scale-125 transition-transform duration-150"
                        onClick={() => sendReaction(r.emoji)}
                        title={r.label}
                      >
                        {r.emoji}
                        {reactionCounts[r.emoji] > 0 && (
                          <span className="absolute -top-2 -right-2 bg-sky-600 text-white text-xs rounded-full px-1.5 py-0.5 animate-bounce shadow">
                            {reactionCounts[r.emoji]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {/* Chat Box */}
                  <div className="flex-1 bg-sky-900/30 border border-sky-400/10 rounded-lg p-2 flex flex-col overflow-y-auto max-h-80">
                    {displayedChat.length === 0 ? (
                      <div className="text-center text-gray-400 py-8">No chat yet. Be the first to say hi!</div>
                    ) : (
                      displayedChat.map((msg, idx) => (
                        <div key={msg.id || idx} className="flex items-start gap-2 mb-2">
                          <img src={msg.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${msg.username || 'User'}`} alt="avatar" className="w-7 h-7 rounded-full border border-sky-400/20" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sky-200 text-sm truncate">{msg.username || 'User'}</span>
                              <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="text-sm text-white break-words">{msg.message}</div>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  {/* Chat Input */}
                  <form className="flex gap-2 mt-2" onSubmit={e => { e.preventDefault(); sendChat(); }}>
                    <input
                      type="text"
                      className="flex-1 rounded-lg px-3 py-2 bg-sky-900/40 border border-sky-400/20 text-white focus:outline-none focus:border-sky-400"
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      disabled={sending || !user}
                      maxLength={200}
                    />
                    <Button type="submit" disabled={sending || !user} className="bg-sky-600 hover:bg-sky-700">Send</Button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="p-6 pt-0 flex justify-end">
          <Button onClick={handleClose} variant="outline" className="border-sky-400/30 hover:bg-sky-900/20">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 