<script setup lang="ts">
import { PhCaretDown, PhCaretRight, PhExport, PhGitBranch, PhMapPin, PhPencilSimple, PhTrash } from '@phosphor-icons/vue';
import { computed, ref } from 'vue';
import type { StoryPeriod, TimelineBranch, TimelineEvent } from '../../shared/types';

const props = defineProps<{ events: TimelineEvent[]; branches: TimelineBranch[]; stages: StoryPeriod[]; collapsedMonths: Set<string>; collapsedStages: Set<string>; focusedStageId: string | null; query: string }>();
const emit = defineEmits<{ edit: [event: TimelineEvent]; delete: [event: TimelineEvent]; export: [event: TimelineEvent]; toggleMonth: [month: string]; toggleStage: [stageId: string]; focusStage: [stageId: string | null]; select: [event: TimelineEvent] }>();
const expandedEvents = ref(new Set<string>());

const branchMap = computed(() => new Map(props.branches.map(branch => [branch.id, branch.name])));
const branchDepth = computed(() => {
  const depths = new Map<string, number>();
  const resolve = (id: string, seen = new Set<string>()): number => {
    if (depths.has(id)) return depths.get(id)!;
    if (seen.has(id)) return 1;
    seen.add(id);
    const branch = props.branches.find(item => item.id === id);
    const parent = branch?.parentEventId == null ? 0 : 1;
    const depth = parent + (branch?.parentEventId != null ? 0 : 0);
    depths.set(id, depth);
    return depth;
  };
  props.branches.forEach(branch => resolve(branch.id));
  return depths;
});
const stageCounts = computed(() => new Map(props.stages.map(stage => [stage.id, props.events.filter(event => inStage(event, stage)).length])));
const stageName = (id: string) => props.stages.find(stage => stage.id === id)?.name || '';
const inStage = (event: TimelineEvent, stage: StoryPeriod) => event.date >= stage.startDate && event.date <= stage.endDate;
const stageBreakdown = (stage: StoryPeriod) => props.branches.map(branch => ({ branch, count: props.events.filter(event => inStage(event, stage) && event.branchId === branch.id).length })).filter(item => item.count);
type MonthGroup = [month: string, events: TimelineEvent[]];
type StageSection = { stage: StoryPeriod | null; months: MonthGroup[]; eventCount: number };
const stageSections = computed<StageSection[]>(() => {
  const grouped = new Map<string, { stage: StoryPeriod | null; months: Map<string, TimelineEvent[]> }>();
  const query = props.query.trim().toLocaleLowerCase();
  for (const event of [...props.events].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)) {
    if (query && !`${event.title} ${event.summary} ${event.location} ${event.people.join(' ')}`.toLocaleLowerCase().includes(query)) continue;
    const stage = props.stages.find(item => inStage(event, item));
    if (stage && props.collapsedStages.has(stage.id)) continue;
    if (props.focusedStageId && (!stage || stage.id !== props.focusedStageId)) continue;
    const month = event.date.slice(0, 7) || '未知月份';
    const key = stage?.id || '__unassigned__';
    if (!grouped.has(key)) grouped.set(key, { stage: stage || null, months: new Map() });
    const section = grouped.get(key)!;
    if (!section.months.has(month)) section.months.set(month, []);
    section.months.get(month)!.push(event);
  }
  const sections: StageSection[] = [];
  for (const stage of props.stages) {
    const section = grouped.get(stage.id);
    if (!section) continue;
    const months = [...section.months.entries()].sort(([a], [b]) => a.localeCompare(b));
    sections.push({ stage, months, eventCount: months.reduce((total, [, events]) => total + events.length, 0) });
  }
  const unassigned = grouped.get('__unassigned__');
  if (unassigned) {
    const months = [...unassigned.months.entries()].sort(([a], [b]) => a.localeCompare(b));
    sections.push({ stage: null, months, eventCount: months.reduce((total, [, events]) => total + events.length, 0) });
  }
  return sections;
});
const timelineBlocks = computed(() => {
  const sectionsByStage = new Map(stageSections.value.filter(section => section.stage).map(section => [section.stage!.id, section]));
  return props.stages
    .filter(stage => !props.focusedStageId || props.focusedStageId === stage.id)
    .map(stage => {
      const section = sectionsByStage.get(stage.id);
      return {
        stage,
        months: section?.months || [],
        eventCount: section?.eventCount || 0,
        collapsed: props.collapsedStages.has(stage.id),
      };
    })
    .filter(block => block.collapsed || block.months.length);
});
const unassignedSection = computed(() => stageSections.value.find(section => !section.stage));
const monthLabel = (month: string) => month === '未知月份' ? month : `${month.slice(0, 4)}年${month.slice(5, 7)}月`;
const branchName = (id: string | null) => id ? branchMap.value.get(id) || '未知分支' : '主线';
const eventIndent = (event: TimelineEvent) => event.branchId ? Math.max(1, branchDepth.value.get(event.branchId) || 1) : 0;
function toggleDetails(event: TimelineEvent) {
  const id = String(event.id);
  const next = new Set(expandedEvents.value);
  next.has(id) ? next.delete(id) : next.add(id);
  expandedEvents.value = next;
}
</script>

<template>
  <section class="timeline" aria-label="事件时间线">
    <div v-if="stages.length" class="stage-tools" aria-label="故事阶段">
      <button v-for="stage in stages" :key="stage.id" class="stage-toggle" type="button" :aria-expanded="!collapsedStages.has(stage.id)" @click="emit('toggleStage', stage.id)">
        <span>{{ stageName(stage.id) }}</span><small>{{ stageCounts.get(stage.id) || 0 }}</small>
      </button>
      <button v-for="stage in stages" :key="`${stage.id}-focus`" class="stage-focus" type="button" :aria-pressed="focusedStageId === stage.id" @click="emit('focusStage', focusedStageId === stage.id ? null : stage.id)">{{ focusedStageId === stage.id ? '返回全部' : `只看${stage.name}` }}</button>
    </div>
    <div v-if="!stageSections.length" class="empty-state"><strong>暂无匹配事件</strong><div>导入 Markdown 或新建事件后，故事会出现在这里。</div></div>
    <template v-for="block in timelineBlocks" :key="block.stage.id">
      <section v-if="block.collapsed" class="stage-summary">
        <div><strong>{{ block.stage.name }}</strong><p>{{ block.stage.startDate }} — {{ block.stage.endDate }} · {{ stageCounts.get(block.stage.id) || 0 }} 个事件</p><div class="event-meta"><span v-for="item in stageBreakdown(block.stage)" :key="item.branch.id" class="chip">{{ item.branch.name }} · {{ item.count }}</span></div></div>
        <button class="btn" type="button" @click="emit('toggleStage', block.stage.id)">展开阶段</button>
      </section>
      <section v-else-if="block.months.length" class="stage-section">
        <header class="stage-heading">
          <div>
            <div class="eyebrow">STORY STAGE</div>
            <h2 class="stage-heading-title">{{ block.stage.name }}</h2>
            <p>{{ block.stage.startDate }} — {{ block.stage.endDate }} · {{ block.eventCount }} 个事件</p>
          </div>
          <button class="icon-btn" type="button" :aria-label="`收起阶段 ${block.stage.name}`" :aria-expanded="true" @click="emit('toggleStage', block.stage.id)"><PhCaretDown :size="19" aria-hidden="true" /></button>
        </header>
        <section v-for="[month, monthEvents] in block.months" :key="month" class="month-section">
        <button class="month-header" type="button" :aria-expanded="!collapsedMonths.has(month)" @click="emit('toggleMonth', month)">
          <span><strong>{{ monthLabel(month) }}</strong><br><small>{{ monthEvents.length }} 个事件</small></span>
          <PhCaretRight v-if="collapsedMonths.has(month)" :size="20" aria-hidden="true" /><PhCaretDown v-else :size="20" aria-hidden="true" />
        </button>
        <Transition name="month-expand">
          <div v-if="!collapsedMonths.has(month)" class="month-expand">
            <div class="month-expand-inner">
              <div class="month-events">
                <article v-for="event in monthEvents" :key="String(event.id)" class="event-card" :class="{ 'details-open': expandedEvents.has(String(event.id)), 'is-nested': eventIndent(event) > 0 }" :style="{ '--event-indent': `${eventIndent(event) * 28}px` }">
                  <div class="event-date"><strong>{{ event.date }}</strong><br>{{ event.time || '时间未注明' }}</div>
                  <button class="event-main" type="button" @click="emit('select', event)">
                    <h3 class="event-title">{{ event.title }}</h3>
                    <p class="event-summary">{{ event.summary || '暂无摘要' }}</p>
                    <div class="event-meta">
                      <span class="chip"><PhGitBranch :size="13" aria-hidden="true" />{{ branchName(event.branchId) }}</span>
                      <span v-if="event.location" class="chip"><PhMapPin :size="13" aria-hidden="true" />{{ event.location }}</span>
                      <span v-for="person in event.people.slice(0, 3)" :key="person" class="chip">{{ person }}</span>
                    </div>
                  </button>
                  <div class="event-actions">
                    <button class="icon-btn" type="button" :aria-label="`${expandedEvents.has(String(event.id)) ? '收起' : '展开'} ${event.title} 详情`" :aria-expanded="expandedEvents.has(String(event.id))" @click="toggleDetails(event)"><PhCaretDown :size="18" aria-hidden="true" /></button>
                    <button class="icon-btn" type="button" :aria-label="`导出 ${event.title}`" @click="emit('export', event)"><PhExport :size="18" aria-hidden="true" /></button>
                    <button class="icon-btn" type="button" :aria-label="`编辑 ${event.title}`" @click="emit('edit', event)"><PhPencilSimple :size="18" aria-hidden="true" /></button>
                    <button class="icon-btn" type="button" :aria-label="`删除 ${event.title}`" @click="emit('delete', event)"><PhTrash :size="18" aria-hidden="true" /></button>
                  </div>
                  <div v-if="expandedEvents.has(String(event.id))" class="event-detail"><p>{{ event.content || '暂无正文' }}</p></div>
                </article>
              </div>
            </div>
          </div>
        </Transition>
        </section>
      </section>
    </template>
    <section v-if="unassignedSection" class="stage-section">
      <header class="stage-heading">
        <div>
          <div class="eyebrow">STORY STAGE</div>
          <h2 class="stage-heading-title">未分阶段</h2>
          <p>{{ unassignedSection.eventCount }} 个事件</p>
        </div>
      </header>
      <section v-for="[month, monthEvents] in unassignedSection.months" :key="month" class="month-section">
        <button class="month-header" type="button" :aria-expanded="!collapsedMonths.has(month)" @click="emit('toggleMonth', month)">
          <span><strong>{{ monthLabel(month) }}</strong><br><small>{{ monthEvents.length }} 个事件</small></span>
          <PhCaretRight v-if="collapsedMonths.has(month)" :size="20" aria-hidden="true" /><PhCaretDown v-else :size="20" aria-hidden="true" />
        </button>
        <Transition name="month-expand">
          <div v-if="!collapsedMonths.has(month)" class="month-expand">
            <div class="month-expand-inner">
              <div class="month-events">
                <article v-for="event in monthEvents" :key="String(event.id)" class="event-card" :class="{ 'details-open': expandedEvents.has(String(event.id)), 'is-nested': eventIndent(event) > 0 }" :style="{ '--event-indent': `${eventIndent(event) * 28}px` }">
                  <div class="event-date"><strong>{{ event.date }}</strong><br>{{ event.time || '时间未注明' }}</div>
                  <button class="event-main" type="button" @click="emit('select', event)">
                    <h3 class="event-title">{{ event.title }}</h3>
                    <p class="event-summary">{{ event.summary || '暂无摘要' }}</p>
                    <div class="event-meta">
                      <span class="chip"><PhGitBranch :size="13" aria-hidden="true" />{{ branchName(event.branchId) }}</span>
                      <span v-if="event.location" class="chip"><PhMapPin :size="13" aria-hidden="true" />{{ event.location }}</span>
                      <span v-for="person in event.people.slice(0, 3)" :key="person" class="chip">{{ person }}</span>
                    </div>
                  </button>
                  <div class="event-actions">
                    <button class="icon-btn" type="button" :aria-label="`${expandedEvents.has(String(event.id)) ? '收起' : '展开'} ${event.title} 详情`" :aria-expanded="expandedEvents.has(String(event.id))" @click="toggleDetails(event)"><PhCaretDown :size="18" aria-hidden="true" /></button>
                    <button class="icon-btn" type="button" :aria-label="`导出 ${event.title}`" @click="emit('export', event)"><PhExport :size="18" aria-hidden="true" /></button>
                    <button class="icon-btn" type="button" :aria-label="`编辑 ${event.title}`" @click="emit('edit', event)"><PhPencilSimple :size="18" aria-hidden="true" /></button>
                    <button class="icon-btn" type="button" :aria-label="`删除 ${event.title}`" @click="emit('delete', event)"><PhTrash :size="18" aria-hidden="true" /></button>
                  </div>
                  <div v-if="expandedEvents.has(String(event.id))" class="event-detail"><p>{{ event.content || '暂无正文' }}</p></div>
                </article>
              </div>
            </div>
          </div>
        </Transition>
      </section>
    </section>
  </section>
</template>
