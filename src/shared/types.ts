export type EventId = string | number;

export interface TimelineBodyData {
  isNPC: boolean;
  underwear: string;
  top: string;
  bottom: string;
  socks: string;
  shoes: string;
  cage: string;
  specialAccessories: Array<{ type: string }>;
  bustSize: number;
  cup: string;
  penisState: string;
  penisLength: number;
  [key: string]: unknown;
}

export interface TimelinePerson {
  name: string;
  notes?: string;
  height?: number;
  upperBust?: number;
  lowerBust?: number;
  waist?: number;
  hip?: number;
  penisNormal?: number | null;
  penisErect?: number | null;
  [key: string]: unknown;
}

export interface TimelineEvent {
  id: EventId;
  title: string;
  date: string;
  time: string;
  location: string;
  summary: string;
  content: string;
  people: string[];
  peopleData: Record<string, TimelineBodyData>;
  order: number;
  branchId: string | null;
}

export interface TimelineBranch {
  id: string;
  name: string;
  parentEventId: EventId | null;
  themeColor?: string;
}

export interface StoryPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface StoryPeriodGroup {
  id: string;
  name: string;
  periods: string[];
}

export interface StoryArchive {
  storyId: string;
  storyName: string;
  events: TimelineEvent[];
  branches: TimelineBranch[];
  mainCharacters: TimelinePerson[];
  semesters: StoryPeriod[];
  semesterGroups: StoryPeriodGroup[];
  savedAt: string;
  uiState?: Record<string, unknown>;
}

export interface StorySummary {
  storyId: string;
  storyName: string;
  eventCount: number;
  branchCount: number;
  savedAt: string;
}

export interface CompendiumItem {
  id: string;
  name: string;
  category: string;
  badgeClass?: string;
  icon?: string;
  isSpecialAccessory?: boolean;
  hasSubOptions?: boolean;
  subOptions?: string[];
  source?: string;
  details?: string;
}

export interface MarkdownImportResult {
  story: StoryArchive;
  importedCount: number;
  warnings: string[];
}
