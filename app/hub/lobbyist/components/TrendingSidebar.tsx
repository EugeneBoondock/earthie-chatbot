'use client';

import { 
  Flame, 
  TrendingUp, 
  Award, 
  Globe,
  Users,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

// Mock trending topics
const TRENDING_TOPICS = [
  { id: 'trend1', tag: 'resource_claim', count: 28, label: 'Resource Claim Update' },
  { id: 'trend2', tag: 'holobuilding', count: 24, label: 'Holobuilding Designs' },
  { id: 'trend3', tag: 'australia', count: 19, label: 'Australia Properties' },
  { id: 'trend4', tag: 'marketplace', count: 15, label: 'Marketplace Deals' },
];

// Mock leaderboard users
const TOP_USERS = [
  { 
    id: 'user1', 
    name: 'TileMaster', 
    avatar: 'https://ui-avatars.com/api/?name=TM&background=0D8ABC&color=fff',
    score: 324,
    country: 'USA'
  },
  { 
    id: 'user2', 
    name: 'E2Builder', 
    avatar: 'https://ui-avatars.com/api/?name=E2B&background=6d28d9&color=fff',
    score: 287,
    country: 'Germany'
  },
  { 
    id: 'user3', 
    name: 'ResourceQueen', 
    avatar: 'https://ui-avatars.com/api/?name=RQ&background=dc2626&color=fff',
    score: 253,
    country: 'UK'
  },
];

// Mock upcoming events
const UPCOMING_EVENTS = [
  {
    id: 'event1',
    title: 'Massive Essence Drop',
    date: '2025-05-15T18:00:00Z',
    participants: 47
  },
  {
    id: 'event2',
    title: 'Community Raid Party',
    date: '2025-05-12T20:00:00Z',
    participants: 32
  }
];

// Format date for events
const formatEventDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function TrendingSidebar() {
  return (
    <div className="space-y-6">
      {/* Trending Topics Section */}
      <Card className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-amber-400/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center">
            <Flame className="h-5 w-5 mr-2 text-amber-500" />
            Trending Topics
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {TRENDING_TOPICS.map(topic => (
              <div key={topic.id} className="flex items-center justify-between group">
                <Button 
                  variant="ghost" 
                  className="text-sm text-gray-300 hover:text-amber-300 px-2 py-1 h-auto"
                >
                  #{topic.tag}
                </Button>
                <Badge variant="outline" className="bg-amber-900/20 border-amber-400/30 text-amber-400">
                  {topic.count} posts
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Lobbyists Leaderboard */}
      <Card className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-sky-400/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center">
            <Award className="h-5 w-5 mr-2 text-sky-400" />
            Top Lobbyists
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {TOP_USERS.map((user, index) => (
              <div key={user.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-earthie-dark-light text-sm font-semibold text-sky-300">
                    {index + 1}
                  </div>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-sky-700/50">
                      {user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-white">{user.name}</p>
                    <p className="text-xs text-gray-400">{user.country}</p>
                  </div>
                </div>
                <Badge className="bg-sky-900/30 text-sky-200 border-sky-500/30">
                  {user.score} pts
                </Badge>
              </div>
            ))}
            <Button 
              variant="ghost" 
              className="w-full text-sky-400 hover:text-sky-300 text-sm mt-2"
            >
              View Full Leaderboard
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-violet-400/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center">
            <Globe className="h-5 w-5 mr-2 text-violet-400" />
            Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {UPCOMING_EVENTS.map(event => (
              <div 
                key={event.id} 
                className="p-2 rounded-lg bg-earthie-dark-light/40 border border-violet-400/10 hover:border-violet-400/30 transition-all cursor-pointer"
              >
                <p className="font-medium text-white text-sm">{event.title}</p>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-gray-400">{formatEventDate(event.date)}</p>
                  <Badge className="bg-violet-900/30 text-violet-200 border-violet-500/30 text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {event.participants}
                  </Badge>
                </div>
              </div>
            ))}
            <Button 
              variant="ghost" 
              className="w-full text-violet-400 hover:text-violet-300 text-sm"
            >
              All Events
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Discord Link */}
      <Card className="backdrop-blur-md bg-gradient-to-br from-purple-900/40 to-indigo-900/30 border border-purple-400/20 overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('/discord-bg.svg')] opacity-5 bg-cover bg-center"></div>
        <CardContent className="p-4 relative">
          <div className="flex items-center">
            <div className="flex-shrink-0 mr-3">
              {/* Discord logo placeholder - would use an actual Discord SVG in real implementation */}
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                D
              </div>
            </div>
            <div>
              <h3 className="text-white font-medium">Join the Earth2 Discord</h3>
              <p className="text-xs text-gray-300">Connect with other Earth2 players</p>
            </div>
          </div>
          <Button 
            className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Join Discord
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
