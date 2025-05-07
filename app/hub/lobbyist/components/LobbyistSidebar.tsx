'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Home,
  User,
  Users,
  Globe,
  BarChart2,
  Brain,
  Flame,
  Settings,
  BookOpen,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';



interface LobbyistSidebarProps {
  activeSubLobby: string | null;
  setActiveSubLobby: (id: string) => void;
  subLobbies: Array<{
    id: string;
    name: string;
    icon: JSX.Element;
  }>;
}

interface UserProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
}

interface LobbyistSidebarProps {
  activeSubLobby: string | null;
  setActiveSubLobby: (id: string) => void;
  subLobbies: Array<{
    id: string;
    name: string;
    icon: JSX.Element;
  }>;
  user?: UserProfile | null;
}

export default function LobbyistSidebar({ 
  activeSubLobby, 
  setActiveSubLobby,
  subLobbies,
  user
}: LobbyistSidebarProps) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* User Profile Card: Only show if user is present */}
      {user ? (
        <Card className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-sky-400/20 overflow-hidden">
          <div className="h-16 bg-gradient-to-r from-indigo-600/40 to-sky-600/30 relative">
            <Avatar className="absolute -bottom-5 left-4 h-16 w-16 border-2 border-earthie-dark">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {/* Quick Stats */}
            {/* Quick Stats - Only show if present in user prop */}
            {user && user.tiles !== undefined && user.essence !== undefined && user.netWorth !== undefined && (
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div className="bg-earthie-dark/40 rounded-md py-2 px-1">
                  <p className="text-xs text-gray-400">Tiles</p>
                  <p className="font-medium text-white">{user.tiles}</p>
                </div>
                <div className="bg-earthie-dark/40 rounded-md py-2 px-1">
                  <p className="text-xs text-gray-400">Essence</p>
                  <p className="font-medium text-white">{user.essence}</p>
                </div>
                <div className="bg-earthie-dark/40 rounded-md py-2 px-1">
                  <p className="text-xs text-gray-400">Net Worth</p>
                  <p className="font-medium text-white">${user.netWorth}</p>
                </div>
              </div>
            )}
            {/* Following/Followers - Only show if present in user prop */}
            {user && user.following !== undefined && user.followers !== undefined && (
              <div className="flex justify-between mt-4 text-sm">
                <span className="text-gray-300">
                  <span className="font-medium text-white">{user.following}</span> Following
                </span>
                <span className="text-gray-300">
                  <span className="font-medium text-white">{user.followers}</span> Followers
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Navigation */}
      <Card className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-sky-400/20">
        <CardHeader className="pb-2">
          <h3 className="font-semibold text-white">Navigation</h3>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-1">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-gray-300 hover:text-white hover:bg-earthie-dark-light/40"
              onClick={() => router.push('/hub')}
            >
              <Home size={18} className="mr-2" />
              Hub Home
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-gray-300 hover:text-white hover:bg-earthie-dark-light/40"
              onClick={() => router.push('/hub/profile')}
            >
              <User size={18} className="mr-2" />
              My Profile
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start bg-sky-600/20 text-sky-300"
            >
              <MessageSquare size={18} className="mr-2" />
              My Lobbyist
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-gray-300 hover:text-white hover:bg-earthie-dark-light/40"
              onClick={() => router.push('/hub/firesales')}
            >
              <Sparkles size={18} className="mr-2" />
              Firesales
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Sub-Lobbies */}
      <Card className="backdrop-blur-md bg-gradient-to-br from-earthie-dark/70 to-earthie-dark-light/60 border border-sky-400/20">
        <CardHeader className="pb-2">
          <h3 className="font-semibold text-white">Sub-Lobbies</h3>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-1">
            {subLobbies.map(lobby => (
              <Button
                key={lobby.id}
                variant="ghost"
                className={`w-full justify-start ${activeSubLobby === lobby.id ? 'bg-sky-600/20 text-sky-300' : 'text-gray-300 hover:text-white hover:bg-earthie-dark-light/40'}`}
                onClick={() => setActiveSubLobby(lobby.id)}
              >
                {lobby.icon}
                <span className="ml-2">{lobby.name}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
