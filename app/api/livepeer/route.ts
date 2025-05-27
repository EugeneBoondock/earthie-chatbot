import { NextRequest, NextResponse } from 'next/server';

const LIVEPEER_API_URL = 'https://livepeer.com/api/stream';
const LIVEPEER_TOKEN = process.env.LIVEPEER_TOKEN || process.env.NEXT_PUBLIC_LIVEPEER_TOKEN;
const LIVEPEER_PROJECT_ID = process.env.LIVEPEER_PROJECT_ID || 'f95627a5-9869-48af-998f-afbc9a3cedc8';

export async function GET() {
  if (!LIVEPEER_TOKEN) {
    return NextResponse.json({ error: 'Missing Livepeer token' }, { status: 500 });
  }
  if (!LIVEPEER_PROJECT_ID) {
    return NextResponse.json({ error: 'Missing Livepeer project ID' }, { status: 500 });
  }
  const headers = { Authorization: `Bearer ${LIVEPEER_TOKEN}` };

  // 1. List all streams
  const res = await fetch(LIVEPEER_API_URL, { headers });
  const streams = await res.json();
  const filteredStreams = Array.isArray(streams)
    ? streams.filter((s) => s.projectId === LIVEPEER_PROJECT_ID)
    : [];

  // 2. For each stream, fetch sessions (recorded VODs)
  let allVods: { title: string; playbackId: string; hlsUrl: string; createdAt: number; duration: number; playbackSources: any[] }[] = [];
  const allStreams = await Promise.all(
    filteredStreams.map(async (stream) => {
      // Fetch sessions (recorded VODs)
      const sessRes = await fetch(
        `https://livepeer.com/api/stream/${stream.id}/sessions?record=true`,
        { headers }
      );
      const sessions = await sessRes.json();
      // 3. For each session, fetch playback info
      const sessionDetails = await Promise.all(
        (Array.isArray(sessions) ? sessions : []).map(async (session) => {
          let playbackSources = [];
          if (session.playbackId) {
            try {
              const pbRes = await fetch(
                `https://livepeer.com/api/playback/${session.playbackId}`,
                { headers }
              );
              const pbInfo = await pbRes.json();
              playbackSources = pbInfo.meta?.source || [];
            } catch {}
          }
          // Aggregate VODs for flat list
          if (session.playbackId) {
            allVods.push({
              title: stream.name,
              playbackId: session.playbackId,
              hlsUrl: `https://livepeercdn.com/hls/${session.playbackId}/index.m3u8`,
              createdAt: session.createdAt,
              duration: session.sourceSegmentsDuration || session.transcodedSegmentsDuration,
              playbackSources,
            });
          }
          return {
            ...session,
            playbackSources,
          };
        })
      );
      // Also fetch real-time stream details for live status
      let liveDetail = null;
      try {
        const liveRes = await fetch(
          `https://livepeer.com/api/stream/${stream.id}`,
          { headers }
        );
        liveDetail = await liveRes.json();
      } catch {}
      return {
        ...stream,
        isActive: liveDetail?.isActive || false,
        playbackId: liveDetail?.playbackId || stream.playbackId,
        streamKey: liveDetail?.streamKey || stream.streamKey,
        livepeerTvUrl: stream.id ? `https://lvpr.tv/broadcast/${stream.id}` : '',
        sessions: sessionDetails,
      };
    })
  );

  return NextResponse.json({
    live: allStreams,
    vods: allVods.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
  });
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
    body: JSON.stringify({
      name,
      profiles: [{ name: '720p', bitrate: 2000000, fps: 30, width: 1280, height: 720 }],
      record: true,
    }),
  });
  const data = await res.json();
  return NextResponse.json(data);
} 