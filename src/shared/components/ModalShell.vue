<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { PhX } from '@phosphor-icons/vue';

const props = defineProps<{ title: string; headingId: string }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLElement>();

onMounted(() => {
  dialog.value?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select, button')?.focus();
});

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
    return;
  }
  if (event.key !== 'Tab') return;
  const controls = [...(dialog.value?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])]
    .filter(element => element.offsetParent !== null);
  if (!controls.length) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
</script>

<template>
  <div class="modal-backdrop" role="presentation" @click.self="emit('close')">
    <section ref="dialog" class="modal" role="dialog" aria-modal="true" :aria-labelledby="props.headingId" @keydown="handleKeydown">
      <header class="modal-header">
        <div><h2 :id="props.headingId">{{ props.title }}</h2><slot name="subtitle" /></div>
        <button class="icon-btn" type="button" aria-label="关闭" @click="emit('close')"><PhX :size="20" aria-hidden="true" /></button>
      </header>
      <slot />
    </section>
  </div>
</template>
