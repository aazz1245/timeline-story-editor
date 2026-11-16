<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { TimelineBranch, TimelineEvent } from '../../shared/types';
import { createDefaultBodyData } from '../../shared/domain/normalize';
import ModalShell from '../../shared/components/ModalShell.vue';
import BodyDataForm from '../../shared/components/BodyDataForm.vue';

const props = defineProps<{ event: TimelineEvent | null; branches: TimelineBranch[]; events: TimelineEvent[] }>();
const emit = defineEmits<{ close: []; save: [event: TimelineEvent, branch?: TimelineBranch] }>();
const form = reactive<TimelineEvent>({ id: '', title: '', date: '', time: '上午', location: '', summary: '', content: '', people: [], peopleData: {}, order: 0, branchId: null });
const createBranchOption = '__create_branch__';
const newBranchName = ref('');
const branchParent = ref('');
const peopleInput = ref('');
const peopleNames = computed(() => peopleInput.value.split(/[,，]/).map(name => name.trim()).filter(Boolean));
function profileFor(name: string) {
  if (!form.peopleData[name]) form.peopleData[name] = createDefaultBodyData();
  return form.peopleData[name];
}
watch(() => props.event, event => {
  Object.assign(form, event ? JSON.parse(JSON.stringify(event)) : { id: crypto.randomUUID(), title: '', date: new Date().toISOString().slice(0, 10).replaceAll('-', '/'), time: '上午', location: '', summary: '', content: '', people: [], peopleData: {}, order: 0, branchId: null });
  peopleInput.value = (event?.people || []).join(', ');
  newBranchName.value = '';
  branchParent.value = '';
}, { immediate: true });
watch(peopleNames, names => names.forEach(profileFor), { immediate: true });
function submit() {
  let branch: TimelineBranch | undefined;
  let branchId = form.branchId;
  if (branchId === createBranchOption) {
    if (!newBranchName.value.trim()) return;
    branch = { id: `branch-${crypto.randomUUID()}`, name: newBranchName.value.trim(), parentEventId: branchParent.value || null };
    branchId = branch.id;
  }
  const people = [...peopleNames.value];
  const peopleData = Object.fromEntries(people.map(name => [name, profileFor(name)]));
  emit('save', { ...form, branchId, people, peopleData, date: form.date.replaceAll('-', '/'), title: form.title.trim(), summary: form.summary.trim() }, branch);
}
</script>

<template>
  <ModalShell :title="event ? '编辑事件' : '新建事件'" heading-id="event-modal-title" @close="emit('close')">
      <form @submit.prevent="submit">
        <div class="form-grid">
          <div class="field full"><label for="event-title">标题</label><input id="event-title" v-model="form.title" required autofocus /></div>
          <div class="field"><label for="event-date">日期</label><input id="event-date" v-model="form.date" placeholder="YYYY/MM/DD" required /></div>
          <div class="field"><label for="event-time">时段</label><select id="event-time" v-model="form.time"><option v-for="time in ['凌晨','清晨','上午','中午','下午','黄昏','晚上','深夜']" :key="time">{{ time }}</option></select></div>
          <div class="field"><label for="event-branch">线路</label><select id="event-branch" v-model="form.branchId"><option :value="null">主线</option><option v-for="branch in branches" :key="branch.id" :value="branch.id">{{ branch.name }}</option><option :value="createBranchOption">＋ 新建分支…</option></select></div>
          <div class="field"><label for="event-location">地点</label><input id="event-location" v-model="form.location" /></div>
          <div class="field full"><label for="event-summary">摘要</label><input id="event-summary" v-model="form.summary" /></div>
          <div class="field full"><label for="event-people">人物</label><input id="event-people" v-model="peopleInput" placeholder="用逗号分隔人物名称" /></div>
          <div v-if="peopleNames.length" class="field full profile-section">
            <div class="profile-section-heading"><strong>人物档案</strong><small>保存本事件中每个人物的身体与穿着数据</small></div>
            <details v-for="person in peopleNames" :key="person" class="profile-disclosure">
              <summary>{{ person }} 的身体数据</summary>
              <BodyDataForm v-model="form.peopleData[person]" :person-name="person" compact />
            </details>
          </div>
          <template v-if="form.branchId === createBranchOption">
            <div class="field"><label for="branch-name">新分支名称</label><input id="branch-name" v-model="newBranchName" required /></div>
            <div class="field"><label for="branch-parent">从哪个事件分出</label><select id="branch-parent" v-model="branchParent"><option value="">暂不关联</option><option v-for="item in events" :key="String(item.id)" :value="String(item.id)">{{ item.date }} · {{ item.title }}</option></select></div>
          </template>
          <div class="field full"><label for="event-content">正文</label><textarea id="event-content" v-model="form.content" /></div>
        </div>
        <div class="modal-actions"><button class="btn" type="button" @click="emit('close')">取消</button><button class="btn primary" type="submit">保存事件</button></div>
      </form>
  </ModalShell>
</template>
