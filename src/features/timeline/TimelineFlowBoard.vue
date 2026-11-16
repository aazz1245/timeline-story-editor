<script setup lang="ts">
import { computed, ref } from 'vue';
import { PhCaretDown, PhCaretRight, PhExport, PhGitBranch, PhPencilSimple } from '@phosphor-icons/vue';
import type { StoryPeriod, TimelineBranch, TimelineEvent } from '../../shared/types';

const props = defineProps<{ events: TimelineEvent[]; branches: TimelineBranch[]; stages: StoryPeriod[] }>();
const emit = defineEmits<{ select: [event: TimelineEvent]; edit: [event: TimelineEvent]; export: [event: TimelineEvent] }>();
const selectedStageId = ref<string | null>(null);
const expandedDays = ref(new Set<string>());
const palette = ['#2563eb', '#0f766e', '#c2410c', '#7c3aed', '#be123c', '#4d7c0f'];

const lines = computed(() => [{ id: null as string | null, name: '主线', color: '#2563eb' }, ...props.branches.map((branch, index) => ({ id: branch.id, name: branch.name, color: branch.themeColor || palette[index % palette.length] }))]);
const inStage = (event: TimelineEvent) => {
  if (!selectedStageId.value) return true;
  const stage = props.stages.find(item => item.id === selectedStageId.value);
  return !stage || (event.date >= stage.startDate && event.date <= stage.endDate);
};
const visibleEvents = computed(() => props.events.filter(inStage));
const dates = computed(() => [...new Set(visibleEvents.value.map(event => event.date))].sort((a, b) => a.localeCompare(b)));
const eventsFor = (lineId: string | null, date: string) => visibleEvents.value.filter(event => (event.branchId || null) === lineId && event.date === date).sort((a, b) => a.time.localeCompare(b.time) || a.order - b.order);
const dayKey = (lineId: string | null, date: string) => `${lineId || 'main'}:${date}`;
const monthLabel = (date: string) => date ? `${date.slice(0, 4)}年${date.slice(5, 7)}月` : '未定日期';
function toggleDay(lineId: string | null, date: string) {
  const key = dayKey(lineId, date);
  const next = new Set(expandedDays.value);
  next.has(key) ? next.delete(key) : next.add(key);
  expandedDays.value = next;
}
</script>

<template>
  <section class="flow-board" aria-label="时间流">
    <header class="flow-header">
      <div><div class="eyebrow">STORY FLOW</div><h2>故事时间流</h2><p>{{ visibleEvents.length }} 个事件 · {{ lines.length }} 条线路 · 横向浏览分歧关系</p></div>
      <div class="flow-legend"><span v-for="line in lines" :key="line.id || 'main'" class="flow-legend-item" :style="{ '--line-color': line.color }"><i />{{ line.name }}</span></div>
    </header>
    <div v-if="stages.length" class="flow-stage-bar"><button class="flow-stage-chip" :class="{ active: !selectedStageId }" type="button" @click="selectedStageId = null">全部阶段</button><button v-for="stage in stages" :key="stage.id" class="flow-stage-chip" :class="{ active: selectedStageId === stage.id }" type="button" @click="selectedStageId = selectedStageId === stage.id ? null : stage.id"><strong>{{ stage.name }}</strong><small>{{ stage.startDate }} — {{ stage.endDate }}</small></button></div>
    <div v-if="!dates.length" class="empty-state"><strong>暂无可显示事件</strong><div>导入 Markdown 或新建事件后，时间流会自动生成。</div></div>
    <div v-else class="flow-scroll" tabindex="0" aria-label="横向时间流">
      <div class="flow-grid" :style="{ '--flow-columns': dates.length }">
        <div class="flow-date-row"><span class="flow-axis-label">线路 / 日期</span><span v-for="date in dates" :key="date" class="flow-date"><strong>{{ date }}</strong><small>{{ monthLabel(date) }}</small></span></div>
        <section v-for="line in lines" :key="line.id || 'main'" class="flow-line" :style="{ '--line-color': line.color }">
          <header class="flow-line-label"><PhGitBranch :size="17" aria-hidden="true" /><div><strong>{{ line.name }}</strong><small>{{ line.id ? '分支线路' : '故事主线' }}</small></div></header>
          <div v-for="date in dates" :key="date" class="flow-cell">
            <template v-if="eventsFor(line.id, date).length">
              <div class="flow-event-stack" :class="{ expanded: expandedDays.has(dayKey(line.id, date)) }">
                <button v-for="event in (expandedDays.has(dayKey(line.id, date)) ? eventsFor(line.id, date) : eventsFor(line.id, date).slice(0, 1))" :key="String(event.id)" class="flow-event" type="button" @click="emit('select', event)"><span class="flow-event-time">{{ event.time || '时间未注明' }}</span><strong>{{ event.title }}</strong><small>{{ event.summary || '暂无摘要' }}</small><span class="flow-event-actions"><span role="button" tabindex="0" :aria-label="`编辑 ${event.title}`" @click.stop="emit('edit', event)"><PhPencilSimple :size="14" aria-hidden="true" /></span><span role="button" tabindex="0" :aria-label="`导出 ${event.title}`" @click.stop="emit('export', event)"><PhExport :size="14" aria-hidden="true" /></span></span></button>
              </div>
              <button v-if="eventsFor(line.id, date).length > 1" class="flow-day-toggle" type="button" :aria-expanded="expandedDays.has(dayKey(line.id, date))" @click="toggleDay(line.id, date)">{{ expandedDays.has(dayKey(line.id, date)) ? '收起同日事件' : `展开同日 ${eventsFor(line.id, date).length} 个事件` }}<PhCaretDown v-if="expandedDays.has(dayKey(line.id, date))" :size="13" aria-hidden="true" /><PhCaretRight v-else :size="13" aria-hidden="true" /></button>
            </template>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
