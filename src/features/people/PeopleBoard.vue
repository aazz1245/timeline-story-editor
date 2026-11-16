<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, watch } from 'vue';
import { PhPlus, PhTrash, PhCheck } from '@phosphor-icons/vue';
import type { StoryArchive, TimelinePerson } from '../../shared/types';
import { calculateCup } from '../../shared/domain/normalize';

const props = defineProps<{ story: StoryArchive }>();
const emit = defineEmits<{ save: [story: StoryArchive] }>();
const draft = reactive<TimelinePerson[]>([]);
let syncing = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
watch(() => props.story.mainCharacters, people => {
  syncing = true;
  draft.splice(0, draft.length, ...JSON.parse(JSON.stringify(people)));
  void nextTick(() => { syncing = false; });
}, { immediate: true, deep: true });

function addPerson() {
  draft.push({ name: '新人物', height: 170, upperBust: 80, lowerBust: 68, waist: 65, hip: 90, penisNormal: 8, penisErect: 12, notes: '' });
}
function removePerson(index: number) { draft.splice(index, 1); }
function clearSaveTimer() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = undefined; }
}
function save() {
  clearSaveTimer();
  const people = JSON.parse(JSON.stringify(draft)) as TimelinePerson[];
  const events = props.story.events.map(event => {
    const peopleData = { ...event.peopleData };
    for (const person of people) {
      const profile = peopleData[person.name];
      if (profile && !profile.isNPC) {
        const upperBust = Number(person.upperBust ?? profile.bustSize);
        const lowerBust = Number(person.lowerBust ?? 0);
        peopleData[person.name] = { ...profile, bustSize: upperBust, cup: calculateCup(upperBust, lowerBust) };
      }
    }
    return { ...event, peopleData };
  });
  emit('save', { ...props.story, mainCharacters: people, events });
}
watch(draft, () => {
  if (syncing) return;
  clearSaveTimer();
  saveTimer = setTimeout(() => { saveTimer = undefined; save(); }, 700);
}, { deep: true });
onBeforeUnmount(() => {
  if (saveTimer) save();
  else clearSaveTimer();
});
</script>

<template>
  <section class="people-board">
    <div class="view-heading"><div><h2>人物基础数据档案</h2><p>维护主要人物的身高、三围与尺寸设定。</p></div><div class="toolbar"><button class="btn" type="button" @click="addPerson"><PhPlus :size="17" aria-hidden="true" />添加人物</button><button class="btn primary" type="button" @click="save"><PhCheck :size="17" aria-hidden="true" />保存数据</button></div></div>
    <div v-if="!draft.length" class="empty-state"><strong>暂无人物设定</strong><div>添加人物后可直接编辑基础数据档案。</div></div>
    <div v-else class="body-table-wrap">
      <table class="body-table">
        <thead><tr><th>人物</th><th>身高</th><th>上胸围</th><th>下胸围</th><th>罩杯</th><th>腰围</th><th>臀围</th><th>常态尺寸</th><th>勃起尺寸</th><th>备注</th><th aria-label="操作" /></tr></thead>
        <tbody>
          <tr v-for="(person, index) in draft" :key="index">
            <td><input v-model="person.name" :aria-label="`人物 ${index + 1} 名称`" /></td>
            <td><input v-model.number="person.height" type="number" min="0" max="250" aria-label="身高" /></td>
            <td><input v-model.number="person.upperBust" type="number" min="0" max="200" aria-label="上胸围" /></td>
            <td><input v-model.number="person.lowerBust" type="number" min="0" max="200" aria-label="下胸围" /></td>
            <td><output>{{ calculateCup(person.upperBust, person.lowerBust) }}</output></td>
            <td><input v-model.number="person.waist" type="number" min="0" max="200" aria-label="腰围" /></td>
            <td><input v-model.number="person.hip" type="number" min="0" max="200" aria-label="臀围" /></td>
            <td><input v-model.number="person.penisNormal" type="number" min="0" max="50" step="0.5" aria-label="常态尺寸" /></td>
            <td><input v-model.number="person.penisErect" type="number" min="0" max="50" step="0.5" aria-label="勃起尺寸" /></td>
            <td><input v-model="person.notes" aria-label="人物备注" /></td>
            <td><button class="icon-btn danger" type="button" :aria-label="`删除人物 ${person.name}`" @click="removePerson(index)"><PhTrash :size="17" aria-hidden="true" /></button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
