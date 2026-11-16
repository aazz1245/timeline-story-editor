<script setup lang="ts">
import { PhGitBranch, PhPlus } from '@phosphor-icons/vue';
import { computed } from 'vue';
import type { TimelineBranch, TimelineEvent } from '../../shared/types';

const props = defineProps<{ events: TimelineEvent[]; branches: TimelineBranch[] }>();
const emit = defineEmits<{ create: []; select: [event: TimelineEvent] }>();
const rows = computed(() => [
  { id: null, name: '主线', parent: null, events: props.events.filter(event => !event.branchId) },
  ...props.branches.map(branch => ({ id: branch.id, name: branch.name, parent: props.events.find(event => String(event.id) === String(branch.parentEventId)) || null, events: props.events.filter(event => event.branchId === branch.id) })),
]);
</script>

<template>
  <section class="branch-board">
    <div class="view-heading"><div><h2>故事线路</h2><p>按主线与分支查看事件及分歧点。</p></div><button class="btn primary" type="button" @click="emit('create')"><PhPlus :size="17" aria-hidden="true" /><span>新建分支</span></button></div>
    <div v-if="!branches.length" class="empty-state"><strong>暂无线路分支</strong><div>新建分支后，可在这里查看分歧关系。</div></div>
    <section v-for="row in rows" :key="row.id || 'main'" class="branch-card">
      <header class="branch-card-header"><PhGitBranch :size="19" aria-hidden="true" /><strong>{{ row.name }}</strong><span class="chip">{{ row.events.length }} 个事件</span></header>
      <p v-if="row.parent" class="branch-parent">从「{{ row.parent.title }}」分出 · {{ row.parent.date }}</p>
      <p v-else-if="row.id" class="branch-parent">尚未关联分歧点</p>
      <div v-if="row.events.length" class="branch-event-list"><button v-for="event in row.events" :key="String(event.id)" class="branch-event" type="button" @click="emit('select', event)"><time>{{ event.date }} · {{ event.time }}</time><strong>{{ event.title }}</strong><span>{{ event.summary }}</span></button></div>
      <p v-else class="branch-parent">这条线路暂时没有事件。</p>
    </section>
  </section>
</template>
