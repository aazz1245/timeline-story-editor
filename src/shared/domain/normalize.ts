import type { StoryArchive, TimelineBranch, TimelineEvent } from '../types';

const emptyStory = (storyName = '未命名故事', storyId: string = crypto.randomUUID()): StoryArchive => ({
  storyId,
  storyName,
  events: [],
  branches: [],
  mainCharacters: [],
  semesters: [],
  semesterGroups: [],
  savedAt: new Date().toISOString(),
});

export function normalizeStory(input: unknown): StoryArchive {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('故事 JSON 必须是对象');
  const value = input as Record<string, unknown>;
  const storyId = String(value.storyId ?? value.id ?? crypto.randomUUID());
  const events = Array.isArray(value.events) ? value.events.map((raw, index) => normalizeEvent(raw, index)) : [];
  const branches = Array.isArray(value.branches) ? value.branches.map(normalizeBranch).filter((branch): branch is TimelineBranch => !!branch) : [];
  const people = Array.isArray(value.mainCharacters) ? value.mainCharacters.filter(isRecord) : [];
  return {
    ...emptyStory(String(value.storyName ?? value.name ?? '未命名故事'), storyId),
    events,
    branches,
    mainCharacters: people.map(person => ({ ...person, name: String(person.name ?? '未命名人物') })),
    semesters: Array.isArray(value.semesters) ? value.semesters.filter(isRecord).map(stage => ({
      id: String(stage.id), name: String(stage.name ?? ''),
      startDate: normalizeDate(String(stage.startDate ?? '')),
      endDate: normalizeDate(String(stage.endDate ?? '')),
    })) : [],
    semesterGroups: Array.isArray(value.semesterGroups) ? value.semesterGroups.filter(isRecord).map(group => ({
      id: String(group.id), name: String(group.name ?? ''),
      periods: Array.isArray(group.periods) ? group.periods.map(String) : [],
    })) : [],
    savedAt: String(value.savedAt ?? new Date().toISOString()),
    ...(isRecord(value.uiState) ? { uiState: value.uiState } : {}),
  };
}

export function createEmptyStory(name = '未命名故事'): StoryArchive {
  return emptyStory(name);
}

export function normalizeDate(value: string): string {
  const match = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return value;
  return `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`;
}

export function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEvent(raw: unknown, index: number): TimelineEvent {
  if (!isRecord(raw)) throw new Error(`第 ${index + 1} 个事件格式错误`);
  const id = raw.id ?? `${Date.now()}-${index}`;
  const people = Array.isArray(raw.people) ? raw.people.map(String) : [];
  const peopleData = isRecord(raw.peopleData) ? raw.peopleData : {};
  return {
    id: typeof id === 'number' ? id : String(id),
    title: String(raw.title ?? '未命名事件'),
    date: normalizeDate(String(raw.date ?? '')),
    time: String(raw.time ?? ''),
    location: String(raw.location ?? ''),
    summary: String(raw.summary ?? ''),
    content: String(raw.content ?? ''),
    people,
    peopleData,
    order: Number(raw.order ?? index + 1),
    branchId: raw.branchId == null || raw.branchId === '' ? null : String(raw.branchId),
  };
}

function normalizeBranch(raw: unknown): TimelineBranch | null {
  if (!isRecord(raw)) return null;
  return {
    id: String(raw.id ?? `branch-${crypto.randomUUID()}`),
    name: String(raw.name ?? '未命名分支'),
    parentEventId: raw.parentEventId == null ? null : raw.parentEventId as string | number,
    ...(typeof raw.themeColor === 'string' ? { themeColor: raw.themeColor } : {}),
  };
}
