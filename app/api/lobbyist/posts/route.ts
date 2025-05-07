import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subLobby = searchParams.get('subLobby');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const userId = searchParams.get('userId');
  
  const supabase = createRouteHandlerClient({ cookies });
  
  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Build query for posts
  let query = supabase
    .from('lobbyist_posts')
    .select(`
      *,
      user:user_id (id, email, user_metadata),
      reactions:lobbyist_reactions (id, user_id, reaction_type),
      comments:lobbyist_comments (count)
    `, {
      count: 'exact'
    })
    .order('created_at', { ascending: false });

  // Add filters if provided
  if (subLobby) {
    query = query.eq('sub_lobby', subLobby);
  }
  
  if (userId) {
    query = query.eq('user_id', userId);
  }

  // Pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Process data to make it more frontend-friendly
  const processedData = data?.map(post => {
    // Count reactions by type
    const reactionCounts = {
      hyped: 0,
      smart: 0, 
      love: 0,
      watching: 0
    };
    
    post.reactions?.forEach(reaction => {
      if (reaction.reaction_type in reactionCounts) {
        reactionCounts[reaction.reaction_type as keyof typeof reactionCounts]++;
      }
    });
    
    // Check if current user has reacted
    const userReactions = post.reactions
      ?.filter(r => r.user_id === session.user.id)
      .map(r => r.reaction_type);

    // Format user data
    const userData = post.user ? {
      id: post.user.id,
      name: post.user.user_metadata?.full_name || post.user.email?.split('@')[0] || 'User',
      avatar: post.user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user.user_metadata?.full_name || post.user.email?.split('@')[0] || 'User')}&background=0D8ABC&color=fff`,
      country: post.user.user_metadata?.country || null,
      tier: post.user.user_metadata?.tier || null
    } : null;

    // Comment count
    const commentCount = post.comments?.[0]?.count || 0;

    return {
      id: post.id,
      title: post.title,
      content: post.content,
      images: post.image_url ? [post.image_url] : [],
      postType: post.post_type,
      tags: post.tags || [],
      createdAt: post.created_at,
      user: userData,
      reactions: reactionCounts,
      userReactions: userReactions || [],
      commentCount,
      isPrivate: post.is_private,
      followersOnly: post.followers_only,
      subLobby: post.sub_lobby
    };
  });

  return NextResponse.json({ 
    data: processedData, 
    meta: { 
      page, 
      limit, 
      total: count || 0,
      totalPages: count ? Math.ceil(count / limit) : 0
    } 
  });
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, content, postType, tags, imageUrl, isPrivate, followersOnly, subLobby } = body;

    // Validate required fields
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Add post to database
    const { data, error } = await supabase
      .from('lobbyist_posts')
      .insert({
        user_id: session.user.id,
        title,
        content,
        post_type: postType || 'text',
        tags: tags || [],
        image_url: imageUrl,
        is_private: isPrivate || false,
        followers_only: followersOnly || false,
        sub_lobby: subLobby
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating post:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
  }
}
