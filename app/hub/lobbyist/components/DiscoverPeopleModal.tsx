'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Search, MapPin, Building, Landmark, User, Users, Loader2, InfoIcon, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ProfileUser {
  id: string;
  username: string;
  avatar_url: string | null;
  e2_user_id: string | null;
  has_earth2_data?: boolean;
  is_fully_linked?: boolean;
  needs_details?: boolean;
  e2_data?: {
    userNetworth?: {
      networth: number;
      totalTiles: number;
    };
    userLandfieldCount?: number;
    description?: string;
    countryCode?: string;
  };
  is_loading?: boolean;
}

interface DiscoverPeopleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DiscoverPeopleModal({ isOpen, onClose }: DiscoverPeopleModalProps) {
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ProfileUser | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch users from profiles and user_e2_profiles tables
  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      // We can't use the foreign key relationship because it doesn't exist in the schema
      // So we'll fetch the profiles and user_e2_profiles separately and join them manually
      
      // First, get all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .order('username');
        
      if (profilesError) throw profilesError;
      
      // Then get all E2 profiles without any filtering
      const { data: e2Data, error: e2Error } = await supabase
        .from('user_e2_profiles')
        .select('user_id, e2_user_id');
        
      if (e2Error && e2Error.code !== 'PGRST116') throw e2Error; // PGRST116 = no rows
      
      // Create a map of user_id -> e2_user_id
      const e2Map = new Map();
      if (e2Data) {
        e2Data.forEach((profile: any) => {
          // Based on the database schema: user_id is the Supabase user ID, e2_user_id is the Earth2 ID
          e2Map.set(profile.user_id, profile.e2_user_id);
        });
      }
      
      // Transform the data from profiles table
      const transformedData = profilesData.map((profile: any) => {
        // If user has username and avatar, they have Earth2 data
        const hasE2Data = profile.username && profile.avatar_url;
        // If they have data in the e2_profiles map, they have explicitly linked their ID
        const e2UserId = e2Map.get(profile.id);
        
        return {
          id: profile.id, // This is the Supabase user ID
          username: profile.username || 'Unknown User',
          avatar_url: profile.avatar_url,
          e2_user_id: e2UserId, // Get the Earth2 ID using the Supabase user ID
          has_earth2_data: hasE2Data,
          // If they have Earth2 data (username/avatar) but no explicit e2_user_id, 
          // that's a special case, otherwise mark as fully linked
          is_fully_linked: hasE2Data && e2UserId ? true : false
        };
      });
        
      // Now fetch any missing e2_user_id users from Earth2 API directly
      // Create a Map of existing users by ID to avoid duplicates
      const userMap = new Map();
      transformedData.forEach(user => {
        userMap.set(user.id, user);
      });
      
      // Add any e2_users not in profiles table
      const missingE2Users = [];
      if (e2Data) {
        for (const e2Profile of e2Data) {
          // If this Supabase user_id is not in the profiles results
          if (!userMap.has(e2Profile.user_id)) {
            // Create a minimal user entry for this user
            missingE2Users.push({
              id: e2Profile.user_id, // Supabase user ID
              username: `User ${e2Profile.e2_user_id.slice(0, 8)}`,
              avatar_url: null,
              e2_user_id: e2Profile.e2_user_id, // Earth2 user ID
              has_earth2_data: false, // We don't have their Earth2 data yet but we will try to get it
              is_fully_linked: true, // They have explicitly linked their E2 ID
              is_loading: true
            });
          }
        }
      }
      
      // For any missing users, try to fetch their details from Earth2 API in parallel
      if (missingE2Users.length > 0) {
        // Load all users to avoid cutoff issues
        const usersToFetch = missingE2Users;
        
        // Set initial state so UI can start rendering
        setUsers([...transformedData, ...missingE2Users]);
        
        // Fetch Earth2 details in parallel
        const updatedUsers = await Promise.all(usersToFetch.map(async (user) => {
          if (user.e2_user_id) {
            try {
              const response = await fetch(`https://app.earth2.io/api/v2/user_info/${user.e2_user_id}?_t=${Date.now()}`);
              if (response.ok) {
                const data = await response.json();
                return {
                  ...user,
                  username: data.username || `Earth2 User #${user.e2_user_id.slice(0, 8)}`,
                  avatar_url: data.customPhoto || data.picture || user.avatar_url,
                  has_earth2_data: true,
                  is_loading: false
                };
              }
            } catch (e) {
              // Silent fail - we'll still show the user with limited info
            }
          }
          // If no data could be fetched, update to a better placeholder
          return {
            ...user,
            username: user.e2_user_id ? `Earth2 User #${user.e2_user_id.slice(0, 8)}` : user.username,
            is_loading: false
          };
        }));
        
        // Replace the placeholder users with updated data
        missingE2Users.splice(0, missingE2Users.length, ...updatedUsers);
      }
      
      // Combine all users and remove any duplicates
      const allUsers = [...transformedData, ...missingE2Users];
      
      // Use a Set to track unique usernames to avoid duplicates
      const seen = new Set();
      const uniqueUsers = allUsers.filter(user => {
        // If it's a real username (not our placeholder), check for duplicates
        if (user.username && !user.username.startsWith('Loading Earth2 User') && !user.username.startsWith('Unknown')) {
          if (seen.has(user.username.toLowerCase())) {
            return false; // Skip this duplicate
          }
          seen.add(user.username.toLowerCase());
          return true;
        }
        // Always include placeholder users (not duplicates)
        return true;
      });
      
      // Filter out profiles without usernames and sort with E2 profiles at top
      const validUsers = uniqueUsers.filter(u => u.username)
        .sort((a, b) => {
          // Show users with Earth2 profiles at the top
          if (a.e2_user_id && !b.e2_user_id) return -1;
          if (!a.e2_user_id && b.e2_user_id) return 1;
          // Then sort by username
          return a.username.localeCompare(b.username);
        });
      
      setUsers(validUsers);
    } catch (e: any) {
      setError(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Earth2 details for a selected user
  const fetchUserDetails = async (userId: string) => {
    if (!userId) return;

    setLoadingDetails(true);
    try {
      // Add a timestamp to prevent caching issues
      const url = `https://app.earth2.io/api/v2/user_info/${userId}?_t=${Date.now()}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch Earth2 user details (status: ${response.status})`);
      }
      
      const data = await response.json();
      setSelectedUserDetails(data);
    } catch (e: any) {
      // Don't set an error state here - just log it and continue
    } finally {
      setLoadingDetails(false);
    }
  };

  // Handle selecting a user
  const handleUserSelect = (user: ProfileUser) => {
    // Special case: For users with placeholder names but E2 IDs, try to get better details
    if (user.username.startsWith('User') && user.e2_user_id) {
      // Update the user's object directly in the users array to improve display
      setUsers(prevUsers => prevUsers.map(u => {
        if (u.id === user.id && user.e2_user_id) {
          return {
            ...u,
            username: `Earth2 User #${user.e2_user_id.slice(0, 8)}`,
            is_loading: false
          };
        }
        return u;
      }));
    }
    
    setSelectedUser(user);
    setSelectedUserDetails(null); // Reset details when a new user is selected
    
    if (user.e2_user_id) {
      // Always fetch fresh data from Earth2 API when a user with E2 ID is selected
      fetchUserDetails(user.e2_user_id);
    } else {
      setSelectedUserDetails(null);
    }
  };

  // Format currency for display
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Filter users based on search query
  const filteredUsers = searchQuery
    ? users.filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] h-full md:h-auto overflow-hidden flex flex-col bg-earthie-dark-light border-sky-400/30 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-xl text-sky-100 font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-400" />
            Discover Earth2 Users
          </DialogTitle>
          <DialogDescription className="text-sky-300/70">
            Explore and connect with other users in the Earth2 community
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row h-[calc(100%-80px)] md:h-[70vh] gap-4 mt-4 overflow-hidden">
          {/* Left side: User list */}
          <div className={`w-full md:w-1/2 flex flex-col overflow-hidden ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-earthie-dark/50 border-sky-400/20 focus:border-sky-400/60"
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2 min-h-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-sky-400 mb-2" />
                  <p className="text-sky-200">Loading users...</p>
                </div>
              ) : error ? (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-center">
                  <p className="text-red-300">{error}</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-gray-400">No users found</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className={`flex items-center p-2 sm:p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedUser?.id === user.id
                        ? 'bg-sky-600/20 border border-sky-500/40'
                        : 'bg-earthie-dark/60 border border-gray-700/50 hover:bg-gray-800/70 hover:border-sky-500/20'
                    }`}
                  >
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 border border-sky-400/30 mr-2 sm:mr-3">
                      {user.avatar_url ? (
                        <AvatarImage src={user.avatar_url} alt={user.username} />
                      ) : (
                        <AvatarFallback className="bg-sky-700/40 text-sky-200">
                          {user.is_loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            user.username.slice(0, 2).toUpperCase()
                          )}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <p className="font-medium text-sky-100 truncate text-sm sm:text-base">
                          {user.is_loading ? (
                            <span className="flex items-center">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Loading User...
                            </span>
                          ) : user.username.startsWith('User') && user.e2_user_id ? (
                            <span className="flex items-center gap-1">
                              <span className="text-sky-300 font-mono">#{user.e2_user_id.slice(0, 8)}</span>
                              <span className="hidden sm:inline">Earth2 User</span>
                            </span>
                          ) : (
                            user.username
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {user.is_fully_linked || (user.e2_user_id && user.has_earth2_data) ? (
                          <Badge variant="outline" className="bg-emerald-900/30 text-emerald-300 border-emerald-500/30 text-[10px] sm:text-xs px-1 sm:px-2 h-4 sm:h-5">
                            <span className="hidden sm:inline">Earth2 Profile </span>Linked
                          </Badge>
                        ) : user.has_earth2_data || user.avatar_url ? (
                          <Badge variant="outline" className="bg-amber-900/30 text-amber-300 border-amber-500/30 text-[10px] sm:text-xs px-1 sm:px-2 h-4 sm:h-5">
                            <span className="hidden sm:inline">Earth2 Data </span>Available
                          </Badge>
                        ) : (
                          <span className="text-[10px] sm:text-xs text-gray-400">No Earth2 profile</span>
                        )}
                        
                        {user.e2_user_id && !user.username.startsWith('User') && (
                          <span className="text-[10px] sm:text-xs text-sky-400 font-mono">#{user.e2_user_id.slice(0, 8)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right side: User details */}
          <div className={`w-full md:w-1/2 bg-earthie-dark/40 border border-sky-400/20 rounded-lg p-4 overflow-y-auto ${selectedUser ? 'flex' : 'hidden md:block'} flex-col h-full`}>
            {/* Mobile-only back button */}
            {selectedUser && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="md:hidden mb-3 text-sky-300 hover:text-sky-200 inline-flex items-center"
                onClick={() => setSelectedUser(null)}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to list
              </Button>
            )}
            
            {!selectedUser ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                <User className="h-10 w-10 text-gray-500/50 mb-2" />
                <p>Select a user to view their profile details</p>
              </div>
            ) : loadingDetails && selectedUser.e2_user_id ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-sky-400 mb-2" />
                <p className="text-sky-200">Loading Earth2 profile details...</p>
                {selectedUser.e2_user_id && (
                  <div className="mt-2 p-2 bg-sky-900/20 border border-sky-500/30 rounded-md">
                    <p className="text-sky-200 font-mono text-xs">Earth2 ID: {selectedUser.e2_user_id}</p>
                  </div>
                )}
              </div>
            ) : selectedUserDetails ? (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <Avatar className="h-16 w-16 border-2 border-sky-400/40 mr-4 self-center sm:self-start mb-3 sm:mb-0">
                    {selectedUserDetails.customPhoto || selectedUserDetails.picture || selectedUser.avatar_url ? (
                      <AvatarImage src={selectedUserDetails.customPhoto || selectedUserDetails.picture || selectedUser.avatar_url} alt={selectedUserDetails.username || selectedUser.username} />
                    ) : (
                      <AvatarFallback className="bg-sky-700/40 text-sky-200 text-lg">
                        {(selectedUserDetails.username || selectedUser.username).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="text-center sm:text-left">
                    <h3 className="text-xl font-bold text-sky-100">
                      {selectedUserDetails.username || 
                       (selectedUser.username.startsWith('User') ? 
                       `Earth2 User #${selectedUser.e2_user_id?.slice(0, 8)}` : 
                        selectedUser.username)}
                    </h3>
                    {selectedUser.e2_user_id && (
                      <div className="flex items-center justify-center sm:justify-start mt-1 bg-sky-900/20 border border-sky-500/30 rounded-md px-2 py-1">
                        <p className="text-sky-300 font-mono text-xs">Earth2 ID: {selectedUser.e2_user_id}</p>
                      </div>
                    )}
                    {selectedUserDetails.description && (
                      <p className="text-gray-300 text-sm mt-1">{selectedUserDetails.description}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedUserDetails.countryCode && (
                    <div className="flex items-center justify-center sm:justify-start text-gray-300">
                      <MapPin className="h-4 w-4 mr-2 text-sky-400" />
                      <span>{selectedUserDetails.countryCode}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <div className="bg-earthie-dark/60 border border-sky-400/20 rounded-lg p-3">
                      <div className="flex items-center mb-1">
                        <Landmark className="h-4 w-4 mr-2 text-sky-400" />
                        <span className="text-gray-300 text-sm">Networth</span>
                      </div>
                      <p className="text-lg font-semibold text-sky-100">
                        {formatCurrency(selectedUserDetails?.userNetworth?.networth)}
                      </p>
                    </div>
                    
                    <div className="bg-earthie-dark/60 border border-sky-400/20 rounded-lg p-3">
                      <div className="flex items-center mb-1">
                        <Building className="h-4 w-4 mr-2 text-sky-400" />
                        <span className="text-gray-300 text-sm">Properties</span>
                      </div>
                      <p className="text-lg font-semibold text-sky-100">
                        {selectedUserDetails?.userLandfieldCount?.toLocaleString() || 'N/A'}
                      </p>
                    </div>
                    
                    <div className="bg-earthie-dark/60 border border-sky-400/20 rounded-lg p-3">
                      <div className="flex items-center mb-1">
                        <MapPin className="h-4 w-4 mr-2 text-sky-400" />
                        <span className="text-gray-300 text-sm">Total Tiles</span>
                      </div>
                      <p className="text-lg font-semibold text-sky-100">
                        {selectedUserDetails?.userNetworth?.totalTiles?.toLocaleString() || 'N/A'}
                      </p>
                    </div>

                    {selectedUserDetails?.is_t1_owner && (
                      <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-lg p-3">
                        <p className="text-emerald-300 font-semibold">Tier 1 Owner</p>
                      </div>
                    )}
                  </div>

                  {selectedUser.e2_user_id && (
                    <div className="mt-6 pt-4 border-t border-gray-700/50">
                      <a 
                        href={`https://app.earth2.io/#profile/${selectedUser.e2_user_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:text-sky-300 flex items-center"
                      >
                        <Button className="bg-sky-600/80 hover:bg-sky-500/90 border border-sky-400/30 w-full">
                          View on Earth2
                        </Button>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                {selectedUser.e2_user_id ? (
                  <>
                    <InfoIcon className="h-10 w-10 text-amber-500/50 mb-2" />
                    <p className="text-amber-300">
                      {selectedUser.username.startsWith('User') ? 
                       `Earth2 User #${selectedUser.e2_user_id.slice(0, 8)}` : 
                        selectedUser.username}
                    </p>
                    <p className="text-amber-300/70 text-sm mt-1">Unable to load profile details</p>
                    <div className="mt-2 p-2 bg-amber-900/20 border border-amber-500/30 rounded-md">
                      <p className="text-amber-200 font-mono">Earth2 ID: {selectedUser.e2_user_id}</p>
                    </div>
                    <a 
                      href={`https://app.earth2.io/#profile/${selectedUser.e2_user_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4"
                    >
                      <Button variant="outline" size="sm" className="border-amber-500/30 text-amber-300">
                        View on Earth2
                      </Button>
                    </a>
                  </>
                ) : selectedUser.has_earth2_data || selectedUser.avatar_url ? (
                  <>
                    <InfoIcon className="h-10 w-10 text-amber-500/50 mb-2" />
                    <p className="text-amber-300">Earth2 data available but ID not linked</p>
                  </>
                ) : (
                  <>
                    <InfoIcon className="h-10 w-10 text-gray-500/50 mb-2" />
                    <p className="text-gray-400">This user hasn't linked their Earth2 profile yet</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 