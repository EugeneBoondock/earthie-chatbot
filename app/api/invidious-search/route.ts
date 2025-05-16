import { NextRequest, NextResponse } from 'next/server';
import { getVideoId, getData, youtubeMusicSearch } from '@hydralerne/youtube-api';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }
  try {
    // Try to get two relevant video IDs
    let videoIds: string[] = [];
    // Try to use a multi-result search if available
    if (typeof youtubeMusicSearch === 'function') {
      // Try to use youtubeMusicSearch for videos (not just music)
      const results = await youtubeMusicSearch(q, 'videos');
      if (Array.isArray(results) && results.length > 0) {
        videoIds = results.filter(v => v.videoId).map(v => v.videoId).slice(0, 2);
      }
    }
    // Fallback: use getVideoId for main and fallback query
    if (videoIds.length < 2) {
      const mainId = await getVideoId(q, true);
      if (typeof mainId === 'string' && !videoIds.includes(mainId)) videoIds.push(mainId);
      // Try a fallback query (e.g., add 'travel guide')
      const fallbackQ = q + ' travel guide';
      const fallbackId = await getVideoId(fallbackQ, true);
      if (typeof fallbackId === 'string' && !videoIds.includes(fallbackId)) videoIds.push(fallbackId);
      videoIds = videoIds.slice(0, 2);
    }
    // Fetch metadata for both videos
    const videos = await Promise.all(
      videoIds.map(async (id) => {
        const videoData = await getData(id);
        return { videoId: id, videoData };
      })
    );
    return NextResponse.json({ videos });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch from YouTube', details: (e as Error).message }, { status: 500 });
  }
} 