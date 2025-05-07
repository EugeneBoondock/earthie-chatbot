'use client';

import { useState, useEffect } from 'react';
import { X, Image, Link, PlusCircle, Globe, BarChart2, Tag, AlertCircle, Users } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// Post types
const POST_TYPES = [
  { id: 'text', label: 'Text', icon: <Globe size={16} /> },
  { id: 'image', label: 'Image', icon: <Image size={16} /> },
  { id: 'trade', label: 'Trade Offer', icon: <Tag size={16} /> },
  { id: 'poll', label: 'Poll', icon: <BarChart2 size={16} /> },
  { id: 'dev_diary', label: 'Dev Diary', icon: <PlusCircle size={16} /> },
  { id: 'raid', label: 'Raid', icon: <Users size={16} /> },
  { id: 'showcase', label: 'Showcase', icon: <Globe size={16} /> }
];

// Sub-lobbies for dropdown
const SUB_LOBBIES = [
  { id: 'sl1', name: 'Showcase' },
  { id: 'sl2', name: 'RaidHQ' },
  { id: 'sl3', name: 'Markets' },
  { id: 'sl4', name: 'Ideas' },
  { id: 'sl5', name: 'Drama' }
];



interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePost: (post: any) => void;
}

interface UserProfile {
  id: string;
  name: string;
  avatar: string;
}

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePost: (post: any) => void;
  user?: UserProfile | null;
}

export default function CreatePostModal({ isOpen, onClose, onCreatePost, user }: CreatePostModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('text');
  const [subLobby, setSubLobby] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [followersOnly, setFollowersOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Keep the form as is
    } else {
      // Reset form on close
      setTitle('');
      setContent('');
      setPostType('text');
      setSubLobby('');
      setTags([]);
      setNewTag('');
      setImageUrls([]);
      setNewImageUrl('');
      setIsPrivate(false);
      setFollowersOnly(false);
      setError('');
    }
  }, [isOpen]);

  // Handle adding a tag
  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag('');
    }
  };

  // Handle removing a tag
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Handle adding an image URL
  const handleAddImageUrl = () => {
    if (newImageUrl && !imageUrls.includes(newImageUrl)) {
      setImageUrls([...imageUrls, newImageUrl]);
      setNewImageUrl('');
    }
  };

  // Handle removing an image URL
  const handleRemoveImageUrl = (urlToRemove: string) => {
    setImageUrls(imageUrls.filter(url => url !== urlToRemove));
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    if (!title.trim()) {
      setError('Please add a title to your post');
      return;
    }

    if (!content.trim()) {
      setError('Please add content to your post');
      return;
    }

    setIsLoading(true);
    setError('');

    if (!user) {
      setError('You must be logged in to create a post.');
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/lobbyist/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          postType,
          tags,
          imageUrl: imageUrls.length > 0 ? imageUrls[0] : null,
          isPrivate,
          followersOnly,
          subLobby,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create post');
      }

      // Backend returns the inserted row in result.data
      onCreatePost(result.data);
      setIsLoading(false);
      onClose();
    } catch (err: any) {
      console.error('Error creating post:', err);
      setError(err.message || 'Failed to create post. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-earthie-dark/95 to-earthie-dark-light/95 border border-sky-400/30 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Create New Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Error message */}
          {error && (
            <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-3 flex items-start">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* User info */}
          {user ? (
            <div className="flex items-center space-x-3">
              <Avatar className="h-9 w-9 border border-sky-400/30">
                {user.avatar ? (
                  <AvatarImage src={user.avatar} alt={user.name} />
                ) : (
                  <span className="animate-pulse bg-sky-700/40 h-full w-full block rounded-full" />
                )}
                <AvatarFallback className="bg-sky-700/40 text-sky-200">
                  {user.name ? user.name.slice(0, 2).toUpperCase() : '--'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-white">
                  {user.name || <span className="inline-block w-24 h-4 bg-sky-900/40 animate-pulse rounded" />}
                </p>
                <Select value={postType} onValueChange={setPostType}>
                  <SelectTrigger className="h-7 w-auto border-0 bg-transparent focus:ring-0 p-0 text-gray-400 hover:text-sky-400">
                    <SelectValue placeholder="Post Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-earthie-dark border border-sky-400/30">
                    {POST_TYPES.map(type => (
                      <SelectItem
                        key={type.id}
                        value={type.id}
                        className="text-white focus:bg-sky-900/40 focus:text-white"
                      >
                        <div className="flex items-center">
                          {type.icon}
                          <span className="ml-2">{type.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={subLobby} onValueChange={setSubLobby}>
                  <SelectTrigger className="h-7 w-auto border-0 bg-transparent focus:ring-0 p-0 text-gray-400 hover:text-sky-400">
                    <SelectValue placeholder="Choose Sub-Lobby" />
                  </SelectTrigger>
                  <SelectContent className="bg-earthie-dark border border-sky-400/30">
                    {SUB_LOBBIES.map(lobby => (
                      <SelectItem
                        key={lobby.id}
                        value={lobby.id}
                        className="text-white focus:bg-sky-900/40 focus:text-white"
                      >
                        {lobby.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {/* Title Input */}
          <Input
            placeholder="Title (max 140 characters)"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 140))}
            className="bg-earthie-dark-light/30 border-sky-400/20 focus:border-sky-400/60"
            maxLength={140}
          />

          {/* Content Textarea */}
          <Textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="bg-earthie-dark-light/30 border-sky-400/20 focus:border-sky-400/60 min-h-[120px]"
          />

          {/* Post Type Specific Content */}
          {postType === 'image' && (
            <div className="space-y-2">
              <div className="flex space-x-2">
                <Input
                  placeholder="Image URL"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  className="bg-earthie-dark-light/30 border-sky-400/20 focus:border-sky-400/60"
                />
                <Button 
                  type="button" 
                  onClick={handleAddImageUrl}
                  variant="secondary"
                  size="sm"
                  className="whitespace-nowrap"
                >
                  Add Image
                </Button>
              </div>

              {/* Image URLs List */}
              {imageUrls.length > 0 && (
                <div className="space-y-2">
                  {imageUrls.map((url, index) => (
                    <div key={index} className="flex items-center justify-between bg-earthie-dark-light/40 rounded-md p-2">
                      <span className="text-sm text-gray-300 truncate max-w-[250px]">{url}</span>
                      <Button
                        type="button"
                        onClick={() => handleRemoveImageUrl(url)}
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-300">Tags</h4>
            <div className="flex space-x-2">
              <Input
                placeholder="Add tag (no spaces)"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value.replace(/\s/g, ''))}
                className="bg-earthie-dark-light/30 border-sky-400/20 focus:border-sky-400/60"
              />
              <Button 
                type="button" 
                onClick={handleAddTag}
                variant="secondary"
                size="sm"
                className="whitespace-nowrap"
              >
                Add Tag
              </Button>
            </div>

            {/* Tags List */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="outline" 
                    className="bg-indigo-950/40 text-indigo-300 border-indigo-400/20 flex items-center"
                  >
                    #{tag}
                    <Button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 rounded-full ml-1 p-0"
                    >
                      <X size={10} />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Privacy Settings */}
          <div className="flex items-center space-x-4 text-sm">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isPrivate} 
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="rounded border-sky-400/40 bg-earthie-dark-light/30 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-gray-300">Private</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={followersOnly} 
                onChange={(e) => setFollowersOnly(e.target.checked)}
                className="rounded border-sky-400/40 bg-earthie-dark-light/30 text-sky-600 focus:ring-sky-500"
              />
              <span className="text-gray-300">Followers Only</span>
            </label>
          </div>
        </div>

        <DialogFooter className="sm:justify-between flex flex-col sm:flex-row gap-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
            className="border-sky-400/30 hover:bg-sky-900/20"
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button 
              type="button" 
              variant="outline"
              className="border-sky-400/30 hover:bg-sky-900/20 flex-1"
            >
              Save Draft
            </Button>
            <Button 
              type="button" 
              onClick={handleSubmit}
              disabled={isLoading || !user}
              className="bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 flex-1"
            >
              {user ? (isLoading ? 'Posting...' : 'Post') : 'Login to Post'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
