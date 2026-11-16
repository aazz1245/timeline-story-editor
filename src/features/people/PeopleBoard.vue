<script setup lang="ts">
import { computed, ref } from 'vue';
import { PhUserCircle, PhPlus } from '@phosphor-icons/vue';
import type { StoryArchive } from '../../shared/types';

const props = defineProps<{ story: StoryArchive }>();
const emit = defineEmits<{ save: [story: StoryArchive] }>();
const filter = ref('');
const people = computed(() => {
  const names = new Set<string>(props.story.mainCharacters.map(person => person.name));
  props.story.events.forEach(event => event.people.forEach(name => names.add(name)));
  return [...names].filter(name => name.toLocaleLowerCase().includes(filter.value.trim().toLocaleLowerCase())).map(name => ({
    name,
    appearances: props.story.events.filter(event => event.people.includes(name)).length,
    profile: props.story.mainCharacters.find(person => person.name === name),
  }));
});
function addPerson() {
  const name = window.prompt('人物名称');
  if (!name?.trim() || props.story.mainCharacters.some(person => person.name === name.trim())) return;
  emit('save', { ...props.story, mainCharacters: [...props.story.mainCharacters, { name: name.trim(), notes: '' }] });
}
</script>

<template>
  <section>
    <div class="view-heading"><div><h2>人物</h2><p>{{ people.length }} 位人物 · 按故事内登场记录汇总</p></div><div class="toolbar"><input v-model="filter" class="search-input" aria-label="筛选人物" placeholder="筛选人物" /><button class="btn primary" type="button" @click="addPerson"><PhPlus :size="17" aria-hidden="true" /><span>添加人物</span></button></div></div>
    <div v-if="!people.length" class="empty-state">当前故事还没有人物记录。</div>
    <div class="people-grid"><article v-for="person in people" :key="person.name" class="person-card"><PhUserCircle :size="25" weight="duotone" aria-hidden="true" /><div><h3>{{ person.name }}</h3><p>{{ person.profile?.notes || '尚无人物备注' }}</p><small>{{ person.appearances }} 次登场</small></div></article></div>
  </section>
</template>
