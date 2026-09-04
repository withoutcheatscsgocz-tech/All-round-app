import { getYouTubeToken } from './auth';

const API = 'https://www.googleapis.com/youtube/v3';

export class YouTubeError extends Error {}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = await getYouTubeToken();
  if (!token) throw new YouTubeError('not-logged-in');

  const url = new URL(API + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) throw new YouTubeError('not-logged-in');
  if (!res.ok) throw new YouTubeError(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  thumbnail?: string;
  itemCount: number;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  channel?: string;
  thumbnail?: string;
}

interface RawThumbnails {
  default?: { url: string };
  medium?: { url: string };
}

interface RawSnippet {
  title: string;
  channelTitle?: string;
  thumbnails?: RawThumbnails;
  resourceId?: { videoId?: string };
}

function thumb(snippet: RawSnippet | undefined): string | undefined {
  return snippet?.thumbnails?.medium?.url ?? snippet?.thumbnails?.default?.url;
}

export async function myPlaylists(): Promise<YouTubePlaylist[]> {
  const data = await call<{
    items?: { id: string; snippet: RawSnippet; contentDetails?: { itemCount: number } }[];
  }>('/playlists', { part: 'snippet,contentDetails', mine: 'true', maxResults: '50' });

  return (data.items ?? []).map((item) => ({
    id: item.id,
    title: item.snippet.title,
    thumbnail: thumb(item.snippet),
    itemCount: item.contentDetails?.itemCount ?? 0,
  }));
}

export async function playlistItems(playlistId: string): Promise<YouTubeVideo[]> {
  const data = await call<{ items?: { snippet: RawSnippet }[] }>('/playlistItems', {
    part: 'snippet', playlistId, maxResults: '50',
  });

  return (data.items ?? [])
    .filter((item) => item.snippet.resourceId?.videoId)
    .map((item) => ({
      id: item.snippet.resourceId!.videoId!,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: thumb(item.snippet),
    }));
}

export async function searchVideos(query: string): Promise<YouTubeVideo[]> {
  if (!query.trim()) return [];
  const data = await call<{ items?: { id: { videoId?: string }; snippet: RawSnippet }[] }>('/search', {
    part: 'snippet', q: query, type: 'video', maxResults: '20',
  });

  return (data.items ?? [])
    .filter((item) => item.id.videoId)
    .map((item) => ({
      id: item.id.videoId!,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: thumb(item.snippet),
    }));
}
