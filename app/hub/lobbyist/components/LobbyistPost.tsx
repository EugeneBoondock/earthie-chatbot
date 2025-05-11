'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Heart, 
  MessageCircle, 
  Repeat, 
  Share2, 
  MoreHorizontal, 
  Flame, 
  Brain, 
  Eye, 
  Globe, 
  MapPin,
  Calendar,
  Users,
  BarChart2,
  BookOpen
} from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import CommentSkeleton from './CommentSkeleton';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';

// Post types
export type PostType = 'text' | 'image' | 'link' | 'trade' | 'poll' | 'dev_diary' | 'raid' | 'showcase';

// Reaction types
export type ReactionType = 'hyped' | 'smart' | 'love' | 'watching';

// Post interface
export interface LobbyistPostProps {
  post: {
    id: string;
    user: {
      id: string;
      name: string;
      avatar: string;
      country?: string;
      tier?: number;
    };
    title: string;
    content: string;
    images?: string[];
    postType: PostType | string;
    tags: string[];
    createdAt: string;
    reactions: {
      hyped: number;
      smart: number;
      love: number;
      watching: number;
    };
    commentCount: number;
    echoCount: number;
  };
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onEcho?: (postId: string) => void;
  onShare?: (postId: string) => void;
}

// Function to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  // If more than a week, show actual date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

export default function LobbyistPost({ post, onLike, onComment, onEcho, onShare }: LobbyistPostProps) {
  const { toast } = useToast();
  // Local state for reactions
  const [activeReaction, setActiveReaction] = useState<ReactionType | null>(null);
  const [reactions, setReactions] = useState(post.reactions);
  const [reactionLoading, setReactionLoading] = useState<ReactionType | null>(null);
  // Comments
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  // Echo state
  const [isEchoed, setIsEchoed] = useState(false);
  const [echoCount, setEchoCount] = useState(post.echoCount);
  const [echoLoading, setEchoLoading] = useState(false);

  // Check if user has echoed this post
  useEffect(() => {
    const checkEchoStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('lobbyist_echoes')
        .select('id')
        .eq('original_post_id', post.id)
        .eq('user_id', session.user.id)
        .single();

      setIsEchoed(!!data);
    };

    checkEchoStatus();
  }, [post.id]);

  // Handle echo
  const handleEcho = async () => {
    if (echoLoading) return;
    setEchoLoading(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      if (isEchoed) {
        // Remove echo
        const { error } = await supabase
          .from('lobbyist_echoes')
          .delete()
          .eq('original_post_id', post.id)
          .eq('user_id', session.user.id);

        if (error) throw error;
        setEchoCount(prev => Math.max(0, prev - 1));
        setIsEchoed(false);
      } else {
        // Add echo
        const { error } = await supabase
          .from('lobbyist_echoes')
          .insert({
            original_post_id: post.id,
            user_id: session.user.id
          });

        if (error) throw error;
        setEchoCount(prev => prev + 1);
        setIsEchoed(true);
      }

      if (onEcho) onEcho(post.id);
    } catch (e: any) {
      toast({
        title: 'Failed to echo post',
        description: e.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setEchoLoading(false);
    }
  };

  // Handle share
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.content,
          url: `${window.location.origin}/hub/lobbyist/post/${post.id}`
        });
      } else {
        // Fallback to copying link to clipboard
        const url = `${window.location.origin}/hub/lobbyist/post/${post.id}`;
        await navigator.clipboard.writeText(url);
        toast({
          title: 'Link copied to clipboard',
          description: 'You can now share this post with others.',
        });
      }

      if (onShare) onShare(post.id);
    } catch (e: any) {
      if (e.name !== 'AbortError') { // Don't show error if user cancelled share dialog
        toast({
          title: 'Failed to share post',
          description: e.message || 'Unknown error',
          variant: 'destructive',
        });
      }
    }
  };

  // Fetch comments when showComments is toggled on
  const fetchComments = async () => {
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const { data: comments, error } = await supabase
        .from('lobbyist_comments')
        .select(`
          *,
          profiles (id, username, avatar_url)
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setComments(comments.map(comment => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.created_at,
        user: {
          id: comment.profiles?.id || '',
          name: comment.profiles?.username || 'Anonymous',
          avatar: comment.profiles?.avatar_url
        }
      })));
    } catch (e: any) {
      setCommentsError(e.message || 'Unknown error');
      toast({
        title: 'Error loading comments',
        description: e.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleToggleComments = () => {
    setShowComments((prev) => {
      const next = !prev;
      if (next && comments.length === 0) fetchComments();
      return next;
    });
  };

  // Handle reaction (add/remove)
  const handleReaction = async (type: ReactionType) => {
    if (reactionLoading) return;
    setReactionLoading(type);
    let updated = { ...reactions };
    let newActive: ReactionType | null = type;
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      if (activeReaction === type) {
        // Remove reaction
        const { error } = await supabase
          .from('lobbyist_reactions')
          .delete()
          .eq('post_id', post.id)
          .eq('reaction_type', type)
          .eq('user_id', session.user.id);

        if (error) throw error;
        updated[type] = Math.max(0, updated[type] - 1);
        newActive = null;
      } else {
        // Add reaction
        const { error } = await supabase
          .from('lobbyist_reactions')
          .insert({
            post_id: post.id,
            reaction_type: type,
            user_id: session.user.id
          });

        if (error) throw error;
        updated[type] = (updated[type] || 0) + 1;
        // Remove previous reaction if any
        if (activeReaction && activeReaction !== type) {
          await supabase
            .from('lobbyist_reactions')
            .delete()
            .eq('post_id', post.id)
            .eq('reaction_type', activeReaction)
            .eq('user_id', session.user.id);
          updated[activeReaction] = Math.max(0, updated[activeReaction] - 1);
        }
      }
      setActiveReaction(newActive);
      setReactions(updated);
    } catch (e: any) {
      toast({
        title: 'Failed to update reaction',
        description: e.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setReactionLoading(null);
    }
    if (onLike) onLike(post.id);
  };

  // Add a comment
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setAddingComment(true);
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      const { data, error } = await supabase
        .from('lobbyist_comments')
        .insert({
          post_id: post.id,
          content: newComment,
          user_id: session.user.id
        })
        .select(`
          *,
          profiles (id, username, avatar_url)
        `)
        .single();

      if (error) throw error;

      const newCommentData = {
        id: data.id,
        content: data.content,
        createdAt: data.created_at,
        user: {
          id: data.profiles?.id || '',
          name: data.profiles?.username || 'Anonymous',
          avatar: data.profiles?.avatar_url
        }
      };

      setComments((prev) => [...prev, newCommentData]);
      setNewComment('');
    } catch (e: any) {
      toast({
        title: 'Failed to add comment',
        description: e.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setAddingComment(false);
    }
  };


  // Map post types to icons
  const postTypeIcons: Record<string, JSX.Element> = {
    'showcase': <Globe size={14} className="text-sky-400" />,
    'trade': <Share2 size={14} className="text-green-400" />,
    'raid': <Users size={14} className="text-amber-400" />,
    'poll': <BarChart2 size={14} className="text-purple-400" />,
    'dev_diary': <BookOpen size={14} className="text-indigo-400" />
  };

  return (
    <Card className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-sky-400/20 overflow-hidden transition-all hover:border-sky-400/40 hover:shadow-lg hover:shadow-sky-900/20">
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between">
        <div className="flex items-start space-x-3 min-w-0">
          <Avatar className="h-9 w-9 border border-sky-400/30 flex-shrink-0">
            <AvatarImage src={post.user.avatar} alt={post.user.name} />
            <AvatarFallback className="bg-sky-700/40 text-sky-200">
              {post.user.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-medium text-white truncate">{post.user.name}</span>
              {post.user.tier && (
                <Badge variant="outline" className="bg-indigo-600/40 text-xs border-indigo-400/30 px-1.5">
                  T{post.user.tier}
                </Badge>
              )}
              {post.user.country && (
                <span className="text-xs text-gray-400 flex items-center">
                  <MapPin size={12} className="mr-0.5 flex-shrink-0" />
                  {post.user.country}
                </span>
              )}
            </div>
            <div className="flex items-center text-xs text-gray-400 mt-0.5 flex-wrap gap-2">
              <span className="flex items-center">
                <Calendar size={12} className="mr-1 flex-shrink-0" />
                {formatDate(post.createdAt)}
              </span>
              {post.postType && (
                <Badge className="bg-sky-900/30 text-sky-300 border-sky-500/30 text-[10px] h-5 px-1.5">
                  {postTypeIcons[post.postType] || null}
                  <span className="ml-1">{post.postType}</span>
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 flex-shrink-0">
              <MoreHorizontal size={16} className="text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-earthie-dark-light border border-sky-400/20">
            <DropdownMenuItem className="text-gray-300 hover:text-white">
              Bookmark
            </DropdownMenuItem>
            <DropdownMenuItem className="text-gray-300 hover:text-white">
              Report
            </DropdownMenuItem>
            <DropdownMenuItem className="text-gray-300 hover:text-white">
              Mute User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      <CardContent className="px-4 py-2">
        {/* Post Content */}
        {post.title && (
          <h3 className="text-lg font-semibold text-white mb-2 break-words">{post.title}</h3>
        )}
        <div className="text-gray-200 whitespace-pre-wrap break-words">
          {post.content}
        </div>
        {post.images && post.images.length > 0 && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {post.images.map((img, index) => (
              <div 
                key={index} 
                className="relative overflow-hidden rounded-lg aspect-video bg-earthie-dark border border-sky-400/10"
              >
                <Image 
                  src={img} 
                  alt={`Image ${index + 1} for post ${post.id}`} 
                  fill 
                  style={{objectFit: 'cover'}}
                  className="hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        )}
        
        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {post.tags.map(tag => (
              <Badge 
                key={tag} 
                variant="outline" 
                className="text-xs bg-indigo-950/40 text-indigo-300 border-indigo-400/20 hover:bg-indigo-900/30 cursor-pointer truncate max-w-full"
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="px-4 py-3 border-t border-sky-400/10 flex flex-col space-y-3">
        {/* Reaction buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-between w-full">
          <div className="flex flex-wrap gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={reactionLoading === 'hyped'}
              className={`rounded-full px-2 min-w-[60px] ${activeReaction === 'hyped' ? 'bg-amber-950/60 text-amber-400' : 'text-gray-400 hover:text-amber-400 hover:bg-amber-950/30'}`}
              onClick={() => handleReaction('hyped')}
            >
              <Flame size={16} className="mr-1" />
              <span className="text-xs">{reactions.hyped}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={reactionLoading === 'smart'}
              className={`rounded-full px-2 min-w-[60px] ${activeReaction === 'smart' ? 'bg-indigo-950/60 text-indigo-400' : 'text-gray-400 hover:text-indigo-400 hover:bg-indigo-950/30'}`}
              onClick={() => handleReaction('smart')}
            >
              <Brain size={16} className="mr-1" />
              <span className="text-xs">{reactions.smart}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={reactionLoading === 'love'}
              className={`rounded-full px-2 min-w-[60px] ${activeReaction === 'love' ? 'bg-pink-950/60 text-pink-400' : 'text-gray-400 hover:text-pink-400 hover:bg-pink-950/30'}`}
              onClick={() => handleReaction('love')}
            >
              <Heart size={16} className="mr-1" />
              <span className="text-xs">{reactions.love}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={reactionLoading === 'watching'}
              className={`rounded-full px-2 min-w-[60px] ${activeReaction === 'watching' ? 'bg-emerald-950/60 text-emerald-400' : 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-950/30'}`}
              onClick={() => handleReaction('watching')}
            >
              <Eye size={16} className="mr-1" />
              <span className="text-xs">{reactions.watching}</span>
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-full px-2 min-w-[60px] text-gray-400 hover:text-sky-400 hover:bg-sky-950/30"
              onClick={handleToggleComments}
            >
              <MessageCircle size={16} className="mr-1" />
              <span className="text-xs">{comments.length || post.commentCount}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className={`rounded-full px-2 min-w-[60px] ${isEchoed ? 'bg-purple-950/60 text-purple-400' : 'text-gray-400 hover:text-purple-400 hover:bg-purple-950/30'}`}
              onClick={handleEcho}
              disabled={echoLoading}
            >
              <Repeat size={16} className="mr-1" />
              <span className="text-xs">{echoCount}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-full px-2 min-w-[40px] text-gray-400 hover:text-blue-400 hover:bg-blue-950/30"
              onClick={handleShare}
            >
              <Share2 size={16} />
            </Button>
          </div>
        </div>
        
        {/* Comments section - collapsed by default */}
        {showComments && (
          <div className="w-full pt-2 border-t border-sky-400/10">
            {/* New comment input */}
            <div className="flex items-start space-x-2 mb-2">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarFallback className="bg-sky-700/40 text-sky-200">ME</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <input 
                  type="text" 
                  placeholder="Add a comment..." 
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  className="w-full bg-earthie-dark/60 border border-sky-400/20 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-sky-400/50"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                  disabled={addingComment}
                />
              </div>
              <Button size="sm" variant="ghost" className="text-sky-400 px-2 flex-shrink-0" onClick={handleAddComment} disabled={addingComment || !newComment.trim()}>
                Post
              </Button>
            </div>
            {/* Comments loading/error */}
            {commentsLoading && (
              <div className="py-2 space-y-2">
                {[...Array(2)].map((_, i) => <CommentSkeleton key={i} />)}
              </div>
            )}
            {commentsError && (
              <div className="text-xs text-red-400 py-2">{commentsError}</div>
            )}
            {/* Comment list */}
            {comments.length > 0 && (
              <div className="space-y-2 mt-2">
                {comments.map((c, idx) => (
                  <div key={c.id || idx} className="flex items-start gap-2">
                    <Avatar className="h-6 w-6 flex-shrink-0">
                      <AvatarImage src={c.user?.avatar || ''} alt={c.user?.name || ''} />
                      <AvatarFallback className="bg-sky-700/40 text-sky-200">{c.user?.name?.slice(0,2).toUpperCase() || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="bg-sky-900/20 rounded-lg px-3 py-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-white font-semibold truncate">{c.user?.name || 'User'}</span>
                        <span className="text-xs text-gray-400">{formatDate(c.createdAt)}</span>
                      </div>
                      <div className="text-xs text-gray-200 mt-0.5 break-words">{c.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!commentsLoading && comments.length === 0 && !commentsError && (
              <div className="text-xs text-gray-400 text-center py-2">No comments yet.</div>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
