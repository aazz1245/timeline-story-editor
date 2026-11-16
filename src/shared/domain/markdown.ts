import { normalizeBodyData, normalizeDate, normalizeStory } from './normalize';
import type { MarkdownImportResult, StoryArchive, TimelineBranch, TimelineEvent } from '../types';

const eventHeading = /^###\s+(\d{4}[/-]\d{1,2}[/-]\d{1,2})(?:\s+(.+?))?\s+-\s*(.+)$/;
const branchHeading = /^##\s+结局分支\s*[:：]\s*(.*?)(?:\s*[(（]分歧点\s*[:：]\s*(.*?)[)）])?\s*$/;
const timeSlots = new Set(['凌晨', '清晨', '上午', '中午', '下午', '黄昏', '晚上', '深夜']);

export function parseMarkdown(markdown: string, original: StoryArchive): MarkdownImportResult {
  const story = normalizeStory(original);
  const warnings: string[] = [];
  const branches = [...story.branches];
  const events = [...story.events];
  let activeBranch: TimelineBranch | null = null;
  let activeParentTitle = '';
  let index = 0;
  let importedCount = 0;
  const lines = markdown.replace(/^#\s+.*\n/, '').split(/\r?\n/);

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    const branchMatch = trimmed.match(branchHeading);
    if (branchMatch) {
      const name = branchMatch[1].trim();
      if (!name) { warnings.push('发现没有名称的分支标题'); index++; continue; }
      activeBranch = findOrCreateBranch(branches, name);
      activeParentTitle = branchMatch[2]?.trim() || '';
      index++;
      continue;
    }
    const header = trimmed.match(eventHeading);
    if (!header) { index++; continue; }

    const body: string[] = [];
    index++;
    while (index < lines.length && !eventHeading.test(lines[index].trim()) && !branchHeading.test(lines[index].trim())) body.push(lines[index++]);
    const parsed = parseEvent(header, body, events.length, branches, activeBranch);
    if (activeBranch && activeParentTitle && activeBranch.parentEventId == null) {
      const parent = events.find(event => event.title === activeParentTitle);
      if (parent) activeBranch.parentEventId = parent.id;
      else warnings.push(`分支「${activeBranch.name}」的分歧点「${activeParentTitle}」未找到`);
    }
    const event = parsed.event;
    const existing = events.findIndex(item => item.title === event.title);
    if (existing >= 0) events[existing] = { ...events[existing], ...event, id: events[existing].id, order: events[existing].order };
    else events.push(event);
    importedCount++;
    warnings.push(...parsed.warnings);
  }

  if (!importedCount) warnings.push('没有找到可导入的事件标题');
  return { story: normalizeStory({ ...story, events, branches, savedAt: new Date().toISOString() }), importedCount, warnings };
}

function parseEvent(header: RegExpMatchArray, body: string[], order: number, branches: TimelineBranch[], activeBranch: TimelineBranch | null) {
  const warnings: string[] = [];
  const fields = new Map<string, string>();
  for (const line of body) {
    const field = line.trim().match(/^\*\*(地点|人物|线路)\*\*\s*[:：]\s*(.*)$/);
    if (field) fields.set(field[1], field[2].trim());
  }
  const marker = fields.get('线路');
  let branchId = activeBranch?.id ?? null;
  if (marker === '主线') branchId = null;
  else if (marker) {
    const name = marker.replace(/^分支\s*[:：]\s*/, '').trim();
    if (name) branchId = findOrCreateBranch(branches, name).id;
    else warnings.push(`事件「${header[3].trim()}」的线路标记无效`);
  }
  const summary = body.find(line => /^>\s?/.test(line.trim()))?.trim().replace(/^>\s?/, '') || '';
  const personBlocks = parsePeople(body);
  const excluded = /^(?:\*\*地点\*\*|\*\*人物\*\*|\*\*线路\*\*|>\s?|####\s*人物档案|#####\s|---\s*$)/;
  const peopleStart = body.findIndex(line => /^####\s*人物档案/.test(line.trim()));
  const prose = peopleStart < 0 ? body : body.slice(0, peopleStart);
  const content = prose.filter(line => line.trim() && !excluded.test(line.trim())).join('\n').trim();
  const event: TimelineEvent = {
    id: `${Date.now()}-${order}`,
    title: header[3].trim(),
    date: normalizeDate(header[1]),
    time: timeSlots.has(header[2]?.trim()) ? header[2].trim() : '上午',
    location: fields.get('地点') || '',
    summary,
    content,
    people: (fields.get('人物') || '').split(/[,，]/).map(name => name.trim()).filter(Boolean),
    peopleData: Object.fromEntries(Object.entries(personBlocks).map(([name, data]) => [name, normalizeBodyData(data)])),
    order: order + 1,
    branchId,
  };
  return { event, warnings };
}

function parsePeople(lines: string[]) {
  const result: Record<string, Record<string, unknown>> = {};
  let currentName = '';
  let fields: Record<string, string> = {};
  const save = () => {
    if (!currentName) return;
    const isNPC = Object.values(fields).some(value => value === 'NPC');
    const dimension = Number((fields['尺寸'] || '').match(/[\d.]+/)?.[0] || 8);
    result[currentName] = {
      isNPC,
      underwear: fields['内衣款式'] || '未设定', top: fields['上衣'] || '未设定',
      bottom: fields['下装'] || '未设定', socks: fields['袜饰'] || '未设定', shoes: fields['鞋履'] || '未设定',
      cage: fields['特殊饰品'] || '无', specialAccessories: [], bustSize: Number((fields['胸围'] || '').match(/[\d.]+/)?.[0] || 80),
      penisState: fields['状态'] || '未勃起', penisLength: fields['尺寸']?.includes('女') ? 0 : dimension,
    };
  };
  for (const line of lines) {
    const heading = line.trim().match(/^#####\s+(.+)$/);
    if (heading) { save(); currentName = heading[1].trim(); fields = {}; continue; }
    const field = line.trim().match(/^-\s*\*\*(.+?)\*\*\s*[:：]\s*(.+)$/);
    if (field && currentName) fields[field[1].trim()] = field[2].trim();
    if (line.trim() === 'NPC' && currentName) fields.NPC = 'NPC';
  }
  save();
  return result;
}

function findOrCreateBranch(branches: TimelineBranch[], name: string) {
  const matches = branches.filter(branch => branch.name === name);
  if (matches.length > 1) throw new Error(`存在同名分支「${name}」，无法确定归属`);
  if (matches[0]) return matches[0];
  const branch: TimelineBranch = { id: `branch-${crypto.randomUUID()}`, name, parentEventId: null };
  branches.push(branch);
  return branch;
}
