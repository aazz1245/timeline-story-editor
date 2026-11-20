<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { PhFileText, PhMagnifyingGlass, PhPlus, PhUploadSimple } from '@phosphor-icons/vue';
import { api } from './shared/api';
import { parseMarkdown, renderEventMarkdown, renderStoryMarkdown } from './shared/domain/markdown';
import type { StoryArchive, TimelineEvent, CompendiumItem } from './shared/types';
import { useStoryArchive } from './features/stories/useStoryArchive';
import StorySidebar from './features/stories/StorySidebar.vue';
import TimelineBoard from './features/timeline/TimelineBoard.vue';
import EventModal from './features/events/EventModal.vue';
import TimelineFlowBoard from './features/timeline/TimelineFlowBoard.vue';
import PeopleBoard from './features/people/PeopleBoard.vue';
import CompendiumBoard from './features/compendium/CompendiumBoard.vue';
import StageSettingsModal from './features/timeline/StageSettingsModal.vue';
import LocalSettingsModal from './shared/components/LocalSettingsModal.vue';

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
let saveNoticeTimer: ReturnType<typeof setTimeout> | undefined;

const archive = useStoryArchive({
  onSaveError: error => { notice.value = error instanceof Error ? error.message : '自动保存失败'; },
});
const { stories, selectedId, story, loading, saving, autoSaveState } = archive;

const sortedEvents = computed(() => story.value?.events || []);
const latestEventDate = computed(() => sortedEvents.value.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date);

async function loadStory(id: string) {
  try {
    await archive.loadStory(id);
    if (!story.value) return;
    const latestMonth = story.value.events.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.date.slice(0, 7);
    collapsedMonths.value = new Set(story.value.events.map(event => event.date.slice(0, 7)).filter(month => month !== latestMonth));
    const latestStage = story.value.semesters.find(stage => latestEventDate.value && latestEventDate.value >= stage.startDate && latestEventDate.value <= stage.endDate);
    collapsedStages.value = new Set(story.value.semesters.filter(stage => stage.id !== latestStage?.id).map(stage => stage.id));
  } catch (error) { notice.value = error instanceof Error ? error.message : '读取故事失败'; }
}
const refreshStories = archive.refreshStories;
async function save(next: StoryArchive) {
  try {
    await archive.save(next);
    showSaveNotice('已保存');
  } catch (error) {
    notice.value = error instanceof Error ? error.message : '保存失败';
  }
}
async function saveCurrentStory() {
  if (!story.value) return;
  try {
    await archive.saveCurrentStory();
    showSaveNotice('已存档');
  } catch (error) {
    notice.value = error instanceof Error ? error.message : '保存失败';
  }
}
function showSaveNotice(message: string) {
  if (saveNoticeTimer) clearTimeout(saveNoticeTimer);
  notice.value = message;
  saveNoticeTimer = setTimeout(() => {
    if (notice.value === message) notice.value = '';
    saveNoticeTimer = undefined;
  }, 2200);
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
  if (id === story.value.storyId) await save({ ...current, storyName: name.trim() });
  else await api.saveStory({ ...current, storyName: name.trim() });
  await refreshStories(false);
}
async function removeStory(id: string) {
  const target = stories.value.find(item => item.storyId === id);
  if (!target || !window.confirm(`删除故事「${target.storyName}」？`)) return;
  try {
    if (id === selectedId.value) await archive.saveCurrentStory();
    await api.deleteStory(id);
    if (id === selectedId.value) { story.value = null; selectedId.value = ''; }
    await refreshStories(false);
    if (stories.value[0]) await loadStory(stories.value[0].storyId);
  } catch (error) {
    notice.value = error instanceof Error ? error.message : '删除故事失败';
  }
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
  download(new Blob([renderStoryMarkdown(story.value)], { type: 'text/markdown;charset=utf-8' }), `${story.value.storyName}.md`);
}
function exportEvent(event: TimelineEvent) {
  if (!story.value) return;
  download(new Blob([renderEventMarkdown(event, story.value.branches, true)], { type: 'text/markdown;charset=utf-8' }), `${event.title || '事件'}.md`);
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
    await archive.saveCurrentStory();
    settingsDirectory.value = (await api.saveSettings({ dataDirectory: directory })).dataDirectory;
    settingsOpen.value = false;
    selectedId.value = '';
    story.value = null;
    await refreshStories(false);
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

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown);
  try {
    settingsDirectory.value = (await api.settings()).dataDirectory;
    await refreshStories(false);
    if (stories.value[0]) await loadStory(stories.value[0].storyId);
    else loading.value = false;
    compendium.value = await api.compendium();
  } catch (error) {
    loading.value = false;
    notice.value = error instanceof Error ? error.message : '服务未启动';
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  archive.dispose();
  if (saveNoticeTimer) clearTimeout(saveNoticeTimer);
});
watch(selectedId, id => { if (id && id !== story.value?.storyId) loadStory(id); });
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
        <nav class="view-tabs" aria-label="工作区视图"><button v-for="tab in [{ id: 'timeline', label: '时间线' }, { id: 'flow', label: '时间流' }, { id: 'people', label: '人物基础数据档案' }, { id: 'compendium', label: '图鉴' }]" :key="tab.id" class="view-tab" :class="{ active: view === tab.id }" type="button" :aria-current="view === tab.id ? 'page' : undefined" @click="setView(tab.id)">{{ tab.label }}</button></nav>
        <TimelineBoard v-if="view === 'timeline'" :events="sortedEvents" :branches="story.branches" :stages="story.semesters" :collapsed-months="collapsedMonths" :collapsed-stages="collapsedStages" :query="query" @toggle-month="toggleMonth" @toggle-stage="toggleStage" @edit="modalEvent = $event" @delete="deleteEvent" @select="modalEvent = $event" @export="exportEvent" />
        <TimelineFlowBoard v-else-if="view === 'flow'" :events="story.events" :branches="story.branches" :stages="story.semesters" @select="modalEvent = $event" @edit="modalEvent = $event" @export="exportEvent" @delete-branch="deleteBranch" />
        <PeopleBoard v-else-if="view === 'people'" :story="story" @save="save" />
        <CompendiumBoard v-else :items="compendium" @save="saveCompendium" />
      </div>
    </main>
    <EventModal v-if="modalEvent !== undefined" :event="modalEvent" :branches="story?.branches || []" :events="story?.events || []" :main-characters="story?.mainCharacters || []" @close="modalEvent = undefined" @save="saveEvent" />
    <StageSettingsModal v-if="stageModal" :stages="story?.semesters || []" @close="stageModal = false" @save="saveStages" />
    <LocalSettingsModal v-if="settingsOpen" :data-directory="settingsDirectory" @close="settingsOpen = false" @refresh="refreshStories(); story && loadStory(story.storyId)" @save="changeDataDirectory" />
  </div>
</template>
