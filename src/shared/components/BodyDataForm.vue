<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { TimelineBodyData } from '../types';
import { createDefaultBodyData } from '../domain/normalize';

const props = withDefaults(defineProps<{ modelValue: TimelineBodyData; personName?: string; compact?: boolean }>(), { personName: '', compact: false });
const emit = defineEmits<{ 'update:modelValue': [value: TimelineBodyData] }>();
const draft = reactive<TimelineBodyData>(createDefaultBodyData());

Object.assign(draft, JSON.parse(JSON.stringify({ ...createDefaultBodyData(), ...props.modelValue })));
watch(draft, value => emit('update:modelValue', JSON.parse(JSON.stringify(value))), { deep: true });

const accessories = computed({
  get: () => draft.specialAccessories.map(item => item.type).join(', '),
  set: value => { draft.specialAccessories = value.split(/[,，]/).map(item => item.trim()).filter(Boolean).map(type => ({ type })); },
});
</script>

<template>
  <section class="body-data-form" :class="{ compact }" :aria-label="personName ? `${personName} 的身体数据` : '身体数据'">
    <div v-if="personName" class="body-data-heading"><strong>{{ personName }} 的身体数据</strong><label class="body-data-npc"><input v-model="draft.isNPC" type="checkbox" /> NPC</label></div>
    <div class="body-data-grid">
      <div class="field"><label :for="`${personName}-underwear`">内衣款式</label><input :id="`${personName}-underwear`" v-model="draft.underwear" /></div>
      <div class="field"><label :for="`${personName}-top`">上衣</label><input :id="`${personName}-top`" v-model="draft.top" /></div>
      <div class="field"><label :for="`${personName}-bottom`">下装</label><input :id="`${personName}-bottom`" v-model="draft.bottom" /></div>
      <div class="field"><label :for="`${personName}-socks`">袜饰</label><input :id="`${personName}-socks`" v-model="draft.socks" /></div>
      <div class="field"><label :for="`${personName}-shoes`">鞋履</label><input :id="`${personName}-shoes`" v-model="draft.shoes" /></div>
      <div class="field"><label :for="`${personName}-cage`">特殊饰品/锁具</label><input :id="`${personName}-cage`" v-model="draft.cage" /></div>
      <div class="field full"><label :for="`${personName}-accessories`">其他饰品</label><input :id="`${personName}-accessories`" v-model="accessories" placeholder="用逗号分隔" /></div>
      <div class="field"><label :for="`${personName}-bust`">胸围 (cm)</label><input :id="`${personName}-bust`" v-model.number="draft.bustSize" type="number" min="0" max="200" /></div>
      <div class="field"><label :for="`${personName}-cup`">罩杯</label><input :id="`${personName}-cup`" v-model="draft.cup" /></div>
      <div class="field"><label :for="`${personName}-state`">状态</label><select :id="`${personName}-state`" v-model="draft.penisState"><option>未勃起</option><option>勃起</option></select></div>
      <div class="field"><label :for="`${personName}-length`">尺寸 (cm)</label><input :id="`${personName}-length`" v-model.number="draft.penisLength" type="number" min="0" max="50" step="0.5" /></div>
    </div>
  </section>
</template>
