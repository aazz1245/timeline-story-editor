<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { PhFileText, PhMagnifyingGlass, PhPlus, PhUploadSimple } from '@phosphor-icons/vue';
import { api } from './shared/api';
import { parseMarkdown } from './shared/domain/markdown';
import type { StoryArchive, StorySummary, TimelineEvent, CompendiumItem } from './shared/types';
import StorySidebar from './features/stories/StorySidebar.vue';
import TimelineBoard from './features/timeline/TimelineBoard.vue';
import EventModal from './features/events/EventModal.vue';
import TimelineFlowBoard from './features/timeline/TimelineFlowBoard.vue';
import PeopleBoard from './features/people/PeopleBoard.vue';
import CompendiumBoard from './features/compendium/CompendiumBoard.vue';
import StageSettingsModal from './features/timeline/StageSettingsModal.vue';
import LocalSettingsModal from './shared/components/LocalSettingsModal.vue';

const stories = ref<StorySummary[]>([]);
const selectedId = ref('');
const story = ref<StoryArchive | null>(null);
const loading = ref(true);
const saving = ref(false);
const query = ref('');
const collapsedMonths = ref<Set<string>>(new Set());
const modalEvent = ref<TimelineEvent | null | undefined>(undefined);
const notice = ref('');
const fileInput = ref<HTMLInputElement>();
const view = ref<'timeline' | 'flow' | 'people' | 'compendium'>('timeline');
const compendium = ref<CompendiumItem[]>([]);
const collapsedStages = ref<Set<string>>(new Set());
const stageModal = ref(false);
const sidebarCollapsed = ref(false);
const settingsOpen = ref(false);
const settingsDirectory = ref('');
const autoSaveState = ref<'saved' | 'pending' | 'saving' | 'error'>('saved');
let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;
let persistedStorySnapshot = '';

const sortedEvents = computed(() => story.value?.events || []);
const latestEventDate = computed(() => sortedEvents.value.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date);

async function refreshStories(selectLatest = true) {
  stories.value = await api.stories();
  if (selectLatest && !selectedId.value) selectedId.value = stories.value[0]?.storyId || '';
}
async function loadStory(id: string) {
  if (!id) return;
  loading.value = true;
  try {
    story.value = await api.story(id);
    selectedId.value = id;
    const latestMonth = story.value.events.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date.slice(0, 7);
    collapsedMonths.value = new Set(story.value.events.map(event => event.date.slice(0, 7)).filter(month => month !== latestMonth));
    const latestStage = story.value.semesters.find(stage => latestEventDate.value && latestEventDate.value >= stage.startDate && latestEventDate.value <= stage.endDate);
    collapsedStages.value = new Set(story.value.semesters.filter(stage => stage.id !== latestStage?.id).map(stage => stage.id));
    persistedStorySnapshot = JSON.stringify(story.value);
    autoSaveState.value = 'saved';
  } catch (error) { notice.value = error instanceof Error ? error.message : '读取故事失败'; }
  finally { loading.value = false; }
}
function clearAutoSaveTimer() {
  if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = undefined; }
}
function scheduleAutoSave() {
  if (!story.value || loading.value) return;
  clearAutoSaveTimer();
  autoSaveState.value = 'pending';
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = undefined;
    if (!story.value || saving.value || JSON.stringify(story.value) === persistedStorySnapshot) return;
    void save(story.value, { silent: true });
  }, 700);
}
async function save(next: StoryArchive, options: { silent?: boolean } = {}) {
  clearAutoSaveTimer();
  saving.value = true;
  autoSaveState.value = 'saving';
  try { story.value = await api.saveStory(next); persistedStorySnapshot = JSON.stringify(story.value); await refreshStories(false); if (!options.silent) notice.value = '已保存'; }
  catch (error) { autoSaveState.value = 'error'; notice.value = error instanceof Error ? error.message : '保存失败'; }
  finally {
    saving.value = false;
    if (!options.silent && autoSaveState.value !== 'error') notice.value = '已保存';
    if (autoSaveState.value !== 'error') autoSaveState.value = 'saved';
    setTimeout(() => { notice.value = ''; }, 2200);
  }
}
function setPersistedStory(storyValue: StoryArchive) {
  story.value = storyValue;
  persistedStorySnapshot = JSON.stringify(storyValue);
  autoSaveState.value = 'saved';
}
async function saveCurrentStory() {
  if (!story.value || saving.value) return;
  await save(story.value);
  notice.value = '已存档';
}
async function createStory() {
  const name = window.prompt('新故事名称', '未命名故事');
  if (!name?.trim()) return;
  const created = await api.createStory(name.trim());
  await refreshStories(false); await loadStory(created.storyId);
}
async function renameStory(id: string) {
  const target = stories.value.find(item => item.storyId === id);
  if (!target) return;
  const name = window.prompt('故事名称', target.storyName);
  if (!name?.trim() || !story.value) return;
  const current = id === story.value.storyId ? story.value : await api.story(id);
  const renamed = await api.saveStory({ ...current, storyName: name.trim() });
  if (id === story.value.storyId) setPersistedStory(renamed);
  await refreshStories(false);
}
async function removeStory(id: string) {
  const target = stories.value.find(item => item.storyId === id);
  if (!target || !window.confirm(`删除故事「${target.storyName}」？`)) return;
  await api.deleteStory(id);
  if (id === selectedId.value) { story.value = null; selectedId.value = ''; }
  await refreshStories();
  if (stories.value[0]) await loadStory(stories.value[0].storyId);
}
async function deleteEvent(event: TimelineEvent) {
  if (!story.value || !window.confirm(`删除事件「${event.title}」？`)) return;
  await save({ ...story.value, events: story.value.events.filter(item => String(item.id) !== String(event.id)) });
}
async function saveEvent(event: TimelineEvent, branch?: import('./shared/types').TimelineBranch) {
  if (!story.value) return;
  if (branch && story.value.branches.some(item => item.name === branch.name)) { notice.value = `已存在同名分支「${branch.name}」`; return; }
  const events = story.value.events.some(item => String(item.id) === String(event.id)) ? story.value.events.map(item => String(item.id) === String(event.id) ? event : item) : [...story.value.events, { ...event, order: story.value.events.length + 1 }];
  modalEvent.value = undefined;
  await save({ ...story.value, events, branches: branch ? [...story.value.branches, branch] : story.value.branches });
}
async function deleteBranch(branchId: string) {
  if (!story.value) return;
  const branch = story.value.branches.find(item => item.id === branchId);
  if (!branch || !window.confirm(`删除线路「${branch.name}」？线路事件会保留并回到主线。`)) return;
  const events = story.value.events.map(event => event.branchId === branchId ? { ...event, branchId: null } : event);
  await save({ ...story.value, events, branches: story.value.branches.filter(item => item.id !== branchId) });
}
function toggleMonth(month: string) {
  const next = new Set(collapsedMonths.value); next.has(month) ? next.delete(month) : next.add(month); collapsedMonths.value = next;
}
function toggleStage(stageId: string) {
  const next = new Set<string>();
  if (collapsedStages.value.has(stageId)) {
    // Only one stage is visible at a time so an older stage cannot leave
    // newer content visible alongside it.
    story.value?.semesters.filter(stage => stage.id !== stageId).forEach(stage => next.add(stage.id));
    const stage = story.value?.semesters.find(item => item.id === stageId);
    const stageMonths = story.value?.events
      .filter(event => stage && event.date >= stage.startDate && event.date <= stage.endDate)
      .map(event => event.date.slice(0, 7)) || [];
    const latestStageMonth = [...new Set(stageMonths)].sort().at(-1);
    if (latestStageMonth) {
      const allMonths = new Set(story.value?.events.map(event => event.date.slice(0, 7)) || []);
      collapsedMonths.value = new Set([...allMonths].filter(month => month !== latestStageMonth));
    }
  } else {
    story.value?.semesters.forEach(stage => next.add(stage.id));
  }
  collapsedStages.value = next;
}
async function saveStages(stages: StoryArchive['semesters']) { if (!story.value) return; stageModal.value = false; await save({ ...story.value, semesters: stages }); }

function exportMarkdown() {
  if (!story.value) return;
  const branchName = (id: string | null) => id ? story.value!.branches.find(branch => branch.id === id)?.name || '未知分支' : '主线';
  const renderEvent = (event: TimelineEvent) => [`### ${event.date} ${event.time} - ${event.title}`, `**线路**: ${branchName(event.branchId)}`, event.location ? `**地点**: ${event.location}` : '', event.people.length ? `**人物**: ${event.people.join(', ')}` : '', '', event.summary ? `> ${event.summary}` : '', '', event.content, '', '---', ''].join('\n');
  const sections = [story.value.events.filter(event => !event.branchId).map(renderEvent).join('\n')];
  for (const branch of story.value.branches) { const parent = story.value.events.find(event => String(event.id) === String(branch.parentEventId)); sections.push(`## 结局分支: ${branch.name}${parent ? ` (分歧点: ${parent.title})` : ''}\n\n${story.value.events.filter(event => event.branchId === branch.id).map(renderEvent).join('\n')}`); }
  download(new Blob([sections.join('\n')], { type: 'text/markdown;charset=utf-8' }), `${story.value.storyName}.md`);
}
function exportEvent(event: TimelineEvent) {
  if (!story.value) return;
  const branchName = event.branchId ? story.value.branches.find(branch => branch.id === event.branchId)?.name || '未知分支' : '主线';
  const profiles = event.people.map(name => {
    const profile = event.peopleData[name];
    if (!profile) return '';
    const accessories = profile.specialAccessories.map(item => item.type).join(', ');
    return [`#### 人物档案`, `##### ${name}`, `- **内衣款式**: ${profile.underwear}`, `- **上衣**: ${profile.top}`, `- **下装**: ${profile.bottom}`, `- **袜饰**: ${profile.socks}`, `- **鞋履**: ${profile.shoes}`, `- **特殊饰品**: ${[profile.cage, accessories].filter(Boolean).join(', ') || '无'}`, `- **胸围**: ${profile.bustSize}cm`, `- **罩杯**: ${profile.cup}`, `- **状态**: ${profile.penisState}`, `- **尺寸**: ${profile.penisLength}cm`].join('\n');
  }).filter(Boolean).join('\n\n');
  const markdown = [`### ${event.date} ${event.time} - ${event.title}`, `**线路**: ${branchName}`, `**地点**: ${event.location}`, `**人物**: ${event.people.join(', ')}`, '', event.summary ? `> ${event.summary}` : '', '', event.content, '', profiles, '', '---', ''].join('\n');
  download(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), `${event.title || '事件'}.md`);
}
async function importMarkdown(file: File) {
  if (!story.value) return;
  const result = parseMarkdown(await file.text(), story.value);
  await save(result.story); notice.value = result.warnings.join('；') || `已导入 ${result.importedCount} 个事件`;
}
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }
async function saveCompendium(items: CompendiumItem[]) { compendium.value = items; await api.saveCompendium(items); notice.value = '图鉴已保存'; setTimeout(() => { notice.value = ''; }, 2200); }
async function openSettings() {
  try { settingsDirectory.value = (await api.settings()).dataDirectory; settingsOpen.value = true; }
  catch (error) { notice.value = error instanceof Error ? error.message : '读取本机设置失败'; }
}
async function changeDataDirectory(directory: string) {
  try {
    settingsDirectory.value = (await api.saveSettings({ dataDirectory: directory })).dataDirectory;
    settingsOpen.value = false;
    selectedId.value = '';
    story.value = null;
    await refreshStories();
    if (stories.value[0]) await loadStory(stories.value[0].storyId);
    notice.value = '默认存档目录已更新';
  } catch (error) { notice.value = error instanceof Error ? error.message : '保存档案目录失败'; }
}
function openMarkdownFile() { fileInput.value?.click(); }
function setView(next: string) { if (['timeline', 'flow', 'people', 'compendium'].includes(next)) view.value = next as typeof view.value; }
async function onMarkdownFile(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (file) await importMarkdown(file); (event.target as HTMLInputElement).value = ''; }
function handleGlobalKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    void saveCurrentStory();
  }
}

onMounted(async () => { window.addEventListener('keydown', handleGlobalKeydown); try { settingsDirectory.value = (await api.settings()).dataDirectory; await refreshStories(); if (stories.value[0]) await loadStory(stories.value[0].storyId); compendium.value = await api.compendium(); } catch (error) { notice.value = error instanceof Error ? error.message : '服务未启动'; } finally { loading.value = false; } });
onBeforeUnmount(() => { window.removeEventListener('keydown', handleGlobalKeydown); clearAutoSaveTimer(); });
watch(selectedId, id => { if (id && id !== story.value?.storyId) loadStory(id); });
watch(story, next => {
  if (!next || loading.value || JSON.stringify(next) === persistedStorySnapshot) return;
  scheduleAutoSave();
}, { deep: true });
</script>

<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <StorySidebar :stories="stories" :selected-id="selectedId" :loading="loading" :collapsed="sidebarCollapsed" @select="selectedId = $event" @create="createStory" @rename="renameStory" @remove="removeStory" @toggle="sidebarCollapsed = !sidebarCollapsed" @settings="openSettings" />
    <main class="workspace">
      <header class="topbar">
        <div><h1>{{ story?.storyName || '故事时间线' }}</h1><p>本机故事工作区 · <span class="save-status" :class="`is-${autoSaveState}`">{{ saving ? '正在保存…' : autoSaveState === 'pending' ? '等待自动保存…' : autoSaveState === 'error' ? '自动保存失败' : '实时保存已开启' }}</span></p></div>
        <div class="toolbar">
          <label class="btn" title="搜索事件"><PhMagnifyingGlass :size="18" aria-hidden="true" /><input v-model="query" aria-label="搜索事件" placeholder="搜索事件" style="width: 120px; border: 0; outline: 0; background: transparent;" /></label>
          <button class="btn" type="button" @click="openMarkdownFile"><PhUploadSimple :size="18" aria-hidden="true" /><span>导入 Markdown</span></button>
          <button class="btn" type="button" :disabled="!story" @click="exportMarkdown"><PhFileText :size="18" aria-hidden="true" /><span>导出 Markdown</span></button>
          <button v-if="view === 'timeline'" class="btn" type="button" @click="stageModal = true"><span>阶段设置</span></button>
          <button class="btn primary" type="button" @click="modalEvent = null"><PhPlus :size="18" aria-hidden="true" /><span>新建事件</span></button>
          <input ref="fileInput" type="file" accept=".md,.markdown,text/markdown" hidden @change="onMarkdownFile" />
        </div>
      </header>
      <div v-if="notice" class="notice" role="status">{{ notice }}</div>
      <div v-if="loading" class="loading">正在读取本机故事…</div>
      <div v-else-if="!story" class="content"><div class="empty-state"><strong>本机还没有故事档案</strong><div>新建故事后开始编辑。</div><div class="toolbar" style="justify-content:center; margin-top:16px;"><button class="btn primary" type="button" @click="createStory"><PhPlus :size="17" aria-hidden="true" />新建故事</button></div></div></div>
      <div v-else class="content">
        <nav class="view-tabs" aria-label="工作区视图"><button v-for="tab in [{ id: 'timeline', label: '时间线' }, { id: 'flow', label: '时间流' }, { id: 'people', label: '人物身体数据' }, { id: 'compendium', label: '图鉴' }]" :key="tab.id" class="view-tab" :class="{ active: view === tab.id }" type="button" :aria-current="view === tab.id ? 'page' : undefined" @click="setView(tab.id)">{{ tab.label }}</button></nav>
        <TimelineBoard v-if="view === 'timeline'" :events="sortedEvents" :branches="story.branches" :stages="story.semesters" :collapsed-months="collapsedMonths" :collapsed-stages="collapsedStages" :query="query" @toggle-month="toggleMonth" @toggle-stage="toggleStage" @edit="modalEvent = $event" @delete="deleteEvent" @select="modalEvent = $event" @export="exportEvent" />
        <TimelineFlowBoard v-else-if="view === 'flow'" :events="story.events" :branches="story.branches" :stages="story.semesters" @select="modalEvent = $event" @edit="modalEvent = $event" @export="exportEvent" @delete-branch="deleteBranch" />
        <PeopleBoard v-else-if="view === 'people'" :story="story" @save="save" />
        <CompendiumBoard v-else :items="compendium" @save="saveCompendium" />
      </div>
    </main>
    <EventModal v-if="modalEvent !== undefined" :event="modalEvent" :branches="story?.branches || []" :events="story?.events || []" @close="modalEvent = undefined" @save="saveEvent" />
    <StageSettingsModal v-if="stageModal" :stages="story?.semesters || []" @close="stageModal = false" @save="saveStages" />
    <LocalSettingsModal v-if="settingsOpen" :data-directory="settingsDirectory" @close="settingsOpen = false" @refresh="refreshStories(); story && loadStory(story.storyId)" @save="changeDataDirectory" />
  </div>
</template>
