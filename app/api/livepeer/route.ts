import { NextRequest, NextResponse } from 'next/server';

const LIVEPEER_API_URL = 'https://livepeer.studio/api/stream';
const LIVEPEER_TOKEN = process.env.LIVEPEER_TOKEN || process.env.NEXT_PUBLIC_LIVEPEER_TOKEN;

export async function GET() {
  if (!LIVEPEER_TOKEN) {
    return NextResponse.json({ error: 'Missing Livepeer token' }, { status: 500 });
  }
  const res = await fetch(LIVEPEER_API_URL, {
    headers: {
      Authorization: `Bearer ${LIVEPEER_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json();
  // Map streams to include required fields for UI
  const streams = (Array.isArray(data) ? data : data.data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    userId: s.userId || s.user_id || '',
    isActive: s.isActive || s.isActive === undefined ? !!s.isActive : !!s.isActive,
    playbackUrl: s.playbackUrl || s.playbackUrl || (s.recordingUrl || (s.playbackIds && s.playbackIds[0]?.id ? `https://livepeercdn.com/hls/${s.playbackIds[0].id}/index.m3u8` : '')),
    streamKey: s.streamKey || s.stream_key || '',
    livepeerTvUrl: s.id ? `https://lvpr.tv/broadcast/${s.id}` : '',
  }));
  return NextResponse.json(streams);
}

export async function POST(req: NextRequest) {
  if (!LIVEPEER_TOKEN) {
    return NextResponse.json({ error: 'Missing Livepeer token' }, { status: 500 });
  }
  const body = await req.json();
  const { name, userId } = body;
  if (!name || !userId) {
    return NextResponse.json({ error: 'Missing name or userId' }, { status: 400 });
  }
  const res = await fetch(LIVEPEER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LIVEPEER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, profiles: [{ name: '720p', bitrate: 2000000, fps: 30, width: 1280, height: 720 }] }),
  });
  const data = await res.json();
  return NextResponse.json(data);
} 