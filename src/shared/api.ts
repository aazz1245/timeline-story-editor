import type { CompendiumItem, StoryArchive, StorySummary } from './types';

export interface LocalSettings { dataDirectory: string; }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || `请求失败 (${response.status})`);
  return response.status === 204 ? undefined as T : response.json();
}

export const api = {
  settings: () => request<LocalSettings>('/api/settings'),
  saveSettings: (settings: LocalSettings) => request<LocalSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  stories: () => request<StorySummary[]>('/api/stories'),
  story: (id: string) => request<StoryArchive>(`/api/stories/${encodeURIComponent(id)}`),
  createStory: (storyName: string) => request<StoryArchive>('/api/stories', { method: 'POST', body: JSON.stringify({ storyName }) }),
  importStory: (story: StoryArchive) => request<StoryArchive>('/api/stories', { method: 'POST', body: JSON.stringify(story) }),
  saveStory: (story: StoryArchive) => request<StoryArchive>(`/api/stories/${encodeURIComponent(story.storyId)}`, { method: 'PUT', body: JSON.stringify(story) }),
  deleteStory: (id: string) => request<void>(`/api/stories/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  compendium: () => request<CompendiumItem[]>('/api/compendium'),
  saveCompendium: (items: CompendiumItem[]) => request<{ count: number }>('/api/compendium', { method: 'PUT', body: JSON.stringify(items) }),
};
