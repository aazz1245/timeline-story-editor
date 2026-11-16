<script setup lang="ts">
import { computed, ref } from 'vue';
import { PhArchiveBox, PhDownloadSimple, PhMagnifyingGlass, PhUploadSimple } from '@phosphor-icons/vue';
import type { CompendiumItem } from '../../shared/types';

const props = defineProps<{ items: CompendiumItem[] }>();
const emit = defineEmits<{ import: [file: File]; export: [] }>();
const query = ref('');
const category = ref('全部');
const categories = computed(() => ['全部', ...new Set(props.items.map(item => item.category).filter(Boolean))]);
const visibleItems = computed(() => props.items.filter(item => (category.value === '全部' || item.category === category.value) && `${item.name} ${item.category} ${item.source} ${item.details}`.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())));
</script>

<template>
  <section>
    <div class="view-heading"><div><h2>物品图鉴</h2><p>{{ items.length }} 项本机图鉴记录</p></div><div class="toolbar"><label class="btn"><PhUploadSimple :size="17" aria-hidden="true" /><span>导入 JSON</span><input type="file" accept=".json,application/json" hidden @change="event => { const file = (event.target as HTMLInputElement).files?.[0]; if (file) emit('import', file); }" /></label><button class="btn" type="button" @click="emit('export')"><PhDownloadSimple :size="17" aria-hidden="true" /><span>导出 JSON</span></button></div></div>
    <div class="compendium-tools"><label class="search-input"><PhMagnifyingGlass :size="17" aria-hidden="true" /><input v-model="query" aria-label="搜索图鉴" placeholder="搜索名称、类别或内容" /></label><select v-model="category" aria-label="图鉴类别"><option v-for="item in categories" :key="item">{{ item }}</option></select></div>
    <div v-if="!visibleItems.length" class="empty-state"><PhArchiveBox :size="26" aria-hidden="true" /><p>暂无图鉴条目</p><small>导入本机 JSON 图鉴后可在此浏览。</small></div>
    <div class="compendium-grid"><article v-for="item in visibleItems" :key="item.id" class="compendium-card"><div class="compendium-card-head"><h3>{{ item.name }}</h3><span class="chip">{{ item.category }}</span></div><small v-if="item.source">来源：{{ item.source }}</small><p>{{ item.details }}</p></article></div>
  </section>
</template>
