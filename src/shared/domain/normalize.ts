import type { StoryArchive, TimelineBodyData, TimelineBranch, TimelineEvent } from '../types';

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
  const peopleData: Record<string, TimelineBodyData> = {};
  if (isRecord(raw.peopleData)) {
    for (const [name, data] of Object.entries(raw.peopleData)) peopleData[name] = normalizeBodyData(data);
  }
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

export function createDefaultBodyData(isNPC = false): TimelineBodyData {
  return {
    isNPC,
    underwear: '未设定',
    top: '未设定',
    bottom: '未设定',
    socks: '未设定',
    shoes: '未设定',
    cage: '无',
    specialAccessories: [],
    bustSize: 80,
    cup: 'A',
    penisState: '未勃起',
    penisLength: 8,
  };
}

export function normalizeBodyData(raw: unknown): TimelineBodyData {
  const data = createDefaultBodyData();
  if (!isRecord(raw)) return data;
  return {
    ...data,
    ...raw,
    isNPC: raw.isNPC === true,
    underwear: String(raw.underwear ?? data.underwear),
    top: String(raw.top ?? data.top),
    bottom: String(raw.bottom ?? data.bottom),
    socks: String(raw.socks ?? data.socks),
    shoes: String(raw.shoes ?? data.shoes),
    cage: String(raw.cage ?? data.cage),
    bustSize: Number(raw.bustSize ?? data.bustSize),
    cup: String(raw.cup ?? data.cup),
    penisState: String(raw.penisState ?? data.penisState),
    penisLength: Number(raw.penisLength ?? data.penisLength),
    specialAccessories: Array.isArray(raw.specialAccessories)
      ? raw.specialAccessories.map(item => typeof item === 'string' ? { type: item } : isRecord(item) ? { type: String(item.type ?? '') } : null).filter((item): item is { type: string } => !!item && !!item.type)
      : [],
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
