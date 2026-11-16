<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { PhPlus, PhTrash } from '@phosphor-icons/vue';
import type { StoryPeriod } from '../../shared/types';
import ModalShell from '../../shared/components/ModalShell.vue';

const props = defineProps<{ stages: StoryPeriod[] }>();
const emit = defineEmits<{ close: []; save: [stages: StoryPeriod[]] }>();
const draft = reactive<StoryPeriod[]>([]);
const error = ref('');
watch(() => props.stages, stages => { draft.splice(0, draft.length, ...JSON.parse(JSON.stringify(stages))); }, { immediate: true });
function add() { draft.push({ id: `stage-${crypto.randomUUID()}`, name: '新阶段', startDate: '', endDate: '' }); }
function remove(id: string) { const index = draft.findIndex(stage => stage.id === id); if (index >= 0) draft.splice(index, 1); }
function submit() {
  const ordered = [...draft].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (ordered.some(stage => !stage.name.trim() || !stage.startDate || !stage.endDate || stage.startDate > stage.endDate)) { error.value = '请填写有效的阶段名称和日期范围。'; return; }
  if (ordered.some((stage, index) => index && stage.startDate <= ordered[index - 1].endDate)) { error.value = '阶段日期不能重叠。'; return; }
  emit('save', JSON.parse(JSON.stringify(ordered)));
}
</script>

<template>
  <ModalShell title="阶段设置" heading-id="stage-title" @close="emit('close')">
      <template #subtitle><p>按日期范围折叠浏览时间线。</p></template>
      <div v-if="!draft.length" class="empty-state">还没有故事阶段。</div>
      <article v-for="stage in draft" :key="stage.id" class="stage-editor-row">
        <div class="field"><label :for="`${stage.id}-name`">阶段名称</label><input :id="`${stage.id}-name`" v-model="stage.name" required /></div>
        <div class="field"><label :for="`${stage.id}-start`">开始日期</label><input :id="`${stage.id}-start`" v-model="stage.startDate" placeholder="YYYY/MM/DD" required /></div>
        <div class="field"><label :for="`${stage.id}-end`">结束日期</label><input :id="`${stage.id}-end`" v-model="stage.endDate" placeholder="YYYY/MM/DD" required /></div>
        <button class="icon-btn danger" type="button" :aria-label="`删除阶段 ${stage.name}`" @click="remove(stage.id)"><PhTrash :size="18" aria-hidden="true" /></button>
      </article>
      <button class="btn" type="button" @click="add"><PhPlus :size="17" aria-hidden="true" />添加阶段</button>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="modal-actions"><button class="btn" type="button" @click="emit('close')">取消</button><button class="btn primary" type="button" @click="submit">保存阶段</button></div>
  </ModalShell>
</template>
