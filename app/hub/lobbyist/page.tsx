'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LobbyistPost from './components/LobbyistPost';
import CreatePostModal from './components/CreatePostModal';
import PostSkeleton from './components/PostSkeleton';
import DiscoverPeopleModal from './components/DiscoverPeopleModal';
import { 
  MessageSquare, 
  Users, 
  Bookmark, 
  TrendingUp, 
  Search, 
  Filter, 
  MapPin, 
  Flame, 
  Brain, 
  Heart, 
  Eye,
  BarChart2,
  Share2,
  Globe,
  Repeat,
  MessageCircle,
  PlusCircle
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';

interface Reaction {
  reaction_type: string;
  post_id: string;
}

interface PostData {
  id: string;
  title: string;
  content: string;
  post_type: string;
  created_at: string;
  tags: string[];
  image_url: string | null;
  user_id: string;
  is_private: boolean;
  followers_only: boolean;
  sub_lobby: string | null;
  user: {
    id: string;
    email: string;
  };
  e2_profile: {
    e2_user_id: string;
  } | null;
  reactions: { reaction_type: string }[];
  comments: { count: number }[];
}

const LiveStreamsPanel = dynamic(() => import('./components/LiveStreamsPanel'), { ssr: false });
const CommunitySentimentPanel = dynamic(() => import('./components/CommunitySentimentPanel'), { ssr: false });

// This page will be enhanced with actual components that we'll create next
export default function LobbyistPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('feed');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDiscoverPeopleOpen, setIsDiscoverPeopleOpen] = useState(false);
  const [activeSubLobby, setActiveSubLobby] = useState<string | null>(
    searchParams?.get('lobby') || null
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // User state for modal
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Feed state
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);

  // 1. Add state for bookmarks
  const [bookmarkedPostIds, setBookmarkedPostIds] = useState<string[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);

  // Add state for followingIds and loading
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  // Get initial session and set up auth listener
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        // Immediately try to get profile from Supabase
        supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) {
              setUserProfile({
                id: session.user.id,
                username: data.username,
                avatar: data.avatar_url
              });
            }
          });
      }
    });

    // Set up auth listener
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  // Fetch Earth2 profile username when user logs in
  useEffect(() => {
    async function loadProfile() {
      if (user) {
        setProfileLoading(true);
        try {
          const { fetchUserProfile } = await import('./profileUtils');
          console.log('Fetching user profile for user ID:', user.id);
          let profile = await fetchUserProfile(user.id);
          console.log('Profile fetch result:', profile);
          
          // If no profile was found, create a minimal fallback profile
          if (!profile) {
            console.log('No profile found, using fallback profile');
            profile = {
              id: user.id,
              username: user.email?.split('@')[0] || 'anonymous',
              avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${user.email?.split('@')[0] || 'anonymous'}`
            };
            
            // If this is the case, we should also try to save this basic profile to the database
            try {
              const { data, error } = await supabase
                .from('profiles')
                .upsert({
                  id: user.id,
                  username: profile.username,
                  avatar_url: profile.avatar,
                  updated_at: new Date().toISOString()
                });
                
              if (error) {
                console.error('Error saving fallback profile:', error);
              } else {
                console.log('Fallback profile saved successfully');
              }
            } catch (e) {
              console.error('Error during fallback profile save:', e);
            }
          }
          
          setUserProfile(profile);
        } catch (e) {
          console.error('Error loading profile:', e);
        } finally {
          setProfileLoading(false);
        }
      } else {
        setUserProfile(null);
      }
    }
    loadProfile();
  }, [user]);

  // Fetch posts from Supabase (client-side)
  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    setPostsError(null);
    try {
      let query = supabase
        .from('lobbyist_posts')
        .select(`
          *,
          profiles!inner(id, username, avatar_url),
          reactions:lobbyist_reactions(post_id, reaction_type),
          comments:lobbyist_comments(count),
          echoes:lobbyist_echoes!original_post_id(count)
        `)
        .order('created_at', { ascending: false });
      if (activeSubLobby) {
        query = query.eq('sub_lobby', activeSubLobby);
      }
      // Pagination (client-side, not as efficient as server-side, but works for now)
      const { data: posts, error } = await query;
      if (error) throw error;
      // Transform the data
      const transformedPosts = posts.map(post => {
        const postReactions = post.reactions || [];
        const commentCount = post.comments?.[0]?.count || 0;
        const echoCount = post.echoes?.[0]?.count || 0;
        return {
          id: post.id,
          title: post.title,
          content: post.content,
          postType: post.post_type,
          createdAt: post.created_at,
          tags: post.tags || [],
          images: [post.image_url].filter(Boolean) as string[],
          user: {
            id: post.user_id,
            name: post.profiles?.username || 'Earth2 Profile Required',
            avatar: post.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${post.profiles?.username || 'anonymous'}`,
            hasProfile: !!post.profiles?.username
          },
          reactions: {
            hyped: postReactions.filter((r: Reaction) => r.reaction_type === 'hyped').length,
            smart: postReactions.filter((r: Reaction) => r.reaction_type === 'smart').length,
            love: postReactions.filter((r: Reaction) => r.reaction_type === 'love').length,
            watching: postReactions.filter((r: Reaction) => r.reaction_type === 'watching').length
          },
          commentCount,
          echoCount
        };
      });
      setPosts(transformedPosts);
      // Set totalPages for client-side pagination
      setTotalPages(Math.max(1, Math.ceil(transformedPosts.length / pageSize)));
    } catch (e: any) {
      setPostsError(e.message || 'Failed to load posts');
    } finally {
      setLoadingPosts(false);
    }
  }, [activeSubLobby, pageSize]);

  // Fetch posts when component mounts or activeSubLobby changes
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Update handlePostCreated to use the same fetching logic
  const handlePostCreated = async () => {
    setIsCreateModalOpen(false);
    setPage(1);
    await fetchPosts();
  };

  // Filtering logic (client-side for search and tag)
  const filteredPosts = posts.filter(post => {
    // Search filter
    const matchesSearch =
      !searchTerm ||
      post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (post.tags && post.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase())));
    // Tag filter
    const matchesTag = !activeTag || (post.tags && post.tags.includes(activeTag));
    return matchesSearch && matchesTag;
  });

  // Pagination (client-side)
  const paginatedPosts = filteredPosts.slice((page - 1) * pageSize, page * pageSize);

  // 2. Fetch bookmarks for the current user
  useEffect(() => {
    const fetchBookmarks = async () => {
      setLoadingBookmarks(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setBookmarkedPostIds([]);
          setLoadingBookmarks(false);
          return;
        }
        const { data, error } = await supabase
          .from('lobbyist_bookmarks')
          .select('post_id')
          .eq('user_id', session.user.id);
        if (error) throw error;
        setBookmarkedPostIds(data.map((b: any) => b.post_id));
      } catch (e) {
        setBookmarkedPostIds([]);
      } finally {
        setLoadingBookmarks(false);
      }
    };
    fetchBookmarks();
  }, []);

  // 3. Add bookmark/unbookmark logic
  const handleBookmark = async (postId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    if (bookmarkedPostIds.includes(postId)) {
      // Remove bookmark
      await supabase
        .from('lobbyist_bookmarks')
        .delete()
        .eq('user_id', session.user.id)
        .eq('post_id', postId);
      setBookmarkedPostIds(ids => ids.filter(id => id !== postId));
    } else {
      // Add bookmark
      await supabase
        .from('lobbyist_bookmarks')
        .insert({ user_id: session.user.id, post_id: postId });
      setBookmarkedPostIds(ids => [...ids, postId]);
    }
  };

  // Fetch followingIds when user changes
  useEffect(() => {
    if (!user) {
      setFollowingIds([]);
      return;
    }
    setLoadingFollowing(true);
    supabase
      .from('socials')
      .select('following_id')
      .eq('follower_id', user.id)
      .eq('relationship_type', 'follow')
      .then(({ data, error }) => {
        if (!error && Array.isArray(data)) {
          setFollowingIds(data.map((row: any) => row.following_id));
        } else {
          setFollowingIds([]);
        }
        setLoadingFollowing(false);
      });
  }, [user]);

  // Tab filtering logic
  let displayedPosts = paginatedPosts;
  if (activeTab === 'following') {
    // Filter posts by followed users
    displayedPosts = paginatedPosts.filter(post => followingIds.includes(post.user.id));
  } else if (activeTab === 'bookmarks') {
    // Filter posts by bookmarks
    displayedPosts = paginatedPosts.filter(post => bookmarkedPostIds.includes(post.id));
  } else if (activeTab === 'trending') {
    // Sort by total reactions (descending)
    displayedPosts = [...paginatedPosts].sort((a, b) => {
      const aReactions = Object.values(a.reactions || {}).reduce((sum: number, v) => sum + Number(v || 0), 0);
      const bReactions = Object.values(b.reactions || {}).reduce((sum: number, v) => sum + Number(v || 0), 0);
      return bReactions - aReactions;
    });
  }

  // Tag click handler
  const handleTagClick = (tag: string) => {
    setActiveTag(tag);
    setPage(1);
  };

  // Clear tag filter
  const clearTagFilter = () => setActiveTag(null);

  // Mock sub-lobbies data
  const SUB_LOBBIES = [
    { id: 'sl1', name: 'Showcase', icon: <Globe size={18} /> },
    { id: 'sl2', name: 'RaidHQ', icon: <Users size={18} /> },
    { id: 'sl3', name: 'Markets', icon: <BarChart2 size={18} /> },
    { id: 'sl4', name: 'Ideas', icon: <Brain size={18} /> },
    { id: 'sl5', name: 'Drama', icon: <Flame size={18} /> }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header Section with Glassmorphic Effect */}
      <div className="relative overflow-hidden rounded-2xl mx-4 sm:mx-6 lg:mx-0 p-4 sm:p-6 backdrop-blur-lg bg-gradient-to-br from-indigo-900/40 to-violet-900/30 border border-indigo-400/30 shadow-xl mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 z-0"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="min-w-0 w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-sky-300 to-indigo-300 inline-block text-transparent bg-clip-text truncate">
              🪩 My Lobbyist
            </h1>
            <p className="text-cyan-200/90 mt-1 text-sm sm:text-base">
              Where digital landowners don't just talk — they lobby.
            </p>
          </div>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <PlusCircle size={16} />
            Create Post
          </Button>
        </div>
      </div>

      {/* Main Layout Container */}
      <div className="flex flex-col lg:flex-row gap-6 max-w-full px-4 sm:px-6 lg:px-0">
        {/* Left Sidebar */}
        <div className="w-full lg:w-1/4 space-y-6">
          <Card className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-sky-400/20 p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Lobbies</h3>
            <div className="flex flex-row flex-wrap lg:flex-col gap-2">
              {SUB_LOBBIES.map(lobby => (
                <Button
                  key={lobby.id}
                  variant="ghost"
                  className={`flex-1 sm:flex-none justify-start text-sm ${activeSubLobby === lobby.id ? 'bg-sky-600/20 text-sky-300' : 'text-gray-300 hover:text-white hover:bg-earthie-dark-light/40'}`}
                  onClick={() => setActiveSubLobby(activeSubLobby === lobby.id ? null : lobby.id)}
                >
                  {lobby.icon}
                  <span className="ml-2 truncate">{lobby.name}</span>
                </Button>
              ))}
            </div>
          </Card>
          {/* Live Streams Panel */}
          <LiveStreamsPanel user={userProfile} />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Tabs for different views */}
          <div className="max-w-full px-4 sm:px-6 lg:px-0 mb-6">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 w-full">
              <button 
                onClick={() => setActiveTab('feed')} 
                className={`flex items-center justify-center gap-2 py-2 sm:py-1.5 px-3 text-sm rounded-md transition-colors ${activeTab === 'feed' 
                  ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30' 
                  : 'text-gray-300 bg-earthie-dark/40 border border-transparent hover:border-sky-500/10 hover:bg-earthie-dark-light/20'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Feed</span>
              </button>
              
              <button 
                onClick={() => setActiveTab('following')} 
                className={`flex items-center justify-center gap-2 py-2 sm:py-1.5 px-3 text-sm rounded-md transition-colors ${activeTab === 'following' 
                  ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30' 
                  : 'text-gray-300 bg-earthie-dark/40 border border-transparent hover:border-sky-500/10 hover:bg-earthie-dark-light/20'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Following</span>
              </button>
              
              <button 
                onClick={() => setActiveTab('bookmarks')} 
                className={`flex items-center justify-center gap-2 py-2 sm:py-1.5 px-3 text-sm rounded-md transition-colors ${activeTab === 'bookmarks' 
                  ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30' 
                  : 'text-gray-300 bg-earthie-dark/40 border border-transparent hover:border-sky-500/10 hover:bg-earthie-dark-light/20'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>Bookmarks</span>
              </button>
              
              <button 
                onClick={() => setActiveTab('trending')} 
                className={`flex items-center justify-center gap-2 py-2 sm:py-1.5 px-3 text-sm rounded-md transition-colors ${activeTab === 'trending' 
                  ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30' 
                  : 'text-gray-300 bg-earthie-dark/40 border border-transparent hover:border-sky-500/10 hover:bg-earthie-dark-light/20'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Trending</span>
              </button>
            </div>

            <div className="mt-6">
              {activeTab === 'feed' && (
                <div className="space-y-6">
                  {/* Search and Filter */}
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mb-4">
                    <div className="relative flex-grow">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search posts..."
                        className="pl-10 bg-earthie-dark-light/30 border-sky-400/20 focus:border-sky-400/60 w-full"
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                      />
                    </div>
                    <Button variant="outline" className="border-sky-400/20 bg-earthie-dark-light/30 whitespace-nowrap" onClick={clearTagFilter} disabled={!activeTag}>
                      <Filter className="h-4 w-4 mr-2" />
                      {activeTag ? `Clear Tag: #${activeTag}` : 'Filter'}
                    </Button>
                  </div>

                  {/* Post Feed - loading, error, or posts */}
                  <div className="w-full">
                    {loadingPosts ? (
                      <div className="py-4 space-y-4">
                        {[...Array(3)].map((_, i) => <PostSkeleton key={i} />)}
                      </div>
                    ) : postsError ? (
                      <div className="backdrop-blur-md bg-gradient-to-br from-red-900/70 to-red-800/60 border border-red-400/20 rounded-xl p-4 mb-6 text-center py-8">
                        <MessageSquare className="h-10 w-10 text-red-400/40 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-red-200 mb-2">{postsError}</h3>
                        <Button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700 mt-2">Retry</Button>
                      </div>
                    ) : displayedPosts.length === 0 ? (
                      <div className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-sky-400/20 rounded-xl p-4 mb-6 text-center py-12">
                        <MessageSquare className="h-12 w-12 text-sky-400/30 mx-auto mb-3" />
                        <h3 className="text-xl font-medium text-white mb-2">No posts yet</h3>
                        <p className="text-gray-300 mb-4">Be the first to post in this lobby!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {displayedPosts.map(post => (
                          <div key={post.id} className="w-full">
                            <LobbyistPost
                              post={post}
                              onTagClick={handleTagClick}
                              isBookmarked={bookmarkedPostIds.includes(post.id)}
                              onBookmark={handleBookmark}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Pagination */}
                  <div className="flex justify-center mt-6 gap-2">
                    <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                    <span className="text-gray-300 px-2">Page {page} of {totalPages}</span>
                    <Button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                  </div>
                </div>
              )}

              {/* Following content */}
              {activeTab === 'following' && (
                <div className="space-y-6">
                  {/* Always show Discover People intro at the top, but only show the empty text if no posts */}
                <div className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-sky-400/20 rounded-xl p-4 sm:p-6 text-center">
                  <Users className="h-10 w-10 text-sky-400/50 mx-auto mb-3" />
                    {displayedPosts.length === 0 && !loadingFollowing && (
                      <>
                  <h3 className="text-xl font-medium text-white mb-2">No followed posts yet</h3>
                  <p className="text-gray-300 mb-4">Follow other lobbyists to see their posts here.</p>
                      </>
                    )}
                  <Button 
                    onClick={() => setIsDiscoverPeopleOpen(true)}
                    className="bg-sky-600 hover:bg-sky-700"
                  >
                    Discover People
                  </Button>
                  </div>
                  {/* Show posts or loading/empty state below */}
                  {loadingFollowing ? (
                    <div className="py-4 space-y-4">
                      {[...Array(3)].map((_, i) => <PostSkeleton key={i} />)}
                    </div>
                  ) : (
                    displayedPosts.length === 0 ? null : (
                      <div className="space-y-4">
                        {displayedPosts.map(post => (
                          <div key={post.id} className="w-full">
                            <LobbyistPost
                              post={post}
                              onTagClick={handleTagClick}
                              isBookmarked={bookmarkedPostIds.includes(post.id)}
                              onBookmark={handleBookmark}
                            />
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}
              
              {/* Bookmarks content */}
              {activeTab === 'bookmarks' && (
                <div className="space-y-6">
                  <div className="w-full">
                    {loadingBookmarks ? (
                      <div className="py-4 space-y-4">
                        {[...Array(3)].map((_, i) => <PostSkeleton key={i} />)}
                      </div>
                    ) : displayedPosts.length === 0 ? (
                      <div className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-sky-400/20 rounded-xl p-4 mb-6 text-center py-12">
                        <Bookmark className="h-12 w-12 text-sky-400/30 mx-auto mb-3" />
                  <h3 className="text-xl font-medium text-white mb-2">No bookmarks yet</h3>
                  <p className="text-gray-300 mb-4">Save posts to see them here!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {displayedPosts.map(post => (
                          <div key={post.id} className="w-full">
                            <LobbyistPost
                              post={post}
                              onTagClick={handleTagClick}
                              isBookmarked={bookmarkedPostIds.includes(post.id)}
                              onBookmark={handleBookmark}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Trending content */}
              {activeTab === 'trending' && (
                <div className="space-y-6">
                  <div className="w-full">
                    {loadingPosts ? (
                      <div className="py-4 space-y-4">
                        {[...Array(3)].map((_, i) => <PostSkeleton key={i} />)}
                      </div>
                    ) : displayedPosts.length === 0 ? (
                      <div className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-sky-400/20 rounded-xl p-4 mb-6 text-center py-12">
                        <TrendingUp className="h-12 w-12 text-sky-400/30 mx-auto mb-3" />
                  <h3 className="text-xl font-medium text-white mb-2">No trending posts yet</h3>
                  <p className="text-gray-300 mb-4">Trending posts will appear here soon.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {displayedPosts.map(post => (
                          <div key={post.id} className="w-full">
                            <LobbyistPost
                              post={post}
                              onTagClick={handleTagClick}
                              isBookmarked={bookmarkedPostIds.includes(post.id)}
                              onBookmark={handleBookmark}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Hidden on mobile, shown on lg screens */}
        <div className="hidden lg:block w-1/4 space-y-6">
          <CommunitySentimentPanel />
          {/* Leaderboard - Only show if real leaderboard data exists */}
          {/* {leaderboard && leaderboard.length > 0 && (
            <Card>...</Card>
          )} */}
          {/* Trending Topics - Only show if real trending data exists */}
          {/* {trendingTopics && trendingTopics.length > 0 && (
            <Card>...</Card>
          )} */}
          {/* Drafts - Only show if user has drafts */}
          {/* {drafts && drafts.length > 0 && (
            <Card>...</Card>
          )} */}
        </div>
      </div>

      {/* Create Post Modal */}
      <CreatePostModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        onCreatePost={handlePostCreated}
        user={userProfile}
      />

      {/* Discover People Modal */}
      <DiscoverPeopleModal
        isOpen={isDiscoverPeopleOpen}
        onClose={() => setIsDiscoverPeopleOpen(false)}
      />
    </div>
  );
}
