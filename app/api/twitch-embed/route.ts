import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username');
  const parent = searchParams.get('parent') || 'localhost';

  if (!username) {
    return NextResponse.json({ error: 'Missing username' }, { status: 400 });
  }

  const clientId = process.env.TWITCH_CLIENT_ID || process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID;
  const accessToken = process.env.TWITCH_ACCESS_TOKEN || process.env.NEXT_PUBLIC_TWITCH_ACCESS_TOKEN;

  if (!clientId || !accessToken) {
    return NextResponse.json({ error: 'Missing Twitch credentials' }, { status: 500 });
  }

  // 1. Get user ID from username
  const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  const userData = await userRes.json();
  if (!userData.data || userData.data.length === 0) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const userId = userData.data[0].id;

  // 2. Check if channel is live
  const streamRes = await fetch(`https://api.twitch.tv/helix/streams?user_id=${userId}`, {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  const streamData = await streamRes.json();
  if (streamData.data && streamData.data.length > 0 && streamData.data[0].type === 'live') {
    // Channel is live
    return NextResponse.json({
      type: 'live',
      embedUrl: `https://player.twitch.tv/?channel=${username}&parent=${parent}&autoplay=false`,
    });
  }

  // 3. If not live, get latest VOD
  const vodRes = await fetch(`https://api.twitch.tv/helix/videos?user_id=${userId}&type=archive&first=1`, {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  const vodData = await vodRes.json();
  if (vodData.data && vodData.data.length > 0) {
    const vodId = vodData.data[0].id;
    return NextResponse.json({
      type: 'vod',
      embedUrl: `https://player.twitch.tv/?video=${vodId}&parent=${parent}&autoplay=false`,
    });
  }

  // 4. No live or VOD found
  return NextResponse.json({ error: 'No live stream or VOD found' }, { status: 404 });
} 