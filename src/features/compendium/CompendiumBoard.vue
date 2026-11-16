<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { PhArchiveBox, PhMagnifyingGlass, PhPencilSimple, PhPlus, PhTrash } from '@phosphor-icons/vue';
import type { CompendiumItem } from '../../shared/types';
import ModalShell from '../../shared/components/ModalShell.vue';

const props = defineProps<{ items: CompendiumItem[] }>();
const emit = defineEmits<{ save: [items: CompendiumItem[]] }>();
const query = ref('');
const category = ref('全部');
const editing = ref<CompendiumItem | null>(null);
const editorOpen = ref(false);
const draft = reactive<CompendiumItem>({ id: '', name: '', category: '', source: '', details: '' });
const categories = computed(() => ['全部', ...new Set(props.items.map(item => item.category).filter(Boolean))]);
const visibleItems = computed(() => props.items.filter(item => (category.value === '全部' || item.category === category.value) && `${item.name} ${item.category} ${item.source} ${item.details}`.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())));

function openEditor(item?: CompendiumItem) {
  Object.assign(draft, item ? JSON.parse(JSON.stringify(item)) : { id: `item-${crypto.randomUUID()}`, name: '', category: '道具与文书', source: '', details: '', badgeClass: 'badge-item' });
  editing.value = item || null;
  editorOpen.value = true;
}
function saveItem() {
  if (!draft.name.trim()) return;
  const next = props.items.some(item => item.id === draft.id) ? props.items.map(item => item.id === draft.id ? JSON.parse(JSON.stringify(draft)) : item) : [...props.items, JSON.parse(JSON.stringify(draft))];
  emit('save', next);
  editing.value = null;
  editorOpen.value = false;
}
function removeItem(item: CompendiumItem) {
  if (!window.confirm(`删除图鉴条目「${item.name}」？`)) return;
  emit('save', props.items.filter(current => current.id !== item.id));
}
</script>

<template>
  <section>
    <div class="view-heading"><div><h2>物品图鉴</h2><p>{{ items.length }} 项本机图鉴记录 · 支持编辑与固定卡片高度</p></div><div class="toolbar"><button class="btn" type="button" @click="openEditor()"><PhPlus :size="17" aria-hidden="true" />新建条目</button></div></div>
    <div class="compendium-tools"><label class="search-input"><PhMagnifyingGlass :size="17" aria-hidden="true" /><input v-model="query" aria-label="搜索图鉴" placeholder="搜索名称、类别或内容" /></label><select v-model="category" aria-label="图鉴类别"><option v-for="item in categories" :key="item">{{ item }}</option></select></div>
    <div v-if="!visibleItems.length" class="empty-state"><PhArchiveBox :size="26" aria-hidden="true" /><p>暂无图鉴条目</p><small>新建图鉴条目后可在此浏览。</small></div>
    <div class="compendium-grid"><article v-for="item in visibleItems" :key="item.id" class="compendium-card"><div class="compendium-card-head"><h3>{{ item.name }}</h3><span class="chip">{{ item.category || '未分类' }}</span></div><small v-if="item.source">来源：{{ item.source }}</small><p>{{ item.details || '暂无详情' }}</p><div class="compendium-card-actions"><button class="icon-btn" type="button" :aria-label="`编辑图鉴 ${item.name}`" @click="openEditor(item)"><PhPencilSimple :size="17" aria-hidden="true" /></button><button class="icon-btn danger" type="button" :aria-label="`删除图鉴 ${item.name}`" @click="removeItem(item)"><PhTrash :size="17" aria-hidden="true" /></button></div></article></div>
    <ModalShell v-if="editorOpen" :title="editing ? '编辑图鉴条目' : '新建图鉴条目'" heading-id="compendium-editor-title" @close="editorOpen = false; editing = null">
      <form @submit.prevent="saveItem"><div class="form-grid"><div class="field full"><label for="compendium-name">名称</label><input id="compendium-name" v-model="draft.name" required /></div><div class="field"><label for="compendium-category">类别</label><input id="compendium-category" v-model="draft.category" /></div><div class="field"><label for="compendium-source">来源</label><input id="compendium-source" v-model="draft.source" /></div><div class="field full"><label for="compendium-details">详情</label><textarea id="compendium-details" v-model="draft.details" /></div></div><div class="modal-actions"><button class="btn" type="button" @click="editorOpen = false; editing = null">取消</button><button class="btn primary" type="submit">保存条目</button></div></form>
    </ModalShell>
  </section>
</template>
