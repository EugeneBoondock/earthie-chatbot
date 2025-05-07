'use client';

import { useState } from 'react';
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
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

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

  // Fetch comments when showComments is toggled on
  const fetchComments = async () => {
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const res = await fetch(`/api/lobbyist/comments?postId=${encodeURIComponent(post.id)}`);
      if (!res.ok) throw new Error('Failed to load comments');
      const data = await res.json();
      setComments(data.comments || []);
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
      if (activeReaction === type) {
        // Remove reaction
        await fetch('/api/lobbyist/reactions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId: post.id, reaction: type })
        });
        updated[type] = Math.max(0, updated[type] - 1);
        newActive = null;
      } else {
        // Add reaction
        await fetch('/api/lobbyist/reactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postId: post.id, reaction: type })
        });
        updated[type] = (updated[type] || 0) + 1;
        // Remove previous reaction if any
        if (activeReaction && activeReaction !== type) {
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
      const res = await fetch('/api/lobbyist/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, content: newComment })
      });
      if (!res.ok) throw new Error('Failed to add comment');
      const data = await res.json();
      setComments((prev) => [...prev, data.comment]);
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
        <div className="flex items-center space-x-3">
          <Avatar className="h-9 w-9 border border-sky-400/30">
            <AvatarImage src={post.user.avatar} alt={post.user.name} />
            <AvatarFallback className="bg-sky-700/40 text-sky-200">
              {post.user.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <div className="flex items-center">
              <span className="font-medium text-white">{post.user.name}</span>
              {post.user.tier && (
                <Badge variant="outline" className="ml-2 bg-indigo-600/40 text-xs border-indigo-400/30 px-1.5">
                  T{post.user.tier}
                </Badge>
              )}
              {post.user.country && (
                <span className="text-xs text-gray-400 ml-2 flex items-center">
                  <MapPin size={12} className="mr-0.5" />
                  {post.user.country}
                </span>
              )}
            </div>
            <div className="flex items-center text-xs text-gray-400 mt-0.5">
              <Calendar size={12} className="mr-1" />
              {formatDate(post.createdAt)}
              {post.postType && (
                <Badge className="ml-2 bg-sky-900/30 text-sky-300 border-sky-500/30 text-[10px] h-5 px-1.5">
                  {postTypeIcons[post.postType] || null}
                  <span className="ml-1">{post.postType}</span>
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
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
        <h3 className="text-lg font-medium text-sky-100 mb-2">{post.title}</h3>
        <p className="text-gray-300 text-sm">{post.content}</p>
        
        {/* Image gallery */}
        {post.images && post.images.length > 0 && (
          <div className={`mt-3 grid ${post.images.length > 1 ? 'grid-cols-2 gap-2' : 'grid-cols-1'}`}>
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
                className="text-xs bg-indigo-950/40 text-indigo-300 border-indigo-400/20 hover:bg-indigo-900/30 cursor-pointer"
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="px-4 py-3 border-t border-sky-400/10 flex flex-col space-y-3">
        {/* Reaction buttons */}
        <div className="flex justify-between w-full">
          <div className="flex space-x-1">
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={reactionLoading === 'hyped'}
              className={`rounded-full px-2 ${activeReaction === 'hyped' ? 'bg-amber-950/60 text-amber-400' : 'text-gray-400 hover:text-amber-400 hover:bg-amber-950/30'}`}
              onClick={() => handleReaction('hyped')}
            >
              <Flame size={16} className="mr-1" />
              <span className="text-xs">{reactions.hyped}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={reactionLoading === 'smart'}
              className={`rounded-full px-2 ${activeReaction === 'smart' ? 'bg-indigo-950/60 text-indigo-400' : 'text-gray-400 hover:text-indigo-400 hover:bg-indigo-950/30'}`}
              onClick={() => handleReaction('smart')}
            >
              <Brain size={16} className="mr-1" />
              <span className="text-xs">{reactions.smart}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={reactionLoading === 'love'}
              className={`rounded-full px-2 ${activeReaction === 'love' ? 'bg-pink-950/60 text-pink-400' : 'text-gray-400 hover:text-pink-400 hover:bg-pink-950/30'}`}
              onClick={() => handleReaction('love')}
            >
              <Heart size={16} className="mr-1" />
              <span className="text-xs">{reactions.love}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={reactionLoading === 'watching'}
              className={`rounded-full px-2 ${activeReaction === 'watching' ? 'bg-emerald-950/60 text-emerald-400' : 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-950/30'}`}
              onClick={() => handleReaction('watching')}
            >
              <Eye size={16} className="mr-1" />
              <span className="text-xs">{reactions.watching}</span>
            </Button>
          </div>
          
          <div className="flex space-x-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-full px-2 text-gray-400 hover:text-sky-400 hover:bg-sky-950/30"
              onClick={handleToggleComments}
            >
              <MessageCircle size={16} className="mr-1" />
              <span className="text-xs">{comments.length || post.commentCount}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-full px-2 text-gray-400 hover:text-purple-400 hover:bg-purple-950/30"
              onClick={() => onEcho && onEcho(post.id)}
            >
              <Repeat size={16} className="mr-1" />
              <span className="text-xs">{post.echoCount}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="rounded-full px-2 text-gray-400 hover:text-blue-400 hover:bg-blue-950/30"
              onClick={() => onShare && onShare(post.id)}
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
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-sky-700/40 text-sky-200">ME</AvatarFallback>
              </Avatar>
              <div className="flex-1">
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
              <Button size="sm" variant="ghost" className="text-sky-400 px-2" onClick={handleAddComment} disabled={addingComment || !newComment.trim()}>
                Post
              </Button>
            </div>
            {/* Comments loading/error */}
            {commentsLoading && (
              <div className="py-2">
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
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={c.user?.avatar || ''} alt={c.user?.name || ''} />
                      <AvatarFallback className="bg-sky-700/40 text-sky-200">{c.user?.name?.slice(0,2).toUpperCase() || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="bg-sky-900/20 rounded-lg px-3 py-1 flex-1">
                      <span className="text-xs text-white font-semibold">{c.user?.name || 'User'}</span>
                      <span className="ml-2 text-xs text-gray-400">{formatDate(c.createdAt)}</span>
                      <div className="text-xs text-gray-200 mt-0.5">{c.content}</div>
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
