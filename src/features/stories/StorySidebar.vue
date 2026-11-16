<script setup lang="ts">
import { PhPlus, PhArchiveBox, PhGear, PhPencilSimple, PhTrash } from '@phosphor-icons/vue';
import type { StorySummary } from '../../shared/types';

defineProps<{ stories: StorySummary[]; selectedId: string; loading?: boolean }>();
const emit = defineEmits<{ select: [id: string]; create: []; settings: []; rename: [id: string]; remove: [id: string] }>();
</script>

<template>
  <aside class="sidebar" aria-label="故事导航">
    <div class="brand"><span class="brand-mark">T</span><strong>故事时间线</strong></div>
    <section class="sidebar-section">
      <span class="section-label">Stories</span>
      <div class="story-list" role="listbox" aria-label="故事列表">
        <div v-for="story in stories" :key="story.storyId" class="story-row" :class="{ active: story.storyId === selectedId }" role="option" :aria-selected="story.storyId === selectedId">
          <button class="story-item" type="button" @click="emit('select', story.storyId)"><PhArchiveBox :size="17" weight="regular" aria-hidden="true" /><span>{{ story.storyName }}</span><small>{{ story.eventCount }}</small></button>
          <div class="story-actions"><button class="story-action" type="button" :aria-label="`重命名 ${story.storyName}`" @click="emit('rename', story.storyId)"><PhPencilSimple :size="15" aria-hidden="true" /></button><button class="story-action" type="button" :aria-label="`删除 ${story.storyName}`" @click="emit('remove', story.storyId)"><PhTrash :size="15" aria-hidden="true" /></button></div>
        </div>
        <p v-if="!stories.length && !loading" class="empty-state" style="padding: 20px 10px; border: 0;">暂无故事</p>
      </div>
    </section>
    <div class="sidebar-footer">
      <button class="btn primary" type="button" @click="emit('create')"><PhPlus :size="18" aria-hidden="true" /><span>新建故事</span></button>
      <button class="btn ghost" type="button" @click="emit('settings')"><PhGear :size="18" aria-hidden="true" /><span>本机设置</span></button>
    </div>
  </aside>
</template>
